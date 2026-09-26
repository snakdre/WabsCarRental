import type { StatusHistoryRow } from "@/lib/queries/management-bookings";
import { STATUS_LABEL, type BookingStatus } from "@/lib/booking-status";

export function StatusHistoryTimeline({ history }: { history: StatusHistoryRow[] }) {
  if (history.length === 0) {
    return (
      <p className="text-sm text-text-muted-wabs">No status history yet.</p>
    );
  }
  return (
    <ol className="space-y-3 relative pl-6 border-l-2 border-gray-200">
      {history.map((row, i) => {
        const label = STATUS_LABEL[row.status as BookingStatus] ?? row.status;
        return (
          <li key={i} className="relative">
            <span className="absolute -left-[29px] top-1 w-3 h-3 rounded-full bg-gold border-2 border-white" />
            <p className="text-sm font-semibold text-navy">{label}</p>
            <p className="text-xs text-text-muted-wabs">{row.created_at.slice(0, 19).replace("T", " ")}</p>
            {row.note && <p className="text-sm text-navy mt-1 bg-gray-50 rounded px-2 py-1">{row.note}</p>}
          </li>
        );
      })}
    </ol>
  );
}
