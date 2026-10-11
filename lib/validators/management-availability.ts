import { z } from "zod";
import { uuidLike, dateField } from "./shared";

export const BLOCKABLE_TYPES = ["maintenance", "blocked"] as const;

export const createAvailabilityBlockSchema = z
  .object({
    vehicle_id: uuidLike,
    type: z.enum(BLOCKABLE_TYPES),
    start_date: dateField,
    end_date: dateField,
    reason: z.string().max(500).nullable(),
  })
  .refine((v) => v.end_date >= v.start_date, {
    message: "End date must be on or after start date",
    path: ["end_date"],
  });

export type CreateAvailabilityBlockInput = z.infer<typeof createAvailabilityBlockSchema>;
