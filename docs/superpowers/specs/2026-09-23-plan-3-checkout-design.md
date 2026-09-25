# Plan 3 — Checkout & Booking Creation — Design Spec

**Date:** 2026-09-23
**Status:** Approved
**Depends on:** Plans 1 & 2 (foundation, auth, browse)
**Stack:** Next.js 14 App Router · Server Components + Server Actions · Supabase JS SSR · Postgres function for atomic booking · Zod · shadcn/ui

---

## 1. Scope

Plan 3 delivers **end-to-end booking**: a customer clicking Reserve on a vehicle detail page walks through six steps and lands on a confirmation with a booking reference. `/account` shows their bookings.

**In scope:**
1. Six-step checkout wizard (dates, driver, extras, review, payment, confirmation).
2. Server-only pricing calculator (`lib/pricing.ts`) — client never sees per-line prices.
3. Atomic booking creation via a Postgres function that inserts `bookings` + `vehicle_availability` + `booking_extras` in one transaction, relying on the existing exclusion constraint to prevent double-booking.
4. Zod-validated driver info plus server-side business rules (age ≥ 25 at pickup, license not expired, dates coherent, min/max rental days).
5. Mock payment — card form with client-side format validation, server always records `payments.method='mock'`, `status='completed'`.
6. Promo code text input at Step 3 (extras). Server validates against `promo_codes` table.
7. Confirmation page with reference `WBS-<YYYY>-<6 alpha-numeric>`.
8. `/account` bookings list — replaces Plan 1 stub with a real table (reference, vehicle, dates, status, total).
9. Middleware already redirects unauthenticated `/checkout/*` → login (Plan 2 preserved the query string).

**Out of scope (deferred):**
- Booking detail page `/account/bookings/[id]` (Plan 4)
- Cancellation / refund flow
- Real Stripe integration (env var scaffolded but not wired)
- Test-card success/fail simulation
- Customer documents upload
- Booking status transitions past `confirmed` (management console — Plan 5)
- Email notifications actually sending (rows in `notifications` may be created; no SMTP)

---

## 2. Architecture

**Wizard shape:** route group `app/(customer)/checkout/` with one page per step. Each is a Server Component. Route order is enforced by a `assertStepPrereqs()` helper called from each step; missing prerequisites redirect back to the earliest incomplete step.

**State locality:**
- **Steps 1–3:** URL search params only, no DB write. Bookmarkable, back-button safe, no cleanup burden. URL is long but well under browser limits.
- **Step 4 → Step 5 boundary:** server action `createDraftBooking` writes one `bookings` row (`status='pending'`) plus one `vehicle_availability` row plus any `booking_extras` rows, atomically via a Postgres function. Redirect carries `booking_ref`.
- **Step 5 → Step 6 boundary:** server action `confirmPayment` writes one `payments` row and flips the booking to `status='confirmed'`. Redirect to confirmation page.

**Why two DB writes (not one):** the booking needs to exist before the payment form renders — the customer is paying for a specific booking. If they abandon at payment, the booking sits at `status='pending'` and the availability row is still held; correct semantics (dates are reserved), and future work can auto-release stale pending bookings.

**Atomic booking creation:** new Postgres function `create_booking_with_availability(p_booking JSONB)` runs the three inserts in a single transaction. If the exclusion constraint on `vehicle_availability` fires (dates overlap another booking), the whole transaction rolls back, no partial state. Marked `SECURITY DEFINER` because customers have no direct INSERT policy on `vehicle_availability` (staff-only per Plan 1 migration 023); the function is the trusted seam.

**Rendering pattern:** Server Components fetch and render. Client Components handle forms + interactive bits (card input formatting, extras checkboxes, promo input, back link).

---

## 3. File Map

```
app/(customer)/checkout/
├── page.tsx                             # NEW: /checkout redirects to /checkout/dates
├── layout.tsx                           # NEW: step-indicator wrapper + guard helper
├── error.tsx                            # NEW: local error boundary
├── dates/page.tsx                       # NEW: Step 1
├── driver/page.tsx                      # NEW: Step 2
├── extras/page.tsx                      # NEW: Step 3
├── review/page.tsx                      # NEW: Step 4
├── payment/page.tsx                     # NEW: Step 5
└── confirmation/[ref]/page.tsx          # NEW: Step 6

app/(customer)/account/
└── page.tsx                             # UPDATE: replace stub with bookings list

components/customer/checkout/
├── step-indicator.tsx                   # server, 6-dot progress
├── back-link.tsx                        # client
├── date-picker-form.tsx                 # client (dates + pickup_method + optional location)
├── driver-form.tsx                      # client (7 fields)
├── extras-form.tsx                      # client (plan radios + extras checkboxes + promo input)
├── review-summary.tsx                   # server (calls calculatePricing)
├── payment-form.tsx                     # client (card fields)
└── booking-summary-card.tsx             # server (small "you're booking X" recap)

components/customer/account/
└── bookings-table.tsx                   # server

lib/
├── pricing.ts                           # calculatePricing() — server-only
├── booking-reference.ts                 # generateBookingReference()
├── queries/
│   ├── bookings.ts                      # getBookingByRef, listMyBookings
│   ├── extras.ts                        # listActiveExtras, listActivePlans
│   └── promo-codes.ts                   # validateAndFetchPromo
├── actions/
│   └── checkout.ts                      # createDraftBooking, confirmPayment
└── validators/
    └── checkout.ts                      # Zod schemas per step + composite

supabase/migrations/
└── 024_create_booking_function.sql      # NEW: atomic create_booking_with_availability

scripts/
├── smoke-test-checkout.mjs              # NEW: end-to-end booking test
└── (no changes to smoke-test-auth.mjs or smoke-test-browse.mjs)
```

**Entry point:** the Reserve button from Plan 2 (`components/customer/vehicles/pricing-card.tsx`) already links to `/checkout?vehicle=<id>`. Plan 3 makes `/checkout` redirect to `/checkout/dates?vehicle=<id>`.

---

## 4. Pricing Calculator

`lib/pricing.ts` exports one function:

```ts
export type PricingInput = {
  vehicle_id: string;
  pickup_date: string;        // ISO YYYY-MM-DD
  return_date: string;
  pickup_method: 'pickup' | 'delivery';
  pickup_location_id: string | null;
  protection_plan_id: string | null;
  extras: { extra_id: string; quantity: number }[];
  promo_code: string | null;
};

export type PricingOutput = {
  rental_days: number;
  base_price: number;
  protection_fee: number;
  extras_fee: number;
  delivery_fee: number;
  subtotal: number;
  discount_amount: number;
  tax_amount: number;
  deposit_amount: number;
  total_amount: number;
  breakdown: { label: string; value: number }[];
  promo_valid: boolean;
  promo_error: string | null;
  // For persisting the booking:
  promo_code_id: string | null;
};

export async function calculatePricing(input: PricingInput): Promise<PricingOutput>;
```

**Rules:**
- `rental_days = ceil((return - pickup) / 1 day)`. Fractional days round up. Enforced against `vehicle.min_rental_days` and `max_rental_days`.
- **Best-price base fare:** if `rental_days >= 30` and `monthly_price` set → `base = monthly_price × floor(days/30) + daily_price × (days%30)`; else if `rental_days >= 7` and `weekly_price` set → `base = weekly_price × floor(days/7) + daily_price × (days%7)`; else `base = daily_price × days`. Always the lowest of the applicable tiers.
- **Protection:** `daily_price(plan) × rental_days` if `protection_plan_id` set, else 0.
- **Extras:** per_day = `extras.price × quantity × rental_days`; flat = `extras.price × quantity`. Sum.
- **Delivery fee:** if `pickup_method='delivery'`, look up `vehicle_locations.delivery_fee` for `pickup_location_id`. If location doesn't allow delivery, return `promo_error`-style validation failure (this rule enforced by caller).
- **Subtotal:** base + protection + extras + delivery.
- **Promo:** if `promo_code` provided, look up. Reject if `!is_active`, `expires_at < now`, or `used_count >= max_uses`. Compute discount: percentage → `subtotal × value / 100`; fixed → `min(value, subtotal)`. If invalid, `promo_valid=false`, `discount_amount=0`, `promo_error` set.
- **Tax:** `(subtotal - discount) × tax_rate`. `tax_rate` read from `application_settings` where `key='tax_rate'` (currently `0.08`).
- **Deposit:** `vehicle.deposit_amount`. Informational; **not** included in `total_amount`.
- **Total:** `subtotal - discount + tax`.

Called from:
- `/checkout/review` (Server Component, for display)
- `createDraftBooking` server action (source of truth for the DB row)
- `/checkout/confirmation` (verification-only render; booking already has totals)

Client never sees line-item pricing as inputs. All numbers come from server computation.

---

## 5. Booking Creation Function

**Migration 024** creates a Postgres function that runs, inside one transaction:
1. INSERT `bookings` row
2. INSERT `vehicle_availability` row (`type='booking'`, `reference_id=bookings.id`)
3. INSERT `booking_extras` rows from the payload's `extras` JSONB array
4. UPDATE `promo_codes.used_count = used_count + 1` if a `promo_code_id` was supplied

Signature:

```sql
create_booking_with_availability(p_booking JSONB) RETURNS TEXT
-- Returns the booking reference on success.
-- Raises on conflict (exclusion_violation) or constraint failure.
```

Marked `SECURITY DEFINER SET search_path = public`. Grants EXECUTE to `authenticated`.

Called from `createDraftBooking` via `supabase.rpc("create_booking_with_availability", { p_booking })`. On success, redirect to payment step. On `exclusion_violation` or `check_violation`, return a user-friendly error.

---

## 6. Server Actions

`lib/actions/checkout.ts`:

### `createDraftBooking(formData)`
Called from `/checkout/review` submit.

1. Zod-validate whole payload (all step-1..3 data).
2. Business rules:
   - Age at pickup ≥ 25 (compute from `driver_dob` and `pickup_date`)
   - `license_expiry > pickup_date`
   - `return_date > pickup_date`
   - `rental_days ∈ [vehicle.min_rental_days, vehicle.max_rental_days]`
   - `pickup_method='delivery'` implies `pickup_location_id` where `vehicle_locations.delivery_available = true`
   - Vehicle `status = 'available'`
3. Call `calculatePricing()`. Take the returned totals — never trust the client.
4. Generate `WBS-YYYY-XXXXXX`. Retry once on collision.
5. `supabase.rpc("create_booking_with_availability", { p_booking })`.
6. On success: `redirect("/checkout/payment?booking_ref=" + ref)`.
7. On `exclusion_violation`: `{ error: "These dates were just taken. Please pick different dates.", field: "pickup_date" }`.
8. Other errors: `{ error }`.

### `confirmPayment(formData)`
Called from `/checkout/payment` submit.

1. Zod-validate card fields (Luhn on number, MM/YY parse, CVC 3-4 digits, zip present).
2. Read booking by `booking_ref`; verify `customer_id = auth.uid()` and `status = 'pending'`.
3. If booking already `confirmed`: redirect to confirmation (idempotent).
4. INSERT `payments` (`method='mock'`, `status='completed'`, `amount = booking.total_amount`, `paid_at = now()`).
5. UPDATE `bookings.status = 'confirmed'`.
6. INSERT `booking_status_history` (pending → confirmed).
7. `revalidatePath("/account")`.
8. `redirect("/checkout/confirmation/<ref>")`.

Both actions use `"use server"`.

---

## 7. Guards & Error Handling

**Step guards** — `assertStepPrereqs(step, params, user)` helper called from each page.tsx. Rules:

| Step | Prereqs | Missing → |
|---|---|---|
| `/checkout` | (none) | redirect `/vehicles` |
| `/checkout/dates` | `vehicle` | redirect `/vehicles` |
| `/checkout/driver` | `vehicle`, `pickup`, `return`, `pickup_method` | redirect `/checkout/dates?vehicle=<id>` |
| `/checkout/extras` | above + 7 driver fields | redirect `/checkout/driver?<carried params>` |
| `/checkout/review` | all step-1..3 data | redirect to lowest incomplete step |
| `/checkout/payment` | `booking_ref`; booking exists, belongs to user, status `pending` | redirect `/checkout/dates?vehicle=<vehicle_id>` |
| `/checkout/confirmation/[ref]` | booking exists, belongs to user | `notFound()` |

**Server action errors** — return `{ error, field? }` objects consumed by forms.

**Route-group error boundary** — `app/(customer)/checkout/error.tsx` catches unhandled throws with the same "Something went wrong" shape used elsewhere.

**Idempotency:**
- `confirmPayment` sees already-`confirmed` booking → straight to confirmation page.
- Duplicate ref (extremely rare): server action retries reference generation once, then errors out to the boundary.

**RLS notes:**
- `bookings_insert_own` and `bookings_select_own` already exist (Plan 1 migration 023). Customer can INSERT their own booking directly, but Plan 3 routes through the RPC to bundle availability + extras atomically.
- No customer INSERT policy on `vehicle_availability` — the RPC uses `SECURITY DEFINER` to bypass. Documented in migration 024's comment.
- `payments` has no customer INSERT policy. `confirmPayment` server action uses a service-role client (already available from `createServiceClient()` in Plan 1) to write the payment row and audit history. This is the only place Plan 3 uses the service role client.

---

## 8. `/account` Bookings List

Replace the Plan 1 stub with a Server Component that queries the customer's bookings and renders a table:

| Column | Source |
|---|---|
| Reference | `bookings.reference` |
| Vehicle | joined `vehicles.make + model + year` |
| Pickup | `pickup_date` formatted |
| Return | `return_date` formatted |
| Status | pill: pending (grey) / confirmed (gold) / active (green) / completed (navy) / cancelled (red) |
| Total | `formatMoney(total_amount)` |

RLS scopes to customer's own bookings via `bookings_select_own`. Empty state: "No bookings yet. [Browse the fleet →]"

No detail page, no click-through. Plan 4 adds that.

---

## 9. Testing & Acceptance

### Automated (`scripts/smoke-test-checkout.mjs`)
Sign in as `customer@wabs.com`, use the SSR cookie pattern from `smoke-test-auth.mjs`.

**Happy path (9 checks):**
1. GET `/checkout/dates?vehicle=<huracan-id>` → 200
2. POST dates form → redirect → land on `/checkout/driver`
3. POST driver → land on `/checkout/extras`
4. POST extras (with promo `WABS10`) → land on `/checkout/review`
5. GET review contains discounted total (`10%` off subtotal visible in HTML)
6. POST review → redirect → land on `/checkout/payment?booking_ref=WBS-…`
7. POST payment → redirect → land on `/checkout/confirmation/WBS-…`
8. GET `/account` contains the new booking reference
9. DB check via REST: booking exists with `status='confirmed'`, availability row exists with `type='booking'`, `promo_codes.used_count` incremented by 1

**Negative paths (6+ checks):**
- Second customer books overlapping dates → step 6 shows `unavailable` error, no booking row created
- Under-25 DOB → step 4 → 5 transition fails
- Expired license → same
- Malformed card number (fails Luhn) → step 6 → 7 fails
- `/checkout/payment?booking_ref=<other-user-ref>` → redirect (not found)
- Promo `NOTREAL` → server returns error, no discount

Total: ~15 checks.

### Manual (`docs/superpowers/plans/2026-09-23-plan-3-smoke-test.md`)
- Step indicator visual progression (1/6, 2/6, …)
- Back-link preserves state (URL params)
- Date-picker rejects `return_date < pickup_date` client-side
- Extras multi-select UX and running total (if displayed)
- Card field auto-formatting (space every 4 digits, MM/YY separator)
- Confirmation page contains booking reference, vehicle summary, next steps
- Booking appears in `/account` bookings table with correct status pill and total

### Regression
- `smoke-test-auth.mjs` — still 12/12
- `smoke-test-browse.mjs` — still 20/20

### Acceptance
1. `npm run build` — all Plan 1+2+3 routes emit; new dynamic routes at `/checkout/*`
2. `npx tsc --noEmit` — clean
3. `smoke-test-checkout.mjs` — all checks pass
4. `smoke-test-auth.mjs` + `smoke-test-browse.mjs` — no regression
5. Manual checklist confirmed
6. Migration 024 applied to Supabase (documented; user runs before smoke tests)
7. From a fresh signup: Reserve → complete 6 steps in < 3 minutes → see booking on `/account`
8. Second customer attempting overlapping dates gets a clean error, no partial write
9. Booking totals in DB match `calculatePricing()` output — client cannot override

---

## 10. Known Deferred

- Availability calendar on `/vehicles/[id]` (was deferred from Plan 2, still deferred)
- Reviews on vehicle detail
- Booking detail page + cancellation
- Email notification sending
- Test-card simulation
- Customer document uploads
- Management console booking workflow

---

## 11. Assumptions

- `.env.local` has `SUPABASE_SERVICE_ROLE_KEY` (from Plan 1 setup). `confirmPayment` uses `createServiceClient()` for the payment insert. Without the service key, payment writes will 401.
- `application_settings` row for `tax_rate` exists (seeded in migration 022).
- Existing seed data (12 vehicles, 3 protection plans, 5 extras, 2 promo codes) is present.
- The three demo users from Plan 1 exist. Smoke tests use the customer.
