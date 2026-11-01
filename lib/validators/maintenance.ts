import { z } from "zod";
import { uuidLike, dateField } from "./shared";

export const MAINTENANCE_CATEGORIES = ["service", "repair", "inspection", "tires", "detailing", "other"] as const;
export const MAINTENANCE_STATUSES = ["scheduled", "in_progress", "completed", "cancelled"] as const;
export type MaintenanceStatus = (typeof MAINTENANCE_STATUSES)[number];

export const MAINTENANCE_STATUS_LABEL: Record<MaintenanceStatus, string> = {
  scheduled: "Scheduled",
  in_progress: "In progress",
  completed: "Completed",
  cancelled: "Cancelled",
};

export const MAINTENANCE_TRANSITIONS: Record<MaintenanceStatus, MaintenanceStatus[]> = {
  scheduled: ["in_progress", "completed", "cancelled"],
  in_progress: ["completed", "cancelled"],
  completed: [],
  cancelled: [],
};

const optionalMoney = z
  .string()
  .trim()
  .transform(v => (v === "" ? null : v))
  .nullable()
  .refine(v => v === null || /^\d+(\.\d{1,2})?$/.test(v), "Cost must be a dollar amount")
  .transform(v => (v === null ? null : Number(v)))
  .refine(v => v === null || v <= 1_000_000, "Cost looks too large");

const optionalInt = z
  .string()
  .trim()
  .transform(v => (v === "" ? null : v))
  .nullable()
  .refine(v => v === null || /^\d+$/.test(v), "Odometer must be a whole number")
  .transform(v => (v === null ? null : Number(v)));

export const createMaintenanceSchema = z
  .object({
    vehicle_id: uuidLike,
    category: z.enum(MAINTENANCE_CATEGORIES),
    service_date: dateField,
    return_date: z.union([dateField, z.literal("")]).transform(v => (v === "" ? null : v)),
    description: z.string().trim().min(1, "Describe the work").max(1000),
    vendor: z.string().trim().max(200).optional().default(""),
    cost: optionalMoney,
    odometer: optionalInt,
  })
  .refine(d => d.return_date === null || d.return_date >= d.service_date, {
    message: "Expected return must be on or after the service date",
    path: ["return_date"],
  });

export const maintenanceStatusSchema = z.object({
  id: uuidLike,
  status: z.enum(["in_progress", "completed", "cancelled"]),
  cost: optionalMoney,
  odometer: optionalInt,
});

export const maintenanceListParamsSchema = z.object({
  status: z.enum(MAINTENANCE_STATUSES).optional(),
  vehicle: uuidLike.optional(),
});
export type MaintenanceListParams = z.infer<typeof maintenanceListParamsSchema>;

export function parseMaintenanceListParams(raw: Record<string, string | string[] | undefined>): MaintenanceListParams {
  const flat: Record<string, string | undefined> = {};
  for (const [k, v] of Object.entries(raw)) flat[k] = Array.isArray(v) ? v[0] : v;
  const parsed = maintenanceListParamsSchema.safeParse(flat);
  return parsed.success ? parsed.data : {};
}
