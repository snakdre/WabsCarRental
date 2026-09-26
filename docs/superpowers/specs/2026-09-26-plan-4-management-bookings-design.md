# Plan 4 — Management Console: Booking Workflow — Design Spec

**Date:** 2026-09-26
**Status:** Approved
**Depends on:** Plans 1, 2 & 3 (foundation, auth, browse, checkout)
**Stack:** Next.js 14 App Router · Server Components + Server Actions · Supabase JS SSR · shadcn/ui

---

## 1. Scope

Plan 4 gives managers and admins the ability to work bookings through their lifecycle. Customers create bookings via Plan 3; Plan 4 lets staff approve, transition, cancel, refund, and annotate them.

**In scope:**
1. **`/management/bookings`** — server-rendered table of all bookings with status filter (chips) and text search (URL-driven state).
2. **`/management/bookings/[id]`** — detail page: all booking fields, customer + vehicle summary, status history timeline, internal notes editor, status action buttons.
3. **Status transitions** — full lifecycle: pending → confirmed / rejected, confirmed → ready_for_pickup / cancelled / refunded, ready_for_pickup → active / cancelled / refunded, active → completed / refunded. Terminal states: completed, cancelled, rejected, refunded.
4. **Availability side effects** — cancelling or rejecting a booking deletes the corresponding `vehicle_availability` row, freeing the dates for other customers.
5. **Internal notes** — `bookings.internal_notes` is editable via a textarea on the detail page. Never surfaced on customer-facing pages.
6. **Status history timeline** — read-only display of `booking_status_history` rows in chronological order. Each transition writes a new row with the acting user id and optional note.
7. **Management sidebar** — new nav component with "Bookings" as the only live section; slots for future sections (Vehicles, Customers, Calendar, Maintenance, Settings) as disabled links.

**Explicitly out of scope:**
- Dashboard KPIs (`/management` landing stays as Plan 1 stub)
- Vehicle CRUD, customer management, calendar view, maintenance, settings
- Refunds table integration — `refunded` transitions flip status + require a note; no `refunds` row is created (that's a follow-up plan pairing with real Stripe)
- CSV export
- Editing customer-facing booking fields (dates, driver info, extras) via management UI
- Email notifications on status changes
- Real-time updates or WebSocket
- Manager vs admin permission differentiation (both get full booking access; migration 023 handles the staff/customer wall)

---

## 2. Architecture

**Rendering:** Server Components for pages and read-only surfaces (table, timeline, summary panels). Client Components only for interactive bits: status action buttons (with confirm dialog), filter chips (URL updates), search input, notes editor. Same pattern as Plans 2 & 3.

**Access control:** Plan 1 middleware already redirects non-staff away from `/management/*`. Plan 1 migration 023 grants staff `bookings_select_staff` and `bookings_update_staff` policies. Plus `booking_status_history` SELECT + INSERT for staff. Plus `va_all_staff` covers DELETE on `vehicle_availability`. No new RLS policies, no service-role client needed — the RLS-scoped `createClient()` covers every operation in Plan 4.

**Status state machine** — centralized in `lib/booking-status.ts`. Both server and client consult the same `TRANSITIONS` map. Server enforces; client uses it to render only valid buttons.

**Cancel/reject flow** — server action does three writes in sequence (not a transaction):
1. UPDATE bookings.status
2. INSERT booking_status_history
3. DELETE from vehicle_availability WHERE reference_id = booking.id AND type = 'booking'

If step 3 fails, status still changes. Staff can retry or a follow-up cleanup can free stale availability rows. Not wrapped in an RPC because RLS already permits all three writes for staff — no `SECURITY DEFINER` seam needed.

---

## 3. File Map

```
app/management/
├── layout.tsx                             # UPDATE: add sidebar wrapper
├── page.tsx                               # UNCHANGED (Plan 1 stub)
├── error.tsx                              # NEW: route-group error boundary
└── bookings/
    ├── page.tsx                           # NEW: list
    └── [id]/page.tsx                      # NEW: detail

components/management/
├── sidebar.tsx                            # NEW: server, static nav
└── bookings/
    ├── bookings-table.tsx                 # NEW: server, table + rows
    ├── bookings-filters.tsx               # NEW: client, chips + search
    ├── booking-detail-header.tsx          # NEW: server, ref + status pill
    ├── booking-summary-panel.tsx          # NEW: server, all read-only fields
    ├── status-actions.tsx                 # NEW: client, buttons + confirm dialog
    ├── status-history-timeline.tsx        # NEW: server, list of rows
    └── notes-editor.tsx                   # NEW: client, textarea + save

lib/
├── booking-status.ts                      # NEW: TRANSITIONS + canTransition + status labels
├── queries/
│   └── management-bookings.ts             # NEW: listAllBookings, getManagementBookingDetail
├── actions/
│   └── management-bookings.ts             # NEW: transitionBookingStatus, updateBookingNotes
└── validators/
    └── management-bookings.ts             # NEW: Zod schemas

scripts/
└── smoke-test-management-bookings.mjs     # NEW: automated status transitions + access guards
```

`app/management/layout.tsx` currently:
```tsx
export default function ManagementLayout({ children }: { children: React.ReactNode }) {
  return <div className="min-h-screen bg-deep text-white">{children}</div>;
}
```

Plan 4 updates it to wrap children in a flex row alongside the new `<ManagementSidebar />`.

---

## 4. Status Machine

`lib/booking-status.ts`:

```ts
export const BOOKING_STATUSES = [
  "draft", "pending", "awaiting_payment", "confirmed",
  "ready_for_pickup", "active", "completed",
  "cancelled", "rejected", "refunded",
] as const;

export type BookingStatus = typeof BOOKING_STATUSES[number];

export const TRANSITIONS: Record<BookingStatus, BookingStatus[]> = {
  draft: ["pending", "cancelled"],
  pending: ["confirmed", "rejected", "cancelled"],
  awaiting_payment: ["confirmed", "cancelled"],
  confirmed: ["ready_for_pickup", "cancelled", "refunded"],
  ready_for_pickup: ["active", "cancelled", "refunded"],
  active: ["completed", "refunded"],
  completed: [],
  cancelled: [],
  rejected: [],
  refunded: [],
};

export function canTransition(from: BookingStatus, to: BookingStatus): boolean {
  return TRANSITIONS[from]?.includes(to) ?? false;
}

export const STATUS_LABEL: Record<BookingStatus, string> = {
  draft: "Draft",
  pending: "Pending",
  awaiting_payment: "Awaiting payment",
  confirmed: "Confirmed",
  ready_for_pickup: "Ready for pickup",
  active: "Active",
  completed: "Completed",
  cancelled: "Cancelled",
  rejected: "Rejected",
  refunded: "Refunded",
};
```

Terminal states (completed, cancelled, rejected, refunded) have empty transition lists. `draft` and `awaiting_payment` are unused by Plan 3's flow but retained for completeness (matches the CHECK constraint from migration 012).

---

## 5. Queries

`lib/queries/management-bookings.ts` exports two functions.

```ts
export type ManagementBookingListItem = {
  id: string;
  reference: string;
  customer_id: string;
  vehicle_year: number;
  vehicle_make: string;
  vehicle_model: string;
  pickup_date: string;
  return_date: string;
  status: string;
  total_amount: number;
  driver_name: string;
  driver_email: string;
  created_at: string;
};

export type ManagementBookingDetail = ManagementBookingListItem & {
  driver_phone: string;
  driver_dob: string;
  license_number: string;
  license_expiry: string;
  license_region: string;
  pickup_method: string;
  rental_days: number;
  base_price: number;
  delivery_fee: number;
  tax_amount: number;
  protection_fee: number;
  extras_fee: number;
  discount_amount: number;
  deposit_amount: number;
  special_requests: string | null;
  internal_notes: string | null;
  history: { status: string; note: string | null; created_at: string }[];
};

export async function listAllBookings(params: {
  status?: string;
  search?: string;
}): Promise<ManagementBookingListItem[]>;

export async function getManagementBookingDetail(
  id: string
): Promise<ManagementBookingDetail | null>;
```

**`listAllBookings`** uses:
- `SELECT bookings.*, vehicles(year, make, model) FROM bookings ORDER BY created_at DESC`
- If `status` provided, `.eq("status", status)` (already Zod-validated against enum)
- If `search` provided, sanitize (strip `,`, `(`, `)` — replace with `.`) and use `.or("reference.ilike.*<term>*,driver_name.ilike.*<term>*,driver_email.ilike.*<term>*")`

**`getManagementBookingDetail`** parallel-fetches:
- `bookings` joined with `vehicles(year, make, model)` by id
- `booking_status_history` sorted ASC by created_at

Returns null if no booking row exists.

**RLS access:** staff-scoped SELECT is granted by migration 023. No service-role needed.

---

## 6. Validators

`lib/validators/management-bookings.ts`:

```ts
import { z } from "zod";
import { BOOKING_STATUSES } from "@/lib/booking-status";

export const managementListParamsSchema = z.object({
  status: z.enum(BOOKING_STATUSES).optional(),
  search: z.string().max(100).optional(),
});

export const transitionSchema = z.object({
  booking_id: z.string().uuid(),
  next_status: z.enum(BOOKING_STATUSES),
  note: z.string().max(500).nullable().optional(),
});

export const notesSchema = z.object({
  booking_id: z.string().uuid(),
  notes: z.string().max(2000),
});
```

Search-term sanitization happens inside `listAllBookings` before passing to PostgREST — the Zod schema only validates length/presence.

---

## 7. Server Actions

`lib/actions/management-bookings.ts`:

### `transitionBookingStatus(formData)`

1. Zod-validate `{ booking_id, next_status, note }`.
2. `createClient()`, `auth.getUser()` — return `{ error: "Not signed in" }` if no user.
3. Fetch current booking status by id. If not found → `{ error: "Booking not found" }`.
4. `canTransition(current, next)` false → `{ error: "Cannot transition from <label(current)> to <label(next)>." }`.
5. If `next === "refunded"` and note is empty/absent → `{ error: "Refunds require a note.", field: "note" }`.
6. UPDATE `bookings.status = next, updated_at = now()`. On error, throw (bubbles to error boundary).
7. INSERT `booking_status_history { booking_id, status: next, changed_by: user.id, note }`.
8. If `next ∈ ("cancelled", "rejected")`: DELETE FROM vehicle_availability WHERE reference_id = booking.id AND type = 'booking'. Log any error but do NOT fail the action.
9. `revalidatePath("/management/bookings")` and `revalidatePath("/management/bookings/" + booking_id)`.
10. Return `{ success: true }`.

`TODO(plan-5-refunds)` comment above the `next === "refunded"` branch to flag the future integration point.

### `updateBookingNotes(formData)`

1. Zod-validate `{ booking_id, notes }`.
2. `createClient()`, verify user.
3. UPDATE `bookings.internal_notes = notes, updated_at = now()`.
4. `revalidatePath("/management/bookings/" + booking_id)`.
5. Return `{ success: true }`.

Both actions return `{ error, field? }` on Zod failure for inline surfacing.

---

## 8. UI Behavior

### `/management/bookings`

**Header:** page title "Bookings" + count of currently-displayed rows.

**Filters** (client component, URL-driven):
- Status chips: "All" · Pending · Confirmed · Ready · Active · Completed · Cancelled · Rejected · Refunded. Clicking updates `?status=` (or removes it for All).
- Search input: debounced 400ms, updates `?search=` on Enter or after debounce.
- Both preserve each other in the URL (chip click keeps search, search doesn't clear chip).

**Table** (server component):
- Columns: Reference · Customer (driver_name / driver_email) · Vehicle · Pickup · Return · Status pill · Total
- Empty state: "No bookings match your filters."
- Each row links to `/management/bookings/[id]`.

### `/management/bookings/[id]`

**Layout:** Two columns on desktop (2/3 left, 1/3 right sidebar).

**Left column:**
- `<BookingDetailHeader />` — reference, status pill, "Created <date>"
- `<BookingSummaryPanel />` — trip details, driver details, pricing breakdown (same fields as the confirmation page but with all internal fields)
- `<StatusHistoryTimeline />` — bulleted list of transitions with timestamps

**Right column:**
- `<StatusActions />` — buttons for valid next statuses. Approve / Mark ready / Mark active / Mark completed are direct; Cancel / Reject / Refund open a small dialog (shadcn `Dialog`) with a required-note textarea for Refund and optional-note for the others.
- `<NotesEditor />` — labeled "Internal notes (staff only)", textarea prefilled with existing value, Save button.

### `<StatusActions />`

Client component. Props: `bookingId`, `currentStatus`, `allowedTransitions`. Renders one button per allowed transition. Each button label uses `STATUS_LABEL`. Destructive transitions (`cancelled`, `rejected`, `refunded`) trigger a confirm dialog before submission; others submit directly on click. All submissions use `useTransition`. Errors surface inline below the buttons.

### `<NotesEditor />`

Client component. Props: `bookingId`, `initialNotes`. `useTransition` for the save. Success shows a small toast/inline "Saved just now" indicator that fades.

### Sidebar

Server component. Renders the WABS logo + a vertical nav:
- Bookings (active link on `/management/bookings*`)
- Vehicles (disabled, gray)
- Customers (disabled, gray)
- Calendar (disabled, gray)
- Maintenance (disabled, gray)
- Settings (disabled, gray for all staff in Plan 4; admin-only visibility comes in the settings plan)

Disabled items render as `<span>` not `<Link>` so they're inert.

---

## 9. Error Handling

- `getManagementBookingDetail(bad-uuid)` returns null → detail page `notFound()`.
- `/management/bookings/[id]` guards `id` matches UUID regex; if not, `notFound()` before hitting the DB.
- Route-group `app/management/error.tsx` catches all throws with retry button.
- Server actions return `{ error, field? }` for Zod / transition / not-found cases; throw for infrastructure failures (DB down, RLS misconfigured).
- Client wrappers (`status-actions.tsx`, `notes-editor.tsx`) display returned errors inline.
- Middleware unchanged.

---

## 10. Testing & Acceptance

### Automated (`scripts/smoke-test-management-bookings.mjs`)

Sign in as manager (`manager@wabs.com`). Set up a fresh test booking via the `create_booking_with_availability` RPC. ~13 checks total.

**Happy path:**
1. GET `/management/bookings` (manager) → 200, HTML contains test booking reference
2. GET `/management/bookings?status=pending` → 200, contains test ref
3. GET `/management/bookings?search=<ref>` → 200, contains test ref
4. GET `/management/bookings?status=completed` → 200, does NOT contain test ref (it's pending)
5. GET `/management/bookings/<id>` → 200, contains driver_email + internal_notes markers
6. GET `/management/bookings/<bogus-uuid>` → 404
7. GET `/management/bookings/not-a-uuid` → 404
8. REST-driven DB assertion after `transitionBookingStatus` (pending → confirmed): booking.status = 'confirmed', new history row exists
9. REST-driven DB assertion after `updateBookingNotes`: booking.internal_notes populated
10. REST-driven DB assertion after `transitionBookingStatus` (confirmed → cancelled): status = 'cancelled', vehicle_availability row DELETED

**Negative:**
11. Attempt invalid transition (completed → pending) via server action / RPC — error returned
12. GET `/management/bookings` as customer (Plan 1 middleware) → 307 → `/`
13. Attempt `transitionBookingStatus` from a customer session → RLS denies, action returns error

Server actions are invoked via a direct `fetch("/api/...")` pattern or via a small helper that POSTs to the page with the Next server-action headers. If that's fragile (Plan 3's smoke test hit this), fall back to REST-based DB checks after simulating what the action would do — same trade-off Plan 3 made.

### Manual (`docs/superpowers/plans/2026-09-26-plan-4-smoke-test.md`)

- Sidebar renders with "Bookings" active
- Status chips update URL, filter table
- Search input filters after debounce
- Detail page renders all fields
- Only valid transition buttons visible per current status
- Confirm dialog appears for cancel / reject / refund
- Refund action requires note before submit; empty note blocks
- After cancel/reject, dates free — a new booking on the same vehicle+dates succeeds (verify via checkout flow)
- Notes save and persist across reload
- Status history timeline shows all past transitions with timestamps in chronological order
- Regression: Plans 1-3 smoke tests still pass

### Acceptance

1. `npm run build` passes; new routes emit
2. `npx tsc --noEmit` clean
3. `smoke-test-management-bookings.mjs` all checks pass
4. `smoke-test-auth.mjs` still 12/12
5. `smoke-test-browse.mjs` still 20/20
6. `smoke-test-checkout.mjs` still 11/11
7. Manual checklist confirmed
8. End-to-end demo:
   - Customer creates booking (Plan 3) → `pending`
   - Staff signs in → sees booking on `/management/bookings`
   - Staff transitions: `pending → confirmed → ready_for_pickup → active → completed`
   - Alternate: cancel a `pending` booking; verify dates become available (another checkout for the same vehicle+dates succeeds)
9. Customer signed in cannot reach `/management/bookings` (Plan 1 regression)

---

## 11. Known Deferred

- Refund action does not create `refunds` rows (status flip only). `TODO(plan-5-refunds)` marker in the action.
- Booking status history displays timestamps but not the acting staff member's name (only `changed_by` UUID exists; no staff-name lookup surface yet). Show as anonymous transitions.
- No CSV export.
- Manager vs admin gating within bookings — both roles have equal booking authority. Admin-only fields (like `refunded` requiring admin) can be added later.
- Vehicle management, customer management, availability calendar all deferred to future plans.
- Email/notification on status change (rows may be created in `notifications` table in a future plan; nothing here).
- `bookings.pickup_date` type follow-up (still `TIMESTAMPTZ`, treated as pure date — flagged in Plan 3 review as I4).

---

## 12. Assumptions

- Migrations 001–024 already applied to Supabase.
- Demo users (customer, manager, admin) exist with the passwords documented in Plan 1.
- Existing seed vehicles, extras, plans, promo codes intact.
- No new migrations needed — Plan 4 is UI + server actions on top of existing schema and RLS.
