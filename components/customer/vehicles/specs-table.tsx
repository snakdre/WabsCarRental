import { formatHorsepower, formatMileage } from "@/lib/utils/format";
import type { VehicleDetail } from "@/lib/queries/vehicles";

type V = VehicleDetail["vehicle"];

const cap = (s: string | null) => s ? s.charAt(0).toUpperCase() + s.slice(1) : "—";

export function SpecsTable({ v }: { v: V }) {
  const rows: [string, string][] = [
    ["Year", String(v.year)],
    ["Category", cap(v.category)],
    ["Transmission", cap(v.transmission)],
    ["Fuel Type", cap(v.fuel_type)],
    ["Horsepower", formatHorsepower(v.horsepower)],
    ["Drivetrain", v.drivetrain ?? "—"],
    ["Seats", v.seats?.toString() ?? "—"],
    ["Doors", v.doors?.toString() ?? "—"],
    ["Exterior", v.exterior_color ?? "—"],
    ["Interior", v.interior_color ?? "—"],
    ["Mileage / day", formatMileage(v.mileage_limit)],
    ["Min rental", `${v.min_rental_days} day${v.min_rental_days === 1 ? "" : "s"}`],
  ];
  return (
    <div className="bg-white rounded-lg border border-gray-200 overflow-hidden">
      <table className="w-full text-sm">
        <tbody>
          {rows.map(([label, value]) => (
            <tr key={label} className="border-b border-gray-100 last:border-b-0">
              <td className="px-4 py-3 text-text-muted-wabs w-1/2">{label}</td>
              <td className="px-4 py-3 text-navy font-medium">{value}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
