import type { ManagementBookingDetail } from "@/lib/queries/management-bookings";
import { formatMoney } from "@/lib/utils/format";

function Row({ label, value }: { label: string; value: React.ReactNode }) {
  return (
    <div className="flex justify-between text-sm py-1">
      <span className="text-text-muted-wabs">{label}</span>
      <span className="text-navy font-medium text-right">{value}</span>
    </div>
  );
}

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <section className="bg-white border border-gray-200 rounded-lg p-6">
      <h2 className="text-sm font-semibold uppercase tracking-wider text-text-muted-wabs mb-4">{title}</h2>
      <div className="space-y-1">{children}</div>
    </section>
  );
}

export function BookingSummaryPanel({ booking }: { booking: ManagementBookingDetail }) {
  return (
    <div className="space-y-4">
      <Section title="Trip">
        <Row label="Vehicle" value={`${booking.vehicle_year} ${booking.vehicle_make} ${booking.vehicle_model}`} />
        <Row label="Pickup" value={booking.pickup_date.slice(0, 10)} />
        <Row label="Return" value={booking.return_date.slice(0, 10)} />
        <Row label="Method" value={booking.pickup_method} />
        <Row label="Duration" value={`${booking.rental_days} day${booking.rental_days === 1 ? "" : "s"}`} />
      </Section>

      <Section title="Driver">
        <Row label="Name" value={booking.driver_name} />
        <Row label="Email" value={booking.driver_email} />
        <Row label="Phone" value={booking.driver_phone} />
        <Row label="Date of birth" value={booking.driver_dob} />
        <Row label="License" value={`${booking.license_number} (${booking.license_region})`} />
        <Row label="License expiry" value={booking.license_expiry} />
      </Section>

      <Section title="Pricing">
        <Row label="Base rental" value={formatMoney(booking.base_price)} />
        {booking.protection_fee > 0 && <Row label="Protection" value={formatMoney(booking.protection_fee)} />}
        {booking.extras_fee > 0 && <Row label="Extras" value={formatMoney(booking.extras_fee)} />}
        {booking.delivery_fee > 0 && <Row label="Delivery" value={formatMoney(booking.delivery_fee)} />}
        {booking.discount_amount > 0 && <Row label="Discount" value={`− ${formatMoney(booking.discount_amount)}`} />}
        {booking.tax_amount > 0 && <Row label="Tax" value={formatMoney(booking.tax_amount)} />}
        <div className="border-t border-gray-100 mt-2 pt-2">
          <Row label="Total charged" value={<strong>{formatMoney(booking.total_amount)}</strong>} />
        </div>
        {booking.deposit_amount > 0 && (
          <p className="text-xs text-text-muted-wabs mt-2">
            Refundable deposit: {formatMoney(booking.deposit_amount)}
          </p>
        )}
      </Section>

      {booking.special_requests && (
        <Section title="Special requests">
          <p className="text-sm text-navy">{booking.special_requests}</p>
        </Section>
      )}
    </div>
  );
}
