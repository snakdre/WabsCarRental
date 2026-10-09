"use client";

import { useState, useTransition } from "react";
import { updateVehicle } from "@/lib/actions/management-vehicles";
import { VEHICLE_STATUSES } from "@/lib/validators/management-vehicles";
import type { ManagementVehicleDetail } from "@/lib/queries/management-vehicles";
import { Button } from "@/components/ui/button";

export function VehicleEditForm({ vehicle }: { vehicle: ManagementVehicleDetail }) {
  const [status, setStatus] = useState(vehicle.status);
  const [isFeatured, setIsFeatured] = useState(vehicle.is_featured);
  const [dailyPrice, setDailyPrice] = useState(String(vehicle.daily_price));
  const [weeklyPrice, setWeeklyPrice] = useState(
    vehicle.weekly_price !== null ? String(vehicle.weekly_price) : ""
  );
  const [monthlyPrice, setMonthlyPrice] = useState(
    vehicle.monthly_price !== null ? String(vehicle.monthly_price) : ""
  );
  const [description, setDescription] = useState(vehicle.description ?? "");

  const [error, setError] = useState<string | null>(null);
  const [savedAt, setSavedAt] = useState<Date | null>(null);
  const [isPending, startTransition] = useTransition();

  const onSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    setSavedAt(null);

    const fd = new FormData();
    fd.set("vehicle_id", vehicle.id);
    fd.set("status", status);
    if (isFeatured) fd.set("is_featured", "on");
    fd.set("daily_price", dailyPrice);
    fd.set("weekly_price", weeklyPrice);
    fd.set("monthly_price", monthlyPrice);
    fd.set("description", description);

    startTransition(async () => {
      const res = await updateVehicle(fd);
      if (res?.error) {
        setError(res.error);
      } else {
        setSavedAt(new Date());
      }
    });
  };

  const labelClass = "block text-sm font-semibold uppercase tracking-wider text-text-muted-wabs mb-1";
  const inputClass =
    "w-full border border-gray-300 rounded px-3 py-2 text-sm text-navy focus:border-gold focus:outline-none bg-white";

  return (
    <form onSubmit={onSubmit} className="space-y-6">
      {/* Status */}
      <section className="bg-white border border-gray-200 rounded-lg p-6">
        <label className={labelClass} htmlFor="vehicle-status">
          Status
        </label>
        <select
          id="vehicle-status"
          value={status}
          onChange={(e) => setStatus(e.target.value)}
          className={inputClass}
        >
          {VEHICLE_STATUSES.map((s) => (
            <option key={s} value={s}>
              {s.charAt(0).toUpperCase() + s.slice(1)}
            </option>
          ))}
        </select>
      </section>

      {/* Featured */}
      <section className="bg-white border border-gray-200 rounded-lg p-6">
        <span className={labelClass}>Featured</span>
        <label className="flex items-center gap-2 cursor-pointer">
          <input
            type="checkbox"
            checked={isFeatured}
            onChange={(e) => setIsFeatured(e.target.checked)}
            className="w-4 h-4 accent-gold"
          />
          <span className="text-sm text-navy">Featured on home page</span>
        </label>
      </section>

      {/* Pricing */}
      <section className="bg-white border border-gray-200 rounded-lg p-6">
        <span className={`${labelClass} mb-3`}>Pricing</span>
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          <div>
            <label className="block text-xs font-medium text-text-muted-wabs mb-1" htmlFor="daily-price">
              Daily (required)
            </label>
            <input
              id="daily-price"
              type="number"
              step="0.01"
              min="0"
              required
              value={dailyPrice}
              onChange={(e) => setDailyPrice(e.target.value)}
              className={inputClass}
            />
          </div>
          <div>
            <label className="block text-xs font-medium text-text-muted-wabs mb-1" htmlFor="weekly-price">
              Weekly (optional)
            </label>
            <input
              id="weekly-price"
              type="number"
              step="0.01"
              min="0"
              value={weeklyPrice}
              onChange={(e) => setWeeklyPrice(e.target.value)}
              className={inputClass}
            />
          </div>
          <div>
            <label className="block text-xs font-medium text-text-muted-wabs mb-1" htmlFor="monthly-price">
              Monthly (optional)
            </label>
            <input
              id="monthly-price"
              type="number"
              step="0.01"
              min="0"
              value={monthlyPrice}
              onChange={(e) => setMonthlyPrice(e.target.value)}
              className={inputClass}
            />
          </div>
        </div>
      </section>

      {/* Description */}
      <section className="bg-white border border-gray-200 rounded-lg p-6">
        <label className={labelClass} htmlFor="vehicle-description">
          Description
        </label>
        <textarea
          id="vehicle-description"
          value={description}
          onChange={(e) => setDescription(e.target.value)}
          maxLength={2000}
          placeholder="Add a description for this vehicle…"
          className={`${inputClass} min-h-[120px]`}
        />
      </section>

      {/* Submit */}
      <div className="flex items-center gap-3">
        <Button
          type="submit"
          disabled={isPending}
          className="bg-gold hover:bg-gold-muted text-deep font-semibold"
        >
          {isPending ? "Saving…" : "Save changes"}
        </Button>
        {error && <span className="text-red-600 text-sm">{error}</span>}
        {!error && savedAt && (
          <span className="text-green-700 text-sm">
            Saved at {savedAt.toLocaleTimeString()}
          </span>
        )}
      </div>
    </form>
  );
}
