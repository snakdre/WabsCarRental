import Link from "next/link";
import { listMyBookings } from "@/lib/queries/bookings";
import { formatMoney } from "@/lib/utils/format";
import { StatusPill } from "@/components/shared/status-pill";

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
                <StatusPill status={b.status} />
              </td>
              <td className="px-4 py-3 text-right font-semibold text-navy">{formatMoney(Number(b.total_amount))}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
