import { getDashboardKpis } from "@/lib/queries/management-dashboard";
import { KpiTile } from "@/components/management/dashboard/kpi-tile";
import { formatMoney } from "@/lib/utils/format";
import Link from "next/link";

export const dynamic = "force-dynamic";

export default async function ManagementDashboard() {
  const k = await getDashboardKpis();

  return (
    <main className="max-w-7xl mx-auto p-8">
      <div className="mb-6">
        <p className="text-gold text-xs uppercase tracking-[0.3em] mb-2">Management</p>
        <h1 className="text-3xl font-bold text-navy">Dashboard</h1>
        <p className="text-text-muted-wabs mt-2">At-a-glance operational KPIs</p>
      </div>

      <section className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-4 mb-8">
        <KpiTile label="Total vehicles" value={k.totalVehicles} />
        <KpiTile label="Available" value={k.availableVehicles} />
        <KpiTile label="Rented" value={k.rentedVehicles} />
        <KpiTile label="Maintenance" value={k.maintenanceVehicles} />
        <KpiTile label="Pending bookings" value={k.pendingBookings} />
        <KpiTile label="Bookings this month" value={k.bookingsThisMonth} />
      </section>

      <section className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-8">
        <div className="bg-white border border-gray-200 rounded-lg p-6">
          <p className="text-text-muted-wabs text-xs uppercase tracking-wider">Revenue this month</p>
          <p className="text-4xl font-bold text-navy mt-2">{formatMoney(k.revenueThisMonth)}</p>
          <p className="text-xs text-text-muted-wabs mt-1">Confirmed, active, completed, in-progress bookings</p>
        </div>
      </section>

      <section className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <UpcomingList title="Today's pickups" items={k.todayPickups} emptyText="No pickups scheduled today." />
        <UpcomingList title="Today's returns" items={k.todayReturns} emptyText="No returns scheduled today." />
      </section>
    </main>
  );
}

function UpcomingList({
  title,
  items,
  emptyText,
}: {
  title: string;
  items: Array<{
    id: string;
    reference: string;
    driver_name: string;
    vehicle_make: string;
    vehicle_model: string;
    vehicle_year: number;
  }>;
  emptyText: string;
}) {
  return (
    <div className="bg-white border border-gray-200 rounded-lg">
      <div className="px-5 py-3 border-b border-gray-100">
        <p className="text-sm font-semibold uppercase tracking-wider text-text-muted-wabs">{title}</p>
      </div>
      {items.length === 0 ? (
        <p className="px-5 py-6 text-sm text-text-muted-wabs">{emptyText}</p>
      ) : (
        <ul className="divide-y divide-gray-100">
          {items.map((b) => (
            <li key={b.id} className="px-5 py-3 flex items-center justify-between gap-3">
              <div>
                <Link href={`/management/bookings/${b.id}`} className="font-mono text-sm text-navy hover:text-gold">
                  {b.reference}
                </Link>
                <p className="text-sm text-text-muted-wabs">{b.driver_name}</p>
              </div>
              <p className="text-sm text-navy text-right">
                {b.vehicle_year} {b.vehicle_make} {b.vehicle_model}
              </p>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
