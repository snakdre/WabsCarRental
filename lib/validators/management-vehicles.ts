import { z } from "zod";

export const VEHICLE_STATUSES = ["draft", "available", "reserved", "rented", "maintenance", "inactive"] as const;

export const CATEGORIES = ["exotic", "sports", "suv", "convertible", "executive", "electric"] as const;

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

export const createVehicleSchema = z.object({
  make: z.string().min(1).max(50),
  model: z.string().min(1).max(50),
  trim: z.string().max(50).nullable(),
  year: z.number().int().min(1990).max(2030),
  category: z.enum(CATEGORIES),
  daily_price: z.number().positive(),
  description: z.string().max(2000).nullable(),
});

export type CreateVehicleInput = z.infer<typeof createVehicleSchema>;
