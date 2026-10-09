import { z } from "zod";

export const VEHICLE_STATUSES = ["draft", "available", "reserved", "rented", "maintenance", "inactive"] as const;

export const updateVehicleSchema = z.object({
  vehicle_id: z.string().uuid(),
  status: z.enum(VEHICLE_STATUSES),
  is_featured: z.boolean(),
  daily_price: z.number().positive(),
  weekly_price: z.number().positive().nullable(),
  monthly_price: z.number().positive().nullable(),
  description: z.string().max(2000).nullable(),
});

export type UpdateVehicleInput = z.infer<typeof updateVehicleSchema>;
