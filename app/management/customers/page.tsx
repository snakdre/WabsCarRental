import { redirect } from "next/navigation";
import { parseCustomerListParams, customersHref } from "@/lib/validators/management-customers";
import { listCustomers } from "@/lib/queries/management-customers";
import { CustomersFilters } from "@/components/management/customers/customers-filters";
import { CustomersTable } from "@/components/management/customers/customers-table";
import { CustomersPagination } from "@/components/management/customers/customers-pagination";

export const dynamic = "force-dynamic";

export default async function ManagementCustomersPage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const params = parseCustomerListParams(await searchParams);
  const { customers, total, page, pageSize } = await listCustomers(params);
  // A page past the end (e.g. after filtering) → jump to the last real page.
  const lastPage = Math.max(1, Math.ceil(total / pageSize));
  if (page > lastPage) redirect(customersHref(params, { page: lastPage }));

  return (
    <main className="max-w-7xl mx-auto p-8">
      <div className="mb-6">
        <p className="text-gold text-xs uppercase tracking-[0.3em] mb-2">Management</p>
        <h1 className="text-3xl font-bold text-navy">Customers</h1>
        <p className="text-text-muted-wabs mt-2">
          {total.toLocaleString("en-US")} customer{total === 1 ? "" : "s"}
        </p>
      </div>
      <CustomersFilters />
      <CustomersTable customers={customers} />
      <CustomersPagination params={params} page={page} pageSize={pageSize} total={total} />
    </main>
  );
}
