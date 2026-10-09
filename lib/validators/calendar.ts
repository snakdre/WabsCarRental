import { z } from "zod";

export const calendarParamsSchema = z.object({
  year: z.coerce.number().int().min(2000).max(2100).optional(),
  month: z.coerce.number().int().min(1).max(12).optional(),
});

export type CalendarParams = { year: number; month: number };

export function parseCalendarParams(
  raw: Record<string, string | string[] | undefined>
): CalendarParams {
  const flat: Record<string, string | undefined> = {};
  for (const [k, v] of Object.entries(raw)) flat[k] = Array.isArray(v) ? v[0] : v;
  const parsed = calendarParamsSchema.safeParse(flat);
  const now = new Date();
  if (!parsed.success || !parsed.data.year || !parsed.data.month) {
    return { year: now.getFullYear(), month: now.getMonth() + 1 };
  }
  return { year: parsed.data.year, month: parsed.data.month };
}
