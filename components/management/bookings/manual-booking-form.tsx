"use client";

import { useMemo, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { createManualBooking } from "@/lib/actions/booking-ops";
import type { BookableVehicle } from "@/lib/queries/management-bookings";
import type { CustomerListItem } from "@/lib/queries/management-customers";
import type { ProtectionPlanOption } from "@/lib/queries/extras";
import { Button } from "@/components/ui/button";

const inputCls =
  "w-full border border-gray-300 rounded px-3 py-2 text-sm text-navy focus:border-gold focus:outline-none bg-white";

function Field({ label, error, children }: { label: string; error?: boolean; children: React.ReactNode }) {
  return (
    <label className="block">
      <span className={`block text-xs font-semibold uppercase tracking-wider mb-1 ${error ? "text-red-600" : "text-text-muted-wabs"}`}>
        {label}
      </span>
      {children}
    </label>
  );
}

export function ManualBookingForm({
  customers, vehicles, plans, presetCustomerId,
}: {
  customers: CustomerListItem[];
  vehicles: BookableVehicle[];
  plans: ProtectionPlanOption[];
  presetCustomerId?: string;
}) {
  const router = useRouter();
  const [customerId, setCustomerId] = useState(presetCustomerId ?? "");
  const [status, setStatus] = useState<"pending" | "confirmed">("confirmed");
  const [error, setError] = useState<{ message: string; field?: string } | null>(null);
  const [isPending, startTransition] = useTransition();

  const customer = useMemo(() => customers.find(c => c.id === customerId), [customers, customerId]);
  const bad = (f: string) => error?.field === f;

  const onSubmit = (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    const fd = new FormData(e.currentTarget);
    setError(null);
    startTransition(async () => {
      const res = await createManualBooking(fd);
      if (res.error) {
        setError({ message: res.error, field: res.field });
        if (res.field) document.querySelector<HTMLElement>(`[name="${res.field}"]`)?.focus();
      } else if (res.booking_id) {
        router.push(`/management/bookings/${res.booking_id}`);
      }
    });
  };

  return (
    <form onSubmit={onSubmit} className="space-y-6" data-testid="manual-booking-form">
      <section className="bg-white border border-gray-200 rounded-lg p-6 grid grid-cols-1 md:grid-cols-2 gap-4">
        <h2 className="md:col-span-2 text-sm font-semibold uppercase tracking-wider text-text-muted-wabs">Customer &amp; vehicle</h2>
        <Field label="Customer" error={bad("customer_id")}>
          <select name="customer_id" value={customerId} onChange={e => setCustomerId(e.target.value)} required className={inputCls}>
            <option value="">Choose a customer…</option>
            {customers.map(c => (
              <option key={c.id} value={c.id}>
                {[c.first_name, c.last_name].filter(Boolean).join(" ") || c.email} · {c.email}{c.flagged ? " ⚑" : ""}
              </option>
            ))}
          </select>
        </Field>
        <Field label="Vehicle" error={bad("vehicle_id")}>
          <select name="vehicle_id" required className={inputCls} defaultValue="">
            <option value="">Choose a vehicle…</option>
            {vehicles.map(v => <option key={v.id} value={v.id}>{v.label} · ${v.daily_price}/day</option>)}
          </select>
        </Field>
        {customer?.flagged && (
          <p className="md:col-span-2 text-sm bg-red-50 text-red-700 rounded px-3 py-2">This customer is flagged. Check their profile before booking.</p>
        )}
        <Field label="Pickup date" error={bad("pickup_date")}>
          <input name="pickup_date" type="date" required className={inputCls} />
        </Field>
        <Field label="Return date" error={bad("return_date")}>
          <input name="return_date" type="date" required className={inputCls} />
        </Field>
        <Field label="Protection plan">
          <select name="protection_plan_id" className={inputCls} defaultValue="">
            <option value="">None</option>
            {plans.map(p => <option key={p.id} value={p.id}>{p.name} · ${p.daily_price}/day</option>)}
          </select>
        </Field>
        <input type="hidden" name="pickup_method" value="pickup" />
      </section>

      <section className="bg-white border border-gray-200 rounded-lg p-6 grid grid-cols-1 md:grid-cols-2 gap-4" key={customerId}>
        <h2 className="md:col-span-2 text-sm font-semibold uppercase tracking-wider text-text-muted-wabs">Driver</h2>
        <Field label="Full name" error={bad("driver_name")}>
          <input name="driver_name" required defaultValue={customer ? [customer.first_name, customer.last_name].filter(Boolean).join(" ") : ""} className={inputCls} />
        </Field>
        <Field label="Email" error={bad("driver_email")}>
          <input name="driver_email" type="email" required defaultValue={customer?.email ?? ""} className={inputCls} />
        </Field>
        <Field label="Phone" error={bad("driver_phone")}>
          <input name="driver_phone" type="tel" required defaultValue={customer?.phone ?? ""} className={inputCls} />
        </Field>
        <Field label="Date of birth" error={bad("driver_dob")}>
          <input name="driver_dob" type="date" required className={inputCls} />
        </Field>
        <Field label="Licence number" error={bad("license_number")}>
          <input name="license_number" required className={inputCls} />
        </Field>
        <Field label="Licence expiry" error={bad("license_expiry")}>
          <input name="license_expiry" type="date" required className={inputCls} />
        </Field>
        <Field label="Issuing region" error={bad("license_region")}>
          <input name="license_region" required className={inputCls} placeholder="e.g. CA" />
        </Field>
        <Field label="Special requests">
          <input name="special_requests" maxLength={500} className={inputCls} />
        </Field>
      </section>

      <section className="bg-white border border-gray-200 rounded-lg p-6 grid grid-cols-1 md:grid-cols-2 gap-4">
        <h2 className="md:col-span-2 text-sm font-semibold uppercase tracking-wider text-text-muted-wabs">Status &amp; payment</h2>
        <Field label="Initial status">
          <select name="initial_status" value={status} onChange={e => setStatus(e.target.value as "pending" | "confirmed")} className={inputCls}>
            <option value="confirmed">Confirmed</option>
            <option value="pending">Pending (customer pays later)</option>
          </select>
        </Field>
        <Field label="Payment" error={bad("payment_method")}>
          <select name="payment_method" className={inputCls} defaultValue="none" disabled={status === "pending"}>
            <option value="none">Not paid yet</option>
            <option value="cash">Paid in person (cash / card terminal)</option>
          </select>
        </Field>
        <p className="md:col-span-2 text-xs text-text-muted-wabs">
          The price is calculated from current rates, tax and the selected protection plan, the same way as online checkout.
          You&apos;ll see the breakdown on the next page.
        </p>
      </section>

      <div className="flex items-center gap-4">
        <Button type="submit" disabled={isPending} className="bg-gold hover:bg-gold-muted text-deep font-semibold">
          {isPending ? "Creating…" : "Create booking"}
        </Button>
        {error && <p className="text-red-600 text-sm" role="alert">{error.message}</p>}
      </div>
    </form>
  );
}
