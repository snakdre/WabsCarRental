import { getFeaturedVehicles } from "@/lib/queries/vehicles";
import { VehicleCard } from "@/components/customer/vehicles/vehicle-card";
import Link from "next/link";

export async function FeaturedVehicles() {
  const vehicles = await getFeaturedVehicles(4);
  return (
    <section className="max-w-7xl mx-auto px-6 py-20">
      <div className="flex items-end justify-between mb-10">
        <div>
          <p className="text-gold text-xs uppercase tracking-[0.3em] mb-2">Featured Vehicles</p>
          <h2 className="text-3xl md:text-4xl font-bold text-navy">Curated for the discerning</h2>
        </div>
        <Link href="/vehicles" className="hidden md:inline text-sm text-gold hover:underline">
          View entire fleet →
        </Link>
      </div>
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
        {vehicles.map((v) => <VehicleCard key={v.id} vehicle={v} />)}
      </div>
    </section>
  );
}
