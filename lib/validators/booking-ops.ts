import { z } from "zod";
import { uuidLike, dateField } from "./shared";

const intField = (min: number, max: number, label: string) =>
  z
    .string()
    .trim()
    .regex(/^\d+$/, `${label} must be a whole number`)
    .transform(Number)
    .pipe(z.number().int().min(min, `${label} must be at least ${min}`).max(max, `${label} must be at most ${max}`));

const notes = z.string().trim().max(1000).optional().default("");

export const recordHandoverSchema = z.object({
  booking_id: uuidLike,
  odometer: intField(0, 2_000_000, "Odometer"),
  fuel: intField(0, 100, "Fuel level"),
  notes,
});

export const reassignSchema = z.object({
  booking_id: uuidLike,
  vehicle_id: uuidLike,
  note: z.string().trim().max(500).optional().default(""),
});

// Manual booking: staff create a booking for an existing customer.
// Pricing is always computed server-side; staff cannot type a total.
export const manualBookingSchema = z
  .object({
    customer_id: uuidLike,
    vehicle_id: uuidLike,
    pickup_date: dateField,
    return_date: dateField,
    pickup_method: z.enum(["pickup", "delivery"]),
    pickup_location_id: uuidLike.nullable(),
    driver_name: z.string().trim().min(1, "Driver name required").max(120),
    driver_email: z.string().trim().email("Invalid email"),
    driver_phone: z.string().trim().min(7, "Phone required").max(30),
    driver_dob: dateField,
    license_number: z.string().trim().min(1, "Licence number required").max(50),
    license_expiry: dateField,
    license_region: z.string().trim().min(1, "Issuing region required").max(50),
    protection_plan_id: uuidLike.nullable(),
    special_requests: z.string().trim().max(500).nullable(),
    initial_status: z.enum(["pending", "confirmed"]),
    payment_method: z.enum(["none", "cash"]),
  })
  .refine(d => d.return_date > d.pickup_date, { message: "Return date must be after pickup date", path: ["return_date"] })
  .refine(d => d.payment_method === "none" || d.initial_status === "confirmed", {
    message: "Recording a cash payment requires the booking to be confirmed",
    path: ["payment_method"],
  });

export type ManualBookingInput = z.infer<typeof manualBookingSchema>;

export function ageAt(dob: string, at: string): number {
  const d = new Date(dob + "T00:00:00Z");
  const a = new Date(at + "T00:00:00Z");
  let age = a.getUTCFullYear() - d.getUTCFullYear();
  const m = a.getUTCMonth() - d.getUTCMonth();
  if (m < 0 || (m === 0 && a.getUTCDate() < d.getUTCDate())) age--;
  return age;
}

// Business rules shared with checkout (spec §6). Returns [message, field] or null.
export function checkDriverRules(d: { pickup_date: string; driver_dob: string; license_expiry: string }): [string, string] | null {
  if (ageAt(d.driver_dob, d.pickup_date) < 25) return ["Driver must be at least 25 years old at pickup.", "driver_dob"];
  if (d.license_expiry <= d.pickup_date) return ["Licence must be valid past the pickup date.", "license_expiry"];
  return null;
}
