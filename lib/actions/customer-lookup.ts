"use server";

import { getUserRole, isManagerOrAdmin } from "@/lib/utils/roles";
import { listCustomers, type CustomerListItem } from "@/lib/queries/management-customers";

export type CustomerOption = Pick<CustomerListItem, "id" | "email" | "first_name" | "last_name" | "phone" | "flagged" | "is_active">;

// Typeahead for the staff booking form: first 10 matches for a search term.
export async function searchCustomers(term: string): Promise<{ results?: CustomerOption[]; error?: string }> {
  if (!isManagerOrAdmin(await getUserRole())) return { error: "Forbidden" };
  const q = String(term ?? "").trim().slice(0, 100);
  if (q.length < 2) return { results: [] };
  const { customers } = await listCustomers({ search: q }, 10);
  return {
    results: customers.map(({ id, email, first_name, last_name, phone, flagged, is_active }) =>
      ({ id, email, first_name, last_name, phone, flagged, is_active })),
  };
}
