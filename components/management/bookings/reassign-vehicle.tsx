"use client";

import { useState, useTransition } from "react";
import { reassignVehicle } from "@/lib/actions/booking-ops";
import type { BookableVehicle } from "@/lib/queries/management-bookings";
import { Button } from "@/components/ui/button";

export function ReassignVehicle({
  bookingId, currentVehicleId, status, vehicles,
}: {
  bookingId: string; currentVehicleId: string; status: string; vehicles: BookableVehicle[];
}) {
  const [vehicleId, setVehicleId] = useState("");
  const [note, setNote] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [done, setDone] = useState(false);
  const [isPending, startTransition] = useTransition();

  if (!["pending", "confirmed", "ready_for_pickup"].includes(status)) {
    return <p className="text-sm text-text-muted-wabs italic">Vehicle can only be changed before pickup.</p>;
  }
  const options = vehicles.filter(v => v.id !== currentVehicleId);

  const submit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!vehicleId) return;
    const fd = new FormData();
    fd.set("booking_id", bookingId);
    fd.set("vehicle_id", vehicleId);
    fd.set("note", note);
    setError(null);
    setDone(false);
    startTransition(async () => {
      const res = await reassignVehicle(fd);
      if (res.error) setError(res.error);
      else { setDone(true); setVehicleId(""); setNote(""); }
    });
  };

  return (
    <form onSubmit={submit} className="space-y-3" data-testid="reassign-vehicle">
      <select
        value={vehicleId}
        onChange={e => setVehicleId(e.target.value)}
        className="w-full border border-gray-300 rounded px-3 py-2 text-sm text-navy bg-white"
        aria-label="New vehicle"
      >
        <option value="">Choose a vehicle…</option>
        {options.map(v => (
          <option key={v.id} value={v.id}>{v.label} · ${v.daily_price}/day</option>
        ))}
      </select>
      <input
        value={note}
        onChange={e => setNote(e.target.value)}
        maxLength={500}
        placeholder="Reason (optional)"
        className="w-full border border-gray-300 rounded px-3 py-2 text-sm text-navy bg-white"
      />
      <Button type="submit" variant="outline" disabled={!vehicleId || isPending} className="w-full">
        {isPending ? "Moving…" : "Reassign vehicle"}
      </Button>
      <p className="text-xs text-text-muted-wabs">The price stays as booked. Availability moves with the booking.</p>
      {error && <p className="text-red-600 text-sm">{error}</p>}
      {done && <p className="text-green-700 text-sm">Vehicle reassigned.</p>}
    </form>
  );
}
