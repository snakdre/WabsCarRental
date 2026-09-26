import Link from "next/link";
import { notFound } from "next/navigation";
import { StepIndicator } from "@/components/customer/checkout/step-indicator";
import { getBookingByRef } from "@/lib/queries/bookings";
import { createClient } from "@/lib/supabase/server";
import { formatMoney } from "@/lib/utils/format";
import { CheckCircle2 } from "lucide-react";

export const dynamic = "force-dynamic";

export default async function CheckoutConfirmationPage({
  params,
}: {
  params: Promise<{ ref: string }>;
}) {
  const { ref } = await params;
  const booking = await getBookingByRef(ref);
  if (!booking) notFound();

  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user || booking.customer_id !== user.id) notFound();

  const { data: vehicle } = await supabase
    .from("vehicles")
    .select("make, model, year")
    .eq("id", booking.vehicle_id).maybeSingle();

  return (
    <div>
      <StepIndicator current={6} />
      <div className="max-w-2xl mx-auto text-center mt-8">
        <CheckCircle2 className="w-16 h-16 text-gold mx-auto mb-4" />
        <h1 className="text-3xl font-bold text-navy mb-2">Booking confirmed</h1>
        <p className="text-text-muted-wabs mb-8">Confirmation sent to {booking.driver_name}. See you soon.</p>

        <div className="bg-white border border-gray-200 rounded-lg p-6 text-left space-y-3">
          <div className="flex justify-between">
            <span className="text-text-muted-wabs">Reference</span>
            <span className="font-mono font-semibold text-navy">{booking.reference}</span>
          </div>
          {vehicle && (
            <div className="flex justify-between">
              <span className="text-text-muted-wabs">Vehicle</span>
              <span className="text-navy">{vehicle.year} {vehicle.make} {vehicle.model}</span>
            </div>
          )}
          <div className="flex justify-between">
            <span className="text-text-muted-wabs">Pickup</span>
            <span className="text-navy">{booking.pickup_date.slice(0, 10)}</span>
          </div>
          <div className="flex justify-between">
            <span className="text-text-muted-wabs">Return</span>
            <span className="text-navy">{booking.return_date.slice(0, 10)}</span>
          </div>
          <div className="flex justify-between font-bold text-navy pt-2 border-t border-gray-200">
            <span>Total charged</span>
            <span>{formatMoney(Number(booking.total_amount))}</span>
          </div>
        </div>

        <div className="mt-8 flex gap-4 justify-center">
          <Link href="/account" className="text-sm bg-gold text-deep font-semibold px-6 py-3 rounded hover:bg-gold-muted">
            View my bookings
          </Link>
          <Link href="/vehicles" className="text-sm text-gold hover:underline px-6 py-3">
            Browse more vehicles
          </Link>
        </div>
      </div>
    </div>
  );
}
