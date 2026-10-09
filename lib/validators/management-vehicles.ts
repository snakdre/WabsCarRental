import { z } from "zod";

export const VEHICLE_STATUSES = ["draft", "available", "reserved", "rented", "maintenance", "inactive"] as const;

// Our seed uses memorable UUIDs like aaaaaaaa-0000-0000-0000-000000000001 that
// are not RFC-4122 version-compliant (zod's .uuid() enforces version nibble 1-8).
// Postgres accepts them as valid UUID columns, so match on hex-shape only.
const uuidLike = z.string().regex(/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i);

export const updateVehicleSchema = z.object({
  vehicle_id: uuidLike,
  status: z.enum(VEHICLE_STATUSES),
  is_featured: z.boolean(),
  daily_price: z.number().positive(),
  weekly_price: z.number().positive().nullable(),
  monthly_price: z.number().positive().nullable(),
  description: z.string().max(2000).nullable(),
});

export type UpdateVehicleInput = z.infer<typeof updateVehicleSchema>;
