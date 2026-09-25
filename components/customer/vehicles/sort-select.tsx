"use client";

import { useRouter, useSearchParams } from "next/navigation";

export function SortSelect({ current }: { current?: string }) {
  const router = useRouter();
  const searchParams = useSearchParams();

  const onChange = (e: React.ChangeEvent<HTMLSelectElement>) => {
    const params = new URLSearchParams(searchParams.toString());
    if (e.target.value) params.set("sort", e.target.value);
    else params.delete("sort");
    router.push(`/vehicles${params.toString() ? `?${params.toString()}` : ""}`);
  };

  return (
    <select
      value={current ?? ""}
      onChange={onChange}
      className="bg-white border border-gray-300 text-navy rounded px-3 py-2 text-sm focus:border-gold focus:outline-none"
    >
      <option value="">Featured first</option>
      <option value="price_asc">Price: Low to High</option>
      <option value="price_desc">Price: High to Low</option>
    </select>
  );
}
