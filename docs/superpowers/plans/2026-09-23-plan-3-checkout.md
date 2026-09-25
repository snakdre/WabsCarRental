# Wabs Car Rental — Plan 3: Checkout & Booking Creation

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Ship end-to-end booking — a customer clicks Reserve, walks through six steps, pays with a mock card, and sees the booking on `/account`.

**Architecture:** Six-step wizard under `app/(customer)/checkout/`. Each step is a Server Component. Steps 1–3 keep state in URL search params. Step 4 → 5 boundary calls a Postgres function (`create_booking_with_availability`) that atomically inserts booking + availability + extras + promo bump inside one transaction, relying on the existing exclusion constraint to prevent double-booking. Step 5 → 6 records a mock payment and flips booking to `confirmed`.

**Tech Stack:** Next.js 14 App Router · Server Components + Server Actions · Supabase JS SSR · Postgres SECURITY DEFINER function · Zod · shadcn/ui.

**Related spec:** `docs/superpowers/specs/2026-09-23-plan-3-checkout-design.md`

---

## File Map

```
app/(customer)/checkout/
├── page.tsx                             # NEW: /checkout → /checkout/dates?vehicle=<id>
├── layout.tsx                           # NEW: step indicator + guard
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
├── step-indicator.tsx
├── back-link.tsx
├── date-picker-form.tsx
├── driver-form.tsx
├── extras-form.tsx
├── review-summary.tsx
├── payment-form.tsx
└── booking-summary-card.tsx

components/customer/account/
└── bookings-table.tsx

lib/
├── pricing.ts
├── booking-reference.ts
├── queries/
│   ├── bookings.ts
│   ├── extras.ts
│   └── promo-codes.ts
├── actions/
│   └── checkout.ts
└── validators/
    └── checkout.ts

supabase/migrations/
└── 024_create_booking_function.sql

scripts/
└── smoke-test-checkout.mjs
```

---

## Task 1: Migration 024 — atomic booking function

**Files:**
- Create: `supabase/migrations/024_create_booking_function.sql`

- [ ] **Step 1: Write the migration**

Create `supabase/migrations/024_create_booking_function.sql`:
```sql
-- Atomic booking creation.
-- Runs booking INSERT + availability INSERT + extras INSERT + promo bump
-- in one transaction. If the exclusion constraint on vehicle_availability
-- fires (dates overlap another booking or maintenance), everything rolls back.
--
-- SECURITY DEFINER because customers have no direct INSERT policy on
-- vehicle_availability (staff-only per migration 023). The function
-- is the trusted seam for the atomic write.

CREATE OR REPLACE FUNCTION create_booking_with_availability(p_booking JSONB)
RETURNS TEXT
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_ref TEXT;
  v_id UUID;
BEGIN
  v_ref := p_booking->>'reference';

  INSERT INTO bookings (
    reference, customer_id, vehicle_id, pickup_date, return_date, pickup_method,
    pickup_location_id, driver_name, driver_email, driver_phone, driver_dob,
    license_number, license_expiry, license_region, rental_days, base_price,
    delivery_fee, tax_amount, protection_fee, extras_fee, discount_amount,
    deposit_amount, total_amount, status, promo_code_id, protection_plan_id,
    special_requests, terms_accepted
  )
  SELECT
    v_ref,
    (p_booking->>'customer_id')::UUID,
    (p_booking->>'vehicle_id')::UUID,
    (p_booking->>'pickup_date')::TIMESTAMPTZ,
    (p_booking->>'return_date')::TIMESTAMPTZ,
    p_booking->>'pickup_method',
    NULLIF(p_booking->>'pickup_location_id', '')::UUID,
    p_booking->>'driver_name',
    p_booking->>'driver_email',
    p_booking->>'driver_phone',
    (p_booking->>'driver_dob')::DATE,
    p_booking->>'license_number',
    (p_booking->>'license_expiry')::DATE,
    p_booking->>'license_region',
    (p_booking->>'rental_days')::INT,
    (p_booking->>'base_price')::NUMERIC,
    COALESCE((p_booking->>'delivery_fee')::NUMERIC, 0),
    COALESCE((p_booking->>'tax_amount')::NUMERIC, 0),
    COALESCE((p_booking->>'protection_fee')::NUMERIC, 0),
    COALESCE((p_booking->>'extras_fee')::NUMERIC, 0),
    COALESCE((p_booking->>'discount_amount')::NUMERIC, 0),
    COALESCE((p_booking->>'deposit_amount')::NUMERIC, 0),
    (p_booking->>'total_amount')::NUMERIC,
    'pending',
    NULLIF(p_booking->>'promo_code_id', '')::UUID,
    NULLIF(p_booking->>'protection_plan_id', '')::UUID,
    p_booking->>'special_requests',
    TRUE
  RETURNING id INTO v_id;

  INSERT INTO vehicle_availability (
    vehicle_id, start_date, end_date, type, reference_id, created_by
  ) VALUES (
    (p_booking->>'vehicle_id')::UUID,
    (p_booking->>'pickup_date')::DATE,
    (p_booking->>'return_date')::DATE,
    'booking',
    v_id,
    (p_booking->>'customer_id')::UUID
  );

  INSERT INTO booking_extras (booking_id, extra_id, quantity, unit_price)
  SELECT
    v_id,
    (e->>'extra_id')::UUID,
    (e->>'quantity')::INT,
    (e->>'unit_price')::NUMERIC
  FROM jsonb_array_elements(COALESCE(p_booking->'extras', '[]'::jsonb)) e;

  IF p_booking->>'promo_code_id' IS NOT NULL AND p_booking->>'promo_code_id' != '' THEN
    UPDATE promo_codes
    SET used_count = used_count + 1
    WHERE id = (p_booking->>'promo_code_id')::UUID;
  END IF;

  RETURN v_ref;
END;
$$;

GRANT EXECUTE ON FUNCTION create_booking_with_availability(JSONB) TO authenticated;
```

- [ ] **Step 2: Apply the migration**

Paste the SQL into the Supabase SQL Editor and run. Expected: `Success. No rows returned.`

Verify the function exists:
```bash
set -a && source .env.local && set +a
curl -s "$NEXT_PUBLIC_SUPABASE_URL/rest/v1/rpc/create_booking_with_availability" \
  -H "apikey: $SUPABASE_SERVICE_ROLE_KEY" \
  -H "Authorization: Bearer $SUPABASE_SERVICE_ROLE_KEY" \
  -H "Content-Type: application/json" \
  -d '{"p_booking":{"reference":"WBS-XXXX-TEST01"}}'
```
Expected: 4xx-range error citing missing required fields (customer_id, etc.) — not a 404 "function does not exist". If you see PGRST202, the function wasn't created; re-run the SQL.

- [ ] **Step 3: Commit**

```bash
git add supabase/migrations/024_create_booking_function.sql
git commit -m "feat(plan3): add atomic create_booking_with_availability function"
```

---

## Task 2: Zod validators for checkout

**Files:**
- Create: `lib/validators/checkout.ts`

- [ ] **Step 1: Create `lib/validators/checkout.ts`**

```typescript
import { z } from "zod";

// Step 1 — dates
export const datesSchema = z.object({
  vehicle_id: z.string().uuid(),
  pickup_date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, "Invalid pickup date"),
  return_date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, "Invalid return date"),
  pickup_method: z.enum(["pickup", "delivery"]),
  pickup_location_id: z.string().uuid().nullable().optional(),
}).refine((d) => d.return_date > d.pickup_date, {
  message: "Return date must be after pickup date",
  path: ["return_date"],
});

// Step 2 — driver
export const driverSchema = z.object({
  driver_name: z.string().min(1, "Name required"),
  driver_email: z.string().email("Invalid email"),
  driver_phone: z.string().min(7, "Phone required"),
  driver_dob: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, "Invalid date of birth"),
  license_number: z.string().min(1, "License number required"),
  license_expiry: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, "Invalid license expiry"),
  license_region: z.string().min(1, "Issuing region required"),
});

// Step 3 — extras
export const extrasSchema = z.object({
  protection_plan_id: z.string().uuid().nullable().optional(),
  extras: z.array(z.object({
    extra_id: z.string().uuid(),
    quantity: z.number().int().positive(),
  })).default([]),
  promo_code: z.string().nullable().optional(),
});

// Composite for createDraftBooking action
export const fullBookingSchema = datesSchema.innerType()
  .merge(driverSchema)
  .merge(extrasSchema)
  .extend({
    terms_accepted: z.literal(true, { errorMap: () => ({ message: "You must accept terms" }) }),
    special_requests: z.string().max(500).optional().nullable(),
  });

// Step 5 — card (Luhn done in action; here we only shape-validate)
export const paymentSchema = z.object({
  card_number: z.string().regex(/^\d{13,19}$/, "Card number must be 13-19 digits"),
  card_expiry: z.string().regex(/^(0[1-9]|1[0-2])\/\d{2}$/, "Format: MM/YY"),
  card_cvc: z.string().regex(/^\d{3,4}$/, "CVC must be 3-4 digits"),
  card_zip: z.string().min(1, "Billing zip required"),
});

export type DatesInput = z.infer<typeof datesSchema>;
export type DriverInput = z.infer<typeof driverSchema>;
export type ExtrasInput = z.infer<typeof extrasSchema>;
export type PaymentInput = z.infer<typeof paymentSchema>;
```

- [ ] **Step 2: Verify tsc**

Run: `npx tsc --noEmit`
Expected: no errors.

- [ ] **Step 3: Commit**

```bash
git add lib/validators/checkout.ts
git commit -m "feat(plan3): add checkout Zod validators (dates, driver, extras, payment)"
```

---

## Task 3: Booking reference generator

**Files:**
- Create: `lib/booking-reference.ts`

- [ ] **Step 1: Create the file**

```typescript
// WBS-YYYY-XXXXXX — 6 chars from a 32-char alphabet (no I/O/0/1 for readability).
// Collision probability at seed volume is negligible; server action retries once on collision.

const ALPHABET = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789";

export function generateBookingReference(date: Date = new Date()): string {
  const year = date.getFullYear();
  let suffix = "";
  for (let i = 0; i < 6; i++) {
    suffix += ALPHABET[Math.floor(Math.random() * ALPHABET.length)];
  }
  return `WBS-${year}-${suffix}`;
}
```

- [ ] **Step 2: Verify tsc**

Run: `npx tsc --noEmit`
Expected: no errors.

- [ ] **Step 3: Commit**

```bash
git add lib/booking-reference.ts
git commit -m "feat(plan3): add booking reference generator"
```

---

## Task 4: Query helpers — extras, plans, promo codes, bookings

**Files:**
- Create: `lib/queries/extras.ts`
- Create: `lib/queries/promo-codes.ts`
- Create: `lib/queries/bookings.ts`

- [ ] **Step 1: Create `lib/queries/extras.ts`**

```typescript
import { createClient } from "@/lib/supabase/server";

export type ExtraOption = {
  id: string;
  name: string;
  description: string | null;
  price: number;
  unit: "per_day" | "flat";
};

export type ProtectionPlanOption = {
  id: string;
  name: string;
  description: string | null;
  daily_price: number;
  coverage_details: string | null;
};

export async function listActiveExtras(): Promise<ExtraOption[]> {
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("extras")
    .select("id, name, description, price, unit")
    .eq("is_active", true)
    .order("name");
  if (error) throw error;
  return (data ?? []) as ExtraOption[];
}

export async function listActivePlans(): Promise<ProtectionPlanOption[]> {
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("protection_plans")
    .select("id, name, description, daily_price, coverage_details")
    .eq("is_active", true)
    .order("daily_price");
  if (error) throw error;
  return (data ?? []) as ProtectionPlanOption[];
}
```

- [ ] **Step 2: Create `lib/queries/promo-codes.ts`**

```typescript
import { createClient } from "@/lib/supabase/server";

export type PromoLookup =
  | { valid: true; id: string; type: "percentage" | "fixed"; value: number }
  | { valid: false; error: string };

export async function validateAndFetchPromo(code: string): Promise<PromoLookup> {
  const trimmed = code.trim();
  if (!trimmed) return { valid: false, error: "Empty promo code" };

  const supabase = await createClient();
  const { data, error } = await supabase
    .from("promo_codes")
    .select("id, code, type, value, max_uses, used_count, expires_at, is_active")
    .eq("code", trimmed)
    .maybeSingle();

  if (error) throw error;
  if (!data) return { valid: false, error: "Promo code not found" };
  if (!data.is_active) return { valid: false, error: "Promo code inactive" };
  if (data.expires_at && new Date(data.expires_at) < new Date()) {
    return { valid: false, error: "Promo code expired" };
  }
  if (data.max_uses != null && data.used_count >= data.max_uses) {
    return { valid: false, error: "Promo code no longer available" };
  }
  return { valid: true, id: data.id, type: data.type, value: Number(data.value) };
}
```

- [ ] **Step 3: Create `lib/queries/bookings.ts`**

```typescript
import { createClient } from "@/lib/supabase/server";

export type BookingRow = {
  id: string;
  reference: string;
  customer_id: string;
  vehicle_id: string;
  pickup_date: string;
  return_date: string;
  pickup_method: string;
  status: string;
  total_amount: number;
  deposit_amount: number;
  rental_days: number;
  driver_name: string;
  created_at: string;
};

export type BookingListItem = BookingRow & {
  vehicle_make: string;
  vehicle_model: string;
  vehicle_year: number;
};

export async function getBookingByRef(ref: string): Promise<BookingRow | null> {
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("bookings")
    .select("*")
    .eq("reference", ref)
    .maybeSingle();
  if (error) throw error;
  return (data as BookingRow) ?? null;
}

export async function listMyBookings(): Promise<BookingListItem[]> {
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("bookings")
    .select("*, vehicles(make, model, year)")
    .order("created_at", { ascending: false });
  if (error) throw error;
  type Row = BookingRow & { vehicles: { make: string; model: string; year: number } | null };
  return (data ?? []).map((r: Row) => ({
    ...r,
    vehicle_make: r.vehicles?.make ?? "",
    vehicle_model: r.vehicles?.model ?? "",
    vehicle_year: r.vehicles?.year ?? 0,
  }));
}
```

- [ ] **Step 4: Verify tsc**

Run: `npx tsc --noEmit`
Expected: no errors.

- [ ] **Step 5: Commit**

```bash
git add lib/queries/extras.ts lib/queries/promo-codes.ts lib/queries/bookings.ts
git commit -m "feat(plan3): add extras, plans, promo, and booking query helpers"
```

---

## Task 5: Pricing calculator

**Files:**
- Create: `lib/pricing.ts`

- [ ] **Step 1: Create `lib/pricing.ts`**

```typescript
import { createClient } from "@/lib/supabase/server";
import { validateAndFetchPromo } from "@/lib/queries/promo-codes";

export type PricingInput = {
  vehicle_id: string;
  pickup_date: string;      // ISO YYYY-MM-DD
  return_date: string;
  pickup_method: "pickup" | "delivery";
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
  promo_code_id: string | null;
};

function daysBetween(pickup: string, ret: string): number {
  const p = new Date(pickup + "T00:00:00Z").getTime();
  const r = new Date(ret + "T00:00:00Z").getTime();
  const days = Math.ceil((r - p) / (1000 * 60 * 60 * 24));
  return Math.max(1, days);
}

function computeBase(days: number, daily: number, weekly: number | null, monthly: number | null): number {
  let remaining = days;
  let total = 0;
  if (monthly != null && remaining >= 30) {
    const months = Math.floor(remaining / 30);
    total += months * monthly;
    remaining -= months * 30;
  }
  if (weekly != null && remaining >= 7) {
    const weeks = Math.floor(remaining / 7);
    total += weeks * weekly;
    remaining -= weeks * 7;
  }
  total += remaining * daily;
  return total;
}

export async function calculatePricing(input: PricingInput): Promise<PricingOutput> {
  const supabase = await createClient();

  const [vehicleRes, planRes, extrasRes, locationRes, taxSettingRes] = await Promise.all([
    supabase.from("vehicles")
      .select("daily_price, weekly_price, monthly_price, deposit_amount, min_rental_days, max_rental_days")
      .eq("id", input.vehicle_id).maybeSingle(),
    input.protection_plan_id
      ? supabase.from("protection_plans").select("daily_price").eq("id", input.protection_plan_id).maybeSingle()
      : Promise.resolve({ data: null, error: null }),
    input.extras.length
      ? supabase.from("extras").select("id, price, unit").in("id", input.extras.map(e => e.extra_id))
      : Promise.resolve({ data: [], error: null }),
    input.pickup_location_id
      ? supabase.from("vehicle_locations").select("delivery_available, delivery_fee").eq("id", input.pickup_location_id).maybeSingle()
      : Promise.resolve({ data: null, error: null }),
    supabase.from("application_settings").select("value").eq("key", "tax_rate").maybeSingle(),
  ]);

  if (vehicleRes.error) throw vehicleRes.error;
  if (planRes.error) throw planRes.error;
  if (extrasRes.error) throw extrasRes.error;
  if (locationRes.error) throw locationRes.error;
  if (taxSettingRes.error) throw taxSettingRes.error;
  if (!vehicleRes.data) throw new Error("Vehicle not found");

  const v = vehicleRes.data;
  const rental_days = daysBetween(input.pickup_date, input.return_date);
  const base_price = computeBase(rental_days, Number(v.daily_price), v.weekly_price ? Number(v.weekly_price) : null, v.monthly_price ? Number(v.monthly_price) : null);
  const protection_fee = planRes.data ? Number(planRes.data.daily_price) * rental_days : 0;

  type ExtraRow = { id: string; price: number; unit: "per_day" | "flat" };
  const extrasByPrice = new Map<string, ExtraRow>();
  (extrasRes.data ?? []).forEach((e: ExtraRow) => extrasByPrice.set(e.id, e));

  let extras_fee = 0;
  for (const chosen of input.extras) {
    const e = extrasByPrice.get(chosen.extra_id);
    if (!e) continue;
    const price = Number(e.price);
    extras_fee += e.unit === "per_day"
      ? price * chosen.quantity * rental_days
      : price * chosen.quantity;
  }

  const delivery_fee = input.pickup_method === "delivery" && locationRes.data?.delivery_available
    ? Number(locationRes.data.delivery_fee ?? 0)
    : 0;

  const subtotal = base_price + protection_fee + extras_fee + delivery_fee;

  let discount_amount = 0;
  let promo_valid = false;
  let promo_error: string | null = null;
  let promo_code_id: string | null = null;
  if (input.promo_code && input.promo_code.trim()) {
    const promo = await validateAndFetchPromo(input.promo_code);
    if (promo.valid) {
      promo_valid = true;
      promo_code_id = promo.id;
      discount_amount = promo.type === "percentage"
        ? Math.round((subtotal * promo.value / 100) * 100) / 100
        : Math.min(promo.value, subtotal);
    } else {
      promo_error = promo.error;
    }
  }

  const taxRate = taxSettingRes.data?.value ? Number(taxSettingRes.data.value) : 0;
  const tax_amount = Math.round((subtotal - discount_amount) * taxRate * 100) / 100;
  const deposit_amount = v.deposit_amount ? Number(v.deposit_amount) : 0;
  const total_amount = Math.round((subtotal - discount_amount + tax_amount) * 100) / 100;

  const breakdown: { label: string; value: number }[] = [
    { label: `Base rental (${rental_days} day${rental_days === 1 ? "" : "s"})`, value: base_price },
  ];
  if (protection_fee > 0) breakdown.push({ label: "Protection plan", value: protection_fee });
  if (extras_fee > 0) breakdown.push({ label: "Extras", value: extras_fee });
  if (delivery_fee > 0) breakdown.push({ label: "Delivery", value: delivery_fee });
  if (discount_amount > 0) breakdown.push({ label: "Promo discount", value: -discount_amount });
  if (tax_amount > 0) breakdown.push({ label: "Tax", value: tax_amount });

  return {
    rental_days, base_price, protection_fee, extras_fee, delivery_fee,
    subtotal, discount_amount, tax_amount, deposit_amount, total_amount,
    breakdown, promo_valid, promo_error, promo_code_id,
  };
}
```

- [ ] **Step 2: Verify tsc**

Run: `npx tsc --noEmit`
Expected: no errors.

- [ ] **Step 3: Commit**

```bash
git add lib/pricing.ts
git commit -m "feat(plan3): add server-only pricing calculator"
```

---

## Task 6: Checkout server actions

**Files:**
- Create: `lib/actions/checkout.ts`

- [ ] **Step 1: Create `lib/actions/checkout.ts`**

```typescript
"use server";

import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";
import { createClient, createServiceClient } from "@/lib/supabase/server";
import { calculatePricing } from "@/lib/pricing";
import { generateBookingReference } from "@/lib/booking-reference";
import { paymentSchema } from "@/lib/validators/checkout";
import { z } from "zod";

// Composite schema for createDraftBooking (mirrors the URL params carried
// from step 1-3 plus terms_accepted on step 4).
const createDraftSchema = z.object({
  vehicle_id: z.string().uuid(),
  pickup_date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
  return_date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
  pickup_method: z.enum(["pickup", "delivery"]),
  pickup_location_id: z.string().uuid().nullable().optional(),
  driver_name: z.string().min(1),
  driver_email: z.string().email(),
  driver_phone: z.string().min(7),
  driver_dob: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
  license_number: z.string().min(1),
  license_expiry: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
  license_region: z.string().min(1),
  protection_plan_id: z.string().uuid().nullable().optional(),
  extras: z.array(z.object({ extra_id: z.string().uuid(), quantity: z.number().int().positive() })).default([]),
  promo_code: z.string().nullable().optional(),
  special_requests: z.string().max(500).nullable().optional(),
  terms_accepted: z.literal("on"),
});

function computeAgeAt(dob: string, at: string): number {
  const d = new Date(dob + "T00:00:00Z");
  const a = new Date(at + "T00:00:00Z");
  let age = a.getUTCFullYear() - d.getUTCFullYear();
  const m = a.getUTCMonth() - d.getUTCMonth();
  if (m < 0 || (m === 0 && a.getUTCDate() < d.getUTCDate())) age--;
  return age;
}

export async function createDraftBooking(formData: FormData) {
  // Parse extras from stringified JSON in the form
  const raw: Record<string, unknown> = {};
  for (const [k, v] of formData.entries()) raw[k] = v;
  if (typeof raw.extras === "string") {
    try { raw.extras = JSON.parse(raw.extras); } catch { raw.extras = []; }
  }
  raw.pickup_location_id = raw.pickup_location_id || null;
  raw.protection_plan_id = raw.protection_plan_id || null;
  raw.promo_code = raw.promo_code || null;
  raw.special_requests = raw.special_requests || null;

  const parsed = createDraftSchema.safeParse(raw);
  if (!parsed.success) {
    const first = parsed.error.issues[0];
    return { error: first.message, field: first.path.join(".") };
  }
  const d = parsed.data;

  // Business rules
  if (computeAgeAt(d.driver_dob, d.pickup_date) < 25) {
    return { error: "Driver must be at least 25 years old at pickup.", field: "driver_dob" };
  }
  if (d.license_expiry <= d.pickup_date) {
    return { error: "License must be valid past the pickup date.", field: "license_expiry" };
  }
  if (d.return_date <= d.pickup_date) {
    return { error: "Return date must be after pickup date.", field: "return_date" };
  }

  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return { error: "Not signed in" };

  // Vehicle status + min/max days check
  const { data: vehicle, error: vErr } = await supabase
    .from("vehicles")
    .select("status, min_rental_days, max_rental_days")
    .eq("id", d.vehicle_id).maybeSingle();
  if (vErr) throw vErr;
  if (!vehicle || vehicle.status !== "available") {
    return { error: "Vehicle is no longer available.", field: "vehicle_id" };
  }

  // Delivery location must allow delivery
  if (d.pickup_method === "delivery") {
    if (!d.pickup_location_id) {
      return { error: "Delivery location required.", field: "pickup_location_id" };
    }
    const { data: loc } = await supabase
      .from("vehicle_locations")
      .select("delivery_available")
      .eq("id", d.pickup_location_id).maybeSingle();
    if (!loc?.delivery_available) {
      return { error: "This location does not offer delivery.", field: "pickup_location_id" };
    }
  }

  const pricing = await calculatePricing({
    vehicle_id: d.vehicle_id,
    pickup_date: d.pickup_date,
    return_date: d.return_date,
    pickup_method: d.pickup_method,
    pickup_location_id: d.pickup_location_id ?? null,
    protection_plan_id: d.protection_plan_id ?? null,
    extras: d.extras,
    promo_code: d.promo_code ?? null,
  });

  if (vehicle.min_rental_days && pricing.rental_days < vehicle.min_rental_days) {
    return { error: `Minimum rental is ${vehicle.min_rental_days} days.`, field: "return_date" };
  }
  if (vehicle.max_rental_days && pricing.rental_days > vehicle.max_rental_days) {
    return { error: `Maximum rental is ${vehicle.max_rental_days} days.`, field: "return_date" };
  }
  if (d.promo_code && !pricing.promo_valid) {
    return { error: pricing.promo_error ?? "Invalid promo code", field: "promo_code" };
  }

  // Attempt booking; retry once on reference collision
  for (let attempt = 0; attempt < 2; attempt++) {
    const reference = generateBookingReference();
    const p_booking = {
      reference,
      customer_id: user.id,
      vehicle_id: d.vehicle_id,
      pickup_date: d.pickup_date,
      return_date: d.return_date,
      pickup_method: d.pickup_method,
      pickup_location_id: d.pickup_location_id ?? "",
      driver_name: d.driver_name,
      driver_email: d.driver_email,
      driver_phone: d.driver_phone,
      driver_dob: d.driver_dob,
      license_number: d.license_number,
      license_expiry: d.license_expiry,
      license_region: d.license_region,
      rental_days: pricing.rental_days,
      base_price: pricing.base_price,
      delivery_fee: pricing.delivery_fee,
      tax_amount: pricing.tax_amount,
      protection_fee: pricing.protection_fee,
      extras_fee: pricing.extras_fee,
      discount_amount: pricing.discount_amount,
      deposit_amount: pricing.deposit_amount,
      total_amount: pricing.total_amount,
      protection_plan_id: d.protection_plan_id ?? "",
      promo_code_id: pricing.promo_code_id ?? "",
      special_requests: d.special_requests ?? "",
      extras: d.extras.map(e => {
        const rec = { extra_id: e.extra_id, quantity: e.quantity, unit_price: 0 };
        return rec;
      }),
    };

    // Fill in unit_price for each extra from pricing computation (need per-extra price)
    // Fetch extras prices once
    if (d.extras.length > 0) {
      const { data: exs } = await supabase.from("extras").select("id, price").in("id", d.extras.map(e => e.extra_id));
      const byId = new Map<string, number>();
      (exs ?? []).forEach((e: { id: string; price: number }) => byId.set(e.id, Number(e.price)));
      p_booking.extras = d.extras.map(e => ({ extra_id: e.extra_id, quantity: e.quantity, unit_price: byId.get(e.extra_id) ?? 0 }));
    }

    const { data: rpcResult, error: rpcErr } = await supabase.rpc("create_booking_with_availability", { p_booking });
    if (!rpcErr) {
      redirect(`/checkout/payment?booking_ref=${rpcResult}`);
    }
    // Reference collision → retry
    if (rpcErr.code === "23505" && rpcErr.message.includes("reference")) continue;
    // Exclusion constraint (dates taken)
    if (rpcErr.code === "23P01") {
      return { error: "These dates were just taken. Please pick different dates.", field: "pickup_date" };
    }
    // Other DB error
    throw rpcErr;
  }
  return { error: "Unable to generate a unique booking reference. Please try again." };
}

export async function confirmPayment(formData: FormData) {
  const raw = {
    booking_ref: String(formData.get("booking_ref") ?? ""),
    card_number: String(formData.get("card_number") ?? "").replace(/\s+/g, ""),
    card_expiry: String(formData.get("card_expiry") ?? ""),
    card_cvc: String(formData.get("card_cvc") ?? ""),
    card_zip: String(formData.get("card_zip") ?? ""),
  };

  const parsed = paymentSchema.safeParse(raw);
  if (!parsed.success) {
    const first = parsed.error.issues[0];
    return { error: first.message, field: first.path.join(".") };
  }

  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return { error: "Not signed in" };

  const { data: booking, error: bErr } = await supabase
    .from("bookings")
    .select("id, reference, customer_id, status, total_amount")
    .eq("reference", raw.booking_ref).maybeSingle();
  if (bErr) throw bErr;
  if (!booking || booking.customer_id !== user.id) {
    return { error: "Booking not found." };
  }
  if (booking.status === "confirmed") {
    redirect(`/checkout/confirmation/${booking.reference}`);
  }
  if (booking.status !== "pending") {
    return { error: "This booking cannot be paid at this time." };
  }

  const service = await createServiceClient();

  const { error: payErr } = await service.from("payments").insert({
    booking_id: booking.id,
    amount: booking.total_amount,
    currency: "USD",
    method: "mock",
    status: "completed",
    paid_at: new Date().toISOString(),
  });
  if (payErr) throw payErr;

  const { error: upErr } = await service.from("bookings")
    .update({ status: "confirmed", updated_at: new Date().toISOString() })
    .eq("id", booking.id);
  if (upErr) throw upErr;

  await service.from("booking_status_history").insert({
    booking_id: booking.id,
    status: "confirmed",
    changed_by: user.id,
    note: "Mock payment completed",
  });

  revalidatePath("/account");
  redirect(`/checkout/confirmation/${booking.reference}`);
}
```

- [ ] **Step 2: Verify tsc**

Run: `npx tsc --noEmit`
Expected: no errors.

- [ ] **Step 3: Commit**

```bash
git add lib/actions/checkout.ts
git commit -m "feat(plan3): add createDraftBooking and confirmPayment server actions"
```

---

## Task 7: Checkout shell — layout, step indicator, entry redirect, error boundary

**Files:**
- Create: `app/(customer)/checkout/layout.tsx`
- Create: `app/(customer)/checkout/page.tsx`
- Create: `app/(customer)/checkout/error.tsx`
- Create: `components/customer/checkout/step-indicator.tsx`
- Create: `components/customer/checkout/back-link.tsx`
- Create: `components/customer/checkout/booking-summary-card.tsx`

- [ ] **Step 1: Create `components/customer/checkout/step-indicator.tsx`**

```typescript
const STEPS = ["Dates", "Driver", "Extras", "Review", "Payment", "Done"];

export function StepIndicator({ current }: { current: number }) {
  return (
    <ol className="flex items-center justify-center gap-2 py-6">
      {STEPS.map((label, i) => {
        const n = i + 1;
        const isActive = n === current;
        const isDone = n < current;
        return (
          <li key={label} className="flex items-center gap-2">
            <span
              className={`w-8 h-8 rounded-full flex items-center justify-center text-xs font-semibold ${
                isActive ? "bg-gold text-deep" :
                isDone ? "bg-gold/40 text-deep" :
                "bg-white border border-gray-300 text-text-muted-wabs"
              }`}
            >{n}</span>
            <span className={`text-xs hidden sm:inline ${isActive ? "text-navy font-semibold" : "text-text-muted-wabs"}`}>
              {label}
            </span>
            {i < STEPS.length - 1 && <span className="w-6 h-px bg-gray-300" />}
          </li>
        );
      })}
    </ol>
  );
}
```

- [ ] **Step 2: Create `components/customer/checkout/back-link.tsx`**

```typescript
"use client";

import Link from "next/link";
import { ChevronLeft } from "lucide-react";

export function BackLink({ href, label }: { href: string; label: string }) {
  return (
    <Link href={href} className="inline-flex items-center gap-1 text-sm text-gold hover:underline mb-4">
      <ChevronLeft className="w-4 h-4" /> {label}
    </Link>
  );
}
```

- [ ] **Step 3: Create `components/customer/checkout/booking-summary-card.tsx`**

```typescript
import { createClient } from "@/lib/supabase/server";
import { formatMoney } from "@/lib/utils/format";

export async function BookingSummaryCard({ vehicleId }: { vehicleId: string }) {
  const supabase = await createClient();
  const { data: vehicle } = await supabase
    .from("vehicles")
    .select("make, model, trim, year, daily_price")
    .eq("id", vehicleId).maybeSingle();
  if (!vehicle) return null;

  return (
    <div className="bg-white border border-gray-200 rounded-lg p-4 text-sm">
      <p className="text-text-muted-wabs text-xs uppercase tracking-wider">Booking</p>
      <p className="mt-1 font-semibold text-navy">
        {vehicle.year} {vehicle.make} {vehicle.model}{vehicle.trim ? ` ${vehicle.trim}` : ""}
      </p>
      <p className="text-text-muted-wabs mt-1">From {formatMoney(Number(vehicle.daily_price))} / day</p>
    </div>
  );
}
```

- [ ] **Step 4: Create `app/(customer)/checkout/layout.tsx`**

```typescript
export default function CheckoutLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className="max-w-5xl mx-auto px-6 py-12">
      {children}
    </div>
  );
}
```

- [ ] **Step 5: Create `app/(customer)/checkout/page.tsx`**

```typescript
import { redirect } from "next/navigation";

export default async function CheckoutEntry({
  searchParams,
}: {
  searchParams: Promise<{ vehicle?: string }>;
}) {
  const { vehicle } = await searchParams;
  if (!vehicle) redirect("/vehicles");
  redirect(`/checkout/dates?vehicle=${encodeURIComponent(vehicle)}`);
}
```

- [ ] **Step 6: Create `app/(customer)/checkout/error.tsx`**

```typescript
"use client";

import { Button } from "@/components/ui/button";

export default function CheckoutError({ reset }: { error: Error; reset: () => void }) {
  return (
    <div className="max-w-2xl mx-auto text-center py-16">
      <h1 className="text-2xl font-bold text-navy mb-2">Something went wrong</h1>
      <p className="text-text-muted-wabs mb-8">Your booking has not been created. Try again.</p>
      <Button onClick={reset} className="bg-gold hover:bg-gold-muted text-deep font-semibold">
        Try again
      </Button>
    </div>
  );
}
```

- [ ] **Step 7: Verify build**

Run: `npm run build`
Expected: build succeeds. `/checkout` route emits (dynamic).

- [ ] **Step 8: Commit**

```bash
git add "app/(customer)/checkout/" components/customer/checkout/step-indicator.tsx components/customer/checkout/back-link.tsx components/customer/checkout/booking-summary-card.tsx
git commit -m "feat(plan3): add checkout shell — layout, step indicator, entry redirect, error boundary"
```

---

## Task 8: Step 1 — Dates & Pickup

**Files:**
- Create: `components/customer/checkout/date-picker-form.tsx`
- Create: `app/(customer)/checkout/dates/page.tsx`

- [ ] **Step 1: Create `components/customer/checkout/date-picker-form.tsx`**

```typescript
"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";

type Location = { id: string; name: string | null; city: string | null; delivery_available: boolean; delivery_fee: number };

export function DatePickerForm({
  vehicleId,
  locations,
}: {
  vehicleId: string;
  locations: Location[];
}) {
  const router = useRouter();
  const today = new Date().toISOString().slice(0, 10);
  const [pickup, setPickup] = useState("");
  const [ret, setRet] = useState("");
  const [method, setMethod] = useState<"pickup" | "delivery">("pickup");
  const [locationId, setLocationId] = useState(locations[0]?.id ?? "");
  const [error, setError] = useState<string | null>(null);

  const deliveryLocations = locations.filter(l => l.delivery_available);

  const onSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    if (!pickup || !ret) { setError("Both dates are required."); return; }
    if (ret <= pickup) { setError("Return date must be after pickup date."); return; }
    if (method === "delivery" && !locationId) { setError("Choose a delivery location."); return; }

    const params = new URLSearchParams({
      vehicle: vehicleId,
      pickup,
      return: ret,
      pickup_method: method,
    });
    if (method === "delivery" && locationId) params.set("pickup_location_id", locationId);
    else if (locationId) params.set("pickup_location_id", locationId);
    router.push(`/checkout/driver?${params.toString()}`);
  };

  return (
    <form onSubmit={onSubmit} className="space-y-6" data-testid="dates-form">
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <div>
          <label className="block text-xs uppercase tracking-wider text-text-muted-wabs mb-2">Pickup date</label>
          <input type="date" min={today} value={pickup} onChange={(e) => setPickup(e.target.value)}
            className="w-full bg-white border border-gray-300 text-navy rounded px-3 py-2 focus:border-gold focus:outline-none" />
        </div>
        <div>
          <label className="block text-xs uppercase tracking-wider text-text-muted-wabs mb-2">Return date</label>
          <input type="date" min={pickup || today} value={ret} onChange={(e) => setRet(e.target.value)}
            className="w-full bg-white border border-gray-300 text-navy rounded px-3 py-2 focus:border-gold focus:outline-none" />
        </div>
      </div>

      <div>
        <label className="block text-xs uppercase tracking-wider text-text-muted-wabs mb-2">Pickup method</label>
        <div className="flex gap-3">
          <button type="button" onClick={() => setMethod("pickup")}
            className={`px-4 py-2 rounded border text-sm ${method === "pickup" ? "bg-gold text-deep border-gold font-semibold" : "bg-white text-navy border-gray-300"}`}>
            I&apos;ll pick up
          </button>
          <button type="button" onClick={() => setMethod("delivery")}
            className={`px-4 py-2 rounded border text-sm ${method === "delivery" ? "bg-gold text-deep border-gold font-semibold" : "bg-white text-navy border-gray-300"}`}>
            Deliver to me
          </button>
        </div>
      </div>

      <div>
        <label className="block text-xs uppercase tracking-wider text-text-muted-wabs mb-2">
          {method === "delivery" ? "Delivery location" : "Pickup location"}
        </label>
        <select value={locationId} onChange={(e) => setLocationId(e.target.value)}
          className="w-full bg-white border border-gray-300 text-navy rounded px-3 py-2 focus:border-gold focus:outline-none">
          {(method === "delivery" ? deliveryLocations : locations).map(l => (
            <option key={l.id} value={l.id}>{l.name} {l.city ? `— ${l.city}` : ""}</option>
          ))}
        </select>
      </div>

      {error && <p className="text-red-600 text-sm">{error}</p>}

      <Button type="submit" className="bg-gold hover:bg-gold-muted text-deep font-semibold">
        Continue to driver info
      </Button>
    </form>
  );
}
```

- [ ] **Step 2: Create `app/(customer)/checkout/dates/page.tsx`**

```typescript
import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { StepIndicator } from "@/components/customer/checkout/step-indicator";
import { BookingSummaryCard } from "@/components/customer/checkout/booking-summary-card";
import { DatePickerForm } from "@/components/customer/checkout/date-picker-form";

export const dynamic = "force-dynamic";

export default async function CheckoutDatesPage({
  searchParams,
}: {
  searchParams: Promise<{ vehicle?: string }>;
}) {
  const { vehicle } = await searchParams;
  if (!vehicle || !/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(vehicle)) {
    redirect("/vehicles");
  }

  const supabase = await createClient();
  const { data: v } = await supabase.from("vehicles").select("id, status").eq("id", vehicle).maybeSingle();
  if (!v || v.status !== "available") redirect("/vehicles");

  const { data: locations } = await supabase
    .from("vehicle_locations")
    .select("id, name, city, delivery_available, delivery_fee")
    .eq("vehicle_id", vehicle)
    .order("name");

  return (
    <div>
      <StepIndicator current={1} />
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-8 mt-6">
        <div className="lg:col-span-2">
          <h1 className="text-3xl font-bold text-navy mb-6">When would you like to book?</h1>
          <DatePickerForm vehicleId={vehicle} locations={(locations ?? []).map(l => ({ ...l, delivery_fee: Number(l.delivery_fee ?? 0) }))} />
        </div>
        <BookingSummaryCard vehicleId={vehicle} />
      </div>
    </div>
  );
}
```

- [ ] **Step 3: Verify build**

Run: `npm run build`
Expected: `/checkout/dates` emits.

- [ ] **Step 4: Commit**

```bash
git add components/customer/checkout/date-picker-form.tsx "app/(customer)/checkout/dates/page.tsx"
git commit -m "feat(plan3): add Step 1 — dates & pickup"
```

---

## Task 9: Step 2 — Driver info

**Files:**
- Create: `components/customer/checkout/driver-form.tsx`
- Create: `app/(customer)/checkout/driver/page.tsx`

- [ ] **Step 1: Create `components/customer/checkout/driver-form.tsx`**

```typescript
"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";

type CarriedParams = {
  vehicle: string;
  pickup: string;
  return: string;
  pickup_method: string;
  pickup_location_id?: string;
};

export function DriverForm({ carried }: { carried: CarriedParams }) {
  const router = useRouter();
  const [error, setError] = useState<string | null>(null);
  const [form, setForm] = useState({
    driver_name: "", driver_email: "", driver_phone: "",
    driver_dob: "", license_number: "",
    license_expiry: "", license_region: "",
  });

  const set = (k: keyof typeof form) => (e: React.ChangeEvent<HTMLInputElement>) =>
    setForm(f => ({ ...f, [k]: e.target.value }));

  const onSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    if (!Object.values(form).every(v => v.trim())) { setError("All fields are required."); return; }

    const params = new URLSearchParams({ ...carried, ...form });
    router.push(`/checkout/extras?${params.toString()}`);
  };

  const inp = "w-full bg-white border border-gray-300 text-navy rounded px-3 py-2 focus:border-gold focus:outline-none";
  const lbl = "block text-xs uppercase tracking-wider text-text-muted-wabs mb-2";

  return (
    <form onSubmit={onSubmit} className="space-y-6" data-testid="driver-form">
      <div>
        <label className={lbl}>Full legal name</label>
        <input required value={form.driver_name} onChange={set("driver_name")} className={inp} />
      </div>
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <div>
          <label className={lbl}>Email</label>
          <input required type="email" value={form.driver_email} onChange={set("driver_email")} className={inp} />
        </div>
        <div>
          <label className={lbl}>Phone</label>
          <input required type="tel" value={form.driver_phone} onChange={set("driver_phone")} className={inp} />
        </div>
      </div>
      <div>
        <label className={lbl}>Date of birth (must be 25+)</label>
        <input required type="date" value={form.driver_dob} onChange={set("driver_dob")} className={inp} />
      </div>
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <div>
          <label className={lbl}>License number</label>
          <input required value={form.license_number} onChange={set("license_number")} className={inp} />
        </div>
        <div>
          <label className={lbl}>Expiry</label>
          <input required type="date" value={form.license_expiry} onChange={set("license_expiry")} className={inp} />
        </div>
        <div>
          <label className={lbl}>Issuing region</label>
          <input required value={form.license_region} onChange={set("license_region")} className={inp} placeholder="e.g. CA, USA" />
        </div>
      </div>
      {error && <p className="text-red-600 text-sm">{error}</p>}
      <Button type="submit" className="bg-gold hover:bg-gold-muted text-deep font-semibold">
        Continue to extras
      </Button>
    </form>
  );
}
```

- [ ] **Step 2: Create `app/(customer)/checkout/driver/page.tsx`**

```typescript
import { redirect } from "next/navigation";
import { StepIndicator } from "@/components/customer/checkout/step-indicator";
import { BackLink } from "@/components/customer/checkout/back-link";
import { BookingSummaryCard } from "@/components/customer/checkout/booking-summary-card";
import { DriverForm } from "@/components/customer/checkout/driver-form";

export const dynamic = "force-dynamic";

export default async function CheckoutDriverPage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | undefined>>;
}) {
  const sp = await searchParams;
  const { vehicle, pickup, return: ret, pickup_method } = sp;
  if (!vehicle || !pickup || !ret || !pickup_method) {
    redirect(`/checkout/dates${vehicle ? `?vehicle=${encodeURIComponent(vehicle)}` : ""}`);
  }

  const carried = {
    vehicle: vehicle!,
    pickup: pickup!,
    return: ret!,
    pickup_method: pickup_method!,
    ...(sp.pickup_location_id ? { pickup_location_id: sp.pickup_location_id } : {}),
  };

  const backParams = new URLSearchParams({ vehicle: vehicle! });
  return (
    <div>
      <StepIndicator current={2} />
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-8 mt-6">
        <div className="lg:col-span-2">
          <BackLink href={`/checkout/dates?${backParams.toString()}`} label="Back to dates" />
          <h1 className="text-3xl font-bold text-navy mb-6">Who&apos;s driving?</h1>
          <DriverForm carried={carried} />
        </div>
        <BookingSummaryCard vehicleId={vehicle!} />
      </div>
    </div>
  );
}
```

- [ ] **Step 3: Verify build**

Run: `npm run build`
Expected: `/checkout/driver` emits.

- [ ] **Step 4: Commit**

```bash
git add components/customer/checkout/driver-form.tsx "app/(customer)/checkout/driver/page.tsx"
git commit -m "feat(plan3): add Step 2 — driver info"
```

---

## Task 10: Step 3 — Extras & Protection

**Files:**
- Create: `components/customer/checkout/extras-form.tsx`
- Create: `app/(customer)/checkout/extras/page.tsx`

- [ ] **Step 1: Create `components/customer/checkout/extras-form.tsx`**

```typescript
"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import { formatMoney } from "@/lib/utils/format";
import type { ExtraOption, ProtectionPlanOption } from "@/lib/queries/extras";

type CarriedParams = Record<string, string>;

export function ExtrasForm({
  carried,
  plans,
  extras,
}: {
  carried: CarriedParams;
  plans: ProtectionPlanOption[];
  extras: ExtraOption[];
}) {
  const router = useRouter();
  const [planId, setPlanId] = useState<string>("");
  const [selected, setSelected] = useState<Record<string, number>>({});
  const [promo, setPromo] = useState("");

  const toggle = (id: string) => {
    setSelected(s => {
      const next = { ...s };
      if (next[id]) delete next[id]; else next[id] = 1;
      return next;
    });
  };

  const onSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    const extrasArr = Object.entries(selected).map(([extra_id, quantity]) => ({ extra_id, quantity }));
    const params = new URLSearchParams(carried);
    if (planId) params.set("protection_plan_id", planId);
    params.set("extras", JSON.stringify(extrasArr));
    if (promo.trim()) params.set("promo_code", promo.trim());
    router.push(`/checkout/review?${params.toString()}`);
  };

  return (
    <form onSubmit={onSubmit} className="space-y-8" data-testid="extras-form">
      <section>
        <h2 className="text-lg font-semibold text-navy mb-3">Protection plan</h2>
        <div className="space-y-2">
          <label className="flex items-center gap-3 p-3 bg-white border border-gray-300 rounded cursor-pointer">
            <input type="radio" name="plan" checked={planId === ""} onChange={() => setPlanId("")} />
            <span className="text-navy">Decline protection</span>
          </label>
          {plans.map(p => (
            <label key={p.id} className={`flex items-center gap-3 p-3 bg-white border rounded cursor-pointer ${planId === p.id ? "border-gold" : "border-gray-300"}`}>
              <input type="radio" name="plan" checked={planId === p.id} onChange={() => setPlanId(p.id)} />
              <div className="flex-1">
                <p className="text-navy font-medium">{p.name}</p>
                <p className="text-text-muted-wabs text-sm">{p.description}</p>
              </div>
              <span className="text-navy font-semibold">{formatMoney(Number(p.daily_price))}/day</span>
            </label>
          ))}
        </div>
      </section>

      <section>
        <h2 className="text-lg font-semibold text-navy mb-3">Extras</h2>
        <div className="space-y-2">
          {extras.map(e => (
            <label key={e.id} className="flex items-center gap-3 p-3 bg-white border border-gray-300 rounded cursor-pointer">
              <input type="checkbox" checked={!!selected[e.id]} onChange={() => toggle(e.id)} />
              <div className="flex-1">
                <p className="text-navy font-medium">{e.name}</p>
                <p className="text-text-muted-wabs text-sm">{e.description}</p>
              </div>
              <span className="text-navy font-semibold">
                {formatMoney(Number(e.price))}{e.unit === "per_day" ? "/day" : ""}
              </span>
            </label>
          ))}
        </div>
      </section>

      <section>
        <h2 className="text-lg font-semibold text-navy mb-3">Promo code (optional)</h2>
        <input value={promo} onChange={(e) => setPromo(e.target.value)}
          placeholder="e.g. WABS10"
          className="w-full bg-white border border-gray-300 text-navy rounded px-3 py-2 focus:border-gold focus:outline-none" />
      </section>

      <Button type="submit" className="bg-gold hover:bg-gold-muted text-deep font-semibold">
        Continue to review
      </Button>
    </form>
  );
}
```

- [ ] **Step 2: Create `app/(customer)/checkout/extras/page.tsx`**

```typescript
import { redirect } from "next/navigation";
import { StepIndicator } from "@/components/customer/checkout/step-indicator";
import { BackLink } from "@/components/customer/checkout/back-link";
import { BookingSummaryCard } from "@/components/customer/checkout/booking-summary-card";
import { ExtrasForm } from "@/components/customer/checkout/extras-form";
import { listActiveExtras, listActivePlans } from "@/lib/queries/extras";

const REQUIRED_DRIVER_FIELDS = [
  "driver_name", "driver_email", "driver_phone", "driver_dob",
  "license_number", "license_expiry", "license_region",
];

export const dynamic = "force-dynamic";

export default async function CheckoutExtrasPage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | undefined>>;
}) {
  const sp = await searchParams;
  if (!sp.vehicle || !sp.pickup || !sp.return || !sp.pickup_method) {
    redirect(`/checkout/dates${sp.vehicle ? `?vehicle=${encodeURIComponent(sp.vehicle)}` : ""}`);
  }
  if (!REQUIRED_DRIVER_FIELDS.every(f => sp[f])) {
    const params = new URLSearchParams();
    (["vehicle","pickup","return","pickup_method","pickup_location_id"] as const)
      .forEach(k => { if (sp[k]) params.set(k, sp[k]!); });
    redirect(`/checkout/driver?${params.toString()}`);
  }

  const [plans, extras] = await Promise.all([listActivePlans(), listActiveExtras()]);
  const carried: Record<string, string> = {};
  Object.entries(sp).forEach(([k, v]) => { if (typeof v === "string") carried[k] = v; });

  const backParams = new URLSearchParams(carried);
  return (
    <div>
      <StepIndicator current={3} />
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-8 mt-6">
        <div className="lg:col-span-2">
          <BackLink href={`/checkout/driver?${backParams.toString()}`} label="Back to driver" />
          <h1 className="text-3xl font-bold text-navy mb-6">Add extras &amp; protection</h1>
          <ExtrasForm carried={carried} plans={plans} extras={extras} />
        </div>
        <BookingSummaryCard vehicleId={sp.vehicle!} />
      </div>
    </div>
  );
}
```

- [ ] **Step 3: Verify build**

Run: `npm run build`
Expected: `/checkout/extras` emits.

- [ ] **Step 4: Commit**

```bash
git add components/customer/checkout/extras-form.tsx "app/(customer)/checkout/extras/page.tsx"
git commit -m "feat(plan3): add Step 3 — extras, protection, promo code"
```

---

## Task 11: Step 4 — Review & submit

**Files:**
- Create: `components/customer/checkout/review-summary.tsx`
- Create: `app/(customer)/checkout/review/page.tsx`

- [ ] **Step 1: Create `components/customer/checkout/review-summary.tsx`**

```typescript
import { formatMoney } from "@/lib/utils/format";
import { calculatePricing } from "@/lib/pricing";

export async function ReviewSummary({
  vehicleId, pickup, ret, method, locationId, planId, extras, promoCode,
}: {
  vehicleId: string;
  pickup: string;
  ret: string;
  method: "pickup" | "delivery";
  locationId: string | null;
  planId: string | null;
  extras: { extra_id: string; quantity: number }[];
  promoCode: string | null;
}) {
  const pricing = await calculatePricing({
    vehicle_id: vehicleId,
    pickup_date: pickup,
    return_date: ret,
    pickup_method: method,
    pickup_location_id: locationId,
    protection_plan_id: planId,
    extras,
    promo_code: promoCode,
  });

  return (
    <div className="bg-white border border-gray-200 rounded-lg p-6">
      <h3 className="text-lg font-semibold text-navy mb-4">Price breakdown</h3>
      <ul className="space-y-2 text-sm">
        {pricing.breakdown.map((b, i) => (
          <li key={i} className="flex justify-between">
            <span className="text-text-muted-wabs">{b.label}</span>
            <span className={`font-medium ${b.value < 0 ? "text-green-700" : "text-navy"}`}>
              {b.value < 0 ? "−" : ""}{formatMoney(Math.abs(b.value))}
            </span>
          </li>
        ))}
      </ul>
      {pricing.promo_error && (
        <p className="text-red-600 text-xs mt-2">Promo: {pricing.promo_error}</p>
      )}
      <div className="mt-4 pt-4 border-t border-gray-200 flex justify-between text-lg font-bold text-navy">
        <span>Total</span>
        <span>{formatMoney(pricing.total_amount)}</span>
      </div>
      {pricing.deposit_amount > 0 && (
        <p className="text-xs text-text-muted-wabs mt-2">
          Plus refundable deposit of {formatMoney(pricing.deposit_amount)} (held separately)
        </p>
      )}
    </div>
  );
}
```

- [ ] **Step 2: Create `app/(customer)/checkout/review/page.tsx`**

```typescript
import { redirect } from "next/navigation";
import { StepIndicator } from "@/components/customer/checkout/step-indicator";
import { BackLink } from "@/components/customer/checkout/back-link";
import { BookingSummaryCard } from "@/components/customer/checkout/booking-summary-card";
import { ReviewSummary } from "@/components/customer/checkout/review-summary";
import { createDraftBooking } from "@/lib/actions/checkout";

const REQUIRED = [
  "vehicle","pickup","return","pickup_method",
  "driver_name","driver_email","driver_phone","driver_dob",
  "license_number","license_expiry","license_region",
];

export const dynamic = "force-dynamic";

export default async function CheckoutReviewPage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | undefined>>;
}) {
  const sp = await searchParams;
  for (const k of REQUIRED) {
    if (!sp[k]) redirect(`/checkout/dates${sp.vehicle ? `?vehicle=${encodeURIComponent(sp.vehicle)}` : ""}`);
  }

  const extras = sp.extras ? JSON.parse(sp.extras) as { extra_id: string; quantity: number }[] : [];
  const backParams = new URLSearchParams();
  Object.entries(sp).forEach(([k, v]) => { if (typeof v === "string") backParams.set(k, v); });

  return (
    <div>
      <StepIndicator current={4} />
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-8 mt-6">
        <div className="lg:col-span-2">
          <BackLink href={`/checkout/extras?${backParams.toString()}`} label="Back to extras" />
          <h1 className="text-3xl font-bold text-navy mb-6">Review your booking</h1>

          <div className="bg-white border border-gray-200 rounded-lg p-6 mb-6 text-sm">
            <p className="text-text-muted-wabs text-xs uppercase tracking-wider mb-3">Trip</p>
            <p><strong>Pickup:</strong> {sp.pickup}</p>
            <p><strong>Return:</strong> {sp.return}</p>
            <p><strong>Method:</strong> {sp.pickup_method}</p>
            <hr className="my-4" />
            <p className="text-text-muted-wabs text-xs uppercase tracking-wider mb-3">Driver</p>
            <p>{sp.driver_name} · {sp.driver_email} · {sp.driver_phone}</p>
            <p>License {sp.license_number} ({sp.license_region}) — expires {sp.license_expiry}</p>
          </div>

          <ReviewSummary
            vehicleId={sp.vehicle!}
            pickup={sp.pickup!}
            ret={sp.return!}
            method={sp.pickup_method as "pickup" | "delivery"}
            locationId={sp.pickup_location_id ?? null}
            planId={sp.protection_plan_id ?? null}
            extras={extras}
            promoCode={sp.promo_code ?? null}
          />

          <form action={createDraftBooking} className="mt-6 space-y-4">
            {Object.entries(sp).map(([k, v]) => (
              typeof v === "string"
                ? <input key={k} type="hidden" name={k === "return" ? "return_date" : k === "pickup" ? "pickup_date" : k === "vehicle" ? "vehicle_id" : k} value={v} />
                : null
            ))}
            <label className="flex items-start gap-2 text-sm text-navy">
              <input type="checkbox" name="terms_accepted" required className="mt-1" />
              <span>I agree to the rental terms and cancellation policy.</span>
            </label>
            <button type="submit" className="bg-gold hover:bg-gold-muted text-deep font-semibold px-6 py-3 rounded">
              Confirm &amp; continue to payment
            </button>
          </form>
        </div>
        <BookingSummaryCard vehicleId={sp.vehicle!} />
      </div>
    </div>
  );
}
```

Note: the hidden-input mapping (`return` → `return_date`, `pickup` → `pickup_date`, `vehicle` → `vehicle_id`) reconciles URL param names with the server action's Zod field names.

- [ ] **Step 3: Verify build**

Run: `npm run build`
Expected: `/checkout/review` emits.

- [ ] **Step 4: Commit**

```bash
git add components/customer/checkout/review-summary.tsx "app/(customer)/checkout/review/page.tsx"
git commit -m "feat(plan3): add Step 4 — review & submit draft booking"
```

---

## Task 12: Step 5 — Payment

**Files:**
- Create: `components/customer/checkout/payment-form.tsx`
- Create: `app/(customer)/checkout/payment/page.tsx`

- [ ] **Step 1: Create `components/customer/checkout/payment-form.tsx`**

```typescript
"use client";

import { useState } from "react";
import { confirmPayment } from "@/lib/actions/checkout";
import { Button } from "@/components/ui/button";

function luhn(num: string): boolean {
  const digits = num.replace(/\D/g, "");
  if (digits.length < 13) return false;
  let sum = 0, dbl = false;
  for (let i = digits.length - 1; i >= 0; i--) {
    let d = parseInt(digits[i], 10);
    if (dbl) { d *= 2; if (d > 9) d -= 9; }
    sum += d;
    dbl = !dbl;
  }
  return sum % 10 === 0;
}

export function PaymentForm({ bookingRef, total }: { bookingRef: string; total: string }) {
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [num, setNum] = useState("");
  const [exp, setExp] = useState("");
  const [cvc, setCvc] = useState("");
  const [zip, setZip] = useState("");

  const formatNum = (v: string) => v.replace(/\D/g, "").slice(0, 19).replace(/(.{4})/g, "$1 ").trim();
  const formatExp = (v: string) => {
    const d = v.replace(/\D/g, "").slice(0, 4);
    return d.length > 2 ? `${d.slice(0, 2)}/${d.slice(2)}` : d;
  };

  const onSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    if (!luhn(num)) { setError("Invalid card number."); return; }
    setLoading(true);

    const fd = new FormData();
    fd.set("booking_ref", bookingRef);
    fd.set("card_number", num.replace(/\s+/g, ""));
    fd.set("card_expiry", exp);
    fd.set("card_cvc", cvc);
    fd.set("card_zip", zip);
    const res = await confirmPayment(fd);
    if (res?.error) { setError(res.error); setLoading(false); }
  };

  const inp = "w-full bg-white border border-gray-300 text-navy rounded px-3 py-2 focus:border-gold focus:outline-none";
  const lbl = "block text-xs uppercase tracking-wider text-text-muted-wabs mb-2";

  return (
    <form onSubmit={onSubmit} className="space-y-4" data-testid="payment-form">
      <div>
        <label className={lbl}>Card number</label>
        <input required value={num} onChange={(e) => setNum(formatNum(e.target.value))}
          placeholder="4242 4242 4242 4242" inputMode="numeric" className={inp} />
      </div>
      <div className="grid grid-cols-2 gap-4">
        <div>
          <label className={lbl}>Expiry (MM/YY)</label>
          <input required value={exp} onChange={(e) => setExp(formatExp(e.target.value))} placeholder="12/28" className={inp} />
        </div>
        <div>
          <label className={lbl}>CVC</label>
          <input required value={cvc} onChange={(e) => setCvc(e.target.value.replace(/\D/g, "").slice(0, 4))} placeholder="123" inputMode="numeric" className={inp} />
        </div>
      </div>
      <div>
        <label className={lbl}>Billing ZIP</label>
        <input required value={zip} onChange={(e) => setZip(e.target.value)} placeholder="90210" className={inp} />
      </div>
      <p className="text-xs text-text-muted-wabs">Mock payment — no real charge is made.</p>
      {error && <p className="text-red-600 text-sm">{error}</p>}
      <Button type="submit" disabled={loading} className="bg-gold hover:bg-gold-muted text-deep font-semibold w-full">
        {loading ? "Processing..." : `Pay ${total} & confirm`}
      </Button>
    </form>
  );
}
```

- [ ] **Step 2: Create `app/(customer)/checkout/payment/page.tsx`**

```typescript
import { redirect, notFound } from "next/navigation";
import { StepIndicator } from "@/components/customer/checkout/step-indicator";
import { PaymentForm } from "@/components/customer/checkout/payment-form";
import { getBookingByRef } from "@/lib/queries/bookings";
import { formatMoney } from "@/lib/utils/format";
import { createClient } from "@/lib/supabase/server";

export const dynamic = "force-dynamic";

export default async function CheckoutPaymentPage({
  searchParams,
}: {
  searchParams: Promise<{ booking_ref?: string }>;
}) {
  const { booking_ref } = await searchParams;
  if (!booking_ref) redirect("/vehicles");

  const booking = await getBookingByRef(booking_ref);
  if (!booking) notFound();

  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user || booking.customer_id !== user.id) notFound();
  if (booking.status === "confirmed") redirect(`/checkout/confirmation/${booking.reference}`);
  if (booking.status !== "pending") redirect("/account");

  return (
    <div>
      <StepIndicator current={5} />
      <div className="max-w-lg mx-auto mt-8">
        <h1 className="text-3xl font-bold text-navy mb-2">Payment</h1>
        <p className="text-text-muted-wabs mb-6">Booking {booking.reference} · {formatMoney(Number(booking.total_amount))}</p>
        <PaymentForm bookingRef={booking.reference} total={formatMoney(Number(booking.total_amount))} />
      </div>
    </div>
  );
}
```

- [ ] **Step 3: Verify build**

Run: `npm run build`
Expected: `/checkout/payment` emits.

- [ ] **Step 4: Commit**

```bash
git add components/customer/checkout/payment-form.tsx "app/(customer)/checkout/payment/page.tsx"
git commit -m "feat(plan3): add Step 5 — mock payment"
```

---

## Task 13: Step 6 — Confirmation

**Files:**
- Create: `app/(customer)/checkout/confirmation/[ref]/page.tsx`

- [ ] **Step 1: Create the page**

```typescript
import Link from "next/link";
import { notFound } from "next/navigation";
import { StepIndicator } from "@/components/customer/checkout/step-indicator";
import { getBookingByRef } from "@/lib/queries/bookings";
import { createClient } from "@/lib/supabase/server";
import { formatMoney } from "@/lib/utils/format";
import { CheckCircle2 } from "lucide-react";

export const dynamic = "force-dynamic";

export default async function CheckoutConfirmationPage({
  params,
}: {
  params: Promise<{ ref: string }>;
}) {
  const { ref } = await params;
  const booking = await getBookingByRef(ref);
  if (!booking) notFound();

  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user || booking.customer_id !== user.id) notFound();

  const { data: vehicle } = await supabase
    .from("vehicles")
    .select("make, model, year")
    .eq("id", booking.vehicle_id).maybeSingle();

  return (
    <div>
      <StepIndicator current={6} />
      <div className="max-w-2xl mx-auto text-center mt-8">
        <CheckCircle2 className="w-16 h-16 text-gold mx-auto mb-4" />
        <h1 className="text-3xl font-bold text-navy mb-2">Booking confirmed</h1>
        <p className="text-text-muted-wabs mb-8">Confirmation sent to {booking.driver_name}. See you soon.</p>

        <div className="bg-white border border-gray-200 rounded-lg p-6 text-left space-y-3">
          <div className="flex justify-between">
            <span className="text-text-muted-wabs">Reference</span>
            <span className="font-mono font-semibold text-navy">{booking.reference}</span>
          </div>
          {vehicle && (
            <div className="flex justify-between">
              <span className="text-text-muted-wabs">Vehicle</span>
              <span className="text-navy">{vehicle.year} {vehicle.make} {vehicle.model}</span>
            </div>
          )}
          <div className="flex justify-between">
            <span className="text-text-muted-wabs">Pickup</span>
            <span className="text-navy">{booking.pickup_date.slice(0, 10)}</span>
          </div>
          <div className="flex justify-between">
            <span className="text-text-muted-wabs">Return</span>
            <span className="text-navy">{booking.return_date.slice(0, 10)}</span>
          </div>
          <div className="flex justify-between font-bold text-navy pt-2 border-t border-gray-200">
            <span>Total charged</span>
            <span>{formatMoney(Number(booking.total_amount))}</span>
          </div>
        </div>

        <div className="mt-8 flex gap-4 justify-center">
          <Link href="/account" className="text-sm bg-gold text-deep font-semibold px-6 py-3 rounded hover:bg-gold-muted">
            View my bookings
          </Link>
          <Link href="/vehicles" className="text-sm text-gold hover:underline px-6 py-3">
            Browse more vehicles
          </Link>
        </div>
      </div>
    </div>
  );
}
```

- [ ] **Step 2: Verify build**

Run: `npm run build`
Expected: `/checkout/confirmation/[ref]` emits (dynamic).

- [ ] **Step 3: Commit**

```bash
git add "app/(customer)/checkout/confirmation/[ref]/page.tsx"
git commit -m "feat(plan3): add Step 6 — confirmation page"
```

---

## Task 14: `/account` bookings table

**Files:**
- Create: `components/customer/account/bookings-table.tsx`
- Modify: `app/(customer)/account/page.tsx`

- [ ] **Step 1: Create `components/customer/account/bookings-table.tsx`**

```typescript
import Link from "next/link";
import { listMyBookings } from "@/lib/queries/bookings";
import { formatMoney } from "@/lib/utils/format";

const STATUS_STYLE: Record<string, string> = {
  pending: "bg-gray-100 text-gray-700",
  awaiting_payment: "bg-gray-100 text-gray-700",
  confirmed: "bg-gold/20 text-gold-muted",
  ready_for_pickup: "bg-blue-100 text-blue-700",
  active: "bg-green-100 text-green-700",
  completed: "bg-navy/10 text-navy",
  cancelled: "bg-red-100 text-red-700",
  rejected: "bg-red-100 text-red-700",
  refunded: "bg-yellow-100 text-yellow-700",
};

export async function BookingsTable() {
  const bookings = await listMyBookings();

  if (bookings.length === 0) {
    return (
      <div className="text-center py-16 bg-white border border-gray-200 rounded-lg">
        <p className="text-navy font-semibold mb-2">No bookings yet</p>
        <p className="text-text-muted-wabs mb-6">Ready for something extraordinary?</p>
        <Link href="/vehicles" className="text-sm bg-gold text-deep font-semibold px-6 py-3 rounded hover:bg-gold-muted">
          Browse the fleet →
        </Link>
      </div>
    );
  }

  return (
    <div className="bg-white border border-gray-200 rounded-lg overflow-hidden">
      <table className="w-full text-sm">
        <thead className="bg-gray-50 text-text-muted-wabs uppercase text-xs tracking-wider">
          <tr>
            <th className="text-left px-4 py-3">Reference</th>
            <th className="text-left px-4 py-3">Vehicle</th>
            <th className="text-left px-4 py-3">Pickup</th>
            <th className="text-left px-4 py-3">Return</th>
            <th className="text-left px-4 py-3">Status</th>
            <th className="text-right px-4 py-3">Total</th>
          </tr>
        </thead>
        <tbody>
          {bookings.map(b => (
            <tr key={b.id} data-booking-ref={b.reference} className="border-t border-gray-100">
              <td className="px-4 py-3 font-mono text-navy">{b.reference}</td>
              <td className="px-4 py-3 text-navy">{b.vehicle_year} {b.vehicle_make} {b.vehicle_model}</td>
              <td className="px-4 py-3 text-navy">{b.pickup_date.slice(0, 10)}</td>
              <td className="px-4 py-3 text-navy">{b.return_date.slice(0, 10)}</td>
              <td className="px-4 py-3">
                <span className={`text-xs px-2 py-1 rounded font-medium ${STATUS_STYLE[b.status] ?? "bg-gray-100 text-gray-700"}`}>
                  {b.status.replace(/_/g, " ")}
                </span>
              </td>
              <td className="px-4 py-3 text-right font-semibold text-navy">{formatMoney(Number(b.total_amount))}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
```

- [ ] **Step 2: Replace `app/(customer)/account/page.tsx`**

```typescript
import { BookingsTable } from "@/components/customer/account/bookings-table";

export const dynamic = "force-dynamic";

export default function AccountPage() {
  return (
    <main className="max-w-6xl mx-auto p-8">
      <div className="mb-8">
        <p className="text-gold text-xs uppercase tracking-[0.3em] mb-2">Account</p>
        <h1 className="text-3xl font-bold text-navy">Your bookings</h1>
      </div>
      <BookingsTable />
    </main>
  );
}
```

- [ ] **Step 3: Verify build**

Run: `npm run build`
Expected: `/account` still emits, now populated with bookings.

- [ ] **Step 4: Commit**

```bash
git add components/customer/account/bookings-table.tsx "app/(customer)/account/page.tsx"
git commit -m "feat(plan3): replace /account stub with bookings table"
```

---

## Task 15: Automated smoke test

**Files:**
- Create: `scripts/smoke-test-checkout.mjs`

- [ ] **Step 1: Create `scripts/smoke-test-checkout.mjs`**

```javascript
// End-to-end checkout smoke test.
// Requires dev server running at NEXT_PUBLIC_APP_URL (default http://localhost:3000).
// Usage: set -a && source .env.local && set +a && node scripts/smoke-test-checkout.mjs

const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL;
const ANON_KEY = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
const SERVICE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY;
const APP_URL = process.env.NEXT_PUBLIC_APP_URL || "http://localhost:3000";
const PROJECT_REF = new URL(SUPABASE_URL).hostname.split(".")[0];
const COOKIE_NAME = `sb-${PROJECT_REF}-auth-token`;

function base64url(s) {
  return Buffer.from(s, "utf8").toString("base64").replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "");
}

async function signIn(email, password) {
  const res = await fetch(`${SUPABASE_URL}/auth/v1/token?grant_type=password`, {
    method: "POST",
    headers: { apikey: ANON_KEY, "Content-Type": "application/json" },
    body: JSON.stringify({ email, password }),
  });
  if (!res.ok) throw new Error(`sign-in ${email}: ${res.status}`);
  return res.json();
}

function buildAuthCookie(session) {
  const stored = {
    access_token: session.access_token,
    token_type: session.token_type,
    expires_in: session.expires_in,
    expires_at: session.expires_at,
    refresh_token: session.refresh_token,
    user: session.user,
  };
  return `${COOKIE_NAME}=base64-${base64url(JSON.stringify(stored))}`;
}

async function fetchAdmin(path, init = {}) {
  return fetch(`${SUPABASE_URL}/rest/v1/${path}`, {
    ...init,
    headers: {
      apikey: SERVICE_KEY,
      Authorization: `Bearer ${SERVICE_KEY}`,
      "Content-Type": "application/json",
      ...(init.headers ?? {}),
    },
  });
}

// Clean up any prior test bookings so the test is repeatable.
async function cleanupPriorBookings() {
  // Delete availability rows created by prior tests (identified by matching booking reference pattern)
  const res = await fetchAdmin("bookings?driver_email=eq.customer@wabs.com&select=id");
  if (!res.ok) return;
  const rows = await res.json();
  for (const r of rows) {
    await fetchAdmin(`vehicle_availability?reference_id=eq.${r.id}`, { method: "DELETE" });
    await fetchAdmin(`booking_extras?booking_id=eq.${r.id}`, { method: "DELETE" });
    await fetchAdmin(`booking_status_history?booking_id=eq.${r.id}`, { method: "DELETE" });
    await fetchAdmin(`payments?booking_id=eq.${r.id}`, { method: "DELETE" });
    await fetchAdmin(`bookings?id=eq.${r.id}`, { method: "DELETE" });
  }
}

const results = [];
function check(name, ok, detail = "") {
  console.log(`${ok ? "✓" : "✗"} ${name}${!ok && detail ? " — " + detail : ""}`);
  results.push(Boolean(ok));
}

async function get(path, cookie) {
  const res = await fetch(`${APP_URL}${path}`, { redirect: "manual", headers: cookie ? { cookie } : {} });
  const body = res.status === 200 ? await res.text() : "";
  return { status: res.status, location: res.headers.get("location"), body };
}

async function postForm(path, cookie, fields) {
  const fd = new URLSearchParams();
  Object.entries(fields).forEach(([k, v]) => fd.set(k, String(v)));
  const res = await fetch(`${APP_URL}${path}`, {
    method: "POST",
    redirect: "manual",
    headers: {
      cookie,
      "content-type": "application/x-www-form-urlencoded",
    },
    body: fd.toString(),
  });
  return { status: res.status, location: res.headers.get("location") };
}

async function run() {
  console.log(`App: ${APP_URL}\n`);
  await cleanupPriorBookings();

  const custSession = await signIn("customer@wabs.com", "WabsDemo2024!");
  const custCookie = buildAuthCookie(custSession);
  const VEHICLE = "aaaaaaaa-0000-0000-0000-000000000001"; // Huracán

  // Step 1
  const dates = await get(`/checkout/dates?vehicle=${VEHICLE}`, custCookie);
  check("GET /checkout/dates → 200", dates.status === 200);

  // Compute pickup 30 days out; return 34 days
  const pickup = new Date(Date.now() + 30 * 86400000).toISOString().slice(0, 10);
  const ret = new Date(Date.now() + 34 * 86400000).toISOString().slice(0, 10);

  // Skip form POST simulation for steps 1–3 (client-side navigation only); go directly to review URL
  const dobOK = "1990-01-01";
  const licExpiry = new Date(Date.now() + 365 * 86400000).toISOString().slice(0, 10);
  const sp = new URLSearchParams({
    vehicle: VEHICLE, pickup, return: ret, pickup_method: "pickup",
    driver_name: "Alex Test", driver_email: "alex@test.local", driver_phone: "+15551230000",
    driver_dob: dobOK,
    license_number: "TEST123", license_expiry: licExpiry, license_region: "CA",
    extras: JSON.stringify([]),
    promo_code: "WABS10",
  });
  const review = await get(`/checkout/review?${sp.toString()}`, custCookie);
  check("GET /checkout/review → 200", review.status === 200);
  check("review shows discount", review.body.includes("Promo discount") || review.body.includes("WABS10") || review.body.toLowerCase().includes("discount"));

  // Step 4 → submit createDraftBooking via the review page's form action
  // We need to POST to the server action path. Server actions in Next 14 are handled via
  // the page's own URL with a special POST. Since replicating the Next server-action wire
  // format from a shell is fragile, this smoke test uses the RPC path directly to verify
  // the booking function works, and validates the pages render.

  // Direct RPC test: create booking via authenticated fetch to the RPC endpoint
  const reference = "WBS-2026-" + Math.random().toString(36).slice(2, 8).toUpperCase();
  const p_booking = {
    reference,
    customer_id: custSession.user.id,
    vehicle_id: VEHICLE,
    pickup_date: pickup,
    return_date: ret,
    pickup_method: "pickup",
    pickup_location_id: "",
    driver_name: "Alex Test",
    driver_email: "alex@test.local",
    driver_phone: "+15551230000",
    driver_dob: dobOK,
    license_number: "TEST123",
    license_expiry: licExpiry,
    license_region: "CA",
    rental_days: 4,
    base_price: 4800,
    delivery_fee: 0,
    tax_amount: 384,
    protection_fee: 0,
    extras_fee: 0,
    discount_amount: 480,
    deposit_amount: 5000,
    total_amount: 4704,
    protection_plan_id: "",
    promo_code_id: "",
    special_requests: "",
    extras: [],
  };

  const rpcRes = await fetch(`${SUPABASE_URL}/rest/v1/rpc/create_booking_with_availability`, {
    method: "POST",
    headers: {
      apikey: ANON_KEY,
      Authorization: `Bearer ${custSession.access_token}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({ p_booking }),
  });
  const rpcBody = await rpcRes.text();
  check("RPC create_booking_with_availability succeeds", rpcRes.ok, `${rpcRes.status} ${rpcBody}`);

  // Now attempt to create another booking with overlapping dates — must fail
  const p2 = { ...p_booking, reference: reference + "X" };
  const rpc2 = await fetch(`${SUPABASE_URL}/rest/v1/rpc/create_booking_with_availability`, {
    method: "POST",
    headers: {
      apikey: ANON_KEY,
      Authorization: `Bearer ${custSession.access_token}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({ p_booking: p2 }),
  });
  check("RPC on overlapping dates fails", !rpc2.ok);

  // Confirmation page renders for the confirmed booking
  const confRes = await fetch(`${SUPABASE_URL}/rest/v1/bookings?reference=eq.${reference}`, {
    headers: { apikey: SERVICE_KEY, Authorization: `Bearer ${SERVICE_KEY}` },
  });
  const [confBooking] = await confRes.json();
  check("booking exists in DB", confBooking?.reference === reference);

  // Simulate payment: flip to confirmed via service role (mirrors what confirmPayment does)
  await fetchAdmin(`bookings?id=eq.${confBooking.id}`, {
    method: "PATCH",
    body: JSON.stringify({ status: "confirmed" }),
    headers: { Prefer: "return=minimal" },
  });

  const conf = await get(`/checkout/confirmation/${reference}`, custCookie);
  check("GET /checkout/confirmation/<ref> → 200", conf.status === 200);
  check("confirmation page contains reference", conf.body.includes(reference));

  const accountPage = await get(`/account`, custCookie);
  check("GET /account → 200", accountPage.status === 200);
  check("/account contains new booking reference", accountPage.body.includes(reference));

  // Guard: /checkout/payment for wrong user → notFound
  const mgrSession = await signIn("manager@wabs.com", "WabsDemo2024!");
  const mgrCookie = buildAuthCookie(mgrSession);
  const wrongUser = await get(`/checkout/payment?booking_ref=${reference}`, mgrCookie);
  check("cross-user /checkout/payment → 404", wrongUser.status === 404);

  const passed = results.filter(Boolean).length;
  console.log(`\n${passed}/${results.length} checks passed`);
  process.exit(passed === results.length ? 0 : 1);
}

run().catch((err) => { console.error(err); process.exit(1); });
```

- [ ] **Step 2: Start the dev server (background)**

Run in background: `npm run dev`. Wait for `Ready in <time>`.

- [ ] **Step 3: Run the smoke test**

```bash
set -a && source .env.local && set +a && node scripts/smoke-test-checkout.mjs
```
Expected: all checks pass.

- [ ] **Step 4: Stop the dev server** and commit.

```bash
git add scripts/smoke-test-checkout.mjs
git commit -m "feat(plan3): add automated smoke test for booking end-to-end"
```

---

## Task 16: Manual smoke test checklist

**Files:**
- Create: `docs/superpowers/plans/2026-09-23-plan-3-smoke-test.md`

- [ ] **Step 1: Create the checklist**

```markdown
# Plan 3 — Manual Smoke Test Checklist

Prerequisites:
- `npm run dev` on http://localhost:3000
- Migration 024 applied
- Plans 1 & 2 smoke tests still green

## Full happy-path booking
- [ ] `/vehicles/aaaaaaaa-0000-0000-0000-000000000001` — click Reserve
- [ ] Redirected to `/checkout/dates?vehicle=…`
- [ ] Pick pickup date (30 days out) and return date (34 days out); choose "Pickup"; continue
- [ ] Fill driver form with real-looking data; DOB before 2000; license expiry 1 year out; continue
- [ ] On extras: pick "Premium Guard" + GPS Navigation; enter `WABS10`; continue
- [ ] Review page shows correct breakdown with 10% discount and tax
- [ ] Accept terms; submit; land on `/checkout/payment?booking_ref=WBS-…`
- [ ] Enter card number 4242 4242 4242 4242, exp 12/28, cvc 123, zip 90210; submit
- [ ] Land on `/checkout/confirmation/WBS-…` with reference and summary
- [ ] Visit `/account` — new booking appears with `confirmed` status pill

## Step guards
- [ ] `/checkout/driver` without params → redirects to `/checkout/dates` (or `/vehicles`)
- [ ] `/checkout/review` without driver params → redirects earlier
- [ ] `/checkout/payment?booking_ref=<someone-elses>` → 404
- [ ] `/checkout/confirmation/<bogus>` → 404
- [ ] Direct navigation to `/checkout` (no vehicle) → redirects to `/vehicles`

## Business rules
- [ ] DOB making driver <25 at pickup → error at Step 4 submit
- [ ] License expiring before pickup date → error at Step 4 submit
- [ ] Return date before/equal pickup → client-side error at Step 1
- [ ] Bogus promo code → server error at Step 4 submit (no discount)

## Payment validation
- [ ] Card 1234 1234 1234 1234 (fails Luhn) → error before server call
- [ ] Missing CVC → HTML5 required error

## Overlap
- [ ] Complete a booking for dates A-B
- [ ] Try to book same vehicle for A-B (different customer) → error "these dates were just taken"

## Regression
- [ ] Plan 1 smoke test: 12/12
- [ ] Plan 2 smoke test: 20/20
```

- [ ] **Step 2: Commit**

```bash
git add docs/superpowers/plans/2026-09-23-plan-3-smoke-test.md
git commit -m "docs(plan3): add manual smoke test checklist"
```

---

## Task 17: Final verification

**Files:** none (verification only)

- [ ] **Step 1: Full clean build**

Run: `rm -rf .next && npm run build`
Expected: all Plan 1+2+3 routes emit: `/`, `/vehicles`, `/vehicles/[id]`, `/checkout`, `/checkout/dates`, `/checkout/driver`, `/checkout/extras`, `/checkout/review`, `/checkout/payment`, `/checkout/confirmation/[ref]`, `/account`, `/management`, plus the auth routes.

- [ ] **Step 2: Type check**

Run: `npx tsc --noEmit`
Expected: clean.

- [ ] **Step 3: Run all smoke tests (dev server up)**

```bash
node scripts/smoke-test-auth.mjs     # 12/12
node scripts/smoke-test-browse.mjs   # 20/20
node scripts/smoke-test-checkout.mjs # all checks pass
```

- [ ] **Step 4: Report status.** Manual checklist ready at `docs/superpowers/plans/2026-09-23-plan-3-smoke-test.md`. No commit needed.
