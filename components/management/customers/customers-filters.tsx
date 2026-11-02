"use client";

import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { useEffect, useState } from "react";

const CHIPS: { key: string | null; label: string }[] = [
  { key: null, label: "All" },
  { key: "yes", label: "Flagged" },
  { key: "no", label: "Not flagged" },
];

export function CustomersFilters() {
  const router = useRouter();
  const params = useSearchParams();
  const flagged = params.get("flagged");
  const [search, setSearch] = useState(params.get("search") ?? "");

  useEffect(() => {
    setSearch(params.get("search") ?? "");
  }, [params]);

  useEffect(() => {
    const handle = setTimeout(() => {
      const next = new URLSearchParams(params.toString());
      if (search) next.set("search", search);
      else next.delete("search");
      if (next.get("search") !== params.get("search")) {
        next.delete("page"); // new search → back to page 1
        router.push(`/management/customers?${next.toString()}`);
      }
    }, 400);
    return () => clearTimeout(handle);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [search]);

  const chipHref = (key: string | null) => {
    const next = new URLSearchParams(params.toString());
    if (key) next.set("flagged", key);
    else next.delete("flagged");
    next.delete("page"); // new filter → back to page 1
    const qs = next.toString();
    return `/management/customers${qs ? `?${qs}` : ""}`;
  };

  return (
    <div className="flex flex-col md:flex-row md:items-center gap-4 mb-6">
      <input
        type="search"
        value={search}
        onChange={(e) => setSearch(e.target.value)}
        placeholder="Search name, email or phone…"
        aria-label="Search customers"
        data-testid="customers-search"
        className="w-full md:w-80 border border-gray-300 rounded px-3 py-2 text-sm text-navy bg-white focus:border-gold focus:outline-none"
      />
      <div className="flex gap-2">
        {CHIPS.map((c) => {
          const active = (c.key ?? null) === (flagged ?? null);
          return (
            <Link
              key={c.label}
              href={chipHref(c.key)}
              className={`text-xs px-3 py-1.5 rounded-full border ${
                active ? "bg-gold border-gold text-deep font-semibold" : "border-gray-300 text-navy hover:border-gold"
              }`}
            >
              {c.label}
            </Link>
          );
        })}
      </div>
    </div>
  );
}
