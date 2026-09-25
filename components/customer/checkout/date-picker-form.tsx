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
