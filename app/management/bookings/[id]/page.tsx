import { notFound } from "next/navigation";
import Link from "next/link";
import { ChevronLeft } from "lucide-react";
import { getManagementBookingDetail } from "@/lib/queries/management-bookings";
import { BookingDetailHeader } from "@/components/management/bookings/booking-detail-header";
import { BookingSummaryPanel } from "@/components/management/bookings/booking-summary-panel";
import { StatusHistoryTimeline } from "@/components/management/bookings/status-history-timeline";
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
            <NotesEditor bookingId={detail.id} initialNotes={detail.internal_notes} />
          </section>
        </aside>
      </div>
    </main>
  );
}
