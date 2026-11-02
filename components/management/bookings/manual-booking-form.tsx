"use client";

import { useMemo, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { createManualBooking } from "@/lib/actions/booking-ops";
import type { BookableVehicle } from "@/lib/queries/management-bookings";
import type { ExtraOption, ProtectionPlanOption } from "@/lib/queries/extras";
import type { CustomerOption } from "@/lib/actions/customer-lookup";
import { CustomerPicker, customerName } from "./customer-picker";
import { Button } from "@/components/ui/button";

const inputCls =
  "w-full border border-gray-300 rounded px-3 py-2 text-sm text-navy focus:border-gold focus:outline-none bg-white";

// `group` renders a fieldset instead of a <label>, for fields that contain
// their own labels or several controls (nested labels misroute clicks).
function Field({ label, error, group, children }: { label: string; error?: boolean; group?: boolean; children: React.ReactNode }) {
  const caption = (
    <span className={`block text-xs font-semibold uppercase tracking-wider mb-1 ${error ? "text-red-600" : "text-text-muted-wabs"}`}>
      {label}
    </span>
  );
  if (group) {
    return (
      <fieldset className="block min-w-0">
        <legend className="contents">{caption}</legend>
        {children}
      </fieldset>
    );
  }
  return (
    <label className="block">
      {caption}
      {children}
    </label>
  );
}

export function ManualBookingForm({
  vehicles, plans, extras, presetCustomer,
}: {
  vehicles: BookableVehicle[];
  plans: ProtectionPlanOption[];
  extras: ExtraOption[];
  presetCustomer?: CustomerOption | null;
}) {
  const router = useRouter();
  const [customer, setCustomer] = useState<CustomerOption | null>(presetCustomer ?? null);
  const [vehicleId, setVehicleId] = useState("");
  const [method, setMethod] = useState<"pickup" | "delivery">("pickup");
  const [qty, setQty] = useState<Record<string, number>>({});
  const [status, setStatus] = useState<"pending" | "confirmed">("confirmed");
  const [error, setError] = useState<{ message: string; field?: string } | null>(null);
  const [isPending, startTransition] = useTransition();

  const vehicle = useMemo(() => vehicles.find(v => v.id === vehicleId) ?? null, [vehicles, vehicleId]);
  const canDeliver = !!vehicle?.location?.delivery_available;
  const effectiveMethod = canDeliver ? method : "pickup";
  const chosenExtras = Object.entries(qty).filter(([, n]) => n > 0).map(([extra_id, quantity]) => ({ extra_id, quantity }));
  const bad = (f: string) => error?.field === f;

  const onSubmit = (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    const fd = new FormData(e.currentTarget);
    fd.set("pickup_method", effectiveMethod);
    fd.set("pickup_location_id", effectiveMethod === "delivery" ? vehicle?.location?.id ?? "" : "");
    fd.set("extras", JSON.stringify(chosenExtras));
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
        <Field label="Customer" error={bad("customer_id")} group>
          <CustomerPicker value={customer} onChange={setCustomer} invalid={bad("customer_id")} />
        </Field>
        <Field label="Vehicle" error={bad("vehicle_id")}>
          <select name="vehicle_id" required className={inputCls} value={vehicleId} onChange={e => setVehicleId(e.target.value)}>
            <option value="">Choose a vehicle…</option>
            {vehicles.map(v => <option key={v.id} value={v.id}>{v.label} · ${v.daily_price}/day</option>)}
          </select>
        </Field>
        {customer?.flagged && (
          <p className="md:col-span-2 text-sm bg-red-50 text-red-700 rounded px-3 py-2">This customer is flagged. Check their profile before booking.</p>
        )}
        {customer && !customer.is_active && (
          <p className="md:col-span-2 text-sm bg-gray-100 text-gray-700 rounded px-3 py-2">This customer is deactivated and can&apos;t sign in, so they won&apos;t see this booking online.</p>
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
        <Field label="Handover" error={bad("pickup_location_id")} group>
          <div className="flex flex-wrap gap-4 py-2 text-sm text-navy">
            <label className="inline-flex items-center gap-2">
              <input type="radio" name="method_choice" checked={effectiveMethod === "pickup"} onChange={() => setMethod("pickup")} />
              Pickup{vehicle?.location?.name ? ` at ${vehicle.location.name}` : ""}
            </label>
            <label className={`inline-flex items-center gap-2 ${canDeliver ? "" : "opacity-40"}`}>
              <input type="radio" name="method_choice" disabled={!canDeliver} checked={effectiveMethod === "delivery"} onChange={() => setMethod("delivery")} data-testid="method-delivery" />
              Delivery{canDeliver ? ` (+$${vehicle!.location!.delivery_fee})` : ""}
            </label>
          </div>
          {vehicle && !canDeliver && <span className="text-[11px] text-text-muted-wabs">This vehicle&apos;s location doesn&apos;t offer delivery.</span>}
        </Field>
      </section>

      {extras.length > 0 && (
        <section className="bg-white border border-gray-200 rounded-lg p-6" data-testid="manual-extras">
          <h2 className="text-sm font-semibold uppercase tracking-wider text-text-muted-wabs mb-4">Extras</h2>
          <ul className="grid grid-cols-1 md:grid-cols-2 gap-3">
            {extras.map(x => (
              <li key={x.id} className="flex items-center justify-between gap-3 border border-gray-100 rounded px-3 py-2">
                <span className="text-sm text-navy">
                  {x.name}
                  <span className="text-text-muted-wabs"> · ${x.price}{x.unit === "per_day" ? "/day" : ""}</span>
                </span>
                <input
                  type="number" min={0} max={10} inputMode="numeric" aria-label={`${x.name} quantity`}
                  value={qty[x.id] ?? 0}
                  onChange={e => setQty(q => ({ ...q, [x.id]: Math.max(0, Math.min(10, Math.trunc(Number(e.target.value) || 0))) }))}
                  className="w-16 border border-gray-300 rounded px-2 py-1 text-sm text-navy text-right"
                />
              </li>
            ))}
          </ul>
          {bad("extras") && <p className="text-red-600 text-sm mt-2">{error?.message}</p>}
        </section>
      )}

      <section className="bg-white border border-gray-200 rounded-lg p-6 grid grid-cols-1 md:grid-cols-2 gap-4" key={customer?.id ?? "none"}>
        <h2 className="md:col-span-2 text-sm font-semibold uppercase tracking-wider text-text-muted-wabs">Driver</h2>
        <Field label="Full name" error={bad("driver_name")}>
          <input name="driver_name" required defaultValue={customer && (customer.first_name || customer.last_name) ? customerName(customer) : ""} className={inputCls} />
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
          The price is calculated from current rates, tax, protection, extras and delivery, the same way as online checkout.
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
