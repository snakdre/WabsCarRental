"use client";

import { useState, useTransition } from "react";
import { recordPickup, recordReturn } from "@/lib/actions/booking-ops";
import type { ManagementBookingDetail } from "@/lib/queries/management-bookings";
import { Button } from "@/components/ui/button";

const inputCls =
  "w-full border border-gray-300 rounded px-3 py-2 text-sm text-navy focus:border-gold focus:outline-none bg-white";

function Recorded({ title, at, odo, fuel, notes }: { title: string; at: string; odo: number | null; fuel: number | null; notes: string | null }) {
  return (
    <div className="text-sm">
      <p className="font-semibold text-navy">{title}</p>
      <p className="text-text-muted-wabs text-xs">{at.slice(0, 16).replace("T", " ")}</p>
      <p className="text-navy mt-1">{odo?.toLocaleString("en-US") ?? "—"} mi · fuel {fuel ?? "—"}%</p>
      {notes && <p className="text-navy bg-gray-50 rounded px-2 py-1 mt-1">{notes}</p>}
    </div>
  );
}

export function HandoverPanel({ booking }: { booking: ManagementBookingDetail }) {
  const h = booking.handover;
  const mode: "pickup" | "return" | null =
    booking.status === "confirmed" || booking.status === "ready_for_pickup" ? "pickup"
      : booking.status === "active" ? "return"
        : null;

  const [error, setError] = useState<{ message: string; field?: string } | null>(null);
  const [isPending, startTransition] = useTransition();

  const onSubmit = (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    const fd = new FormData(e.currentTarget);
    fd.set("booking_id", booking.id);
    setError(null);
    startTransition(async () => {
      const res = await (mode === "pickup" ? recordPickup(fd) : recordReturn(fd));
      if (res?.error) setError({ message: res.error, field: res.field });
    });
  };

  const distance =
    h.pickup_odometer != null && h.return_odometer != null ? h.return_odometer - h.pickup_odometer : null;

  return (
    <div className="space-y-4" data-testid="handover-panel">
      {h.pickup_recorded_at && (
        <Recorded title="Picked up" at={h.pickup_recorded_at} odo={h.pickup_odometer} fuel={h.pickup_fuel_level} notes={h.pickup_notes} />
      )}
      {h.return_recorded_at && (
        <Recorded title="Returned" at={h.return_recorded_at} odo={h.return_odometer} fuel={h.return_fuel_level} notes={h.return_notes} />
      )}
      {distance != null && (
        <p className="text-sm text-navy"><span className="text-text-muted-wabs">Distance driven:</span> {distance.toLocaleString("en-US")} mi</p>
      )}

      {mode && (
        <form onSubmit={onSubmit} className="space-y-3 border-t border-gray-100 pt-4">
          <p className="text-sm font-semibold text-navy">{mode === "pickup" ? "Record pickup" : "Record return"}</p>
          <div className="grid grid-cols-2 gap-3">
            <label className="block">
              <span className="block text-xs text-text-muted-wabs mb-1">Odometer (mi)</span>
              <input
                name="odometer" inputMode="numeric" required
                defaultValue={mode === "return" ? h.pickup_odometer ?? "" : ""}
                className={`${inputCls} ${error?.field === "odometer" ? "border-red-500" : ""}`}
              />
            </label>
            <label className="block">
              <span className="block text-xs text-text-muted-wabs mb-1">Fuel / charge (%)</span>
              <input
                name="fuel" type="number" min={0} max={100} required defaultValue={mode === "pickup" ? 100 : ""}
                className={`${inputCls} ${error?.field === "fuel" ? "border-red-500" : ""}`}
              />
            </label>
          </div>
          <label className="block">
            <span className="block text-xs text-text-muted-wabs mb-1">Condition notes</span>
            <textarea name="notes" maxLength={1000} className={`${inputCls} min-h-[60px]`} placeholder="Scratches, cleanliness, accessories…" />
          </label>
          <Button type="submit" disabled={isPending} className="w-full bg-gold hover:bg-gold-muted text-deep font-semibold" data-testid={`record-${mode}`}>
            {isPending ? "Saving…" : mode === "pickup" ? "Record pickup → Active" : "Record return → Completed"}
          </Button>
          {error && <p className="text-red-600 text-sm">{error.message}</p>}
        </form>
      )}

      {!mode && !h.pickup_recorded_at && (
        <p className="text-sm text-text-muted-wabs italic">Pickup can be recorded once the booking is confirmed.</p>
      )}
    </div>
  );
}
