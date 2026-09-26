import { redirect } from "next/navigation";
import { StepIndicator } from "@/components/customer/checkout/step-indicator";
import { BackLink } from "@/components/customer/checkout/back-link";
import { BookingSummaryCard } from "@/components/customer/checkout/booking-summary-card";
import { DriverForm } from "@/components/customer/checkout/driver-form";

export const dynamic = "force-dynamic";

export default async function CheckoutDriverPage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | undefined>>;
}) {
  const sp = await searchParams;
  const { vehicle, pickup, return: ret, pickup_method } = sp;
  if (!vehicle || !pickup || !ret || !pickup_method) {
    redirect(`/checkout/dates${vehicle ? `?vehicle=${encodeURIComponent(vehicle)}` : ""}`);
  }

  const carried = {
    vehicle: vehicle!,
    pickup: pickup!,
    return: ret!,
    pickup_method: pickup_method!,
    ...(sp.pickup_location_id ? { pickup_location_id: sp.pickup_location_id } : {}),
  };

  const backParams = new URLSearchParams({ vehicle: vehicle! });
  return (
    <div>
      <StepIndicator current={2} />
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-8 mt-6">
        <div className="lg:col-span-2">
          <BackLink href={`/checkout/dates?${backParams.toString()}`} label="Back to dates" />
          <h1 className="text-3xl font-bold text-navy mb-6">Who&apos;s driving?</h1>
          <DriverForm carried={carried} />
        </div>
        <BookingSummaryCard vehicleId={vehicle!} />
      </div>
    </div>
  );
}
