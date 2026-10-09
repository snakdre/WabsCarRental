"use client";

import { useState, useTransition } from "react";
import { createVehicle } from "@/lib/actions/management-vehicles";
import { CATEGORIES } from "@/lib/validators/management-vehicles";

export function VehicleCreateForm() {
  const [make, setMake] = useState("");
  const [model, setModel] = useState("");
  const [trim, setTrim] = useState("");
  const [year, setYear] = useState(String(new Date().getFullYear()));
  const [category, setCategory] = useState<string>(CATEGORIES[0]);
  const [dailyPrice, setDailyPrice] = useState("");
  const [description, setDescription] = useState("");

  const [error, setError] = useState<string | null>(null);
  const [isPending, startTransition] = useTransition();

  const onSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);

    const fd = new FormData();
    fd.set("make", make);
    fd.set("model", model);
    fd.set("trim", trim);
    fd.set("year", year);
    fd.set("category", category);
    fd.set("daily_price", dailyPrice);
    fd.set("description", description);

    startTransition(async () => {
      const res = await createVehicle(fd);
      if (res?.error) {
        setError(res.error);
      }
    });
  };

  const labelClass =
    "block text-sm font-semibold uppercase tracking-wider text-text-muted-wabs mb-1";
  const inputClass =
    "w-full border border-gray-300 rounded px-3 py-2 text-sm text-navy focus:border-gold focus:outline-none bg-white";

  return (
    <form onSubmit={onSubmit} className="space-y-6">
      <div className="bg-white border border-gray-200 rounded-lg p-6">
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {/* Make */}
          <div>
            <label className={labelClass} htmlFor="vehicle-make">
              Make
            </label>
            <input
              id="vehicle-make"
              type="text"
              required
              maxLength={50}
              value={make}
              onChange={(e) => setMake(e.target.value)}
              placeholder="e.g. Ferrari"
              className={inputClass}
            />
          </div>

          {/* Model */}
          <div>
            <label className={labelClass} htmlFor="vehicle-model">
              Model
            </label>
            <input
              id="vehicle-model"
              type="text"
              required
              maxLength={50}
              value={model}
              onChange={(e) => setModel(e.target.value)}
              placeholder="e.g. F8 Tributo"
              className={inputClass}
            />
          </div>

          {/* Trim */}
          <div>
            <label className={labelClass} htmlFor="vehicle-trim">
              Trim <span className="normal-case font-normal">(optional)</span>
            </label>
            <input
              id="vehicle-trim"
              type="text"
              maxLength={50}
              value={trim}
              onChange={(e) => setTrim(e.target.value)}
              placeholder="e.g. Spider"
              className={inputClass}
            />
          </div>

          {/* Year */}
          <div>
            <label className={labelClass} htmlFor="vehicle-year">
              Year
            </label>
            <input
              id="vehicle-year"
              type="number"
              required
              min={1990}
              max={2030}
              value={year}
              onChange={(e) => setYear(e.target.value)}
              className={inputClass}
            />
          </div>

          {/* Category */}
          <div>
            <label className={labelClass} htmlFor="vehicle-category">
              Category
            </label>
            <select
              id="vehicle-category"
              value={category}
              onChange={(e) => setCategory(e.target.value)}
              className={inputClass}
            >
              {CATEGORIES.map((c) => (
                <option key={c} value={c}>
                  {c.charAt(0).toUpperCase() + c.slice(1)}
                </option>
              ))}
            </select>
          </div>

          {/* Daily Price */}
          <div>
            <label className={labelClass} htmlFor="vehicle-daily-price">
              Daily price
            </label>
            <input
              id="vehicle-daily-price"
              type="number"
              required
              step="0.01"
              min="0.01"
              value={dailyPrice}
              onChange={(e) => setDailyPrice(e.target.value)}
              placeholder="e.g. 500"
              className={inputClass}
            />
          </div>
        </div>

        {/* Description */}
        <div className="mt-4">
          <label className={labelClass} htmlFor="vehicle-description">
            Description <span className="normal-case font-normal">(optional)</span>
          </label>
          <textarea
            id="vehicle-description"
            value={description}
            onChange={(e) => setDescription(e.target.value)}
            maxLength={2000}
            placeholder="Add a description for this vehicle…"
            className={`${inputClass} min-h-[120px]`}
          />
        </div>
      </div>

      <div className="flex items-center gap-3">
        <button
          type="submit"
          disabled={isPending}
          className="bg-gold hover:bg-gold-muted text-deep font-semibold px-4 py-2 rounded disabled:opacity-50 disabled:pointer-events-none"
        >
          {isPending ? "Creating…" : "Create vehicle"}
        </button>
        {error && <span className="text-red-600 text-sm">{error}</span>}
      </div>

      <p className="text-sm text-text-muted-wabs">
        Vehicle is created as a draft. You&apos;ll be able to edit pricing, status, images, and more on the next page.
      </p>
    </form>
  );
}
