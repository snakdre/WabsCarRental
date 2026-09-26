import type { ManagementBookingDetail } from "@/lib/queries/management-bookings";
import { StatusPill } from "./status-pill";

export function BookingDetailHeader({ booking }: { booking: ManagementBookingDetail }) {
  return (
    <div className="mb-6">
      <p className="text-gold text-xs uppercase tracking-[0.3em] mb-2">Booking</p>
      <div className="flex items-center gap-3">
        <h1 className="text-3xl font-bold text-navy font-mono">{booking.reference}</h1>
        <StatusPill status={booking.status} />
      </div>
      <p className="text-text-muted-wabs text-sm mt-2">
        Created {booking.created_at.slice(0, 10)}
      </p>
    </div>
  );
}
