import { createClient } from "@/lib/supabase/server";
import { formatMoney } from "@/lib/utils/format";

export async function BookingSummaryCard({ vehicleId }: { vehicleId: string }) {
  const supabase = await createClient();
  const { data: vehicle } = await supabase
    .from("vehicles")
    .select("make, model, trim, year, daily_price")
    .eq("id", vehicleId).maybeSingle();
  if (!vehicle) return null;

  return (
    <div className="bg-white border border-gray-200 rounded-lg p-4 text-sm">
      <p className="text-text-muted-wabs text-xs uppercase tracking-wider">Booking</p>
      <p className="mt-1 font-semibold text-navy">
        {vehicle.year} {vehicle.make} {vehicle.model}{vehicle.trim ? ` ${vehicle.trim}` : ""}
      </p>
      <p className="text-text-muted-wabs mt-1">From {formatMoney(Number(vehicle.daily_price))} / day</p>
    </div>
  );
}
