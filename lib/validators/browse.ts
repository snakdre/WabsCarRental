import { z } from "zod";

export const CATEGORIES = ["exotic", "sports", "suv", "convertible", "executive", "electric"] as const;
export const SORTS = ["price_asc", "price_desc"] as const;

export const browseParamsSchema = z.object({
  category: z.enum(CATEGORIES).optional(),
  sort: z.enum(SORTS).optional(),
  pickup: z.string().optional(),
  return: z.string().optional(),
});

export type BrowseParams = z.infer<typeof browseParamsSchema>;

export function parseBrowseParams(raw: Record<string, string | string[] | undefined>): BrowseParams {
  const flat: Record<string, string | undefined> = {};
  for (const [k, v] of Object.entries(raw)) {
    flat[k] = Array.isArray(v) ? v[0] : v;
  }
  const parsed = browseParamsSchema.safeParse(flat);
  return parsed.success ? parsed.data : {};
}
