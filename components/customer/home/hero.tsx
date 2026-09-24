"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";
import { Button } from "@/components/ui/button";
import { CATEGORIES } from "@/lib/validators/browse";

export function Hero() {
  const router = useRouter();
  const [category, setCategory] = useState("");
  const [pickup, setPickup] = useState("");
  const [ret, setRet] = useState("");

  const onSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    const params = new URLSearchParams();
    if (category) params.set("category", category);
    if (pickup) params.set("pickup", pickup);
    if (ret) params.set("return", ret);
    router.push(`/vehicles${params.toString() ? `?${params.toString()}` : ""}`);
  };

  return (
    <section className="relative bg-deep text-white overflow-hidden">
      <div className="absolute inset-0 bg-gradient-to-br from-deep via-navy to-navy-light opacity-90" />
      <div className="relative max-w-7xl mx-auto px-6 py-24 md:py-32">
        <p className="text-gold text-xs uppercase tracking-[0.4em] mb-4">Luxury · Performance · Exclusivity</p>
        <h1 className="text-4xl md:text-6xl font-bold leading-tight max-w-3xl">
          Drive the extraordinary.
        </h1>
        <p className="mt-6 text-lg text-text-muted-wabs max-w-2xl">
          From Ferraris on Pacific Coast Highway to a Rolls-Royce for the black-tie gala.
          Handpicked vehicles, hand-delivered.
        </p>
        <form onSubmit={onSubmit} className="mt-12 bg-white/5 backdrop-blur-md border border-navy-light rounded-lg p-6 max-w-4xl">
          <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
            <div className="col-span-1 md:col-span-2">
              <label className="block text-xs uppercase tracking-wider text-text-muted-wabs mb-2">Category</label>
              <select
                value={category}
                onChange={(e) => setCategory(e.target.value)}
                className="w-full bg-navy-light border border-navy-light text-white rounded px-3 py-2 focus:border-gold focus:outline-none"
              >
                <option value="">All categories</option>
                {CATEGORIES.map((c) => (
                  <option key={c} value={c}>{c.charAt(0).toUpperCase() + c.slice(1)}</option>
                ))}
              </select>
            </div>
            <div>
              <label className="block text-xs uppercase tracking-wider text-text-muted-wabs mb-2">Pickup</label>
              <input
                type="date"
                value={pickup}
                onChange={(e) => setPickup(e.target.value)}
                className="w-full bg-navy-light border border-navy-light text-white rounded px-3 py-2 focus:border-gold focus:outline-none"
              />
            </div>
            <div>
              <label className="block text-xs uppercase tracking-wider text-text-muted-wabs mb-2">Return</label>
              <input
                type="date"
                value={ret}
                onChange={(e) => setRet(e.target.value)}
                className="w-full bg-navy-light border border-navy-light text-white rounded px-3 py-2 focus:border-gold focus:outline-none"
              />
            </div>
          </div>
          <Button type="submit" className="mt-4 bg-gold hover:bg-gold-muted text-deep font-semibold w-full md:w-auto md:px-8">
            Search fleet
          </Button>
        </form>
      </div>
    </section>
  );
}
