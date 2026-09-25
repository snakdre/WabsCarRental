import Link from "next/link";
import Image from "next/image";
import type { VehicleCardData } from "@/lib/queries/vehicles";
import { formatMoney } from "@/lib/utils/format";

export function VehicleCard({ vehicle }: { vehicle: VehicleCardData }) {
  return (
    <Link
      href={`/vehicles/${vehicle.id}`}
      data-vehicle-id={vehicle.id}
      className="group block bg-white rounded-lg overflow-hidden shadow-sm hover:shadow-xl transition-all duration-200"
    >
      <div className="aspect-[4/3] relative bg-gradient-to-br from-navy to-navy-light">
        {vehicle.cover_url && (
          <Image
            src={vehicle.cover_url}
            alt={vehicle.cover_alt ?? `${vehicle.make} ${vehicle.model}`}
            fill
            sizes="(max-width: 768px) 100vw, 33vw"
            className="object-cover group-hover:scale-105 transition-transform duration-500"
          />
        )}
        <div className="absolute top-3 left-3 bg-navy/80 text-white text-xs uppercase tracking-wider px-2 py-1 rounded">
          {vehicle.category}
        </div>
      </div>
      <div className="p-5">
        <p className="text-text-muted-wabs text-xs uppercase tracking-wider">{vehicle.year}</p>
        <h3 className="text-lg font-semibold text-navy mt-1">{vehicle.make} {vehicle.model}</h3>
        {vehicle.trim && <p className="text-sm text-text-muted-wabs">{vehicle.trim}</p>}
        <div className="mt-4 flex items-baseline justify-between">
          <span className="text-2xl font-bold text-navy">{formatMoney(vehicle.daily_price)}</span>
          <span className="text-xs text-text-muted-wabs">/ day</span>
        </div>
      </div>
    </Link>
  );
}
