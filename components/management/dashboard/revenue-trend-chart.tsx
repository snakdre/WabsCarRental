"use client";

import { useId, useState } from "react";
import type { RevenueMonth } from "@/lib/queries/management-dashboard";
import { niceTicks, formatAxisMoney, monthLabel, monthLabelLong } from "@/lib/utils/chart";
import { formatMoney } from "@/lib/utils/format";

// Single-series column chart: monthly revenue. One hue (brand gold-muted),
// no legend (the title names the series), recessive hairline grid,
// <=24px columns with a 4px rounded data-end, hover/focus tooltip per column,
// and a table view so no value is gated behind hover.
// #B8963E is < 3:1 against white, so values stay reachable via direct label
// on the latest month, tooltip, and table (contrast relief).

const W = 720;
const H = 240;
const PAD = { top: 16, right: 12, bottom: 28, left: 56 };
const BAR_MAX = 24;
const SERIES = "#B8963E";
const GRID = "#E5E7EB";

export function RevenueTrendChart({ data }: { data: RevenueMonth[] }) {
  const [hover, setHover] = useState<number | null>(null);
  const [showTable, setShowTable] = useState(false);
  const titleId = useId();

  const max = Math.max(0, ...data.map(d => d.revenue));
  const ticks = niceTicks(max);
  const top = ticks[ticks.length - 1] || 1;
  const innerW = W - PAD.left - PAD.right;
  const innerH = H - PAD.top - PAD.bottom;
  const band = innerW / Math.max(data.length, 1);
  const barW = Math.min(BAR_MAX, band * 0.6);
  const y = (v: number) => PAD.top + innerH - (v / top) * innerH;
  const total = data.reduce((s, d) => s + d.revenue, 0);
  const last = data.length - 1;

  return (
    <section className="bg-white border border-gray-200 rounded-lg p-6" data-testid="revenue-trend">
      <div className="flex items-baseline justify-between mb-4 gap-4">
        <div>
          <h2 id={titleId} className="text-sm font-semibold uppercase tracking-wider text-text-muted-wabs">
            Revenue, last {data.length} months
          </h2>
          <p className="text-2xl font-bold text-navy mt-1">{formatMoney(total)}</p>
        </div>
        <button
          type="button"
          onClick={() => setShowTable(s => !s)}
          className="text-xs text-gold hover:underline"
          aria-expanded={showTable}
        >
          {showTable ? "Show chart" : "Show table"}
        </button>
      </div>

      {showTable ? (
        <table className="w-full text-sm">
          <thead className="text-text-muted-wabs text-xs uppercase tracking-wider">
            <tr><th className="text-left py-1">Month</th><th className="text-right py-1">Bookings</th><th className="text-right py-1">Revenue</th></tr>
          </thead>
          <tbody>
            {data.map(d => (
              <tr key={d.month} className="border-t border-gray-100">
                <td className="py-1 text-navy">{monthLabelLong(d.month)}</td>
                <td className="py-1 text-right text-navy">{d.bookings}</td>
                <td className="py-1 text-right text-navy font-semibold">{formatMoney(d.revenue)}</td>
              </tr>
            ))}
          </tbody>
        </table>
      ) : (
        <div className="relative">
          <svg viewBox={`0 0 ${W} ${H}`} className="w-full h-auto" role="img" aria-labelledby={titleId}>
            {ticks.map(t => (
              <g key={t}>
                <line x1={PAD.left} x2={W - PAD.right} y1={y(t)} y2={y(t)} stroke={GRID} strokeWidth={1} />
                <text x={PAD.left - 8} y={y(t)} dy="0.32em" textAnchor="end" className="fill-text-muted-wabs" fontSize={11}>
                  {formatAxisMoney(t, top)}
                </text>
              </g>
            ))}
            {data.map((d, i) => {
              const cx = PAD.left + band * i + band / 2;
              const h = Math.max(0, PAD.top + innerH - y(d.revenue));
              const x = cx - barW / 2;
              const yTop = PAD.top + innerH - h;
              const r = Math.min(4, h / 2, barW / 2);
              // Rounded top (data end), square at the baseline.
              const path = h > 0
                ? `M${x},${PAD.top + innerH} V${yTop + r} Q${x},${yTop} ${x + r},${yTop} H${x + barW - r} Q${x + barW},${yTop} ${x + barW},${yTop + r} V${PAD.top + innerH} Z`
                : "";
              const active = hover === i;
              return (
                <g key={d.month}>
                  {path && <path d={path} fill={SERIES} opacity={hover === null || active ? 1 : 0.55} />}
                  <text x={cx} y={H - 8} textAnchor="middle" fontSize={11} className="fill-text-muted-wabs">
                    {monthLabel(d.month)}
                  </text>
                  {i === last && d.revenue > 0 && (
                    <text x={cx} y={yTop - 6} textAnchor="middle" fontSize={11} fontWeight={600} className="fill-navy">
                      {formatAxisMoney(d.revenue, top)}
                    </text>
                  )}
                  {/* Hit target: full band height, wider than the mark. */}
                  <rect
                    x={PAD.left + band * i}
                    y={PAD.top}
                    width={band}
                    height={innerH}
                    fill="transparent"
                    tabIndex={0}
                    role="graphics-symbol"
                    aria-label={`${monthLabelLong(d.month)}: ${formatMoney(d.revenue)}, ${d.bookings} bookings`}
                    onPointerEnter={() => setHover(i)}
                    onPointerLeave={() => setHover(null)}
                    onFocus={() => setHover(i)}
                    onBlur={() => setHover(null)}
                    className="outline-none"
                  />
                </g>
              );
            })}
            <line x1={PAD.left} x2={W - PAD.right} y1={PAD.top + innerH} y2={PAD.top + innerH} stroke="#D1D5DB" strokeWidth={1} />
          </svg>

          {hover !== null && data[hover] && (
            <div
              className="pointer-events-none absolute -translate-x-1/2 -translate-y-full bg-white border border-gray-200 shadow-md rounded px-3 py-2 text-xs"
              style={{
                left: `${((PAD.left + band * hover + band / 2) / W) * 100}%`,
                top: `${(y(data[hover].revenue) / H) * 100}%`,
              }}
              role="status"
            >
              <p className="text-navy font-semibold text-sm">{formatMoney(data[hover].revenue)}</p>
              <p className="text-text-muted-wabs">{monthLabelLong(data[hover].month)} · {data[hover].bookings} bookings</p>
            </div>
          )}
        </div>
      )}
      <p className="text-xs text-text-muted-wabs mt-2">Confirmed, ready, active and completed bookings, by booking date.</p>
    </section>
  );
}
