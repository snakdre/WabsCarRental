import { z } from "zod";

export const CATEGORIES = ["exotic", "sports", "suv", "convertible", "executive", "electric"] as const;
export const SORTS = ["price_asc", "price_desc"] as const;

const dateField = z.string().regex(/^\d{4}-\d{2}-\d{2}$/).optional();

export const browseParamsSchema = z.object({
  category: z.enum(CATEGORIES).optional(),
  sort: z.enum(SORTS).optional(),
  pickup: dateField,
  return: dateField,
});

export type BrowseParams = z.infer<typeof browseParamsSchema>;

export function isDateFilterActive(params: BrowseParams): boolean {
  return typeof params.pickup === "string" && typeof params.return === "string";
}

export function parseBrowseParams(raw: Record<string, string | string[] | undefined>): BrowseParams {
  const flat: Record<string, string | undefined> = {};
  for (const [k, v] of Object.entries(raw)) {
    flat[k] = Array.isArray(v) ? v[0] : v;
  }
  const parsed = browseParamsSchema.safeParse(flat);
  if (!parsed.success) return {};
  const result = parsed.data;
  // If both dates are present, require return >= pickup; otherwise drop both.
  if (result.pickup !== undefined && result.return !== undefined) {
    if (result.return < result.pickup) {
      return { category: result.category, sort: result.sort };
    }
  }
  return result;
}
