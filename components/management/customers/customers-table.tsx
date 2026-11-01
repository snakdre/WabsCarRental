import Link from "next/link";
import { Flag } from "lucide-react";
import type { CustomerListItem } from "@/lib/queries/management-customers";
import { formatMoney } from "@/lib/utils/format";

export function CustomersTable({ customers }: { customers: CustomerListItem[] }) {
  if (customers.length === 0) {
    return (
      <div className="text-center py-16 bg-white border border-gray-200 rounded-lg">
        <p className="text-navy font-semibold mb-2">No customers match your filters</p>
        <p className="text-text-muted-wabs">Try a different search or clear the filter.</p>
      </div>
    );
  }

  return (
    <div className="bg-white border border-gray-200 rounded-lg overflow-hidden">
      <table className="w-full text-sm" data-testid="customers-table">
        <thead className="bg-gray-50 text-text-muted-wabs uppercase text-xs tracking-wider">
          <tr>
            <th className="text-left px-4 py-3">Customer</th>
            <th className="text-left px-4 py-3">Phone</th>
            <th className="text-right px-4 py-3">Bookings</th>
            <th className="text-right px-4 py-3">Spent</th>
            <th className="text-left px-4 py-3">Last booking</th>
            <th className="text-left px-4 py-3">Joined</th>
            <th className="text-left px-4 py-3">Status</th>
          </tr>
        </thead>
        <tbody>
          {customers.map((c) => {
            const name = [c.first_name, c.last_name].filter(Boolean).join(" ") || "—";
            return (
              <tr key={c.id} className="border-t border-gray-100 hover:bg-gray-50">
                <td className="px-4 py-3">
                  <Link href={`/management/customers/${c.id}`} className="text-navy font-medium hover:text-gold">
                    {name}
                  </Link>
                  <p className="text-xs text-text-muted-wabs">{c.email}</p>
                </td>
                <td className="px-4 py-3 text-navy">{c.phone ?? "—"}</td>
                <td className="px-4 py-3 text-right text-navy">{c.booking_count}</td>
                <td className="px-4 py-3 text-right text-navy font-semibold">{formatMoney(c.total_spent)}</td>
                <td className="px-4 py-3 text-navy">{c.last_booking_at?.slice(0, 10) ?? "—"}</td>
                <td className="px-4 py-3 text-navy">{c.created_at.slice(0, 10)}</td>
                <td className="px-4 py-3">
                  <div className="flex flex-wrap gap-1">
                    {c.flagged && (
                      <span className="inline-flex items-center gap-1 text-xs px-2 py-1 rounded font-medium bg-red-100 text-red-700">
                        <Flag className="w-3 h-3" /> Flagged
                      </span>
                    )}
                    {!c.is_active && (
                      <span className="text-xs px-2 py-1 rounded font-medium bg-gray-200 text-gray-700">Inactive</span>
                    )}
                    {c.unverified_documents > 0 && (
                      <span className="text-xs px-2 py-1 rounded font-medium bg-yellow-100 text-yellow-700">
                        {c.unverified_documents} doc{c.unverified_documents === 1 ? "" : "s"} to review
                      </span>
                    )}
                  </div>
                </td>
              </tr>
            );
          })}
        </tbody>
      </table>
    </div>
  );
}
