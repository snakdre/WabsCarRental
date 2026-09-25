import { redirect } from "next/navigation";

export default async function CheckoutEntry({
  searchParams,
}: {
  searchParams: Promise<{ vehicle?: string }>;
}) {
  const { vehicle } = await searchParams;
  if (!vehicle) redirect("/vehicles");
  redirect(`/checkout/dates?vehicle=${encodeURIComponent(vehicle)}`);
}
