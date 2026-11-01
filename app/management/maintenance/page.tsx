import Link from "next/link";
import { parseMaintenanceListParams, MAINTENANCE_STATUSES, MAINTENANCE_STATUS_LABEL } from "@/lib/validators/maintenance";
import { listMaintenance, getMaintenanceSummary, listMaintenanceVehicles } from "@/lib/queries/maintenance";
import { MaintenanceForm } from "@/components/management/maintenance/maintenance-form";
import { MaintenanceTable } from "@/components/management/maintenance/maintenance-table";
import { KpiTile } from "@/components/management/dashboard/kpi-tile";
import { formatMoney } from "@/lib/utils/format";

export const dynamic = "force-dynamic";

export default async function MaintenancePage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const params = parseMaintenanceListParams(await searchParams);
  const [rows, summary, vehicles] = await Promise.all([
    listMaintenance(params),
    getMaintenanceSummary(),
    listMaintenanceVehicles(),
  ]);

  const chipHref = (status?: string) => {
    const q = new URLSearchParams();
    if (status) q.set("status", status);
    if (params.vehicle) q.set("vehicle", params.vehicle);
    const qs = q.toString();
    return `/management/maintenance${qs ? `?${qs}` : ""}`;
  };

  return (
    <main className="max-w-7xl mx-auto p-8">
      <div className="mb-6">
        <p className="text-gold text-xs uppercase tracking-[0.3em] mb-2">Management</p>
        <h1 className="text-3xl font-bold text-navy">Maintenance</h1>
      </div>

      <section className="grid grid-cols-1 sm:grid-cols-3 gap-4 mb-8">
        <KpiTile label="In progress" value={summary.open} />
        <KpiTile label="Scheduled, next 30 days" value={summary.scheduledNext30} />
        <KpiTile label="Spend this year" value={formatMoney(summary.costThisYear)} />
      </section>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
        <div className="lg:col-span-2 space-y-4">
          <div className="flex flex-wrap gap-2">
            {[undefined, ...MAINTENANCE_STATUSES].map(s => {
              const active = (s ?? null) === (params.status ?? null);
              return (
                <Link
                  key={s ?? "all"}
                  href={chipHref(s)}
                  className={`text-xs px-3 py-1.5 rounded-full border ${active ? "bg-gold border-gold text-deep font-semibold" : "border-gray-300 text-navy hover:border-gold"}`}
                >
                  {s ? MAINTENANCE_STATUS_LABEL[s] : "All"}
                </Link>
              );
            })}
            {params.vehicle && (
              <Link href={chipHref(params.status)} className="text-xs px-3 py-1.5 rounded-full border border-navy text-navy">
                {vehicles.find(v => v.id === params.vehicle)?.label ?? "Vehicle"} ✕
              </Link>
            )}
          </div>
          <MaintenanceTable rows={rows} />
        </div>
        <aside>
          <MaintenanceForm vehicles={vehicles} presetVehicleId={params.vehicle} />
        </aside>
      </div>
    </main>
  );
}
