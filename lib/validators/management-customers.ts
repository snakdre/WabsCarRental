import { z } from "zod";
import { uuidLike } from "./shared";

export const CUSTOMERS_PAGE_SIZE = 50;

export const customerListParamsSchema = z.object({
  search: z.string().trim().max(100).optional(),
  flagged: z.enum(["yes", "no"]).optional(),
  page: z.coerce.number().int().min(1).max(10_000).optional(),
});
export type CustomerListParams = z.infer<typeof customerListParamsSchema>;

export function parseCustomerListParams(raw: Record<string, string | string[] | undefined>): CustomerListParams {
  const flat: Record<string, string | undefined> = {};
  for (const [k, v] of Object.entries(raw)) flat[k] = Array.isArray(v) ? v[0] : v;
  // Parse each field independently so one bad value (e.g. ?page=abc) doesn't
  // throw away a valid search.
  const out: CustomerListParams = {};
  const search = customerListParamsSchema.shape.search.safeParse(flat.search);
  if (search.success && search.data) out.search = search.data;
  const flagged = customerListParamsSchema.shape.flagged.safeParse(flat.flagged);
  if (flagged.success && flagged.data) out.flagged = flagged.data;
  const page = customerListParamsSchema.shape.page.safeParse(flat.page);
  if (page.success && page.data && page.data > 1) out.page = page.data;
  return out;
}

// Build a /management/customers URL that keeps the current filters.
export function customersHref(params: CustomerListParams, patch: Partial<CustomerListParams> = {}): string {
  const merged = { ...params, ...patch };
  const q = new URLSearchParams();
  if (merged.search) q.set("search", merged.search);
  if (merged.flagged) q.set("flagged", merged.flagged);
  if (merged.page && merged.page > 1) q.set("page", String(merged.page));
  const qs = q.toString();
  return `/management/customers${qs ? `?${qs}` : ""}`;
}

const boolField = z.enum(["true", "false"]).transform(v => v === "true");

export const setCustomerFlagSchema = z.object({ customer_id: uuidLike, flagged: boolField });
export const setCustomerActiveSchema = z.object({ customer_id: uuidLike, is_active: boolField });
export const customerNotesSchema = z.object({ customer_id: uuidLike, notes: z.string().max(4000) });
export const verifyDocumentSchema = z.object({ document_id: uuidLike, verified: boolField });
