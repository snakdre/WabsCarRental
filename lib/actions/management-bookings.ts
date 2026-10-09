"use server";

import { revalidatePath, revalidateTag } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import { canTransition, STATUS_LABEL, isBookingStatus, type BookingStatus } from "@/lib/booking-status";
import { transitionSchema, notesSchema } from "@/lib/validators/management-bookings";

type ActionResult = { success?: true; warning?: string; error?: string; field?: string };

export async function transitionBookingStatus(formData: FormData): Promise<ActionResult> {
  const raw = {
    booking_id: String(formData.get("booking_id") ?? ""),
    next_status: String(formData.get("next_status") ?? ""),
    note: (formData.get("note") as string | null) || null,
  };

  const parsed = transitionSchema.safeParse(raw);
  if (!parsed.success) {
    const first = parsed.error.issues[0];
    return { error: first.message, field: first.path.join(".") };
  }
  const { booking_id, next_status, note } = parsed.data;

  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return { error: "Not signed in" };

  const { data: current, error: fetchErr } = await supabase
    .from("bookings")
    .select("id, status")
    .eq("id", booking_id)
    .maybeSingle();
  if (fetchErr) throw fetchErr;
  if (!current) return { error: "Booking not found" };
  if (!isBookingStatus(current.status)) return { error: `Unrecognized current status: ${current.status}` };

  const from = current.status as BookingStatus;
  if (!canTransition(from, next_status)) {
    return { error: `Cannot transition from ${STATUS_LABEL[from]} to ${STATUS_LABEL[next_status]}.` };
  }

  // TODO(plan-5-refunds): when the refunds workflow lands, replace this note-only
  // path with an actual refunds row + Stripe refund API call.
  if (next_status === "refunded" && (!note || !note.trim())) {
    return { error: "Refunds require a note.", field: "note" };
  }

  const { error: updErr } = await supabase
    .from("bookings")
    .update({ status: next_status, updated_at: new Date().toISOString() })
    .eq("id", booking_id);
  if (updErr) throw updErr;

  const { error: histErr } = await supabase
    .from("booking_status_history")
    .insert({
      booking_id,
      status: next_status,
      changed_by: user.id,
      note: note ?? null,
    });
  if (histErr) throw histErr;

  let warning: string | undefined;
  if (next_status === "cancelled" || next_status === "rejected") {
    // DELETE availability rows created by this booking (regardless of pickup date —
    // even a booking cancelled mid-active still needs its future availability freed,
    // and the exclusion constraint uses inclusive date ranges).
    const { error: delErr } = await supabase
      .from("vehicle_availability")
      .delete()
      .eq("reference_id", booking_id)
      .eq("type", "booking");
    if (delErr) {
      console.error("Failed to release availability after cancel/reject", { booking_id, delErr });
      warning = "Status updated but the vehicle's dates could not be released automatically. Contact an admin.";
    }
  }

  revalidateTag("vehicles");
  revalidatePath("/management/bookings");
  revalidatePath(`/management/bookings/${booking_id}`);
  return warning ? { success: true, warning } : { success: true };
}

export async function updateBookingNotes(formData: FormData): Promise<ActionResult> {
  const raw = {
    booking_id: String(formData.get("booking_id") ?? ""),
    notes: String(formData.get("notes") ?? ""),
  };

  const parsed = notesSchema.safeParse(raw);
  if (!parsed.success) {
    const first = parsed.error.issues[0];
    return { error: first.message, field: first.path.join(".") };
  }
  const { booking_id, notes } = parsed.data;

  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return { error: "Not signed in" };

  const { error: updErr } = await supabase
    .from("bookings")
    .update({ internal_notes: notes, updated_at: new Date().toISOString() })
    .eq("id", booking_id);
  if (updErr) throw updErr;

  revalidatePath(`/management/bookings/${booking_id}`);
  return { success: true };
}
