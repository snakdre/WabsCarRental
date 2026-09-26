import { STATUS_LABEL, type BookingStatus } from "@/lib/booking-status";

const STATUS_STYLE: Record<string, string> = {
  draft: "bg-gray-100 text-gray-700",
  pending: "bg-gray-100 text-gray-700",
  awaiting_payment: "bg-gray-100 text-gray-700",
  confirmed: "bg-gold/20 text-gold-muted",
  ready_for_pickup: "bg-blue-100 text-blue-700",
  active: "bg-green-100 text-green-700",
  completed: "bg-navy/10 text-navy",
  cancelled: "bg-red-100 text-red-700",
  rejected: "bg-red-100 text-red-700",
  refunded: "bg-yellow-100 text-yellow-700",
};

export function StatusPill({ status }: { status: string }) {
  const cls = STATUS_STYLE[status] ?? "bg-gray-100 text-gray-700";
  const label = STATUS_LABEL[status as BookingStatus] ?? status.replace(/_/g, " ");
  return (
    <span className={`text-xs px-2 py-1 rounded font-medium ${cls}`}>
      {label}
    </span>
  );
}
