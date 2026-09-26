"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import { formatMoney } from "@/lib/utils/format";
import type { ExtraOption, ProtectionPlanOption } from "@/lib/queries/extras";

type CarriedParams = Record<string, string>;

export function ExtrasForm({
  carried,
  plans,
  extras,
}: {
  carried: CarriedParams;
  plans: ProtectionPlanOption[];
  extras: ExtraOption[];
}) {
  const router = useRouter();
  const [planId, setPlanId] = useState<string>("");
  const [selected, setSelected] = useState<Record<string, number>>({});
  const [promo, setPromo] = useState("");

  const toggle = (id: string) => {
    setSelected(s => {
      const next = { ...s };
      if (next[id]) delete next[id]; else next[id] = 1;
      return next;
    });
  };

  const onSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    const extrasArr = Object.entries(selected).map(([extra_id, quantity]) => ({ extra_id, quantity }));
    const params = new URLSearchParams(carried);
    if (planId) params.set("protection_plan_id", planId);
    params.set("extras", JSON.stringify(extrasArr));
    if (promo.trim()) params.set("promo_code", promo.trim());
    router.push(`/checkout/review?${params.toString()}`);
  };

  return (
    <form onSubmit={onSubmit} className="space-y-8" data-testid="extras-form">
      <section>
        <h2 className="text-lg font-semibold text-navy mb-3">Protection plan</h2>
        <div className="space-y-2">
          <label className="flex items-center gap-3 p-3 bg-white border border-gray-300 rounded cursor-pointer">
            <input type="radio" name="plan" checked={planId === ""} onChange={() => setPlanId("")} />
            <span className="text-navy">Decline protection</span>
          </label>
          {plans.map(p => (
            <label key={p.id} className={`flex items-center gap-3 p-3 bg-white border rounded cursor-pointer ${planId === p.id ? "border-gold" : "border-gray-300"}`}>
              <input type="radio" name="plan" checked={planId === p.id} onChange={() => setPlanId(p.id)} />
              <div className="flex-1">
                <p className="text-navy font-medium">{p.name}</p>
                <p className="text-text-muted-wabs text-sm">{p.description}</p>
              </div>
              <span className="text-navy font-semibold">{formatMoney(Number(p.daily_price))}/day</span>
            </label>
          ))}
        </div>
      </section>

      <section>
        <h2 className="text-lg font-semibold text-navy mb-3">Extras</h2>
        <div className="space-y-2">
          {extras.map(e => (
            <label key={e.id} className="flex items-center gap-3 p-3 bg-white border border-gray-300 rounded cursor-pointer">
              <input type="checkbox" checked={!!selected[e.id]} onChange={() => toggle(e.id)} />
              <div className="flex-1">
                <p className="text-navy font-medium">{e.name}</p>
                <p className="text-text-muted-wabs text-sm">{e.description}</p>
              </div>
              <span className="text-navy font-semibold">
                {formatMoney(Number(e.price))}{e.unit === "per_day" ? "/day" : ""}
              </span>
            </label>
          ))}
        </div>
      </section>

      <section>
        <h2 className="text-lg font-semibold text-navy mb-3">Promo code (optional)</h2>
        <input value={promo} onChange={(e) => setPromo(e.target.value)}
          placeholder="e.g. WABS10"
          className="w-full bg-white border border-gray-300 text-navy rounded px-3 py-2 focus:border-gold focus:outline-none" />
      </section>

      <Button type="submit" className="bg-gold hover:bg-gold-muted text-deep font-semibold">
        Continue to review
      </Button>
    </form>
  );
}
