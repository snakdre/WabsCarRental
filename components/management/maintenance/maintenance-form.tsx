"use client";

import { useRef, useState, useTransition } from "react";
import { createMaintenance } from "@/lib/actions/maintenance";
import { MAINTENANCE_CATEGORIES } from "@/lib/validators/maintenance";
import { Button } from "@/components/ui/button";

const inputCls =
  "w-full border border-gray-300 rounded px-3 py-2 text-sm text-navy focus:border-gold focus:outline-none bg-white";

export function MaintenanceForm({ vehicles, presetVehicleId }: { vehicles: { id: string; label: string }[]; presetVehicleId?: string }) {
  const formRef = useRef<HTMLFormElement>(null);
  const [error, setError] = useState<{ message: string; field?: string } | null>(null);
  const [saved, setSaved] = useState(false);
  const [isPending, startTransition] = useTransition();
  const today = new Date().toISOString().slice(0, 10);
  const bad = (f: string) => (error?.field === f ? "border-red-500" : "");

  const onSubmit = (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    const fd = new FormData(e.currentTarget);
    setError(null);
    setSaved(false);
    startTransition(async () => {
      const res = await createMaintenance(fd);
      if (res.error) setError({ message: res.error, field: res.field });
      else { setSaved(true); formRef.current?.reset(); }
    });
  };

  return (
    <form ref={formRef} onSubmit={onSubmit} className="bg-white border border-gray-200 rounded-lg p-6 space-y-4" data-testid="maintenance-form">
      <h2 className="text-sm font-semibold uppercase tracking-wider text-text-muted-wabs">Schedule maintenance</h2>
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <label className="block md:col-span-2">
          <span className="block text-xs text-text-muted-wabs mb-1">Vehicle</span>
          <select name="vehicle_id" required defaultValue={presetVehicleId ?? ""} className={`${inputCls} ${bad("vehicle_id")}`}>
            <option value="">Choose a vehicle…</option>
            {vehicles.map(v => <option key={v.id} value={v.id}>{v.label}</option>)}
          </select>
        </label>
        <label className="block">
          <span className="block text-xs text-text-muted-wabs mb-1">Type</span>
          <select name="category" defaultValue="service" className={inputCls}>
            {MAINTENANCE_CATEGORIES.map(c => <option key={c} value={c} className="capitalize">{c[0].toUpperCase() + c.slice(1)}</option>)}
          </select>
        </label>
        <label className="block">
          <span className="block text-xs text-text-muted-wabs mb-1">Vendor</span>
          <input name="vendor" maxLength={200} className={inputCls} placeholder="e.g. Beverly Hills Porsche" />
        </label>
        <label className="block">
          <span className="block text-xs text-text-muted-wabs mb-1">Service date</span>
          <input name="service_date" type="date" required defaultValue={today} className={`${inputCls} ${bad("service_date")}`} />
        </label>
        <label className="block">
          <span className="block text-xs text-text-muted-wabs mb-1">Expected back (optional)</span>
          <input name="return_date" type="date" className={`${inputCls} ${bad("return_date")}`} />
        </label>
        <label className="block md:col-span-2">
          <span className="block text-xs text-text-muted-wabs mb-1">Work description</span>
          <textarea name="description" required maxLength={1000} className={`${inputCls} min-h-[70px] ${bad("description")}`} />
        </label>
        <label className="block">
          <span className="block text-xs text-text-muted-wabs mb-1">Estimated cost (USD)</span>
          <input name="cost" inputMode="decimal" className={`${inputCls} ${bad("cost")}`} placeholder="0.00" />
        </label>
        <label className="block">
          <span className="block text-xs text-text-muted-wabs mb-1">Odometer (mi)</span>
          <input name="odometer" inputMode="numeric" className={`${inputCls} ${bad("odometer")}`} />
        </label>
      </div>
      <p className="text-xs text-text-muted-wabs">
        Blocks the vehicle on the calendar for these dates. Bookings that overlap are refused.
      </p>
      <div className="flex items-center gap-3">
        <Button type="submit" disabled={isPending} className="bg-gold hover:bg-gold-muted text-deep font-semibold">
          {isPending ? "Saving…" : "Schedule"}
        </Button>
        {saved && <span className="text-green-700 text-sm">Scheduled</span>}
        {error && <span className="text-red-600 text-sm" role="alert">{error.message}</span>}
      </div>
    </form>
  );
}
