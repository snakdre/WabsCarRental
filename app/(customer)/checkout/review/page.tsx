import { redirect } from "next/navigation";
import { StepIndicator } from "@/components/customer/checkout/step-indicator";
import { BackLink } from "@/components/customer/checkout/back-link";
import { BookingSummaryCard } from "@/components/customer/checkout/booking-summary-card";
import { ReviewSummary } from "@/components/customer/checkout/review-summary";
import { ReviewSubmitForm } from "@/components/customer/checkout/review-submit-form";

const REQUIRED = [
  "vehicle","pickup","return","pickup_method",
  "driver_name","driver_email","driver_phone","driver_dob",
  "license_number","license_expiry","license_region",
];

export const dynamic = "force-dynamic";

export default async function CheckoutReviewPage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | undefined>>;
}) {
  const sp = await searchParams;
  for (const k of REQUIRED) {
    if (!sp[k]) redirect(`/checkout/dates${sp.vehicle ? `?vehicle=${encodeURIComponent(sp.vehicle)}` : ""}`);
  }

  const extras = sp.extras ? JSON.parse(sp.extras) as { extra_id: string; quantity: number }[] : [];
  const backParams = new URLSearchParams();
  Object.entries(sp).forEach(([k, v]) => { if (typeof v === "string") backParams.set(k, v); });

  const hiddenParams: Record<string, string> = {};
  Object.entries(sp).forEach(([k, v]) => { if (typeof v === "string") hiddenParams[k] = v; });

  return (
    <div>
      <StepIndicator current={4} />
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-8 mt-6">
        <div className="lg:col-span-2">
          <BackLink href={`/checkout/extras?${backParams.toString()}`} label="Back to extras" />
          <h1 className="text-3xl font-bold text-navy mb-6">Review your booking</h1>

          <div className="bg-white border border-gray-200 rounded-lg p-6 mb-6 text-sm">
            <p className="text-text-muted-wabs text-xs uppercase tracking-wider mb-3">Trip</p>
            <p><strong>Pickup:</strong> {sp.pickup}</p>
            <p><strong>Return:</strong> {sp.return}</p>
            <p><strong>Method:</strong> {sp.pickup_method}</p>
            <hr className="my-4" />
            <p className="text-text-muted-wabs text-xs uppercase tracking-wider mb-3">Driver</p>
            <p>{sp.driver_name} · {sp.driver_email} · {sp.driver_phone}</p>
            <p>License {sp.license_number} ({sp.license_region}) — expires {sp.license_expiry}</p>
          </div>

          <ReviewSummary
            vehicleId={sp.vehicle!}
            pickup={sp.pickup!}
            ret={sp.return!}
            method={sp.pickup_method as "pickup" | "delivery"}
            locationId={sp.pickup_location_id ?? null}
            planId={sp.protection_plan_id ?? null}
            extras={extras}
            promoCode={sp.promo_code ?? null}
          />

          <ReviewSubmitForm hidden={hiddenParams} />
        </div>
        <BookingSummaryCard vehicleId={sp.vehicle!} />
      </div>
    </div>
  );
}
