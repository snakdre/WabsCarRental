import Link from "next/link";
import { formatMoney } from "@/lib/utils/format";
import { Button } from "@/components/ui/button";
import type { VehicleDetail } from "@/lib/queries/vehicles";

type V = VehicleDetail["vehicle"];

export function PricingCard({ v, location }: { v: V; location: VehicleDetail["location"] }) {
  return (
    <div className="bg-white border border-gray-200 rounded-lg p-6 sticky top-24">
      <p className="text-text-muted-wabs text-xs uppercase tracking-wider">Starting at</p>
      <div className="mt-2 flex items-baseline gap-2">
        <span className="text-4xl font-bold text-navy">{formatMoney(v.daily_price)}</span>
        <span className="text-text-muted-wabs">/ day</span>
      </div>
      <div className="mt-6 space-y-3 text-sm border-t border-gray-100 pt-6">
        {v.weekly_price != null && (
          <div className="flex justify-between">
            <span className="text-text-muted-wabs">Weekly rate</span>
            <span className="text-navy font-medium">{formatMoney(v.weekly_price)}</span>
          </div>
        )}
        {v.monthly_price != null && (
          <div className="flex justify-between">
            <span className="text-text-muted-wabs">Monthly rate</span>
            <span className="text-navy font-medium">{formatMoney(v.monthly_price)}</span>
          </div>
        )}
        {v.deposit_amount != null && (
          <div className="flex justify-between">
            <span className="text-text-muted-wabs">Security deposit</span>
            <span className="text-navy font-medium">{formatMoney(v.deposit_amount)}</span>
          </div>
        )}
      </div>
      {location && (location.city || location.name) && (
        <div className="mt-6 pt-6 border-t border-gray-100 text-sm">
          <p className="text-text-muted-wabs text-xs uppercase tracking-wider mb-2">Location</p>
          <p className="text-navy">{location.name}</p>
          {location.city && <p className="text-text-muted-wabs">{location.city}, {location.state}</p>}
          {location.delivery_available && (
            <p className="text-gold text-xs mt-2">
              Delivery available · {formatMoney(location.delivery_fee)}
            </p>
          )}
        </div>
      )}
      <Button asChild className="w-full mt-6 bg-gold hover:bg-gold-muted text-deep font-semibold">
        <Link href={`/checkout?vehicle=${v.id}`}>Reserve this vehicle</Link>
      </Button>
    </div>
  );
}
