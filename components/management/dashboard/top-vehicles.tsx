import Link from "next/link";
import type { TopVehicle } from "@/lib/queries/management-dashboard";
import { formatMoney } from "@/lib/utils/format";

// Ranked horizontal bars, one hue. Value labels sit at the bar tip in text
// ink (never the series colour). Every number is printed, so no hover layer
// is required for access; the native title gives a quick tooltip.
const SERIES = "#B8963E";

export function TopVehicles({ vehicles }: { vehicles: TopVehicle[] }) {
  const max = Math.max(1, ...vehicles.map(v => v.rentals));
  return (
    <section className="bg-white border border-gray-200 rounded-lg p-6" data-testid="top-vehicles">
      <h2 className="text-sm font-semibold uppercase tracking-wider text-text-muted-wabs mb-4">
        Most-rented vehicles, last 12 months
      </h2>
      {vehicles.length === 0 ? (
        <p className="text-sm text-text-muted-wabs">No rentals in this period yet.</p>
      ) : (
        <ol className="space-y-3">
          {vehicles.map((v, i) => (
            <li key={v.vehicle_id} title={`${v.label}: ${v.rentals} rentals, ${formatMoney(v.revenue)}`}>
              <div className="flex justify-between text-sm mb-1 gap-3">
                <Link href={`/management/vehicles/${v.vehicle_id}`} className="text-navy hover:text-gold truncate">
                  <span className="text-text-muted-wabs mr-2">{i + 1}</span>{v.label}
                </Link>
                <span className="text-text-muted-wabs shrink-0">{formatMoney(v.revenue)}</span>
              </div>
              <div className="flex items-center gap-2">
                <div className="flex-1 h-3">
                  <div
                    className="h-3 rounded-r"
                    style={{ width: `${Math.max(2, (v.rentals / max) * 100)}%`, background: SERIES }}
                  />
                </div>
                <span className="text-xs font-semibold text-navy w-16 text-right">
                  {v.rentals} rental{v.rentals === 1 ? "" : "s"}
                </span>
              </div>
            </li>
          ))}
        </ol>
      )}
    </section>
  );
}
