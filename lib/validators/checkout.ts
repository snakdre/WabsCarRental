import { z } from "zod";

// Step 1 — dates
const _datesObject = z.object({
  vehicle_id: z.string().uuid(),
  pickup_date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, "Invalid pickup date"),
  return_date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, "Invalid return date"),
  pickup_method: z.enum(["pickup", "delivery"]),
  pickup_location_id: z.string().uuid().nullable().optional(),
});
export const datesSchema = _datesObject.refine((d) => d.return_date > d.pickup_date, {
  message: "Return date must be after pickup date",
  path: ["return_date"],
});

// Step 2 — driver
export const driverSchema = z.object({
  driver_name: z.string().min(1, "Name required"),
  driver_email: z.string().email("Invalid email"),
  driver_phone: z.string().min(7, "Phone required"),
  driver_dob: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, "Invalid date of birth"),
  license_number: z.string().min(1, "License number required"),
  license_expiry: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, "Invalid license expiry"),
  license_region: z.string().min(1, "Issuing region required"),
});

// Step 3 — extras
export const extrasSchema = z.object({
  protection_plan_id: z.string().uuid().nullable().optional(),
  extras: z.array(z.object({
    extra_id: z.string().uuid(),
    quantity: z.number().int().positive(),
  })).default([]),
  promo_code: z.string().nullable().optional(),
});

// Composite for createDraftBooking action
export const fullBookingSchema = _datesObject
  .merge(driverSchema)
  .merge(extrasSchema)
  .extend({
    terms_accepted: z.literal(true, { message: "You must accept terms" }),
    special_requests: z.string().max(500).optional().nullable(),
  });

// Step 5 — card (Luhn done in action; here we only shape-validate)
export const paymentSchema = z.object({
  card_number: z.string().regex(/^\d{13,19}$/, "Card number must be 13-19 digits"),
  card_expiry: z.string().regex(/^(0[1-9]|1[0-2])\/\d{2}$/, "Format: MM/YY"),
  card_cvc: z.string().regex(/^\d{3,4}$/, "CVC must be 3-4 digits"),
  card_zip: z.string().min(1, "Billing zip required"),
});

export type DatesInput = z.infer<typeof datesSchema>;
export type DriverInput = z.infer<typeof driverSchema>;
export type ExtrasInput = z.infer<typeof extrasSchema>;
export type PaymentInput = z.infer<typeof paymentSchema>;
