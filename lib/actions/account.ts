"use server";

import { randomUUID } from "node:crypto";
import { revalidatePath, revalidateTag } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import {
  profileSchema,
  cancelBookingSchema,
  favoriteSchema,
  documentMetaSchema,
  idSchema,
  canCustomerCancel,
  extFromMime,
  DOCUMENTS_BUCKET,
} from "@/lib/validators/account";

export type ActionResult = { success?: true; error?: string; field?: string };

function firstIssue(err: { issues: { message: string; path: PropertyKey[] }[] }): ActionResult {
  const i = err.issues[0];
  return { error: i.message, field: i.path.map(String).join(".") };
}

async function requireUser() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  return { supabase, user };
}

// ---------- Profile ----------

export async function updateProfile(formData: FormData): Promise<ActionResult> {
  const parsed = profileSchema.safeParse({
    first_name: String(formData.get("first_name") ?? ""),
    last_name: String(formData.get("last_name") ?? ""),
    phone: String(formData.get("phone") ?? ""),
    date_of_birth: String(formData.get("date_of_birth") ?? ""),
    address_line1: String(formData.get("address_line1") ?? ""),
    address_city: String(formData.get("address_city") ?? ""),
    address_state: String(formData.get("address_state") ?? ""),
    address_zip: String(formData.get("address_zip") ?? ""),
  });
  if (!parsed.success) return firstIssue(parsed.error);

  const { supabase, user } = await requireUser();
  if (!user) return { error: "Not signed in" };

  const p = parsed.data;
  const hasAddress = p.address_line1 || p.address_city || p.address_state || p.address_zip;
  const { error } = await supabase
    .from("profiles")
    .update({
      first_name: p.first_name,
      last_name: p.last_name,
      phone: p.phone,
      date_of_birth: p.date_of_birth,
      address: hasAddress
        ? { line1: p.address_line1, city: p.address_city, state: p.address_state, zip: p.address_zip }
        : null,
      updated_at: new Date().toISOString(),
    })
    .eq("id", user.id);
  if (error) throw error;

  revalidatePath("/account");
  return { success: true };
}

// ---------- Cancellation ----------

export async function cancelMyBooking(formData: FormData): Promise<ActionResult> {
  const parsed = cancelBookingSchema.safeParse({
    booking_id: String(formData.get("booking_id") ?? ""),
    reason: String(formData.get("reason") ?? ""),
  });
  if (!parsed.success) return firstIssue(parsed.error);
  const { booking_id, reason } = parsed.data;

  const { supabase, user } = await requireUser();
  if (!user) return { error: "Not signed in" };

  // Pre-check for a friendly message; the RPC re-enforces all of this.
  const { data: booking, error: fetchErr } = await supabase
    .from("bookings")
    .select("id, status, pickup_date")
    .eq("id", booking_id)
    .eq("customer_id", user.id)
    .maybeSingle();
  if (fetchErr) throw fetchErr;
  if (!booking) return { error: "Booking not found" };
  if (!canCustomerCancel(booking.status, booking.pickup_date)) {
    return { error: "This booking can no longer be cancelled online. Please contact us." };
  }

  const { error: rpcErr } = await supabase.rpc("cancel_my_booking", {
    p_booking_id: booking_id,
    p_reason: reason,
  });
  if (rpcErr) {
    const msg = rpcErr.message ?? "";
    if (msg.includes("window") || msg.includes("cannot be cancelled")) {
      return { error: "This booking can no longer be cancelled online. Please contact us." };
    }
    if (msg.includes("not found")) return { error: "Booking not found" };
    throw rpcErr;
  }

  revalidateTag("vehicles");
  revalidatePath("/account");
  revalidatePath(`/account/bookings/${booking_id}`);
  revalidatePath("/management/bookings");
  return { success: true };
}

// ---------- Favorites ----------

export async function toggleFavorite(formData: FormData): Promise<ActionResult & { favorited?: boolean }> {
  const parsed = favoriteSchema.safeParse({ vehicle_id: String(formData.get("vehicle_id") ?? "") });
  if (!parsed.success) return firstIssue(parsed.error);
  const { vehicle_id } = parsed.data;

  const { supabase, user } = await requireUser();
  if (!user) return { error: "Not signed in" };

  const { data: existing, error: fetchErr } = await supabase
    .from("favorites")
    .select("id")
    .eq("customer_id", user.id)
    .eq("vehicle_id", vehicle_id)
    .maybeSingle();
  if (fetchErr) throw fetchErr;

  let favorited: boolean;
  if (existing) {
    const { error } = await supabase.from("favorites").delete().eq("id", (existing as { id: string }).id);
    if (error) throw error;
    favorited = false;
  } else {
    const { error } = await supabase.from("favorites").insert({ customer_id: user.id, vehicle_id });
    // 23505 = unique violation (double-click race) — treat as already favorited.
    if (error && (error as { code?: string }).code !== "23505") throw error;
    favorited = true;
  }

  revalidatePath("/account");
  revalidatePath(`/vehicles/${vehicle_id}`);
  return { success: true, favorited };
}

// ---------- Documents ----------

export async function uploadDocument(formData: FormData): Promise<ActionResult> {
  const file = formData.get("file");
  if (!(file instanceof File)) return { error: "Choose a file to upload", field: "file" };

  const parsed = documentMetaSchema.safeParse({
    type: String(formData.get("type") ?? ""),
    mime: file.type,
    size: file.size,
  });
  if (!parsed.success) return firstIssue(parsed.error);

  const { supabase, user } = await requireUser();
  if (!user) return { error: "Not signed in" };

  const path = `${user.id}/${randomUUID()}.${extFromMime(parsed.data.mime)}`;
  const { error: upErr } = await supabase.storage
    .from(DOCUMENTS_BUCKET)
    .upload(path, file, { contentType: parsed.data.mime, upsert: false });
  if (upErr) return { error: `Upload failed: ${upErr.message}` };

  const { error: insErr } = await supabase.from("customer_documents").insert({
    customer_id: user.id,
    type: parsed.data.type,
    storage_path: path,
    url: path, // private bucket: served through signed URLs
  });
  if (insErr) {
    await supabase.storage.from(DOCUMENTS_BUCKET).remove([path]);
    throw insErr;
  }

  revalidatePath("/account");
  return { success: true };
}

export async function deleteDocument(formData: FormData): Promise<ActionResult> {
  const parsed = idSchema.safeParse({ id: String(formData.get("id") ?? "") });
  if (!parsed.success) return firstIssue(parsed.error);

  const { supabase, user } = await requireUser();
  if (!user) return { error: "Not signed in" };

  const { data: doc, error: fetchErr } = await supabase
    .from("customer_documents")
    .select("id, storage_path, verified")
    .eq("id", parsed.data.id)
    .eq("customer_id", user.id)
    .maybeSingle();
  if (fetchErr) throw fetchErr;
  if (!doc) return { error: "Document not found" };
  const d = doc as { id: string; storage_path: string; verified: boolean };
  if (d.verified) return { error: "Verified documents can't be removed. Contact us to replace it." };

  const { error: delErr } = await supabase.from("customer_documents").delete().eq("id", d.id);
  if (delErr) throw delErr;
  const { error: rmErr } = await supabase.storage.from(DOCUMENTS_BUCKET).remove([d.storage_path]);
  if (rmErr) console.error("Orphaned document object", { path: d.storage_path, rmErr });

  revalidatePath("/account");
  return { success: true };
}

// ---------- Notifications ----------

export async function markNotificationRead(formData: FormData): Promise<ActionResult> {
  const parsed = idSchema.safeParse({ id: String(formData.get("id") ?? "") });
  if (!parsed.success) return firstIssue(parsed.error);

  const { supabase, user } = await requireUser();
  if (!user) return { error: "Not signed in" };

  const { error } = await supabase
    .from("notifications")
    .update({ is_read: true })
    .eq("id", parsed.data.id)
    .eq("user_id", user.id);
  if (error) throw error;

  revalidatePath("/account");
  return { success: true };
}

export async function markAllNotificationsRead(): Promise<ActionResult> {
  const { supabase, user } = await requireUser();
  if (!user) return { error: "Not signed in" };

  const { error } = await supabase
    .from("notifications")
    .update({ is_read: true })
    .eq("user_id", user.id)
    .eq("is_read", false);
  if (error) throw error;

  revalidatePath("/account");
  return { success: true };
}
