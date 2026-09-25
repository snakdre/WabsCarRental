import { parseBrowseParams } from "@/lib/validators/browse";
import { listVehicles } from "@/lib/queries/vehicles";
import { CategoryChips } from "@/components/customer/vehicles/category-chips";
import { SortSelect } from "@/components/customer/vehicles/sort-select";
import { VehicleGrid } from "@/components/customer/vehicles/vehicle-grid";

export const dynamic = "force-dynamic";

export default async function VehiclesPage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const raw = await searchParams;
  const params = parseBrowseParams(raw);
  const vehicles = await listVehicles(params);

  return (
    <div className="max-w-7xl mx-auto px-6 py-12">
      <div className="mb-8">
        <p className="text-gold text-xs uppercase tracking-[0.3em] mb-2">Fleet</p>
        <h1 className="text-4xl font-bold text-navy">Browse every vehicle</h1>
        <p className="text-text-muted-wabs mt-2">{vehicles.length} vehicle{vehicles.length === 1 ? "" : "s"} available</p>
      </div>
      <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4 mb-8">
        <CategoryChips active={params.category} sort={params.sort} />
        <SortSelect current={params.sort} />
      </div>
      <VehicleGrid vehicles={vehicles} />
    </div>
  );
}
