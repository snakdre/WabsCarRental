import Link from "next/link";
import type { VehicleBookingHistoryItem } from "@/lib/queries/management-vehicles";
import { StatusPill } from "@/components/shared/status-pill";
import { formatMoney } from "@/lib/utils/format";

const EARNING = new Set(["confirmed", "ready_for_pickup", "active", "completed"]);

export function VehicleBookingHistory({ bookings }: { bookings: VehicleBookingHistoryItem[] }) {
  const revenue = bookings.filter(b => EARNING.has(b.status)).reduce((s, b) => s + b.total_amount, 0);
  return (
    <section className="bg-white border border-gray-200 rounded-lg overflow-hidden" data-testid="vehicle-booking-history">
      <div className="flex items-baseline justify-between p-6 pb-3">
        <h2 className="text-sm font-semibold uppercase tracking-wider text-text-muted-wabs">Booking history</h2>
        <p className="text-sm text-navy">
          {bookings.length} booking{bookings.length === 1 ? "" : "s"} · {formatMoney(revenue)} revenue
        </p>
      </div>
      {bookings.length === 0 ? (
        <p className="px-6 pb-6 text-sm text-text-muted-wabs">This vehicle hasn&apos;t been booked yet.</p>
      ) : (
        <table className="w-full text-sm">
          <thead className="bg-gray-50 text-text-muted-wabs uppercase text-xs tracking-wider">
            <tr>
              <th className="text-left px-6 py-2">Reference</th>
              <th className="text-left px-4 py-2">Driver</th>
              <th className="text-left px-4 py-2">Dates</th>
              <th className="text-left px-4 py-2">Status</th>
              <th className="text-right px-6 py-2">Total</th>
            </tr>
          </thead>
          <tbody>
            {bookings.map(b => (
              <tr key={b.id} className="border-t border-gray-100">
                <td className="px-6 py-2 font-mono">
                  <Link href={`/management/bookings/${b.id}`} className="text-navy hover:text-gold">{b.reference}</Link>
                </td>
                <td className="px-4 py-2 text-navy">{b.driver_name}</td>
                <td className="px-4 py-2 text-navy">{b.pickup_date.slice(0, 10)} → {b.return_date.slice(0, 10)}</td>
                <td className="px-4 py-2"><StatusPill status={b.status} /></td>
                <td className="px-6 py-2 text-right text-navy font-semibold">{formatMoney(b.total_amount)}</td>
              </tr>
            ))}
          </tbody>
        </table>
      )}
    </section>
  );
}
