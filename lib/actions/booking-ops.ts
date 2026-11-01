"use server";

import { revalidatePath, revalidateTag } from "next/cache";
import { createClient, createServiceClient } from "@/lib/supabase/server";
import { getUserRole, isManagerOrAdmin } from "@/lib/utils/roles";
import { calculatePricing } from "@/lib/pricing";
import { generateBookingReference } from "@/lib/booking-reference";
import { getMinDriverAge } from "@/lib/queries/settings";
import {
  recordHandoverSchema, reassignSchema, manualBookingSchema, checkDriverRules,
} from "@/lib/validators/booking-ops";

type ActionResult = { success?: true; error?: string; field?: string };

function firstIssue(err: { issues: { message: string; path: PropertyKey[] }[] }): ActionResult {
  const i = err.issues[0];
  return { error: i.message, field: i.path.map(String).join(".") };
}

function str(fd: FormData, k: string): string {
  return String(fd.get(k) ?? "");
}

function revalidateBooking(id: string) {
  revalidateTag("vehicles");
  revalidatePath("/management");
  revalidatePath("/management/bookings");
  revalidatePath(`/management/bookings/${id}`);
}

// Map RAISE EXCEPTION messages from the 031 RPCs to user-facing text.
function rpcMessage(err: { message?: string; code?: string }): string | null {
  const m = err.message ?? "";
  if (err.code === "23P01") return "That vehicle is already booked or in maintenance for these dates.";
  if (err.code === "42501") return "Not authorized";
  if (/not found|cannot be reassigned|already on this vehicle|not bookable|can only be recorded|below pickup odometer/i.test(m)) {
    return m.replace(/\s*\(status \w+\)/, "");
  }
  return null;
}

async function handover(kind: "pickup" | "return", formData: FormData): Promise<ActionResult> {
  if (!isManagerOrAdmin(await getUserRole())) return { error: "Forbidden" };
  const parsed = recordHandoverSchema.safeParse({
    booking_id: str(formData, "booking_id"),
    odometer: str(formData, "odometer"),
    fuel: str(formData, "fuel"),
    notes: str(formData, "notes"),
  });
  if (!parsed.success) return firstIssue(parsed.error);
  const { booking_id, odometer, fuel, notes } = parsed.data;

  const supabase = await createClient();
  const { error } = await supabase.rpc(kind === "pickup" ? "staff_record_pickup" : "staff_record_return", {
    p_booking_id: booking_id,
    p_odometer: odometer,
    p_fuel: fuel,
    p_notes: notes,
  });
  if (error) {
    const msg = rpcMessage(error);
    if (msg) return { error: msg, field: /odometer/i.test(msg) ? "odometer" : undefined };
    throw error;
  }

  revalidateBooking(booking_id);
  return { success: true };
}

export async function recordPickup(formData: FormData): Promise<ActionResult> {
  return handover("pickup", formData);
}

export async function recordReturn(formData: FormData): Promise<ActionResult> {
  return handover("return", formData);
}

export async function reassignVehicle(formData: FormData): Promise<ActionResult> {
  if (!isManagerOrAdmin(await getUserRole())) return { error: "Forbidden" };
  const parsed = reassignSchema.safeParse({
    booking_id: str(formData, "booking_id"),
    vehicle_id: str(formData, "vehicle_id"),
    note: str(formData, "note"),
  });
  if (!parsed.success) return firstIssue(parsed.error);

  const supabase = await createClient();
  const { error } = await supabase.rpc("staff_reassign_vehicle", {
    p_booking_id: parsed.data.booking_id,
    p_vehicle_id: parsed.data.vehicle_id,
    p_note: parsed.data.note,
  });
  if (error) {
    const msg = rpcMessage(error);
    if (msg) return { error: msg, field: "vehicle_id" };
    throw error;
  }

  revalidateBooking(parsed.data.booking_id);
  return { success: true };
}

export async function createManualBooking(formData: FormData): Promise<ActionResult & { booking_id?: string }> {
  if (!isManagerOrAdmin(await getUserRole())) return { error: "Forbidden" };

  const parsed = manualBookingSchema.safeParse({
    customer_id: str(formData, "customer_id"),
    vehicle_id: str(formData, "vehicle_id"),
    pickup_date: str(formData, "pickup_date"),
    return_date: str(formData, "return_date"),
    pickup_method: str(formData, "pickup_method") || "pickup",
    pickup_location_id: str(formData, "pickup_location_id") || null,
    driver_name: str(formData, "driver_name"),
    driver_email: str(formData, "driver_email"),
    driver_phone: str(formData, "driver_phone"),
    driver_dob: str(formData, "driver_dob"),
    license_number: str(formData, "license_number"),
    license_expiry: str(formData, "license_expiry"),
    license_region: str(formData, "license_region"),
    protection_plan_id: str(formData, "protection_plan_id") || null,
    special_requests: str(formData, "special_requests").trim() || null,
    initial_status: str(formData, "initial_status") || "pending",
    payment_method: str(formData, "payment_method") || "none",
  });
  if (!parsed.success) return firstIssue(parsed.error);
  const d = parsed.data;

  const todayISO = new Date().toISOString().slice(0, 10);
  if (d.pickup_date < todayISO) return { error: "Pickup date can't be in the past.", field: "pickup_date" };
  const rule = checkDriverRules(d, await getMinDriverAge());
  if (rule) return { error: rule[0], field: rule[1] };

  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return { error: "Not signed in" };

  const [{ data: customerRole }, { data: vehicle, error: vErr }] = await Promise.all([
    supabase.from("roles").select("role").eq("user_id", d.customer_id).maybeSingle(),
    supabase.from("vehicles").select("status, min_rental_days, max_rental_days").eq("id", d.vehicle_id).maybeSingle(),
  ]);
  if (vErr) throw vErr;
  if ((customerRole as { role?: string } | null)?.role !== "customer") return { error: "Customer not found", field: "customer_id" };
  const v = vehicle as { status: string; min_rental_days: number | null; max_rental_days: number | null } | null;
  if (!v || ["draft", "inactive", "maintenance"].includes(v.status)) {
    return { error: "That vehicle isn't bookable right now.", field: "vehicle_id" };
  }

  if (d.pickup_method === "delivery") {
    if (!d.pickup_location_id) return { error: "Delivery location required.", field: "pickup_location_id" };
    const { data: loc } = await supabase
      .from("vehicle_locations").select("delivery_available").eq("id", d.pickup_location_id).maybeSingle();
    if (!(loc as { delivery_available?: boolean } | null)?.delivery_available) {
      return { error: "This location does not offer delivery.", field: "pickup_location_id" };
    }
  }

  const pricing = await calculatePricing({
    vehicle_id: d.vehicle_id,
    pickup_date: d.pickup_date,
    return_date: d.return_date,
    pickup_method: d.pickup_method,
    pickup_location_id: d.pickup_location_id,
    protection_plan_id: d.protection_plan_id,
    extras: [],
    promo_code: null,
  });
  if (v.min_rental_days && pricing.rental_days < v.min_rental_days) {
    return { error: `Minimum rental is ${v.min_rental_days} days.`, field: "return_date" };
  }
  if (v.max_rental_days && pricing.rental_days > v.max_rental_days) {
    return { error: `Maximum rental is ${v.max_rental_days} days.`, field: "return_date" };
  }

  // Service role: create_booking_with_availability is service-only since 031.
  const service = await createServiceClient();
  let created: { id: string; reference: string } | null = null;
  for (let attempt = 0; attempt < 2 && !created; attempt++) {
    const reference = generateBookingReference();
    const { error: rpcErr } = await service.rpc("create_booking_with_availability", {
      p_booking: {
        reference,
        customer_id: d.customer_id,
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
        promo_code_id: "",
        special_requests: d.special_requests ?? "",
        extras: [],
      },
    });
    if (!rpcErr) {
      const { data: row, error: fetchErr } = await service.from("bookings").select("id, reference").eq("reference", reference).maybeSingle();
      if (fetchErr) throw fetchErr;
      created = row as { id: string; reference: string };
      break;
    }
    if (rpcErr.code === "23505" && rpcErr.message?.includes("reference")) continue;
    if (rpcErr.code === "23P01") return { error: "Those dates are already taken for this vehicle.", field: "pickup_date" };
    throw rpcErr;
  }
  if (!created) return { error: "Couldn't generate a unique booking reference. Try again." };

  const history: { booking_id: string; status: string; changed_by: string; note: string }[] = [
    { booking_id: created.id, status: "pending", changed_by: user.id, note: "Created manually by staff" },
  ];
  if (d.initial_status === "confirmed") {
    const { error: upErr } = await service
      .from("bookings").update({ status: "confirmed", updated_at: new Date().toISOString() }).eq("id", created.id);
    if (upErr) throw upErr;
    history.push({
      booking_id: created.id, status: "confirmed", changed_by: user.id,
      note: d.payment_method === "cash" ? "Confirmed by staff · cash payment recorded" : "Confirmed by staff",
    });
    if (d.payment_method === "cash") {
      const { error: payErr } = await service.from("payments").insert({
        booking_id: created.id, amount: pricing.total_amount, currency: "USD",
        method: "cash", status: "completed", paid_at: new Date().toISOString(),
      });
      if (payErr) throw payErr;
    }
  }
  const { error: hErr } = await service.from("booking_status_history").insert(history);
  if (hErr) console.error("status history insert failed", { booking_id: created.id, hErr });

  const { error: aErr } = await service.from("audit_logs").insert({
    actor_id: user.id, action: "booking.create_manual", entity_type: "booking", entity_id: created.id,
    diff: { reference: created.reference, status: d.initial_status, payment: d.payment_method, total: pricing.total_amount },
  });
  if (aErr) console.error("audit insert failed", { booking_id: created.id, aErr });

  const { error: nErr } = await service.from("notifications").insert({
    user_id: d.customer_id,
    type: "booking_created",
    title: `Booking ${created.reference} created`,
    body: "Our team created a booking for you. You can view it in your account.",
  });
  if (nErr) console.error("notification insert failed", { booking_id: created.id, nErr });

  revalidateBooking(created.id);
  return { success: true, booking_id: created.id };
}
