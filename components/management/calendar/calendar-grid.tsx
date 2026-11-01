"use client";

import { useMemo, useState } from "react";
import Link from "next/link";
import { AlertTriangle } from "lucide-react";
import { blockColumns, findConflicts } from "@/lib/utils/calendar";
import type { CalendarData } from "@/lib/queries/management-availability";
import { AddBlockDialog } from "./add-block-dialog";

const BLOCK_STYLE: Record<string, string> = {
  booking: "bg-gold/80 text-deep",
  maintenance: "bg-red-500/80 text-white",
  blocked: "bg-gray-500/80 text-white",
};

const WEEKDAY = (iso: string) =>
  new Date(iso + "T00:00:00Z").toLocaleString("en-US", { weekday: "short", timeZone: "UTC" });

// Renders any contiguous date range: a month (28–31 columns) or a week (7).
// Columns are dates, so blocks spanning month/week boundaries clamp correctly.
export function CalendarGrid({
  dates,
  data,
  today,
  variant,
}: {
  dates: string[]; // YYYY-MM-DD, contiguous
  data: CalendarData;
  today: string;
  variant: "month" | "week";
}) {
  const [dialogState, setDialogState] = useState<{
    open: boolean;
    vehicleId: string;
    vehicleLabel: string;
    date: string;
  } | null>(null);

  const conflicts = useMemo(() => findConflicts(data.blocks), [data.blocks]);
  const conflictVehicles = useMemo(
    () => new Set(data.blocks.filter(b => conflicts.has(b.id)).map(b => b.vehicle_id)),
    [data.blocks, conflicts],
  );

  const colMin = variant === "week" ? "minmax(96px, 1fr)" : "minmax(28px, 1fr)";
  const gridTemplateColumns = `180px repeat(${dates.length}, ${colMin})`;
  const rowH = variant === "week" ? "h-14" : "h-10";
  const rowOffset = variant === "week" ? "-mt-14" : "-mt-10";

  const label = (v: CalendarData["vehicles"][number]) =>
    `${v.year} ${v.make} ${v.model}${v.trim ? ` ${v.trim}` : ""}`;

  return (
    <>
      {conflicts.size > 0 && (
        <div
          role="alert"
          className="mb-4 flex items-start gap-2 bg-red-50 border border-red-200 text-red-800 rounded-lg px-4 py-3 text-sm"
          data-testid="calendar-conflicts"
        >
          <AlertTriangle className="w-4 h-4 mt-0.5 shrink-0" aria-hidden />
          <div>
            <p className="font-semibold">
              {conflictVehicles.size} vehicle{conflictVehicles.size === 1 ? " has" : "s have"} overlapping periods in this view
            </p>
            <p className="text-red-700">
              Outlined blocks overlap another block on the same vehicle. Usually a blocked period sitting on top of a booking. Review them before the dates arrive.
            </p>
          </div>
        </div>
      )}

      <div className="bg-white border border-gray-200 rounded-lg overflow-x-auto">
        <div className="min-w-max">
          <div
            className="grid border-b border-gray-200 bg-gray-50 text-text-muted-wabs text-xs uppercase tracking-wider sticky top-0"
            style={{ gridTemplateColumns }}
          >
            <div className="px-3 py-2 border-r border-gray-200">Vehicle</div>
            {dates.map((d) => (
              <div
                key={d}
                className={`px-1 py-2 text-center border-r border-gray-100 last:border-r-0 ${d === today ? "bg-gold/15 text-navy font-semibold" : ""}`}
              >
                {variant === "week" ? (
                  <>
                    <span className="block">{WEEKDAY(d)}</span>
                    <span className="block text-[11px] normal-case">{d.slice(5).replace("-", "/")}</span>
                  </>
                ) : (
                  Number(d.slice(8))
                )}
              </div>
            ))}
          </div>

          {data.vehicles.map((v) => (
            <div key={v.id} className="grid border-b border-gray-100 last:border-b-0" style={{ gridTemplateColumns }}>
              <div className="px-3 py-2 border-r border-gray-200 text-sm text-navy truncate flex items-center gap-1">
                {conflictVehicles.has(v.id) && <AlertTriangle className="w-3.5 h-3.5 text-red-600 shrink-0" aria-label="Has conflicts" />}
                <span className="truncate">{label(v)}</span>
              </div>
              {dates.map((d) => (
                <button
                  key={d}
                  type="button"
                  onClick={() => setDialogState({ open: true, vehicleId: v.id, vehicleLabel: label(v), date: d })}
                  aria-label={`Add block for ${label(v)} on ${d}`}
                  className={`relative ${rowH} border-r border-gray-100 last:border-r-0 hover:bg-gold/10 focus:outline-none focus:ring-2 focus:ring-inset focus:ring-gold/50 ${d === today ? "bg-gold/5" : ""}`}
                />
              ))}
              {/* Blocks layer: pointer-events-none keeps the day buttons clickable
                  except on the strips themselves. */}
              <div className={`col-start-2 col-end-[-1] ${rowOffset} ${rowH} pointer-events-none`}>
                <div className="relative h-full grid" style={{ gridTemplateColumns: `repeat(${dates.length}, ${colMin})` }}>
                  {data.blocks
                    .filter((b) => b.vehicle_id === v.id)
                    .map((b) => {
                      const cols = blockColumns(b.start_date, b.end_date, dates);
                      if (!cols) return null;
                      const conflict = conflicts.has(b.id);
                      const title = `${b.type}${b.reason ? `: ${b.reason}` : ""} (${b.start_date} → ${b.end_date})${conflict ? " · overlaps another block" : ""}`;
                      const cls = `m-1 rounded text-xs font-medium flex items-center justify-center overflow-hidden pointer-events-auto ${BLOCK_STYLE[b.type] ?? "bg-gray-400/80 text-white"} ${conflict ? "ring-2 ring-red-600 ring-offset-1" : ""}`;
                      const style = { gridColumnStart: cols.from, gridColumnEnd: cols.to + 1, gridRowStart: 1 };
                      const text = (
                        <span className="truncate px-1">
                          {conflict && "⚠ "}
                          {variant === "week" && b.reason ? b.reason : b.type}
                        </span>
                      );
                      return b.type === "booking" && b.reference_id ? (
                        <Link key={b.id} href={`/management/bookings/${b.reference_id}`} title={title} className={`${cls} hover:brightness-95`} style={style}>
                          {text}
                        </Link>
                      ) : (
                        <div key={b.id} title={title} className={cls} style={style}>{text}</div>
                      );
                    })}
                </div>
              </div>
            </div>
          ))}

          {data.vehicles.length === 0 && (
            <div className="px-4 py-8 text-center text-text-muted-wabs">No vehicles to display.</div>
          )}
        </div>

        <div className="flex flex-wrap items-center gap-4 px-4 py-3 border-t border-gray-200 text-xs text-text-muted-wabs">
          <span className="inline-flex items-center gap-1"><span className="w-3 h-3 rounded bg-gold/80 inline-block" />Booking (click to open)</span>
          <span className="inline-flex items-center gap-1"><span className="w-3 h-3 rounded bg-red-500/80 inline-block" />Maintenance</span>
          <span className="inline-flex items-center gap-1"><span className="w-3 h-3 rounded bg-gray-500/80 inline-block" />Blocked</span>
          <span className="inline-flex items-center gap-1"><span className="w-3 h-3 rounded ring-2 ring-red-600 inline-block" />Overlap</span>
        </div>
      </div>

      {dialogState && (
        <AddBlockDialog
          open={dialogState.open}
          onOpenChange={(open) => setDialogState((s) => (s ? { ...s, open } : null))}
          vehicleId={dialogState.vehicleId}
          vehicleLabel={dialogState.vehicleLabel}
          initialDate={dialogState.date}
        />
      )}
    </>
  );
}
