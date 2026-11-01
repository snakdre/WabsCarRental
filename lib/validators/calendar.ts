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

export type CalendarView =
  | { view: "month"; year: number; month: number }
  | { view: "week"; start: string }; // Monday, YYYY-MM-DD

const weekStart = z.string().regex(/^\d{4}-\d{2}-\d{2}$/);

// ?view=week&start=YYYY-MM-DD (snapped to Monday by the caller) or the month params.
export function parseCalendarView(
  raw: Record<string, string | string[] | undefined>,
  today: string,
): CalendarView {
  const v = Array.isArray(raw.view) ? raw.view[0] : raw.view;
  if (v === "week") {
    const s = Array.isArray(raw.start) ? raw.start[0] : raw.start;
    const ok = weekStart.safeParse(s);
    const start = ok.success && !Number.isNaN(Date.parse(ok.data)) ? ok.data : today;
    return { view: "week", start };
  }
  return { view: "month", ...parseCalendarParams(raw) };
}
