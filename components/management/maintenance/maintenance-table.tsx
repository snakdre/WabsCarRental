"use client";

import Link from "next/link";
import { useState, useTransition } from "react";
import { setMaintenanceStatus } from "@/lib/actions/maintenance";
import type { MaintenanceRow } from "@/lib/queries/maintenance";
import { MAINTENANCE_STATUS_LABEL, MAINTENANCE_TRANSITIONS, type MaintenanceStatus } from "@/lib/validators/maintenance";
import { formatMoney } from "@/lib/utils/format";

const STATUS_STYLE: Record<MaintenanceStatus, string> = {
  scheduled: "bg-blue-100 text-blue-700",
  in_progress: "bg-yellow-100 text-yellow-700",
  completed: "bg-green-100 text-green-700",
  cancelled: "bg-gray-100 text-gray-600",
};

function RowActions({ row }: { row: MaintenanceRow }) {
  const [error, setError] = useState<string | null>(null);
  const [isPending, startTransition] = useTransition();
  const next = MAINTENANCE_TRANSITIONS[row.status];
  if (next.length === 0) return null;

  const go = (status: MaintenanceStatus) => {
    let cost = "";
    if (status === "completed") {
      const v = prompt("Final cost (USD), blank to keep the estimate:", row.cost?.toFixed(2) ?? "");
      if (v === null) return;
      cost = v;
    } else if (status === "cancelled" && !confirm("Cancel this maintenance and free the vehicle's dates?")) {
      return;
    }
    const fd = new FormData();
    fd.set("id", row.id);
    fd.set("vehicle_id", row.vehicle_id);
    fd.set("status", status);
    fd.set("cost", cost);
    fd.set("odometer", "");
    setError(null);
    startTransition(async () => {
      const res = await setMaintenanceStatus(fd);
      if (res.error) setError(res.error);
    });
  };

  return (
    <div className="flex flex-col items-end gap-1">
      <div className="flex gap-3">
        {next.filter(s => s !== "scheduled").map(s => (
          <button
            key={s}
            type="button"
            disabled={isPending}
            onClick={() => go(s)}
            className={`text-xs hover:underline ${s === "cancelled" ? "text-red-600" : "text-gold font-semibold"}`}
          >
            {s === "in_progress" ? "Start" : s === "completed" ? "Complete" : "Cancel"}
          </button>
        ))}
      </div>
      {error && <span className="text-red-600 text-xs">{error}</span>}
    </div>
  );
}

export function MaintenanceTable({ rows }: { rows: MaintenanceRow[] }) {
  if (rows.length === 0) {
    return (
      <div className="text-center py-12 bg-white border border-gray-200 rounded-lg">
        <p className="text-navy font-semibold mb-1">No maintenance records</p>
        <p className="text-text-muted-wabs text-sm">Schedule work with the form to block the vehicle on the calendar.</p>
      </div>
    );
  }
  return (
    <div className="bg-white border border-gray-200 rounded-lg overflow-x-auto">
      <table className="w-full text-sm" data-testid="maintenance-table">
        <thead className="bg-gray-50 text-text-muted-wabs uppercase text-xs tracking-wider">
          <tr>
            <th className="text-left px-4 py-3">Vehicle</th>
            <th className="text-left px-4 py-3">Work</th>
            <th className="text-left px-4 py-3">Dates</th>
            <th className="text-right px-4 py-3">Cost</th>
            <th className="text-left px-4 py-3">Status</th>
            <th className="px-4 py-3"><span className="sr-only">Actions</span></th>
          </tr>
        </thead>
        <tbody>
          {rows.map(r => (
            <tr key={r.id} className="border-t border-gray-100 align-top">
              <td className="px-4 py-3">
                <Link href={`/management/vehicles/${r.vehicle_id}`} className="text-navy hover:text-gold">{r.vehicle_label}</Link>
                {r.odometer != null && <p className="text-xs text-text-muted-wabs">{r.odometer.toLocaleString("en-US")} mi</p>}
              </td>
              <td className="px-4 py-3 max-w-xs">
                <p className="text-navy capitalize">{r.category}</p>
                {r.description && <p className="text-xs text-text-muted-wabs line-clamp-2">{r.description}</p>}
                {r.vendor && <p className="text-xs text-text-muted-wabs">{r.vendor}</p>}
              </td>
              <td className="px-4 py-3 text-navy whitespace-nowrap">
                {r.service_date}{r.return_date && r.return_date !== r.service_date ? ` → ${r.return_date}` : ""}
              </td>
              <td className="px-4 py-3 text-right text-navy">{r.cost != null ? formatMoney(r.cost) : "—"}</td>
              <td className="px-4 py-3">
                <span className={`text-xs px-2 py-1 rounded font-medium ${STATUS_STYLE[r.status]}`}>{MAINTENANCE_STATUS_LABEL[r.status]}</span>
              </td>
              <td className="px-4 py-3 text-right"><RowActions row={r} /></td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
