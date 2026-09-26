import Link from "next/link";
import type { ManagementBookingListItem } from "@/lib/queries/management-bookings";
import { StatusPill } from "./status-pill";
import { formatMoney } from "@/lib/utils/format";

export function BookingsTable({ bookings }: { bookings: ManagementBookingListItem[] }) {
  if (bookings.length === 0) {
    return (
      <div className="text-center py-16 bg-white border border-gray-200 rounded-lg">
        <p className="text-navy font-semibold mb-2">No bookings match your filters</p>
        <p className="text-text-muted-wabs">Try a different status or clear the search.</p>
      </div>
    );
  }
  return (
    <div className="bg-white border border-gray-200 rounded-lg overflow-hidden">
      <table className="w-full text-sm">
        <thead className="bg-gray-50 text-text-muted-wabs uppercase text-xs tracking-wider">
          <tr>
            <th className="text-left px-4 py-3">Reference</th>
            <th className="text-left px-4 py-3">Customer</th>
            <th className="text-left px-4 py-3">Vehicle</th>
            <th className="text-left px-4 py-3">Pickup</th>
            <th className="text-left px-4 py-3">Return</th>
            <th className="text-left px-4 py-3">Status</th>
            <th className="text-right px-4 py-3">Total</th>
          </tr>
        </thead>
        <tbody>
          {bookings.map((b) => (
            <tr key={b.id} data-booking-ref={b.reference} className="border-t border-gray-100 hover:bg-gray-50">
              <td className="px-4 py-3 font-mono text-navy">
                <Link href={`/management/bookings/${b.id}`} className="hover:text-gold">
                  {b.reference}
                </Link>
              </td>
              <td className="px-4 py-3 text-navy">
                <div>{b.driver_name}</div>
                <div className="text-xs text-text-muted-wabs">{b.driver_email}</div>
              </td>
              <td className="px-4 py-3 text-navy">
                {b.vehicle_year} {b.vehicle_make} {b.vehicle_model}
              </td>
              <td className="px-4 py-3 text-navy">{b.pickup_date.slice(0, 10)}</td>
              <td className="px-4 py-3 text-navy">{b.return_date.slice(0, 10)}</td>
              <td className="px-4 py-3"><StatusPill status={b.status} /></td>
              <td className="px-4 py-3 text-right font-semibold text-navy">{formatMoney(b.total_amount)}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
