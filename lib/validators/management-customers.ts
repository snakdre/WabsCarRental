import { z } from "zod";
import { uuidLike } from "./shared";

export const customerListParamsSchema = z.object({
  search: z.string().trim().max(100).optional(),
  flagged: z.enum(["yes", "no"]).optional(),
});
export type CustomerListParams = z.infer<typeof customerListParamsSchema>;

export function parseCustomerListParams(raw: Record<string, string | string[] | undefined>): CustomerListParams {
  const flat: Record<string, string | undefined> = {};
  for (const [k, v] of Object.entries(raw)) flat[k] = Array.isArray(v) ? v[0] : v;
  const parsed = customerListParamsSchema.safeParse(flat);
  if (!parsed.success) return {};
  return { ...parsed.data, search: parsed.data.search || undefined };
}

const boolField = z.enum(["true", "false"]).transform(v => v === "true");

export const setCustomerFlagSchema = z.object({ customer_id: uuidLike, flagged: boolField });
export const setCustomerActiveSchema = z.object({ customer_id: uuidLike, is_active: boolField });
export const customerNotesSchema = z.object({ customer_id: uuidLike, notes: z.string().max(4000) });
export const verifyDocumentSchema = z.object({ document_id: uuidLike, verified: boolField });
