import { notFound } from "next/navigation";
import Link from "next/link";
import { ChevronLeft } from "lucide-react";
import { getManagementBookingDetail, listBookableVehicles } from "@/lib/queries/management-bookings";
import { listCustomerDocuments } from "@/lib/queries/management-customers";
import { HandoverPanel } from "@/components/management/bookings/handover-panel";
import { ReassignVehicle } from "@/components/management/bookings/reassign-vehicle";
import { DocumentReviewPanel } from "@/components/management/bookings/document-review-panel";
import { formatMoney } from "@/lib/utils/format";
import { BookingDetailHeader } from "@/components/management/bookings/booking-detail-header";
import { BookingSummaryPanel } from "@/components/management/bookings/booking-summary-panel";
import { StatusHistoryTimeline } from "@/components/shared/status-history-timeline";
import { StatusActions } from "@/components/management/bookings/status-actions";
import { NotesEditor } from "@/components/management/bookings/notes-editor";

export const dynamic = "force-dynamic";

export default async function ManagementBookingDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const detail = await getManagementBookingDetail(id);
  if (!detail) notFound();
  const [vehicles, documents] = await Promise.all([
    listBookableVehicles(),
    listCustomerDocuments(detail.customer_id),
  ]);

  return (
    <main className="max-w-6xl mx-auto p-8">
      <Link
        href="/management/bookings"
        className="inline-flex items-center gap-1 text-sm text-gold hover:underline mb-4"
      >
        <ChevronLeft className="w-4 h-4" /> Back to bookings
      </Link>

      <BookingDetailHeader booking={detail} />

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-8 mt-6">
        <div className="lg:col-span-2 space-y-6">
          <BookingSummaryPanel booking={detail} />
          <section className="bg-white border border-gray-200 rounded-lg p-6">
            <h2 className="text-sm font-semibold uppercase tracking-wider text-text-muted-wabs mb-4">
              Status history
            </h2>
            <StatusHistoryTimeline history={detail.history} />
          </section>
        </div>

        <aside className="space-y-6">
          <section className="bg-white border border-gray-200 rounded-lg p-6">
            <h2 className="text-sm font-semibold uppercase tracking-wider text-text-muted-wabs mb-4">
              Actions
            </h2>
            <StatusActions bookingId={detail.id} currentStatus={detail.status} />
          </section>

          <section className="bg-white border border-gray-200 rounded-lg p-6">
            <h2 className="text-sm font-semibold uppercase tracking-wider text-text-muted-wabs mb-4">
              Pickup &amp; return
            </h2>
            <HandoverPanel booking={detail} />
          </section>

          <section className="bg-white border border-gray-200 rounded-lg p-6">
            <h2 className="text-sm font-semibold uppercase tracking-wider text-text-muted-wabs mb-4">Vehicle</h2>
            <ReassignVehicle
              bookingId={detail.id}
              currentVehicleId={detail.vehicle_id}
              status={detail.status}
              vehicles={vehicles}
            />
          </section>

          <section className="bg-white border border-gray-200 rounded-lg p-6">
            <h2 className="text-sm font-semibold uppercase tracking-wider text-text-muted-wabs mb-4">Documents</h2>
            <DocumentReviewPanel customerId={detail.customer_id} documents={documents} />
          </section>

          <section className="bg-white border border-gray-200 rounded-lg p-6">
            <h2 className="text-sm font-semibold uppercase tracking-wider text-text-muted-wabs mb-4">Payments</h2>
            {detail.payments.length === 0 ? (
              <p className="text-sm text-text-muted-wabs">No payments recorded.</p>
            ) : (
              <ul className="space-y-2 text-sm" data-testid="payments">
                {detail.payments.map(p => (
                  <li key={p.id} className="flex justify-between">
                    <span className="text-navy capitalize">{p.method} · {p.status}</span>
                    <span className="text-navy font-semibold">{formatMoney(p.amount)}</span>
                  </li>
                ))}
              </ul>
            )}
          </section>

          <section className="bg-white border border-gray-200 rounded-lg p-6">
            <NotesEditor bookingId={detail.id} initialNotes={detail.internal_notes} />
          </section>
        </aside>
      </div>
    </main>
  );
}
