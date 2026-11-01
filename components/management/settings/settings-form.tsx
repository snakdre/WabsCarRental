"use client";

import { useState, useTransition } from "react";
import { updateSettings } from "@/lib/actions/settings";
import { SETTINGS, settingToInput, type SettingKey } from "@/lib/validators/settings";
import type { SettingRow } from "@/lib/queries/settings";
import { Button } from "@/components/ui/button";

const GROUPS: { title: string; keys: SettingKey[] }[] = [
  { title: "Pricing & rules", keys: ["tax_rate", "min_driver_age", "default_deposit", "late_return_fee_per_hour"] },
  { title: "Business details", keys: ["business_name", "business_email", "business_phone"] },
];

const SUFFIX: Partial<Record<string, string>> = { percent: "%", money: "USD", integer: "years" };

export function SettingsForm({ rows }: { rows: SettingRow[] }) {
  const byKey = new Map(rows.map(r => [r.key, r]));
  const [result, setResult] = useState<{ ok: boolean; message: string; field?: string } | null>(null);
  const [isPending, startTransition] = useTransition();

  const onSubmit = (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    const fd = new FormData(e.currentTarget);
    setResult(null);
    startTransition(async () => {
      const res = await updateSettings(fd);
      if (res.error) setResult({ ok: false, message: res.error, field: res.field });
      else setResult({ ok: true, message: res.changed ? `Saved ${res.changed} change${res.changed === 1 ? "" : "s"}.` : "No changes." });
    });
  };

  return (
    <form onSubmit={onSubmit} className="space-y-6" data-testid="settings-form">
      {GROUPS.map(g => (
        <section key={g.title} className="bg-white border border-gray-200 rounded-lg p-6">
          <h2 className="text-sm font-semibold uppercase tracking-wider text-text-muted-wabs mb-4">{g.title}</h2>
          <div className="space-y-5">
            {g.keys.map(key => {
              const def = SETTINGS[key];
              const row = byKey.get(key);
              const invalid = result?.field === key;
              const numeric = def.kind === "percent" || def.kind === "money" || def.kind === "integer";
              return (
                <div key={key} className="grid grid-cols-1 md:grid-cols-3 gap-2 md:gap-6 items-start">
                  <label htmlFor={`setting-${key}`} className="md:pt-2">
                    <span className="block text-sm font-medium text-navy">{def.label}</span>
                    <span className="block text-xs text-text-muted-wabs">{def.help}</span>
                  </label>
                  <div className="md:col-span-2">
                    <div className="flex items-center gap-2">
                      <input
                        id={`setting-${key}`}
                        name={key}
                        type={def.kind === "email" ? "email" : "text"}
                        inputMode={numeric ? "decimal" : undefined}
                        defaultValue={settingToInput(key, row?.value)}
                        aria-invalid={invalid || undefined}
                        className={`w-full max-w-sm border rounded px-3 py-2 text-sm text-navy bg-white focus:border-gold focus:outline-none ${invalid ? "border-red-500" : "border-gray-300"}`}
                      />
                      {SUFFIX[def.kind] && <span className="text-xs text-text-muted-wabs">{SUFFIX[def.kind]}</span>}
                    </div>
                    {row?.updated_at && (
                      <p className="text-[11px] text-text-muted-wabs mt-1">Last changed {row.updated_at.slice(0, 10)}</p>
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        </section>
      ))}
      <div className="flex items-center gap-3">
        <Button type="submit" disabled={isPending} className="bg-gold hover:bg-gold-muted text-deep font-semibold">
          {isPending ? "Saving…" : "Save settings"}
        </Button>
        {result && (
          <span className={`text-sm ${result.ok ? "text-green-700" : "text-red-600"}`} role={result.ok ? "status" : "alert"}>
            {result.message}
          </span>
        )}
      </div>
    </form>
  );
}
