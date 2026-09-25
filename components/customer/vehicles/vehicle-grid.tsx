import type { VehicleCardData } from "@/lib/queries/vehicles";
import { VehicleCard } from "./vehicle-card";

export function VehicleGrid({ vehicles }: { vehicles: VehicleCardData[] }) {
  if (vehicles.length === 0) {
    return (
      <div className="text-center py-24">
        <p className="text-2xl font-semibold text-navy mb-2">No vehicles match your filters</p>
        <p className="text-text-muted-wabs">Try a different category or clear filters.</p>
      </div>
    );
  }
  return (
    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
      {vehicles.map((v) => <VehicleCard key={v.id} vehicle={v} />)}
    </div>
  );
}
