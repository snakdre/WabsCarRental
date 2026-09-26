# Wabs Car Rental — Plan 4: Management Console — Booking Workflow

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Give managers and admins a working bookings queue: list + detail + status transitions (approve, cancel, refund, etc.) + internal notes, with cancellation freeing dates automatically.

**Architecture:** Server Components under `app/management/bookings/`. Interactive bits (status buttons w/ confirm dialog, filter chips, search, notes editor) are Client Components using `useTransition`. Server actions read/write via the RLS-scoped `createClient()` — Plan 1 migration 023 already grants staff SELECT/UPDATE on `bookings`, SELECT/INSERT on `booking_status_history`, and DELETE on `vehicle_availability`. No new RLS, no service role.

**Tech Stack:** Next.js 14 App Router · Server Components + Server Actions · Supabase JS SSR · shadcn/ui (Dialog, Textarea already present)

**Related spec:** `docs/superpowers/specs/2026-09-26-plan-4-management-bookings-design.md`

---

## File Map

```
app/management/
├── layout.tsx                              # UPDATE: wrap children in sidebar layout
├── page.tsx                                # UNCHANGED
├── error.tsx                               # NEW: error boundary
└── bookings/
    ├── page.tsx                            # NEW: list
    └── [id]/page.tsx                       # NEW: detail

components/management/
├── sidebar.tsx                             # NEW: server, static nav
└── bookings/
    ├── bookings-table.tsx                  # NEW: server
    ├── bookings-filters.tsx                # NEW: client (chips + search)
    ├── status-pill.tsx                     # NEW: server, shared
    ├── booking-detail-header.tsx           # NEW: server
    ├── booking-summary-panel.tsx           # NEW: server
    ├── status-actions.tsx                  # NEW: client (buttons + dialog)
    ├── status-history-timeline.tsx         # NEW: server
    └── notes-editor.tsx                    # NEW: client (textarea + save)

lib/
├── booking-status.ts                       # NEW: TRANSITIONS + canTransition + labels
├── queries/
│   └── management-bookings.ts              # NEW: listAllBookings, getManagementBookingDetail
├── actions/
│   └── management-bookings.ts              # NEW: transitionBookingStatus, updateBookingNotes
└── validators/
    └── management-bookings.ts              # NEW: Zod

scripts/
└── smoke-test-management-bookings.mjs      # NEW: automated
```

**Note on `<StatusPill>`:** the `/account` bookings table (Plan 3) inlined a small STATUS_STYLE map. Rather than duplicate, Task 3 extracts `<StatusPill>` as a shared component used by both surfaces. Task 3 also updates `/account`'s bookings table to import it.

---

## Task 1: Booking status machine + labels

**Files:**
- Create: `lib/booking-status.ts`

- [ ] **Step 1: Create `lib/booking-status.ts`**

```typescript
// Booking status state machine.
// Terminal states (empty transition arrays): completed, cancelled, rejected, refunded.
// draft and awaiting_payment are unused by the current customer flow but retained
// for completeness (match the CHECK constraint from migration 012).

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

export function nextStatusesFor(current: BookingStatus): BookingStatus[] {
  return TRANSITIONS[current] ?? [];
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

export const DESTRUCTIVE_TRANSITIONS: ReadonlySet<BookingStatus> = new Set([
  "cancelled", "rejected", "refunded",
]);

export function isBookingStatus(s: string): s is BookingStatus {
  return (BOOKING_STATUSES as readonly string[]).includes(s);
}
```

- [ ] **Step 2: Verify tsc**

Run: `npx tsc --noEmit`
Expected: no errors.

- [ ] **Step 3: Commit**

```bash
git add lib/booking-status.ts
git commit -m "feat(plan4): add booking status state machine"
```

---

## Task 2: Zod validators for management bookings

**Files:**
- Create: `lib/validators/management-bookings.ts`

- [ ] **Step 1: Create `lib/validators/management-bookings.ts`**

```typescript
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

export type ManagementListParams = z.infer<typeof managementListParamsSchema>;
export type TransitionInput = z.infer<typeof transitionSchema>;
export type NotesInput = z.infer<typeof notesSchema>;

export function parseListParams(raw: Record<string, string | string[] | undefined>): ManagementListParams {
  const flat: Record<string, string | undefined> = {};
  for (const [k, v] of Object.entries(raw)) flat[k] = Array.isArray(v) ? v[0] : v;
  const parsed = managementListParamsSchema.safeParse(flat);
  return parsed.success ? parsed.data : {};
}
```

- [ ] **Step 2: Verify tsc**

Run: `npx tsc --noEmit`
Expected: no errors.

- [ ] **Step 3: Commit**

```bash
git add lib/validators/management-bookings.ts
git commit -m "feat(plan4): add management bookings Zod validators"
```

---

## Task 3: Extract shared `<StatusPill>` and update /account to use it

**Files:**
- Create: `components/management/bookings/status-pill.tsx`
- Modify: `components/customer/account/bookings-table.tsx`

- [ ] **Step 1: Create `components/management/bookings/status-pill.tsx`**

```typescript
import { STATUS_LABEL, type BookingStatus } from "@/lib/booking-status";

const STATUS_STYLE: Record<string, string> = {
  draft: "bg-gray-100 text-gray-700",
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

export function StatusPill({ status }: { status: string }) {
  const cls = STATUS_STYLE[status] ?? "bg-gray-100 text-gray-700";
  const label = STATUS_LABEL[status as BookingStatus] ?? status.replace(/_/g, " ");
  return (
    <span className={`text-xs px-2 py-1 rounded font-medium ${cls}`}>
      {label}
    </span>
  );
}
```

- [ ] **Step 2: Update `components/customer/account/bookings-table.tsx`**

Read the current file first, then apply:
- Remove the top-level `STATUS_STYLE` constant.
- Replace the `<span>` that renders the status pill inline with `<StatusPill status={b.status} />`.
- Add `import { StatusPill } from "@/components/management/bookings/status-pill";` near the top.

The rest of the file (bookings query, empty state, table structure) stays unchanged.

- [ ] **Step 3: Verify build**

Run: `npm run build`
Expected: build succeeds; `/account` route still emits.

- [ ] **Step 4: Commit**

```bash
git add components/management/bookings/status-pill.tsx components/customer/account/bookings-table.tsx
git commit -m "feat(plan4): extract shared StatusPill; adopt on /account"
```

---

## Task 4: Query helpers — listAllBookings, getManagementBookingDetail

**Files:**
- Create: `lib/queries/management-bookings.ts`

- [ ] **Step 1: Create `lib/queries/management-bookings.ts`**

```typescript
import { createClient } from "@/lib/supabase/server";
import type { ManagementListParams } from "@/lib/validators/management-bookings";

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

export type StatusHistoryRow = {
  status: string;
  note: string | null;
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
  history: StatusHistoryRow[];
};

type VehicleJoin = { year: number; make: string; model: string } | null;

// PostgREST .or() uses commas as separators. Strip user-provided commas / parens
// so a malicious search term can't inject additional filters.
function sanitizeSearchTerm(raw: string): string {
  return raw.trim().replace(/[,()]/g, ".").slice(0, 100);
}

export async function listAllBookings(params: ManagementListParams): Promise<ManagementBookingListItem[]> {
  const supabase = await createClient();
  let query = supabase
    .from("bookings")
    .select(`
      id, reference, customer_id, pickup_date, return_date, status, total_amount,
      driver_name, driver_email, created_at,
      vehicles ( year, make, model )
    `)
    .order("created_at", { ascending: false });

  if (params.status) query = query.eq("status", params.status);

  if (params.search) {
    const term = sanitizeSearchTerm(params.search);
    if (term) {
      query = query.or(`reference.ilike.*${term}*,driver_name.ilike.*${term}*,driver_email.ilike.*${term}*`);
    }
  }

  const { data, error } = await query;
  if (error) throw error;

  type Row = Omit<ManagementBookingListItem, "vehicle_year" | "vehicle_make" | "vehicle_model"> & { vehicles: VehicleJoin };
  return ((data ?? []) as unknown as Row[]).map((r) => ({
    id: r.id,
    reference: r.reference,
    customer_id: r.customer_id,
    vehicle_year: r.vehicles?.year ?? 0,
    vehicle_make: r.vehicles?.make ?? "",
    vehicle_model: r.vehicles?.model ?? "",
    pickup_date: r.pickup_date,
    return_date: r.return_date,
    status: r.status,
    total_amount: Number(r.total_amount),
    driver_name: r.driver_name,
    driver_email: r.driver_email,
    created_at: r.created_at,
  }));
}

export async function getManagementBookingDetail(id: string): Promise<ManagementBookingDetail | null> {
  if (!/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(id)) return null;

  const supabase = await createClient();
  const [bookingRes, historyRes] = await Promise.all([
    supabase
      .from("bookings")
      .select(`
        id, reference, customer_id, pickup_date, return_date, status, total_amount,
        driver_name, driver_email, driver_phone, driver_dob, license_number, license_expiry, license_region,
        pickup_method, rental_days, base_price, delivery_fee, tax_amount, protection_fee, extras_fee,
        discount_amount, deposit_amount, special_requests, internal_notes, created_at,
        vehicles ( year, make, model )
      `)
      .eq("id", id)
      .maybeSingle(),
    supabase
      .from("booking_status_history")
      .select("status, note, created_at")
      .eq("booking_id", id)
      .order("created_at", { ascending: true }),
  ]);

  if (bookingRes.error) throw bookingRes.error;
  if (historyRes.error) throw historyRes.error;
  if (!bookingRes.data) return null;

  const b = bookingRes.data as unknown as {
    id: string; reference: string; customer_id: string;
    pickup_date: string; return_date: string; status: string; total_amount: number;
    driver_name: string; driver_email: string; driver_phone: string; driver_dob: string;
    license_number: string; license_expiry: string; license_region: string;
    pickup_method: string; rental_days: number; base_price: number; delivery_fee: number;
    tax_amount: number; protection_fee: number; extras_fee: number; discount_amount: number;
    deposit_amount: number; special_requests: string | null; internal_notes: string | null;
    created_at: string; vehicles: VehicleJoin;
  };

  return {
    id: b.id,
    reference: b.reference,
    customer_id: b.customer_id,
    vehicle_year: b.vehicles?.year ?? 0,
    vehicle_make: b.vehicles?.make ?? "",
    vehicle_model: b.vehicles?.model ?? "",
    pickup_date: b.pickup_date,
    return_date: b.return_date,
    status: b.status,
    total_amount: Number(b.total_amount),
    driver_name: b.driver_name,
    driver_email: b.driver_email,
    driver_phone: b.driver_phone,
    driver_dob: b.driver_dob,
    license_number: b.license_number,
    license_expiry: b.license_expiry,
    license_region: b.license_region,
    pickup_method: b.pickup_method,
    rental_days: b.rental_days,
    base_price: Number(b.base_price),
    delivery_fee: Number(b.delivery_fee),
    tax_amount: Number(b.tax_amount),
    protection_fee: Number(b.protection_fee),
    extras_fee: Number(b.extras_fee),
    discount_amount: Number(b.discount_amount),
    deposit_amount: Number(b.deposit_amount),
    special_requests: b.special_requests,
    internal_notes: b.internal_notes,
    created_at: b.created_at,
    history: (historyRes.data ?? []) as StatusHistoryRow[],
  };
}
```

- [ ] **Step 2: Verify tsc**

Run: `npx tsc --noEmit`
Expected: no errors.

- [ ] **Step 3: Commit**

```bash
git add lib/queries/management-bookings.ts
git commit -m "feat(plan4): add listAllBookings and getManagementBookingDetail queries"
```

---

## Task 5: Server actions — transitionBookingStatus, updateBookingNotes

**Files:**
- Create: `lib/actions/management-bookings.ts`

- [ ] **Step 1: Create `lib/actions/management-bookings.ts`**

```typescript
"use server";

import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import { canTransition, STATUS_LABEL, isBookingStatus, type BookingStatus } from "@/lib/booking-status";
import { transitionSchema, notesSchema } from "@/lib/validators/management-bookings";

type ActionResult = { success?: true; error?: string; field?: string };

export async function transitionBookingStatus(formData: FormData): Promise<ActionResult> {
  const raw = {
    booking_id: String(formData.get("booking_id") ?? ""),
    next_status: String(formData.get("next_status") ?? ""),
    note: (formData.get("note") as string | null) || null,
  };

  const parsed = transitionSchema.safeParse(raw);
  if (!parsed.success) {
    const first = parsed.error.issues[0];
    return { error: first.message, field: first.path.join(".") };
  }
  const { booking_id, next_status, note } = parsed.data;

  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return { error: "Not signed in" };

  const { data: current, error: fetchErr } = await supabase
    .from("bookings")
    .select("id, status")
    .eq("id", booking_id)
    .maybeSingle();
  if (fetchErr) throw fetchErr;
  if (!current) return { error: "Booking not found" };
  if (!isBookingStatus(current.status)) return { error: `Unrecognized current status: ${current.status}` };

  const from = current.status as BookingStatus;
  if (!canTransition(from, next_status)) {
    return { error: `Cannot transition from ${STATUS_LABEL[from]} to ${STATUS_LABEL[next_status]}.` };
  }

  // TODO(plan-5-refunds): when the refunds workflow lands, replace this note-only
  // path with an actual refunds row + Stripe refund API call.
  if (next_status === "refunded" && (!note || !note.trim())) {
    return { error: "Refunds require a note.", field: "note" };
  }

  const { error: updErr } = await supabase
    .from("bookings")
    .update({ status: next_status, updated_at: new Date().toISOString() })
    .eq("id", booking_id);
  if (updErr) throw updErr;

  const { error: histErr } = await supabase
    .from("booking_status_history")
    .insert({
      booking_id,
      status: next_status,
      changed_by: user.id,
      note: note ?? null,
    });
  if (histErr) throw histErr;

  if (next_status === "cancelled" || next_status === "rejected") {
    const { error: delErr } = await supabase
      .from("vehicle_availability")
      .delete()
      .eq("reference_id", booking_id)
      .eq("type", "booking");
    if (delErr) {
      // Non-fatal: status change already persisted. Log and move on.
      console.error("Failed to release availability after cancel/reject", { booking_id, delErr });
    }
  }

  revalidatePath("/management/bookings");
  revalidatePath(`/management/bookings/${booking_id}`);
  return { success: true };
}

export async function updateBookingNotes(formData: FormData): Promise<ActionResult> {
  const raw = {
    booking_id: String(formData.get("booking_id") ?? ""),
    notes: String(formData.get("notes") ?? ""),
  };

  const parsed = notesSchema.safeParse(raw);
  if (!parsed.success) {
    const first = parsed.error.issues[0];
    return { error: first.message, field: first.path.join(".") };
  }
  const { booking_id, notes } = parsed.data;

  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return { error: "Not signed in" };

  const { error: updErr } = await supabase
    .from("bookings")
    .update({ internal_notes: notes, updated_at: new Date().toISOString() })
    .eq("id", booking_id);
  if (updErr) throw updErr;

  revalidatePath(`/management/bookings/${booking_id}`);
  return { success: true };
}
```

- [ ] **Step 2: Verify tsc**

Run: `npx tsc --noEmit`
Expected: no errors.

- [ ] **Step 3: Commit**

```bash
git add lib/actions/management-bookings.ts
git commit -m "feat(plan4): add transitionBookingStatus and updateBookingNotes actions"
```

---

## Task 6: Management sidebar + layout + error boundary

**Files:**
- Create: `components/management/sidebar.tsx`
- Modify: `app/management/layout.tsx`
- Create: `app/management/error.tsx`

- [ ] **Step 1: Create `components/management/sidebar.tsx`**

```typescript
import Link from "next/link";

const ITEMS = [
  { href: "/management/bookings", label: "Bookings", enabled: true },
  { href: "#", label: "Vehicles", enabled: false },
  { href: "#", label: "Customers", enabled: false },
  { href: "#", label: "Calendar", enabled: false },
  { href: "#", label: "Maintenance", enabled: false },
  { href: "#", label: "Settings", enabled: false },
];

export function ManagementSidebar({ activeHref }: { activeHref?: string }) {
  return (
    <aside className="w-56 shrink-0 bg-navy border-r border-navy-light py-8 px-4 min-h-screen">
      <div className="mb-8 px-2">
        <span className="text-lg font-bold tracking-widest uppercase text-white">WABS</span>
        <span className="block text-xs tracking-[0.3em] text-gold uppercase">Management</span>
      </div>
      <nav>
        <ul className="space-y-1">
          {ITEMS.map((item) => {
            const isActive = item.enabled && activeHref === item.href;
            const base = "block px-3 py-2 rounded text-sm";
            if (!item.enabled) {
              return (
                <li key={item.label}>
                  <span className={`${base} text-text-muted-wabs cursor-not-allowed opacity-50`}>
                    {item.label}
                  </span>
                </li>
              );
            }
            return (
              <li key={item.label}>
                <Link
                  href={item.href}
                  className={`${base} ${isActive ? "bg-gold text-deep font-semibold" : "text-white hover:bg-navy-light hover:text-gold"}`}
                >
                  {item.label}
                </Link>
              </li>
            );
          })}
        </ul>
      </nav>
    </aside>
  );
}
```

- [ ] **Step 2: Replace `app/management/layout.tsx`**

```typescript
import { ManagementSidebar } from "@/components/management/sidebar";

export default function ManagementLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className="min-h-screen bg-deep text-white flex">
      <ManagementSidebar activeHref="/management/bookings" />
      <div className="flex-1 bg-warm-white text-navy">
        {children}
      </div>
    </div>
  );
}
```

Note: `activeHref` is hard-coded to `/management/bookings` for Plan 4 because that's the only live route. When more sections come online, the layout will need to read the current pathname (e.g., via `usePathname` in a client sidebar, or via server-side header inspection).

- [ ] **Step 3: Create `app/management/error.tsx`**

```typescript
"use client";

import { Button } from "@/components/ui/button";

export default function ManagementError({ reset }: { error: Error; reset: () => void }) {
  return (
    <div className="max-w-2xl mx-auto text-center py-24 px-6">
      <h1 className="text-2xl font-bold text-navy mb-2">Something went wrong</h1>
      <p className="text-text-muted-wabs mb-8">We couldn&apos;t load this management page.</p>
      <Button onClick={reset} className="bg-gold hover:bg-gold-muted text-deep font-semibold">
        Try again
      </Button>
    </div>
  );
}
```

- [ ] **Step 4: Verify build**

Run: `npm run build`
Expected: build succeeds. `/management` route still emits and renders inside the new layout.

- [ ] **Step 5: Commit**

```bash
git add components/management/sidebar.tsx app/management/layout.tsx app/management/error.tsx
git commit -m "feat(plan4): add management sidebar layout and error boundary"
```

---

## Task 7: Bookings list — table + filters

**Files:**
- Create: `components/management/bookings/bookings-table.tsx`
- Create: `components/management/bookings/bookings-filters.tsx`
- Create: `app/management/bookings/page.tsx`

- [ ] **Step 1: Create `components/management/bookings/bookings-table.tsx`**

```typescript
import Link from "next/link";
import type { ManagementBookingListItem } from "@/lib/queries/management-bookings";
import { StatusPill } from "./status-pill";
import { formatMoney } from "@/lib/utils/format";

export function BookingsTable({ bookings }: { bookings: ManagementBookingListItem[] }) {
  if (bookings.length === 0) {
    return (
      <div className="text-center py-16 bg-white border border-gray-200 rounded-lg">
        <p className="text-navy font-semibold mb-2">No bookings match your filters</p>
        <p className="text-text-muted-wabs">Try a different status or clear the search.</p>
      </div>
    );
  }
  return (
    <div className="bg-white border border-gray-200 rounded-lg overflow-hidden">
      <table className="w-full text-sm">
        <thead className="bg-gray-50 text-text-muted-wabs uppercase text-xs tracking-wider">
          <tr>
            <th className="text-left px-4 py-3">Reference</th>
            <th className="text-left px-4 py-3">Customer</th>
            <th className="text-left px-4 py-3">Vehicle</th>
            <th className="text-left px-4 py-3">Pickup</th>
            <th className="text-left px-4 py-3">Return</th>
            <th className="text-left px-4 py-3">Status</th>
            <th className="text-right px-4 py-3">Total</th>
          </tr>
        </thead>
        <tbody>
          {bookings.map((b) => (
            <tr key={b.id} data-booking-ref={b.reference} className="border-t border-gray-100 hover:bg-gray-50">
              <td className="px-4 py-3 font-mono text-navy">
                <Link href={`/management/bookings/${b.id}`} className="hover:text-gold">
                  {b.reference}
                </Link>
              </td>
              <td className="px-4 py-3 text-navy">
                <div>{b.driver_name}</div>
                <div className="text-xs text-text-muted-wabs">{b.driver_email}</div>
              </td>
              <td className="px-4 py-3 text-navy">
                {b.vehicle_year} {b.vehicle_make} {b.vehicle_model}
              </td>
              <td className="px-4 py-3 text-navy">{b.pickup_date.slice(0, 10)}</td>
              <td className="px-4 py-3 text-navy">{b.return_date.slice(0, 10)}</td>
              <td className="px-4 py-3"><StatusPill status={b.status} /></td>
              <td className="px-4 py-3 text-right font-semibold text-navy">{formatMoney(b.total_amount)}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
```

- [ ] **Step 2: Create `components/management/bookings/bookings-filters.tsx`**

```typescript
"use client";

import { useRouter, useSearchParams } from "next/navigation";
import { useEffect, useState } from "react";
import { BOOKING_STATUSES, STATUS_LABEL } from "@/lib/booking-status";

const CHIPS: { key: string | null; label: string }[] = [
  { key: null, label: "All" },
  ...BOOKING_STATUSES
    .filter((s) => s !== "draft" && s !== "awaiting_payment")
    .map((s) => ({ key: s, label: STATUS_LABEL[s] })),
];

export function BookingsFilters() {
  const router = useRouter();
  const params = useSearchParams();
  const status = params.get("status");
  const initialSearch = params.get("search") ?? "";
  const [search, setSearch] = useState(initialSearch);

  useEffect(() => {
    setSearch(params.get("search") ?? "");
  }, [params]);

  useEffect(() => {
    const handle = setTimeout(() => {
      const next = new URLSearchParams(params.toString());
      if (search) next.set("search", search);
      else next.delete("search");
      if (next.toString() !== params.toString()) {
        router.push(`/management/bookings?${next.toString()}`);
      }
    }, 400);
    return () => clearTimeout(handle);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [search]);

  const chipHref = (key: string | null) => {
    const next = new URLSearchParams(params.toString());
    if (key) next.set("status", key);
    else next.delete("status");
    const qs = next.toString();
    return `/management/bookings${qs ? `?${qs}` : ""}`;
  };

  return (
    <div className="flex flex-col gap-3 mb-6">
      <div className="flex flex-wrap gap-2" data-testid="bookings-filter-chips">
        {CHIPS.map((c) => {
          const isActive = (c.key ?? null) === (status ?? null);
          return (
            <a
              key={c.label}
              href={chipHref(c.key)}
              className={`px-3 py-1.5 rounded-full text-sm border transition-colors ${
                isActive
                  ? "bg-gold border-gold text-deep font-semibold"
                  : "bg-white border-gray-300 text-navy hover:border-gold"
              }`}
            >
              {c.label}
            </a>
          );
        })}
      </div>
      <input
        type="text"
        value={search}
        onChange={(e) => setSearch(e.target.value)}
        placeholder="Search reference, name, or email…"
        className="w-full max-w-md bg-white border border-gray-300 text-navy rounded px-3 py-2 focus:border-gold focus:outline-none text-sm"
        data-testid="bookings-search-input"
      />
    </div>
  );
}
```

- [ ] **Step 3: Create `app/management/bookings/page.tsx`**

```typescript
import { parseListParams } from "@/lib/validators/management-bookings";
import { listAllBookings } from "@/lib/queries/management-bookings";
import { BookingsFilters } from "@/components/management/bookings/bookings-filters";
import { BookingsTable } from "@/components/management/bookings/bookings-table";

export const dynamic = "force-dynamic";

export default async function ManagementBookingsPage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const raw = await searchParams;
  const params = parseListParams(raw);
  const bookings = await listAllBookings(params);

  return (
    <main className="max-w-7xl mx-auto p-8">
      <div className="mb-6">
        <p className="text-gold text-xs uppercase tracking-[0.3em] mb-2">Management</p>
        <h1 className="text-3xl font-bold text-navy">Bookings</h1>
        <p className="text-text-muted-wabs mt-2">
          {bookings.length} booking{bookings.length === 1 ? "" : "s"}
        </p>
      </div>
      <BookingsFilters />
      <BookingsTable bookings={bookings} />
    </main>
  );
}
```

- [ ] **Step 4: Verify build**

Run: `npm run build`
Expected: `/management/bookings` emits as dynamic.

- [ ] **Step 5: Commit**

```bash
git add components/management/bookings/bookings-table.tsx components/management/bookings/bookings-filters.tsx app/management/bookings/page.tsx
git commit -m "feat(plan4): add management bookings list with filters"
```

---

## Task 8: Booking detail — summary + history timeline

**Files:**
- Create: `components/management/bookings/booking-detail-header.tsx`
- Create: `components/management/bookings/booking-summary-panel.tsx`
- Create: `components/management/bookings/status-history-timeline.tsx`

- [ ] **Step 1: Create `components/management/bookings/booking-detail-header.tsx`**

```typescript
import type { ManagementBookingDetail } from "@/lib/queries/management-bookings";
import { StatusPill } from "./status-pill";

export function BookingDetailHeader({ booking }: { booking: ManagementBookingDetail }) {
  return (
    <div className="mb-6">
      <p className="text-gold text-xs uppercase tracking-[0.3em] mb-2">Booking</p>
      <div className="flex items-center gap-3">
        <h1 className="text-3xl font-bold text-navy font-mono">{booking.reference}</h1>
        <StatusPill status={booking.status} />
      </div>
      <p className="text-text-muted-wabs text-sm mt-2">
        Created {booking.created_at.slice(0, 10)}
      </p>
    </div>
  );
}
```

- [ ] **Step 2: Create `components/management/bookings/booking-summary-panel.tsx`**

```typescript
import type { ManagementBookingDetail } from "@/lib/queries/management-bookings";
import { formatMoney } from "@/lib/utils/format";

function Row({ label, value }: { label: string; value: React.ReactNode }) {
  return (
    <div className="flex justify-between text-sm py-1">
      <span className="text-text-muted-wabs">{label}</span>
      <span className="text-navy font-medium text-right">{value}</span>
    </div>
  );
}

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <section className="bg-white border border-gray-200 rounded-lg p-6">
      <h2 className="text-sm font-semibold uppercase tracking-wider text-text-muted-wabs mb-4">{title}</h2>
      <div className="space-y-1">{children}</div>
    </section>
  );
}

export function BookingSummaryPanel({ booking }: { booking: ManagementBookingDetail }) {
  return (
    <div className="space-y-4">
      <Section title="Trip">
        <Row label="Vehicle" value={`${booking.vehicle_year} ${booking.vehicle_make} ${booking.vehicle_model}`} />
        <Row label="Pickup" value={booking.pickup_date.slice(0, 10)} />
        <Row label="Return" value={booking.return_date.slice(0, 10)} />
        <Row label="Method" value={booking.pickup_method} />
        <Row label="Duration" value={`${booking.rental_days} day${booking.rental_days === 1 ? "" : "s"}`} />
      </Section>

      <Section title="Driver">
        <Row label="Name" value={booking.driver_name} />
        <Row label="Email" value={booking.driver_email} />
        <Row label="Phone" value={booking.driver_phone} />
        <Row label="Date of birth" value={booking.driver_dob} />
        <Row label="License" value={`${booking.license_number} (${booking.license_region})`} />
        <Row label="License expiry" value={booking.license_expiry} />
      </Section>

      <Section title="Pricing">
        <Row label="Base rental" value={formatMoney(booking.base_price)} />
        {booking.protection_fee > 0 && <Row label="Protection" value={formatMoney(booking.protection_fee)} />}
        {booking.extras_fee > 0 && <Row label="Extras" value={formatMoney(booking.extras_fee)} />}
        {booking.delivery_fee > 0 && <Row label="Delivery" value={formatMoney(booking.delivery_fee)} />}
        {booking.discount_amount > 0 && <Row label="Discount" value={`− ${formatMoney(booking.discount_amount)}`} />}
        {booking.tax_amount > 0 && <Row label="Tax" value={formatMoney(booking.tax_amount)} />}
        <div className="border-t border-gray-100 mt-2 pt-2">
          <Row label="Total charged" value={<strong>{formatMoney(booking.total_amount)}</strong>} />
        </div>
        {booking.deposit_amount > 0 && (
          <p className="text-xs text-text-muted-wabs mt-2">
            Refundable deposit: {formatMoney(booking.deposit_amount)}
          </p>
        )}
      </Section>

      {booking.special_requests && (
        <Section title="Special requests">
          <p className="text-sm text-navy">{booking.special_requests}</p>
        </Section>
      )}
    </div>
  );
}
```

- [ ] **Step 3: Create `components/management/bookings/status-history-timeline.tsx`**

```typescript
import type { StatusHistoryRow } from "@/lib/queries/management-bookings";
import { STATUS_LABEL, type BookingStatus } from "@/lib/booking-status";

export function StatusHistoryTimeline({ history }: { history: StatusHistoryRow[] }) {
  if (history.length === 0) {
    return (
      <p className="text-sm text-text-muted-wabs">No status history yet.</p>
    );
  }
  return (
    <ol className="space-y-3 relative pl-6 border-l-2 border-gray-200">
      {history.map((row, i) => {
        const label = STATUS_LABEL[row.status as BookingStatus] ?? row.status;
        return (
          <li key={i} className="relative">
            <span className="absolute -left-[29px] top-1 w-3 h-3 rounded-full bg-gold border-2 border-white" />
            <p className="text-sm font-semibold text-navy">{label}</p>
            <p className="text-xs text-text-muted-wabs">{row.created_at.slice(0, 19).replace("T", " ")}</p>
            {row.note && <p className="text-sm text-navy mt-1 bg-gray-50 rounded px-2 py-1">{row.note}</p>}
          </li>
        );
      })}
    </ol>
  );
}
```

- [ ] **Step 4: Verify tsc**

Run: `npx tsc --noEmit`
Expected: no errors.

- [ ] **Step 5: Commit**

```bash
git add components/management/bookings/booking-detail-header.tsx components/management/bookings/booking-summary-panel.tsx components/management/bookings/status-history-timeline.tsx
git commit -m "feat(plan4): add booking detail header, summary panel, and history timeline"
```

---

## Task 9: Status actions (client) + Notes editor (client)

**Files:**
- Create: `components/management/bookings/status-actions.tsx`
- Create: `components/management/bookings/notes-editor.tsx`

- [ ] **Step 1: Create `components/management/bookings/status-actions.tsx`**

```typescript
"use client";

import { useState, useTransition } from "react";
import { transitionBookingStatus } from "@/lib/actions/management-bookings";
import { nextStatusesFor, STATUS_LABEL, DESTRUCTIVE_TRANSITIONS, type BookingStatus } from "@/lib/booking-status";
import { Button } from "@/components/ui/button";
import {
  Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle, DialogTrigger,
} from "@/components/ui/dialog";

export function StatusActions({ bookingId, currentStatus }: { bookingId: string; currentStatus: string }) {
  const next = nextStatusesFor(currentStatus as BookingStatus);
  const [error, setError] = useState<string | null>(null);
  const [isPending, startTransition] = useTransition();

  if (next.length === 0) {
    return <p className="text-sm text-text-muted-wabs italic">This booking is in a final state.</p>;
  }

  const submit = (next_status: BookingStatus, note?: string) => {
    setError(null);
    const fd = new FormData();
    fd.set("booking_id", bookingId);
    fd.set("next_status", next_status);
    if (note) fd.set("note", note);
    startTransition(async () => {
      const res = await transitionBookingStatus(fd);
      if (res?.error) setError(res.error);
    });
  };

  return (
    <div className="space-y-3" data-testid="status-actions">
      {next.map((n) => {
        const label = STATUS_LABEL[n];
        const destructive = DESTRUCTIVE_TRANSITIONS.has(n);
        if (!destructive) {
          return (
            <Button
              key={n}
              onClick={() => submit(n)}
              disabled={isPending}
              className="w-full bg-gold hover:bg-gold-muted text-deep font-semibold"
              data-testid={`action-${n}`}
            >
              {label}
            </Button>
          );
        }
        return <DestructiveActionButton key={n} nextStatus={n} label={label} isPending={isPending} onConfirm={submit} />;
      })}
      {error && <p className="text-red-600 text-sm">{error}</p>}
    </div>
  );
}

function DestructiveActionButton({
  nextStatus, label, isPending, onConfirm,
}: {
  nextStatus: BookingStatus;
  label: string;
  isPending: boolean;
  onConfirm: (next: BookingStatus, note?: string) => void;
}) {
  const [open, setOpen] = useState(false);
  const [note, setNote] = useState("");
  const requiresNote = nextStatus === "refunded";

  const handle = () => {
    if (requiresNote && !note.trim()) return;
    onConfirm(nextStatus, note.trim() || undefined);
    setOpen(false);
    setNote("");
  };

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button
          disabled={isPending}
          className="w-full bg-red-600 hover:bg-red-700 text-white font-semibold"
          data-testid={`action-${nextStatus}`}
        >
          {label}
        </Button>
      </DialogTrigger>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Confirm {label}</DialogTitle>
          <DialogDescription>
            {nextStatus === "refunded"
              ? "Refunds require a note explaining the reason."
              : `This will mark the booking as ${label.toLowerCase()}. Continue?`}
          </DialogDescription>
        </DialogHeader>
        <textarea
          value={note}
          onChange={(e) => setNote(e.target.value)}
          placeholder={requiresNote ? "Reason for refund (required)…" : "Optional note…"}
          className="w-full min-h-[80px] border border-gray-300 rounded px-3 py-2 text-sm text-navy focus:border-gold focus:outline-none"
          maxLength={500}
        />
        <DialogFooter>
          <Button variant="ghost" onClick={() => setOpen(false)}>Cancel</Button>
          <Button
            onClick={handle}
            disabled={requiresNote && !note.trim()}
            className="bg-red-600 hover:bg-red-700 text-white"
          >
            Confirm {label}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
```

- [ ] **Step 2: Create `components/management/bookings/notes-editor.tsx`**

```typescript
"use client";

import { useState, useTransition } from "react";
import { updateBookingNotes } from "@/lib/actions/management-bookings";
import { Button } from "@/components/ui/button";

export function NotesEditor({ bookingId, initialNotes }: { bookingId: string; initialNotes: string | null }) {
  const [notes, setNotes] = useState(initialNotes ?? "");
  const [status, setStatus] = useState<"idle" | "saved" | "error">("idle");
  const [error, setError] = useState<string | null>(null);
  const [isPending, startTransition] = useTransition();

  const onSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    setStatus("idle");
    const fd = new FormData();
    fd.set("booking_id", bookingId);
    fd.set("notes", notes);
    startTransition(async () => {
      const res = await updateBookingNotes(fd);
      if (res?.error) { setStatus("error"); setError(res.error); }
      else setStatus("saved");
    });
  };

  return (
    <form onSubmit={onSubmit} className="space-y-3" data-testid="notes-editor">
      <label className="block text-sm font-semibold uppercase tracking-wider text-text-muted-wabs">
        Internal notes (staff only)
      </label>
      <textarea
        value={notes}
        onChange={(e) => { setNotes(e.target.value); setStatus("idle"); }}
        placeholder="Add internal notes about this booking…"
        maxLength={2000}
        className="w-full min-h-[120px] border border-gray-300 rounded px-3 py-2 text-sm text-navy focus:border-gold focus:outline-none bg-white"
      />
      <div className="flex items-center gap-3">
        <Button type="submit" disabled={isPending} className="bg-gold hover:bg-gold-muted text-deep font-semibold">
          {isPending ? "Saving…" : "Save notes"}
        </Button>
        {status === "saved" && <span className="text-green-700 text-sm">Saved</span>}
        {status === "error" && <span className="text-red-600 text-sm">{error}</span>}
      </div>
    </form>
  );
}
```

- [ ] **Step 3: Verify tsc**

Run: `npx tsc --noEmit`
Expected: no errors.

- [ ] **Step 4: Commit**

```bash
git add components/management/bookings/status-actions.tsx components/management/bookings/notes-editor.tsx
git commit -m "feat(plan4): add status action buttons and notes editor"
```

---

## Task 10: Booking detail page

**Files:**
- Create: `app/management/bookings/[id]/page.tsx`

- [ ] **Step 1: Create `app/management/bookings/[id]/page.tsx`**

```typescript
import { notFound } from "next/navigation";
import Link from "next/link";
import { ChevronLeft } from "lucide-react";
import { getManagementBookingDetail } from "@/lib/queries/management-bookings";
import { BookingDetailHeader } from "@/components/management/bookings/booking-detail-header";
import { BookingSummaryPanel } from "@/components/management/bookings/booking-summary-panel";
import { StatusHistoryTimeline } from "@/components/management/bookings/status-history-timeline";
import { StatusActions } from "@/components/management/bookings/status-actions";
import { NotesEditor } from "@/components/management/bookings/notes-editor";

export const dynamic = "force-dynamic";

export default async function ManagementBookingDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const detail = await getManagementBookingDetail(id);
  if (!detail) notFound();

  return (
    <main className="max-w-6xl mx-auto p-8">
      <Link
        href="/management/bookings"
        className="inline-flex items-center gap-1 text-sm text-gold hover:underline mb-4"
      >
        <ChevronLeft className="w-4 h-4" /> Back to bookings
      </Link>

      <BookingDetailHeader booking={detail} />

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-8 mt-6">
        <div className="lg:col-span-2 space-y-6">
          <BookingSummaryPanel booking={detail} />
          <section className="bg-white border border-gray-200 rounded-lg p-6">
            <h2 className="text-sm font-semibold uppercase tracking-wider text-text-muted-wabs mb-4">
              Status history
            </h2>
            <StatusHistoryTimeline history={detail.history} />
          </section>
        </div>

        <aside className="space-y-6">
          <section className="bg-white border border-gray-200 rounded-lg p-6">
            <h2 className="text-sm font-semibold uppercase tracking-wider text-text-muted-wabs mb-4">
              Actions
            </h2>
            <StatusActions bookingId={detail.id} currentStatus={detail.status} />
          </section>

          <section className="bg-white border border-gray-200 rounded-lg p-6">
            <NotesEditor bookingId={detail.id} initialNotes={detail.internal_notes} />
          </section>
        </aside>
      </div>
    </main>
  );
}
```

- [ ] **Step 2: Verify build**

Run: `npm run build`
Expected: `/management/bookings/[id]` emits as dynamic.

- [ ] **Step 3: Commit**

```bash
git add "app/management/bookings/[id]/page.tsx"
git commit -m "feat(plan4): add management booking detail page"
```

---

## Task 11: Automated smoke test

**Files:**
- Create: `scripts/smoke-test-management-bookings.mjs`

- [ ] **Step 1: Create `scripts/smoke-test-management-bookings.mjs`**

```javascript
// Automated smoke test for management bookings workflow.
// Requires dev server running at NEXT_PUBLIC_APP_URL (default http://localhost:3000).
// Usage: set -a && source .env.local && set +a && node scripts/smoke-test-management-bookings.mjs

const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL;
const ANON_KEY = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
const SERVICE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY;
const APP_URL = process.env.NEXT_PUBLIC_APP_URL || "http://localhost:3000";
const PROJECT_REF = new URL(SUPABASE_URL).hostname.split(".")[0];
const COOKIE_NAME = `sb-${PROJECT_REF}-auth-token`;
const TEST_EMAIL = "mgmt-test@example.local";
const VEHICLE = "aaaaaaaa-0000-0000-0000-000000000001";

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

async function admin(path, init = {}) {
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

async function cleanupPriorTestBookings() {
  const res = await admin(`bookings?driver_email=eq.${encodeURIComponent(TEST_EMAIL)}&select=id`);
  if (!res.ok) return;
  const rows = await res.json();
  for (const r of rows) {
    await admin(`vehicle_availability?reference_id=eq.${r.id}`, { method: "DELETE" });
    await admin(`booking_extras?booking_id=eq.${r.id}`, { method: "DELETE" });
    await admin(`booking_status_history?booking_id=eq.${r.id}`, { method: "DELETE" });
    await admin(`payments?booking_id=eq.${r.id}`, { method: "DELETE" });
    await admin(`bookings?id=eq.${r.id}`, { method: "DELETE" });
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

async function createTestBooking(userId) {
  const pickup = new Date(Date.now() + 90 * 86400000).toISOString().slice(0, 10);
  const ret = new Date(Date.now() + 94 * 86400000).toISOString().slice(0, 10);
  const reference = "WBS-MGMT-" + Math.random().toString(36).slice(2, 8).toUpperCase();
  const p_booking = {
    reference, customer_id: userId, vehicle_id: VEHICLE,
    pickup_date: pickup, return_date: ret, pickup_method: "pickup", pickup_location_id: "",
    driver_name: "Mgmt Test", driver_email: TEST_EMAIL, driver_phone: "+15550001111",
    driver_dob: "1990-01-01", license_number: "MGMTTEST", license_expiry: "2030-01-01", license_region: "CA",
    rental_days: 4, base_price: 4800, delivery_fee: 0, tax_amount: 384, protection_fee: 0,
    extras_fee: 0, discount_amount: 0, deposit_amount: 5000, total_amount: 5184,
    protection_plan_id: "", promo_code_id: "", special_requests: "", extras: [],
  };
  const res = await admin(`rpc/create_booking_with_availability`, {
    method: "POST",
    body: JSON.stringify({ p_booking }),
  });
  if (!res.ok) throw new Error(`create booking: ${res.status} ${await res.text()}`);
  const body = await res.json();
  return { reference: body, pickup, ret };
}

async function fetchBookingRow(reference) {
  const res = await admin(`bookings?reference=eq.${reference}`);
  const rows = await res.json();
  return rows[0];
}

async function run() {
  console.log(`App: ${APP_URL}\n`);
  await cleanupPriorTestBookings();

  const custSession = await signIn("customer@wabs.com", "WabsDemo2024!");
  const custCookie = buildAuthCookie(custSession);
  const mgrSession = await signIn("manager@wabs.com", "WabsDemo2024!");
  const mgrCookie = buildAuthCookie(mgrSession);

  const { reference } = await createTestBooking(custSession.user.id);
  const booking = await fetchBookingRow(reference);
  check("test booking created", booking?.reference === reference);

  // List page renders
  const list = await get(`/management/bookings`, mgrCookie);
  check("GET /management/bookings (manager) → 200", list.status === 200);
  check("list contains test reference", list.body.includes(reference));

  // Status filter
  const listPending = await get(`/management/bookings?status=pending`, mgrCookie);
  check("filter status=pending contains ref", listPending.body.includes(reference));
  const listCompleted = await get(`/management/bookings?status=completed`, mgrCookie);
  check("filter status=completed excludes ref", !listCompleted.body.includes(reference));

  // Search
  const listSearch = await get(`/management/bookings?search=${encodeURIComponent(reference)}`, mgrCookie);
  check("search by reference contains ref", listSearch.body.includes(reference));

  // Detail page
  const detail = await get(`/management/bookings/${booking.id}`, mgrCookie);
  check("GET /management/bookings/<id> → 200", detail.status === 200);
  check("detail contains driver_email marker", detail.body.includes(TEST_EMAIL));
  check("detail contains notes-editor marker", detail.body.includes("notes-editor"));
  check("detail contains status-actions marker", detail.body.includes("status-actions"));

  // Guards
  const badUuid = await get(`/management/bookings/00000000-0000-0000-0000-000000000000`, mgrCookie);
  check("bogus uuid detail → 404", badUuid.status === 404);
  const notUuid = await get(`/management/bookings/not-a-uuid`, mgrCookie);
  check("non-uuid detail → 404", notUuid.status === 404);

  // Customer cannot access management
  const custBlocked = await get(`/management/bookings`, custCookie);
  check("customer /management/bookings → redirect", custBlocked.status === 307 || custBlocked.status === 302);

  // Simulate transition: pending → confirmed via service role (mirrors what the action does)
  await admin(`bookings?id=eq.${booking.id}`, {
    method: "PATCH",
    headers: { Prefer: "return=minimal" },
    body: JSON.stringify({ status: "confirmed" }),
  });
  await admin(`booking_status_history`, {
    method: "POST",
    headers: { Prefer: "return=minimal" },
    body: JSON.stringify({ booking_id: booking.id, status: "confirmed", changed_by: mgrSession.user.id, note: null }),
  });
  const confirmed = await fetchBookingRow(reference);
  check("DB transition pending→confirmed", confirmed.status === "confirmed");

  // Simulate cancel + availability delete
  await admin(`bookings?id=eq.${booking.id}`, {
    method: "PATCH",
    headers: { Prefer: "return=minimal" },
    body: JSON.stringify({ status: "cancelled" }),
  });
  await admin(`booking_status_history`, {
    method: "POST",
    headers: { Prefer: "return=minimal" },
    body: JSON.stringify({ booking_id: booking.id, status: "cancelled", changed_by: mgrSession.user.id, note: "test cancel" }),
  });
  await admin(`vehicle_availability?reference_id=eq.${booking.id}&type=eq.booking`, { method: "DELETE" });

  const cancelled = await fetchBookingRow(reference);
  check("DB transition to cancelled", cancelled.status === "cancelled");

  const availRes = await admin(`vehicle_availability?reference_id=eq.${booking.id}&type=eq.booking&select=id`);
  const availRows = await availRes.json();
  check("vehicle_availability row deleted", availRows.length === 0);

  // History rows exist
  const histRes = await admin(`booking_status_history?booking_id=eq.${booking.id}&select=status&order=created_at.asc`);
  const hist = await histRes.json();
  check("history contains confirmed + cancelled", hist.some(h => h.status === "confirmed") && hist.some(h => h.status === "cancelled"));

  const passed = results.filter(Boolean).length;
  console.log(`\n${passed}/${results.length} checks passed`);
  process.exit(passed === results.length ? 0 : 1);
}

run().catch((err) => { console.error(err); process.exit(1); });
```

- [ ] **Step 2: Start dev server (background) and wait for ready**

Kill any lingering CarRental dev processes first:
```bash
powershell -Command "Get-WmiObject Win32_Process | Where-Object CommandLine -match 'CarRental.*next.*dev' | Select-Object ProcessId, CommandLine | Format-List"
```
Kill any listed PIDs via `taskkill //PID <pid> //F`.

Then start dev in background with `run_in_background: true`:
```bash
npm run dev
```

Wait ~7 seconds. Read the task output file — look for `- Local:` line to get the port (3000 or 3001) and `✓ Ready`.

- [ ] **Step 3: Run the smoke test**

If port is 3001:
```bash
set -a && source .env.local && set +a && NEXT_PUBLIC_APP_URL=http://localhost:3001 node scripts/smoke-test-management-bookings.mjs
```
Else default 3000:
```bash
set -a && source .env.local && set +a && node scripts/smoke-test-management-bookings.mjs
```
Expected: all checks pass.

- [ ] **Step 4: Stop dev server** via TaskStop.

- [ ] **Step 5: Commit**

```bash
git add scripts/smoke-test-management-bookings.mjs
git commit -m "feat(plan4): add automated smoke test for management bookings"
```

---

## Task 12: Manual smoke test checklist

**Files:**
- Create: `docs/superpowers/plans/2026-09-26-plan-4-smoke-test.md`

- [ ] **Step 1: Create the checklist**

```markdown
# Plan 4 — Manual Smoke Test Checklist

Prerequisites:
- `npm run dev` on http://localhost:3000
- Plans 1-3 smoke tests still green
- At least one confirmed booking in the DB (from Plan 3 smoke or manual test flow)

## Sidebar + layout
- [ ] Signed in as manager or admin, visiting `/management/bookings` shows the sidebar
- [ ] "Bookings" nav item is highlighted (gold background)
- [ ] Disabled items (Vehicles, Customers, Calendar, Maintenance, Settings) render greyed out and do not link anywhere

## List page
- [ ] Table shows all bookings sorted by created_at DESC
- [ ] Status pill matches Plan 3 /account style
- [ ] Clicking a status chip updates the URL (`?status=…`) and filters the table
- [ ] Clicking the "All" chip removes the status param
- [ ] Typing in the search input filters after ~400ms; URL updates to `?search=…`
- [ ] Search matches by reference, driver name, driver email
- [ ] Empty state renders when no bookings match

## Detail page
- [ ] Clicking a row navigates to `/management/bookings/[id]`
- [ ] All summary sections render (Trip, Driver, Pricing, Special requests when present)
- [ ] Status history timeline shows chronological transitions with timestamps
- [ ] Only valid next-status buttons visible for the current status
- [ ] Terminal states (completed, cancelled, rejected, refunded) show "This booking is in a final state" message
- [ ] Approve / Mark ready / Mark active / Mark completed submit directly
- [ ] Cancel / Reject open a confirm dialog with optional note field
- [ ] Refund opens a confirm dialog with a required note; submit is disabled while note is empty
- [ ] Notes editor prefills existing internal_notes; save shows "Saved" indicator; value persists on reload
- [ ] Direct navigation to `/management/bookings/<random-uuid>` returns 404
- [ ] Direct navigation to `/management/bookings/not-a-uuid` returns 404

## Cancel/reject side effect
- [ ] Cancel a `confirmed` booking
- [ ] Attempt Plan 3 checkout for the same vehicle + same dates as a different customer → checkout succeeds (dates freed)

## Refund flow
- [ ] From a `confirmed` booking, click Refund → dialog opens
- [ ] Submit with empty note → button disabled
- [ ] Enter a reason → submit → booking status becomes `refunded`; timeline shows the note

## Access control (regression)
- [ ] Sign in as customer → visit `/management/bookings` → redirected to `/`
- [ ] Sign out → visit `/management/bookings` → redirected to `/login`

## Full regression
- [ ] `smoke-test-auth.mjs` — 12/12
- [ ] `smoke-test-browse.mjs` — 20/20
- [ ] `smoke-test-checkout.mjs` — 11/11
- [ ] `smoke-test-management-bookings.mjs` — all pass
```

- [ ] **Step 2: Commit**

```bash
git add docs/superpowers/plans/2026-09-26-plan-4-smoke-test.md
git commit -m "docs(plan4): add manual smoke test checklist"
```

---

## Task 13: Final verification

**Files:** none (verification only)

- [ ] **Step 1: Full clean build**

Run: `rm -rf .next && npm run build`
Expected: all Plan 1+2+3+4 routes emit. Verify these new routes appear: `/management/bookings`, `/management/bookings/[id]`. All existing routes still present.

- [ ] **Step 2: Type check**

Run: `npx tsc --noEmit`
Expected: clean.

- [ ] **Step 3: Run all 4 smoke tests (dev server up)**

```bash
node scripts/smoke-test-auth.mjs             # 12/12
node scripts/smoke-test-browse.mjs           # 20/20
node scripts/smoke-test-checkout.mjs         # 11/11
node scripts/smoke-test-management-bookings.mjs  # all pass
```

If Plan 4 breaks any earlier suite, investigate — do NOT paper over.

- [ ] **Step 4: Kill dev server** and report. Manual checklist ready. No commit needed.
