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
