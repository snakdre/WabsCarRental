import Link from "next/link";
import { listMyBookings } from "@/lib/queries/bookings";
import { formatMoney } from "@/lib/utils/format";

const STATUS_STYLE: Record<string, string> = {
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

export async function BookingsTable() {
  const bookings = await listMyBookings();

  if (bookings.length === 0) {
    return (
      <div className="text-center py-16 bg-white border border-gray-200 rounded-lg">
        <p className="text-navy font-semibold mb-2">No bookings yet</p>
        <p className="text-text-muted-wabs mb-6">Ready for something extraordinary?</p>
        <Link href="/vehicles" className="text-sm bg-gold text-deep font-semibold px-6 py-3 rounded hover:bg-gold-muted">
          Browse the fleet →
        </Link>
      </div>
    );
  }

  return (
    <div className="bg-white border border-gray-200 rounded-lg overflow-hidden">
      <table className="w-full text-sm">
        <thead className="bg-gray-50 text-text-muted-wabs uppercase text-xs tracking-wider">
          <tr>
            <th className="text-left px-4 py-3">Reference</th>
            <th className="text-left px-4 py-3">Vehicle</th>
            <th className="text-left px-4 py-3">Pickup</th>
            <th className="text-left px-4 py-3">Return</th>
            <th className="text-left px-4 py-3">Status</th>
            <th className="text-right px-4 py-3">Total</th>
          </tr>
        </thead>
        <tbody>
          {bookings.map(b => (
            <tr key={b.id} data-booking-ref={b.reference} className="border-t border-gray-100">
              <td className="px-4 py-3 font-mono text-navy">{b.reference}</td>
              <td className="px-4 py-3 text-navy">{b.vehicle_year} {b.vehicle_make} {b.vehicle_model}</td>
              <td className="px-4 py-3 text-navy">{b.pickup_date.slice(0, 10)}</td>
              <td className="px-4 py-3 text-navy">{b.return_date.slice(0, 10)}</td>
              <td className="px-4 py-3">
                <span className={`text-xs px-2 py-1 rounded font-medium ${STATUS_STYLE[b.status] ?? "bg-gray-100 text-gray-700"}`}>
                  {b.status.replace(/_/g, " ")}
                </span>
              </td>
              <td className="px-4 py-3 text-right font-semibold text-navy">{formatMoney(Number(b.total_amount))}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
