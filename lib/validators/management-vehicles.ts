import { z } from "zod";
import { uuidLike } from "./shared";

export const VEHICLE_STATUSES = ["draft", "available", "reserved", "rented", "maintenance", "inactive"] as const;

export const CATEGORIES = ["exotic", "sports", "suv", "convertible", "executive", "electric"] as const;

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

// ---------- Images ----------

export const VEHICLE_IMAGES_BUCKET = "vehicle-images";
export const IMAGE_MIME_TYPES = ["image/jpeg", "image/png", "image/webp"] as const;
export const IMAGE_MAX_BYTES = 10 * 1024 * 1024;
export const MAX_IMAGES_PER_VEHICLE = 20;

export function imageExt(mime: string): string | null {
  return ({ "image/jpeg": "jpg", "image/png": "png", "image/webp": "webp" } as Record<string, string>)[mime] ?? null;
}

// Shared client/server file pre-check. Returns an error message or null.
export function validateImageFile(file: { type: string; size: number }): string | null {
  if (!(IMAGE_MIME_TYPES as readonly string[]).includes(file.type)) return "Images must be JPEG, PNG or WebP";
  if (file.size <= 0) return "File is empty";
  if (file.size > IMAGE_MAX_BYTES) return "Images must be 10 MB or smaller";
  return null;
}

const HEX_UUID = "[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}";
const STORAGE_PATH = new RegExp(`^${HEX_UUID}/${HEX_UUID}\\.(jpg|png|webp)$`, "i");

const altText = z.string().trim().max(200).transform(v => (v === "" ? null : v)).nullable();

export const registerImageSchema = z
  .object({
    vehicle_id: uuidLike,
    storage_path: z.string().regex(STORAGE_PATH, "Invalid storage path"),
    alt_text: altText,
  })
  .refine(d => d.storage_path.toLowerCase().startsWith(`${d.vehicle_id.toLowerCase()}/`), {
    message: "Storage path does not belong to this vehicle",
    path: ["storage_path"],
  });

export const imageAltSchema = z.object({ image_id: uuidLike, alt_text: altText });
export const imageIdSchema = z.object({ image_id: uuidLike });
export const reorderImagesSchema = z.object({
  vehicle_id: uuidLike,
  image_ids: z
    .array(uuidLike)
    .min(1)
    .max(MAX_IMAGES_PER_VEHICLE)
    .refine(ids => new Set(ids).size === ids.length, "Duplicate image ids"),
});
export const vehicleIdSchema = z.object({ vehicle_id: uuidLike });
