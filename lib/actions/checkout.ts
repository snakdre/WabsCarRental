"use server";

import { redirect } from "next/navigation";
import { revalidatePath, revalidateTag } from "next/cache";
import { createClient, createServiceClient } from "@/lib/supabase/server";
import { calculatePricing } from "@/lib/pricing";
import { generateBookingReference } from "@/lib/booking-reference";
import { paymentSchema } from "@/lib/validators/checkout";
import { z } from "zod";

function luhn(num: string): boolean {
  const digits = num.replace(/\D/g, "");
  if (digits.length < 13) return false;
  let sum = 0, dbl = false;
  for (let i = digits.length - 1; i >= 0; i--) {
    let d = parseInt(digits[i], 10);
    if (dbl) { d *= 2; if (d > 9) d -= 9; }
    sum += d;
    dbl = !dbl;
  }
  return sum % 10 === 0;
}

// Composite schema for createDraftBooking (mirrors the URL params carried
// from step 1-3 plus terms_accepted on step 4).
const createDraftSchema = z.object({
  vehicle_id: z.string().uuid(),
  pickup_date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
  return_date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
  pickup_method: z.enum(["pickup", "delivery"]),
  pickup_location_id: z.string().uuid().nullable().optional(),
  driver_name: z.string().min(1),
  driver_email: z.string().email(),
  driver_phone: z.string().min(7),
  driver_dob: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
  license_number: z.string().min(1),
  license_expiry: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
  license_region: z.string().min(1),
  protection_plan_id: z.string().uuid().nullable().optional(),
  extras: z.array(z.object({ extra_id: z.string().uuid(), quantity: z.number().int().positive() })).default([]),
  promo_code: z.string().nullable().optional(),
  special_requests: z.string().max(500).nullable().optional(),
  terms_accepted: z.literal("on"),
});

function computeAgeAt(dob: string, at: string): number {
  const d = new Date(dob + "T00:00:00Z");
  const a = new Date(at + "T00:00:00Z");
  let age = a.getUTCFullYear() - d.getUTCFullYear();
  const m = a.getUTCMonth() - d.getUTCMonth();
  if (m < 0 || (m === 0 && a.getUTCDate() < d.getUTCDate())) age--;
  return age;
}

export async function createDraftBooking(formData: FormData) {
  // Parse extras from stringified JSON in the form
  const raw: Record<string, unknown> = {};
  formData.forEach((v, k) => { raw[k] = v; });
  if (typeof raw.extras === "string") {
    try { raw.extras = JSON.parse(raw.extras); } catch { raw.extras = []; }
  }
  raw.pickup_location_id = raw.pickup_location_id || null;
  raw.protection_plan_id = raw.protection_plan_id || null;
  raw.promo_code = raw.promo_code || null;
  raw.special_requests = raw.special_requests || null;

  const parsed = createDraftSchema.safeParse(raw);
  if (!parsed.success) {
    const first = parsed.error.issues[0];
    return { error: first.message, field: first.path.join(".") };
  }
  const d = parsed.data;

  // Business rules
  const todayISO = new Date().toISOString().slice(0, 10);
  if (d.pickup_date < todayISO) {
    return { error: "Pickup date must be in the future.", field: "pickup_date" };
  }
  if (computeAgeAt(d.driver_dob, d.pickup_date) < 25) {
    return { error: "Driver must be at least 25 years old at pickup.", field: "driver_dob" };
  }
  if (d.license_expiry <= d.pickup_date) {
    return { error: "License must be valid past the pickup date.", field: "license_expiry" };
  }
  if (d.return_date <= d.pickup_date) {
    return { error: "Return date must be after pickup date.", field: "return_date" };
  }

  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return { error: "Not signed in" };

  // Vehicle status + min/max days check
  const { data: vehicle, error: vErr } = await supabase
    .from("vehicles")
    .select("status, min_rental_days, max_rental_days")
    .eq("id", d.vehicle_id).maybeSingle();
  if (vErr) throw vErr;
  if (!vehicle || vehicle.status !== "available") {
    return { error: "Vehicle is no longer available.", field: "vehicle_id" };
  }

  // Delivery location must allow delivery
  if (d.pickup_method === "delivery") {
    if (!d.pickup_location_id) {
      return { error: "Delivery location required.", field: "pickup_location_id" };
    }
    const { data: loc } = await supabase
      .from("vehicle_locations")
      .select("delivery_available")
      .eq("id", d.pickup_location_id).maybeSingle();
    if (!loc?.delivery_available) {
      return { error: "This location does not offer delivery.", field: "pickup_location_id" };
    }
  }

  const pricing = await calculatePricing({
    vehicle_id: d.vehicle_id,
    pickup_date: d.pickup_date,
    return_date: d.return_date,
    pickup_method: d.pickup_method,
    pickup_location_id: d.pickup_location_id ?? null,
    protection_plan_id: d.protection_plan_id ?? null,
    extras: d.extras,
    promo_code: d.promo_code ?? null,
  });

  if (vehicle.min_rental_days && pricing.rental_days < vehicle.min_rental_days) {
    return { error: `Minimum rental is ${vehicle.min_rental_days} days.`, field: "return_date" };
  }
  if (vehicle.max_rental_days && pricing.rental_days > vehicle.max_rental_days) {
    return { error: `Maximum rental is ${vehicle.max_rental_days} days.`, field: "return_date" };
  }
  if (d.promo_code && !pricing.promo_valid) {
    return { error: pricing.promo_error ?? "Invalid promo code", field: "promo_code" };
  }

  // Fetch extras unit prices once for the p_booking payload
  let extrasWithPrice: { extra_id: string; quantity: number; unit_price: number }[] = [];
  if (d.extras.length > 0) {
    const { data: exs } = await supabase.from("extras").select("id, price").in("id", d.extras.map(e => e.extra_id));
    const byId = new Map<string, number>();
    (exs ?? []).forEach((e: { id: string; price: number }) => byId.set(e.id, Number(e.price)));
    extrasWithPrice = d.extras.map(e => ({ extra_id: e.extra_id, quantity: e.quantity, unit_price: byId.get(e.extra_id) ?? 0 }));
  }

  // Attempt booking; retry once on reference collision
  for (let attempt = 0; attempt < 2; attempt++) {
    const reference = generateBookingReference();
    const p_booking = {
      reference,
      customer_id: user.id,
      vehicle_id: d.vehicle_id,
      pickup_date: d.pickup_date,
      return_date: d.return_date,
      pickup_method: d.pickup_method,
      pickup_location_id: d.pickup_location_id ?? "",
      driver_name: d.driver_name,
      driver_email: d.driver_email,
      driver_phone: d.driver_phone,
      driver_dob: d.driver_dob,
      license_number: d.license_number,
      license_expiry: d.license_expiry,
      license_region: d.license_region,
      rental_days: pricing.rental_days,
      base_price: pricing.base_price,
      delivery_fee: pricing.delivery_fee,
      tax_amount: pricing.tax_amount,
      protection_fee: pricing.protection_fee,
      extras_fee: pricing.extras_fee,
      discount_amount: pricing.discount_amount,
      deposit_amount: pricing.deposit_amount,
      total_amount: pricing.total_amount,
      protection_plan_id: d.protection_plan_id ?? "",
      promo_code_id: pricing.promo_code_id ?? "",
      special_requests: d.special_requests ?? "",
      extras: extrasWithPrice,
    };

    const { data: rpcResult, error: rpcErr } = await supabase.rpc("create_booking_with_availability", { p_booking });
    if (!rpcErr) {
      revalidateTag("vehicles");
      redirect(`/checkout/payment?booking_ref=${rpcResult}`);
    }
    // Reference collision → retry
    if (rpcErr.code === "23505" && rpcErr.message.includes("reference")) continue;
    // Exclusion constraint (dates taken)
    if (rpcErr.code === "23P01") {
      return { error: "These dates were just taken. Please pick different dates.", field: "pickup_date" };
    }
    // Other DB error
    throw rpcErr;
  }
  return { error: "Unable to generate a unique booking reference. Please try again." };
}

export async function confirmPayment(formData: FormData) {
  const raw = {
    booking_ref: String(formData.get("booking_ref") ?? ""),
    card_number: String(formData.get("card_number") ?? "").replace(/\s+/g, ""),
    card_expiry: String(formData.get("card_expiry") ?? ""),
    card_cvc: String(formData.get("card_cvc") ?? ""),
    card_zip: String(formData.get("card_zip") ?? ""),
  };

  const parsed = paymentSchema.safeParse(raw);
  if (!parsed.success) {
    const first = parsed.error.issues[0];
    return { error: first.message, field: first.path.join(".") };
  }

  if (!luhn(raw.card_number)) {
    return { error: "Invalid card number.", field: "card_number" };
  }

  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return { error: "Not signed in" };

  const { data: booking, error: bErr } = await supabase
    .from("bookings")
    .select("id, reference, customer_id, status, total_amount")
    .eq("reference", raw.booking_ref).maybeSingle();
  if (bErr) throw bErr;
  if (!booking || booking.customer_id !== user.id) {
    return { error: "Booking not found." };
  }
  if (booking.status === "confirmed") {
    redirect(`/checkout/confirmation/${booking.reference}`);
  }
  if (booking.status !== "pending") {
    return { error: "This booking cannot be paid at this time." };
  }

  const service = await createServiceClient();

  const { error: payErr } = await service.from("payments").insert({
    booking_id: booking.id,
    amount: booking.total_amount,
    currency: "USD",
    method: "mock",
    status: "completed",
    paid_at: new Date().toISOString(),
  });
  if (payErr) throw payErr;

  const { error: upErr } = await service.from("bookings")
    .update({ status: "confirmed", updated_at: new Date().toISOString() })
    .eq("id", booking.id);
  if (upErr) throw upErr;

  await service.from("booking_status_history").insert({
    booking_id: booking.id,
    status: "confirmed",
    changed_by: user.id,
    note: "Mock payment completed",
  });

  revalidatePath("/account");
  redirect(`/checkout/confirmation/${booking.reference}`);
}
