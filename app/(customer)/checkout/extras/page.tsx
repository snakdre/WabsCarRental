import { redirect } from "next/navigation";
import { StepIndicator } from "@/components/customer/checkout/step-indicator";
import { BackLink } from "@/components/customer/checkout/back-link";
import { BookingSummaryCard } from "@/components/customer/checkout/booking-summary-card";
import { ExtrasForm } from "@/components/customer/checkout/extras-form";
import { listActiveExtras, listActivePlans } from "@/lib/queries/extras";

const REQUIRED_DRIVER_FIELDS = [
  "driver_name", "driver_email", "driver_phone", "driver_dob",
  "license_number", "license_expiry", "license_region",
];

export const dynamic = "force-dynamic";

export default async function CheckoutExtrasPage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | undefined>>;
}) {
  const sp = await searchParams;
  if (!sp.vehicle || !sp.pickup || !sp.return || !sp.pickup_method) {
    redirect(`/checkout/dates${sp.vehicle ? `?vehicle=${encodeURIComponent(sp.vehicle)}` : ""}`);
  }
  if (!REQUIRED_DRIVER_FIELDS.every(f => sp[f])) {
    const params = new URLSearchParams();
    (["vehicle","pickup","return","pickup_method","pickup_location_id"] as const)
      .forEach(k => { if (sp[k]) params.set(k, sp[k]!); });
    redirect(`/checkout/driver?${params.toString()}`);
  }

  const [plans, extras] = await Promise.all([listActivePlans(), listActiveExtras()]);
  const carried: Record<string, string> = {};
  Object.entries(sp).forEach(([k, v]) => { if (typeof v === "string") carried[k] = v; });

  const backParams = new URLSearchParams(carried);
  return (
    <div>
      <StepIndicator current={3} />
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-8 mt-6">
        <div className="lg:col-span-2">
          <BackLink href={`/checkout/driver?${backParams.toString()}`} label="Back to driver" />
          <h1 className="text-3xl font-bold text-navy mb-6">Add extras &amp; protection</h1>
          <ExtrasForm carried={carried} plans={plans} extras={extras} />
        </div>
        <BookingSummaryCard vehicleId={sp.vehicle!} />
      </div>
    </div>
  );
}
