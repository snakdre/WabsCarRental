import { formatMoney } from "@/lib/utils/format";
import { calculatePricing } from "@/lib/pricing";

export async function ReviewSummary({
  vehicleId, pickup, ret, method, locationId, planId, extras, promoCode,
}: {
  vehicleId: string;
  pickup: string;
  ret: string;
  method: "pickup" | "delivery";
  locationId: string | null;
  planId: string | null;
  extras: { extra_id: string; quantity: number }[];
  promoCode: string | null;
}) {
  const pricing = await calculatePricing({
    vehicle_id: vehicleId,
    pickup_date: pickup,
    return_date: ret,
    pickup_method: method,
    pickup_location_id: locationId,
    protection_plan_id: planId,
    extras,
    promo_code: promoCode,
  });

  return (
    <div className="bg-white border border-gray-200 rounded-lg p-6">
      <h3 className="text-lg font-semibold text-navy mb-4">Price breakdown</h3>
      <ul className="space-y-2 text-sm">
        {pricing.breakdown.map((b, i) => (
          <li key={i} className="flex justify-between">
            <span className="text-text-muted-wabs">{b.label}</span>
            <span className={`font-medium ${b.value < 0 ? "text-green-700" : "text-navy"}`}>
              {b.value < 0 ? "−" : ""}{formatMoney(Math.abs(b.value))}
            </span>
          </li>
        ))}
      </ul>
      {pricing.promo_error && (
        <p className="text-red-600 text-xs mt-2">Promo: {pricing.promo_error}</p>
      )}
      <div className="mt-4 pt-4 border-t border-gray-200 flex justify-between text-lg font-bold text-navy">
        <span>Total</span>
        <span>{formatMoney(pricing.total_amount)}</span>
      </div>
      {pricing.deposit_amount > 0 && (
        <p className="text-xs text-text-muted-wabs mt-2">
          Plus refundable deposit of {formatMoney(pricing.deposit_amount)} (held separately)
        </p>
      )}
    </div>
  );
}
