import { z } from "zod";
import { BOOKING_STATUSES } from "@/lib/booking-status";

export const managementListParamsSchema = z.object({
  status: z.enum(BOOKING_STATUSES).optional(),
  search: z.string().max(100).optional(),
});

export const transitionSchema = z.object({
  booking_id: z.string().uuid(),
  next_status: z.enum(BOOKING_STATUSES),
  note: z.string().max(500).nullable().optional(),
});

export const notesSchema = z.object({
  booking_id: z.string().uuid(),
  notes: z.string().max(2000),
});

export type ManagementListParams = z.infer<typeof managementListParamsSchema>;
export type TransitionInput = z.infer<typeof transitionSchema>;
export type NotesInput = z.infer<typeof notesSchema>;

export function parseListParams(raw: Record<string, string | string[] | undefined>): ManagementListParams {
  const flat: Record<string, string | undefined> = {};
  for (const [k, v] of Object.entries(raw)) flat[k] = Array.isArray(v) ? v[0] : v;
  const parsed = managementListParamsSchema.safeParse(flat);
  return parsed.success ? parsed.data : {};
}
