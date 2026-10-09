import Link from "next/link";
import { listAllVehicles } from "@/lib/queries/management-vehicles";
import { VehiclesTable } from "@/components/management/vehicles/vehicles-table";

export const dynamic = "force-dynamic";

export default async function ManagementVehiclesPage() {
  const vehicles = await listAllVehicles();

  return (
    <main className="max-w-7xl mx-auto p-8">
      <div className="mb-6 flex items-start justify-between gap-4">
        <div>
          <p className="text-gold text-xs uppercase tracking-[0.3em] mb-2">Management</p>
          <h1 className="text-3xl font-bold text-navy">Vehicles</h1>
          <p className="text-text-muted-wabs mt-2">
            {vehicles.length} vehicle{vehicles.length === 1 ? "" : "s"}
          </p>
        </div>
        <Link
          href="/management/vehicles/new"
          className="inline-flex items-center gap-1 bg-gold hover:bg-gold-muted text-deep font-semibold px-4 py-2 rounded"
        >
          New vehicle
        </Link>
      </div>
      <VehiclesTable vehicles={vehicles} />
    </main>
  );
}
