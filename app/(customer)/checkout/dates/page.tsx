import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { StepIndicator } from "@/components/customer/checkout/step-indicator";
import { BookingSummaryCard } from "@/components/customer/checkout/booking-summary-card";
import { DatePickerForm } from "@/components/customer/checkout/date-picker-form";

export const dynamic = "force-dynamic";

export default async function CheckoutDatesPage({
  searchParams,
}: {
  searchParams: Promise<{ vehicle?: string }>;
}) {
  const { vehicle } = await searchParams;
  if (!vehicle || !/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(vehicle)) {
    redirect("/vehicles");
  }

  const supabase = await createClient();
  const { data: v } = await supabase.from("vehicles").select("id, status").eq("id", vehicle).maybeSingle();
  if (!v || v.status !== "available") redirect("/vehicles");

  const { data: locations } = await supabase
    .from("vehicle_locations")
    .select("id, name, city, delivery_available, delivery_fee")
    .eq("vehicle_id", vehicle)
    .order("name");

  return (
    <div>
      <StepIndicator current={1} />
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-8 mt-6">
        <div className="lg:col-span-2">
          <h1 className="text-3xl font-bold text-navy mb-6">When would you like to book?</h1>
          <DatePickerForm vehicleId={vehicle} locations={(locations ?? []).map(l => ({ ...l, delivery_fee: Number(l.delivery_fee ?? 0) }))} />
        </div>
        <BookingSummaryCard vehicleId={vehicle} />
      </div>
    </div>
  );
}
