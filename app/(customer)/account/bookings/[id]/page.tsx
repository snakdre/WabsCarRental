import Link from "next/link";
import { notFound } from "next/navigation";
import { ChevronLeft } from "lucide-react";
import { getMyBookingDetail } from "@/lib/queries/account";
import { canCustomerCancel } from "@/lib/validators/account";
import { formatMoney } from "@/lib/utils/format";
import { StatusPill } from "@/components/shared/status-pill";
import { StatusHistoryTimeline } from "@/components/shared/status-history-timeline";
import { CancelBookingDialog } from "@/components/customer/account/cancel-booking-dialog";

export const dynamic = "force-dynamic";

function Row({ label, value, strong }: { label: string; value: string; strong?: boolean }) {
  return (
    <div className={`flex justify-between py-1 text-sm ${strong ? "font-semibold text-navy border-t border-gray-200 pt-2 mt-2" : "text-navy"}`}>
      <span className={strong ? "" : "text-text-muted-wabs"}>{label}</span>
      <span>{value}</span>
    </div>
  );
}

export default async function MyBookingDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const b = await getMyBookingDetail(id);
  if (!b) notFound();

  const cancellable = canCustomerCancel(b.status, b.pickup_date);
  const paid = ["confirmed", "ready_for_pickup"].includes(b.status);
  const vehicleName = b.vehicle ? `${b.vehicle.year} ${b.vehicle.make} ${b.vehicle.model}` : "Vehicle";
  const fmtDate = (iso: string) =>
    new Date(iso).toLocaleString("en-US", { dateStyle: "medium", timeStyle: "short" });

  return (
    <main className="max-w-6xl mx-auto p-8">
      <Link href="/account" className="inline-flex items-center gap-1 text-sm text-gold hover:underline mb-4">
        <ChevronLeft className="w-4 h-4" /> Back to account
      </Link>

      <div className="flex flex-wrap items-center gap-4 mb-6">
        <h1 className="text-3xl font-bold text-navy font-mono" data-testid="booking-reference">{b.reference}</h1>
        <StatusPill status={b.status} />
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
        <div className="lg:col-span-2 space-y-6">
          <section className="bg-white border border-gray-200 rounded-lg overflow-hidden flex flex-col sm:flex-row">
            {b.vehicle?.cover_url && (
              // eslint-disable-next-line @next/next/no-img-element
              <img src={b.vehicle.cover_url} alt={vehicleName} className="sm:w-64 aspect-[16/10] object-cover" />
            )}
            <div className="p-6 space-y-2">
              <p className="text-lg font-semibold text-navy">
                {b.vehicle ? <Link href={`/vehicles/${b.vehicle.id}`} className="hover:text-gold">{vehicleName}</Link> : vehicleName}
              </p>
              <p className="text-sm text-navy"><span className="text-text-muted-wabs">Pickup:</span> {fmtDate(b.pickup_date)}</p>
              <p className="text-sm text-navy"><span className="text-text-muted-wabs">Return:</span> {fmtDate(b.return_date)}</p>
              <p className="text-sm text-navy">
                <span className="text-text-muted-wabs">{b.pickup_method === "delivery" ? "Delivery" : "Pickup location"}:</span>{" "}
                {b.location ? [b.location.name, b.location.address, b.location.city, b.location.state].filter(Boolean).join(", ") : "—"}
              </p>
              <p className="text-sm text-navy"><span className="text-text-muted-wabs">Driver:</span> {b.driver_name} · {b.driver_email} · {b.driver_phone}</p>
              {b.special_requests && (
                <p className="text-sm text-navy"><span className="text-text-muted-wabs">Requests:</span> {b.special_requests}</p>
              )}
            </div>
          </section>

          <section className="bg-white border border-gray-200 rounded-lg p-6">
            <h2 className="text-sm font-semibold uppercase tracking-wider text-text-muted-wabs mb-4">Status history</h2>
            <StatusHistoryTimeline history={b.history} />
          </section>
        </div>

        <aside className="space-y-6">
          <section className="bg-white border border-gray-200 rounded-lg p-6" data-testid="price-breakdown">
            <h2 className="text-sm font-semibold uppercase tracking-wider text-text-muted-wabs mb-4">Price</h2>
            <Row label={`Rental (${b.rental_days} day${b.rental_days === 1 ? "" : "s"})`} value={formatMoney(b.base_price)} />
            {b.protection_fee > 0 && <Row label="Protection" value={formatMoney(b.protection_fee)} />}
            {b.extras.map((e, i) => (
              <Row key={i} label={`${e.name}${e.quantity > 1 ? ` × ${e.quantity}` : ""}`} value={formatMoney(e.unit_price * e.quantity)} />
            ))}
            {b.extras.length === 0 && b.extras_fee > 0 && <Row label="Extras" value={formatMoney(b.extras_fee)} />}
            {b.delivery_fee > 0 && <Row label="Delivery" value={formatMoney(b.delivery_fee)} />}
            {b.discount_amount > 0 && <Row label="Discount" value={`−${formatMoney(b.discount_amount)}`} />}
            <Row label="Tax" value={formatMoney(b.tax_amount)} />
            <Row label="Total" value={formatMoney(b.total_amount)} strong />
            {b.deposit_amount > 0 && <p className="text-xs text-text-muted-wabs mt-2">Refundable deposit: {formatMoney(b.deposit_amount)}</p>}
          </section>

          <section className="bg-white border border-gray-200 rounded-lg p-6 space-y-3">
            <h2 className="text-sm font-semibold uppercase tracking-wider text-text-muted-wabs">Manage</h2>
            {cancellable ? (
              <>
                <CancelBookingDialog bookingId={b.id} reference={b.reference} paid={paid} />
                <p className="text-xs text-text-muted-wabs">Free cancellation up to 24 hours before pickup.</p>
              </>
            ) : (
              <p className="text-sm text-text-muted-wabs">
                {["cancelled", "rejected", "refunded", "completed"].includes(b.status)
                  ? "This booking is closed."
                  : "Online cancellation is no longer available. Contact us for changes."}
              </p>
            )}
          </section>
        </aside>
      </div>
    </main>
  );
}
