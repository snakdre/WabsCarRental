import Link from "next/link";
import { customersHref, type CustomerListParams } from "@/lib/validators/management-customers";

export function CustomersPagination({
  params, page, pageSize, total,
}: {
  params: CustomerListParams; page: number; pageSize: number; total: number;
}) {
  const pages = Math.max(1, Math.ceil(total / pageSize));
  if (total === 0) return null;
  const from = (page - 1) * pageSize + 1;
  const to = Math.min(page * pageSize, total);
  const btn = "px-3 py-1.5 rounded border text-sm";
  const on = `${btn} border-gray-300 bg-white text-navy hover:border-gold`;
  const off = `${btn} border-gray-200 text-gray-300 cursor-not-allowed`;

  return (
    <nav className="flex items-center justify-between mt-4" aria-label="Customer pages" data-testid="customers-pagination">
      <p className="text-sm text-text-muted-wabs">
        {from.toLocaleString("en-US")}–{to.toLocaleString("en-US")} of {total.toLocaleString("en-US")}
      </p>
      {pages > 1 && (
        <div className="flex items-center gap-2">
          {page > 1 ? <Link href={customersHref(params, { page: page - 1 })} className={on} rel="prev">← Previous</Link> : <span className={off}>← Previous</span>}
          <span className="text-sm text-navy px-2">Page {page} of {pages}</span>
          {page < pages ? <Link href={customersHref(params, { page: page + 1 })} className={on} rel="next">Next →</Link> : <span className={off}>Next →</span>}
        </div>
      )}
    </nav>
  );
}
