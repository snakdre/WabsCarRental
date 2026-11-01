// Small, dependency-free helpers for the dashboard's SVG charts.

// "Nice" axis maximum + evenly spaced ticks (1/2/2.5/5 × 10^n steps).
export function niceTicks(maxValue: number, targetTicks = 4): number[] {
  if (!Number.isFinite(maxValue) || maxValue <= 0) return [0];
  const rough = maxValue / targetTicks;
  const pow = Math.pow(10, Math.floor(Math.log10(rough)));
  const step = [1, 2, 2.5, 5, 10].map(m => m * pow).find(s => s >= rough) ?? 10 * pow;
  const top = Math.ceil(maxValue / step) * step;
  const ticks: number[] = [];
  for (let v = 0; v <= top + step / 2; v += step) ticks.push(Math.round(v * 100) / 100);
  return ticks;
}

// Axis tick label: full under 10,000, compact (10K, 1.2M) at or above.
export function formatAxisMoney(v: number, axisMax: number): string {
  if (axisMax < 10_000) return `$${v.toLocaleString("en-US")}`;
  return `$${new Intl.NumberFormat("en-US", { notation: "compact", maximumFractionDigits: 1 }).format(v)}`;
}

export function monthLabel(isoDate: string): string {
  const d = new Date(isoDate.slice(0, 10) + "T00:00:00Z");
  return d.toLocaleString("en-US", { month: "short", timeZone: "UTC" });
}

export function monthLabelLong(isoDate: string): string {
  const d = new Date(isoDate.slice(0, 10) + "T00:00:00Z");
  return d.toLocaleString("en-US", { month: "long", year: "numeric", timeZone: "UTC" });
}
