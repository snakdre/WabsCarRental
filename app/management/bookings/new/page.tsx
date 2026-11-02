import Link from "next/link";
import { ChevronLeft } from "lucide-react";
import { getCustomerDetail } from "@/lib/queries/management-customers";
import { listBookableVehicles } from "@/lib/queries/management-bookings";
import { listActivePlans, listActiveExtras } from "@/lib/queries/extras";
import { ManualBookingForm } from "@/components/management/bookings/manual-booking-form";

export const dynamic = "force-dynamic";

export default async function NewManualBookingPage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const raw = (await searchParams).customer;
  const preset = Array.isArray(raw) ? raw[0] : raw;
  const [presetDetail, vehicles, plans, extras] = await Promise.all([
    preset ? getCustomerDetail(preset) : Promise.resolve(null),
    listBookableVehicles(),
    listActivePlans(),
    listActiveExtras(),
  ]);
  const presetCustomer = presetDetail
    ? {
        id: presetDetail.id, email: presetDetail.email, first_name: presetDetail.first_name,
        last_name: presetDetail.last_name, phone: presetDetail.phone,
        flagged: presetDetail.flagged, is_active: presetDetail.is_active,
      }
    : null;

  return (
    <main className="max-w-4xl mx-auto p-8">
      <Link href="/management/bookings" className="inline-flex items-center gap-1 text-sm text-gold hover:underline mb-4">
        <ChevronLeft className="w-4 h-4" /> Back to bookings
      </Link>
      <div className="mb-6">
        <p className="text-gold text-xs uppercase tracking-[0.3em] mb-2">Management</p>
        <h1 className="text-3xl font-bold text-navy">New booking</h1>
        <p className="text-text-muted-wabs mt-2">Book on behalf of a registered customer (phone or walk-in).</p>
      </div>
      <ManualBookingForm vehicles={vehicles} plans={plans} extras={extras} presetCustomer={presetCustomer} />
    </main>
  );
}
