"use client";

import { useState } from "react";
import { daysInMonth, clampBlockToMonth } from "@/lib/utils/calendar";
import type { CalendarData } from "@/lib/queries/management-availability";
import { AddBlockDialog } from "./add-block-dialog";

const BLOCK_STYLE: Record<string, string> = {
  booking: "bg-gold/80 text-deep",
  maintenance: "bg-red-500/80 text-white",
  blocked: "bg-gray-500/80 text-white",
};

export function CalendarGrid({
  year,
  month,
  data,
}: {
  year: number;
  month: number;
  data: CalendarData;
}) {
  const [dialogState, setDialogState] = useState<{
    open: boolean;
    vehicleId: string;
    vehicleLabel: string;
    date: string; // YYYY-MM-DD
  } | null>(null);

  const days = daysInMonth(year, month);
  const gridTemplateColumns = `180px repeat(${days.length}, minmax(28px, 1fr))`;

  const openDialog = (v: CalendarData["vehicles"][number], day: number) => {
    const mm = String(month).padStart(2, "0");
    const dd = String(day).padStart(2, "0");
    const date = `${year}-${mm}-${dd}`;
    setDialogState({
      open: true,
      vehicleId: v.id,
      vehicleLabel: `${v.year} ${v.make} ${v.model}${v.trim ? ` ${v.trim}` : ""}`,
      date,
    });
  };

  return (
    <>
      <div className="bg-white border border-gray-200 rounded-lg overflow-x-auto">
        <div className="min-w-max">
          {/* Header row — unchanged from the previous version */}
          <div
            className="grid border-b border-gray-200 bg-gray-50 text-text-muted-wabs text-xs uppercase tracking-wider sticky top-0"
            style={{ gridTemplateColumns }}
          >
            <div className="px-3 py-2 border-r border-gray-200">Vehicle</div>
            {days.map((d) => (
              <div
                key={d}
                className="px-1 py-2 text-center border-r border-gray-100 last:border-r-0"
              >
                {d}
              </div>
            ))}
          </div>

          {/* Vehicle rows */}
          {data.vehicles.map((v) => (
            <div
              key={v.id}
              className="grid border-b border-gray-100 last:border-b-0"
              style={{ gridTemplateColumns }}
            >
              <div className="px-3 py-2 border-r border-gray-200 text-sm text-navy truncate">
                {v.year} {v.make} {v.model}
                {v.trim ? ` ${v.trim}` : ""}
              </div>
              {days.map((d) => (
                <button
                  key={d}
                  type="button"
                  onClick={() => openDialog(v, d)}
                  aria-label={`Add block on day ${d}`}
                  className="relative h-10 border-r border-gray-100 last:border-r-0 hover:bg-gold/10 focus:outline-none focus:ring-2 focus:ring-inset focus:ring-gold/50"
                />
              ))}
              {/* Blocks layer — pointer-events-none keeps underlying buttons clickable
                  everywhere except the colored strip itself (strip uses pointer-events-auto so its
                  tooltip works). Clicks on a strip don't open the dialog — that's intentional for v1. */}
              <div className="col-start-2 col-end-[-1] -mt-10 h-10 pointer-events-none">
                <div
                  className="relative h-full"
                  style={{
                    gridTemplateColumns: `repeat(${days.length}, minmax(28px, 1fr))`,
                    display: "grid",
                  }}
                >
                  {data.blocks
                    .filter((b) => b.vehicle_id === v.id)
                    .map((b) => {
                      const clamped = clampBlockToMonth(b.start_date, b.end_date, year, month);
                      if (!clamped) return null;
                      return (
                        <div
                          key={b.id}
                          title={`${b.type}${b.reason ? `: ${b.reason}` : ""} (${b.start_date} → ${b.end_date})`}
                          className={`m-1 rounded text-xs font-medium flex items-center justify-center overflow-hidden pointer-events-auto ${BLOCK_STYLE[b.type] ?? "bg-gray-400/80 text-white"}`}
                          style={{
                            gridColumnStart: clamped.startDay,
                            gridColumnEnd: clamped.endDay + 1,
                          }}
                        >
                          <span className="truncate px-1">{b.type}</span>
                        </div>
                      );
                    })}
                </div>
              </div>
            </div>
          ))}

          {data.vehicles.length === 0 && (
            <div className="px-4 py-8 text-center text-text-muted-wabs">
              No vehicles to display.
            </div>
          )}
        </div>

        {/* Legend */}
        <div className="flex items-center gap-4 px-4 py-3 border-t border-gray-200 text-xs text-text-muted-wabs">
          <span className="inline-flex items-center gap-1">
            <span className="w-3 h-3 rounded bg-gold/80 inline-block"></span>Booking
          </span>
          <span className="inline-flex items-center gap-1">
            <span className="w-3 h-3 rounded bg-red-500/80 inline-block"></span>Maintenance
          </span>
          <span className="inline-flex items-center gap-1">
            <span className="w-3 h-3 rounded bg-gray-500/80 inline-block"></span>Blocked
          </span>
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
