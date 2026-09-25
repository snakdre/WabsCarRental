import { redirect, notFound } from "next/navigation";
import { StepIndicator } from "@/components/customer/checkout/step-indicator";
import { PaymentForm } from "@/components/customer/checkout/payment-form";
import { getBookingByRef } from "@/lib/queries/bookings";
import { formatMoney } from "@/lib/utils/format";
import { createClient } from "@/lib/supabase/server";

export const dynamic = "force-dynamic";

export default async function CheckoutPaymentPage({
  searchParams,
}: {
  searchParams: Promise<{ booking_ref?: string }>;
}) {
  const { booking_ref } = await searchParams;
  if (!booking_ref) redirect("/vehicles");

  const booking = await getBookingByRef(booking_ref);
  if (!booking) notFound();

  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user || booking.customer_id !== user.id) notFound();
  if (booking.status === "confirmed") redirect(`/checkout/confirmation/${booking.reference}`);
  if (booking.status !== "pending") redirect("/account");

  return (
    <div>
      <StepIndicator current={5} />
      <div className="max-w-lg mx-auto mt-8">
        <h1 className="text-3xl font-bold text-navy mb-2">Payment</h1>
        <p className="text-text-muted-wabs mb-6">Booking {booking.reference} · {formatMoney(Number(booking.total_amount))}</p>
        <PaymentForm bookingRef={booking.reference} total={formatMoney(Number(booking.total_amount))} />
      </div>
    </div>
  );
}
