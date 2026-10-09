import Link from "next/link";
import type { ManagementVehicleListItem } from "@/lib/queries/management-vehicles";
import { formatMoney } from "@/lib/utils/format";

const VEHICLE_STATUS_STYLE: Record<string, string> = {
  draft: "bg-gray-100 text-gray-700",
  available: "bg-green-100 text-green-700",
  reserved: "bg-blue-100 text-blue-700",
  rented: "bg-navy/10 text-navy",
  maintenance: "bg-yellow-100 text-yellow-700",
  inactive: "bg-red-100 text-red-700",
};

function VehicleStatusPill({ status }: { status: string }) {
  const cls = VEHICLE_STATUS_STYLE[status] ?? "bg-gray-100 text-gray-700";
  return (
    <span className={`text-xs px-2 py-1 rounded font-medium capitalize ${cls}`}>
      {status}
    </span>
  );
}

export function VehiclesTable({ vehicles }: { vehicles: ManagementVehicleListItem[] }) {
  if (vehicles.length === 0) {
    return (
      <div className="text-center py-16 bg-white border border-gray-200 rounded-lg">
        <p className="text-navy font-semibold mb-2">No vehicles yet</p>
      </div>
    );
  }

  return (
    <div className="bg-white border border-gray-200 rounded-lg overflow-hidden">
      <table className="w-full text-sm">
        <thead className="bg-gray-50 text-text-muted-wabs uppercase text-xs tracking-wider">
          <tr>
            <th className="text-left px-4 py-3">Vehicle</th>
            <th className="text-left px-4 py-3">Category</th>
            <th className="text-left px-4 py-3">Status</th>
            <th className="text-right px-4 py-3">Price/day</th>
            <th className="text-left px-4 py-3">Featured</th>
          </tr>
        </thead>
        <tbody>
          {vehicles.map((v) => (
            <tr key={v.id} className="border-t border-gray-100 hover:bg-gray-50">
              <td className="px-4 py-3 text-navy">
                <Link
                  href={`/management/vehicles/${v.id}`}
                  className="hover:text-gold flex items-center gap-2"
                >
                  {v.cover_url && (
                    // eslint-disable-next-line @next/next/no-img-element
                    <img
                      src={v.cover_url}
                      alt=""
                      width={32}
                      height={24}
                      className="rounded object-cover flex-shrink-0"
                      style={{ width: 32, height: 24 }}
                    />
                  )}
                  <span>
                    {v.year} {v.make} {v.model}
                    {v.trim ? ` ${v.trim}` : ""}
                  </span>
                </Link>
              </td>
              <td className="px-4 py-3 text-navy capitalize">{v.category}</td>
              <td className="px-4 py-3">
                <VehicleStatusPill status={v.status} />
              </td>
              <td className="px-4 py-3 text-right font-semibold text-navy">
                {formatMoney(v.daily_price)}
              </td>
              <td className="px-4 py-3">
                {v.is_featured ? (
                  <span className="text-xs px-2 py-1 rounded font-medium bg-yellow-50 text-gold border border-gold/20">
                    ★ Featured
                  </span>
                ) : (
                  <span className="text-text-muted-wabs">—</span>
                )}
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
