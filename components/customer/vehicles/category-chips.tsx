"use client";

import Link from "next/link";
import { CATEGORIES } from "@/lib/validators/browse";

export function CategoryChips({ active, sort }: { active?: string; sort?: string }) {
  const chip = (key: string | null, label: string) => {
    const params = new URLSearchParams();
    if (key) params.set("category", key);
    if (sort) params.set("sort", sort);
    const href = `/vehicles${params.toString() ? `?${params.toString()}` : ""}`;
    const isActive = key === (active ?? null);
    return (
      <Link
        key={key ?? "all"}
        href={href}
        className={`px-4 py-2 rounded-full text-sm border transition-colors ${
          isActive
            ? "bg-gold border-gold text-deep font-semibold"
            : "bg-white border-gray-300 text-navy hover:border-gold"
        }`}
      >
        {label}
      </Link>
    );
  };

  return (
    <div className="flex flex-wrap gap-2">
      {chip(null, "All")}
      {CATEGORIES.map((c) => chip(c, c.charAt(0).toUpperCase() + c.slice(1)))}
    </div>
  );
}
