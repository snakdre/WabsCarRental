import { z } from "zod";
import { uuidLike, dateField } from "./shared";

export const ACCOUNT_TABS = ["bookings", "profile", "favorites", "documents", "notifications"] as const;
export type AccountTab = typeof ACCOUNT_TABS[number];

export function parseAccountTab(raw: string | string[] | undefined): AccountTab {
  const v = Array.isArray(raw) ? raw[0] : raw;
  return (ACCOUNT_TABS as readonly string[]).includes(v ?? "") ? (v as AccountTab) : "bookings";
}

const optionalText = (max: number) =>
  z.string().trim().max(max).transform(v => (v === "" ? null : v)).nullable();

export const profileSchema = z.object({
  first_name: z.string().trim().min(1, "First name is required").max(80),
  last_name: z.string().trim().min(1, "Last name is required").max(80),
  phone: optionalText(30).refine(v => v === null || /^[+()\d\s.-]{7,30}$/.test(v), "Enter a valid phone number"),
  date_of_birth: z.union([dateField, z.literal("")]).transform(v => (v === "" ? null : v)),
  address_line1: optionalText(200),
  address_city: optionalText(100),
  address_state: optionalText(100),
  address_zip: optionalText(20),
});

export const cancelBookingSchema = z.object({
  booking_id: uuidLike,
  reason: z.string().max(500).optional().default(""),
});

export const favoriteSchema = z.object({ vehicle_id: uuidLike });

export const DOCUMENT_TYPES = ["license_front", "license_back", "passport", "other"] as const;
export const DOCUMENT_TYPE_LABEL: Record<typeof DOCUMENT_TYPES[number], string> = {
  license_front: "Driver's licence (front)",
  license_back: "Driver's licence (back)",
  passport: "Passport",
  other: "Other",
};
export const DOCUMENT_MIME_TYPES = ["image/jpeg", "image/png", "image/webp", "application/pdf"] as const;
export const DOCUMENT_MAX_BYTES = 10 * 1024 * 1024;

export const documentMetaSchema = z.object({
  type: z.enum(DOCUMENT_TYPES),
  mime: z.enum(DOCUMENT_MIME_TYPES, { message: "File must be JPEG, PNG, WebP or PDF" }),
  size: z.number().int().positive("File is empty").max(DOCUMENT_MAX_BYTES, "File must be 10 MB or smaller"),
});

export const idSchema = z.object({ id: uuidLike });

export const CANCELLABLE_STATUSES = ["pending", "confirmed", "ready_for_pickup"] as const;
export const CANCEL_WINDOW_MS = 24 * 60 * 60 * 1000;

export function canCustomerCancel(status: string, pickupIso: string, now: Date = new Date()): boolean {
  if (!(CANCELLABLE_STATUSES as readonly string[]).includes(status)) return false;
  return new Date(pickupIso).getTime() - now.getTime() > CANCEL_WINDOW_MS;
}

export function extFromMime(mime: typeof DOCUMENT_MIME_TYPES[number]): string {
  return { "image/jpeg": "jpg", "image/png": "png", "image/webp": "webp", "application/pdf": "pdf" }[mime];
}
export const DOCUMENTS_BUCKET = "customer-documents";
