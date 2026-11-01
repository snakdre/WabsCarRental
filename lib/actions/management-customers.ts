"use server";

import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import {
  setCustomerFlagSchema,
  setCustomerActiveSchema,
  customerNotesSchema,
  verifyDocumentSchema,
} from "@/lib/validators/management-customers";

type ActionResult = { success?: true; error?: string; field?: string };

function firstIssue(err: { issues: { message: string; path: PropertyKey[] }[] }): ActionResult {
  const i = err.issues[0];
  return { error: i.message, field: i.path.map(String).join(".") };
}

async function requireStaff() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return { supabase, user: null, error: "Not signed in" as const };
  const { data: role } = await supabase.from("roles").select("role").eq("user_id", user.id).maybeSingle();
  const r = (role as { role?: string } | null)?.role;
  if (r !== "manager" && r !== "admin") return { supabase, user: null, error: "Not authorized" as const };
  return { supabase, user, error: null };
}

type Supa = Awaited<ReturnType<typeof createClient>>;

async function audit(supabase: Supa, actorId: string, action: string, entityType: string, entityId: string, diff: unknown) {
  const { error } = await supabase.from("audit_logs").insert({
    actor_id: actorId, action, entity_type: entityType, entity_id: entityId, diff,
  });
  // Audit failures shouldn't roll back the user-visible change, but must be loud.
  if (error) console.error("audit_logs insert failed", { action, entityId, error });
}

function revalidateCustomer(id: string) {
  revalidatePath("/management/customers");
  revalidatePath(`/management/customers/${id}`);
}

export async function setCustomerFlag(formData: FormData): Promise<ActionResult> {
  const parsed = setCustomerFlagSchema.safeParse({
    customer_id: String(formData.get("customer_id") ?? ""),
    flagged: String(formData.get("flagged") ?? ""),
  });
  if (!parsed.success) return firstIssue(parsed.error);
  const { supabase, user, error } = await requireStaff();
  if (!user) return { error: error! };

  const { customer_id, flagged } = parsed.data;
  const { error: updErr } = await supabase
    .from("profiles")
    .update({ flagged, updated_at: new Date().toISOString() })
    .eq("id", customer_id);
  if (updErr) throw updErr;

  await audit(supabase, user.id, flagged ? "customer.flag" : "customer.unflag", "customer", customer_id, { flagged });
  revalidateCustomer(customer_id);
  return { success: true };
}

export async function setCustomerActive(formData: FormData): Promise<ActionResult> {
  const parsed = setCustomerActiveSchema.safeParse({
    customer_id: String(formData.get("customer_id") ?? ""),
    is_active: String(formData.get("is_active") ?? ""),
  });
  if (!parsed.success) return firstIssue(parsed.error);
  const { supabase, user, error } = await requireStaff();
  if (!user) return { error: error! };

  const { customer_id, is_active } = parsed.data;
  const { error: updErr } = await supabase
    .from("profiles")
    .update({ is_active, updated_at: new Date().toISOString() })
    .eq("id", customer_id);
  if (updErr) throw updErr;

  await audit(supabase, user.id, is_active ? "customer.activate" : "customer.deactivate", "customer", customer_id, { is_active });
  revalidateCustomer(customer_id);
  return { success: true };
}

export async function updateCustomerNotes(formData: FormData): Promise<ActionResult> {
  const parsed = customerNotesSchema.safeParse({
    customer_id: String(formData.get("customer_id") ?? ""),
    notes: String(formData.get("notes") ?? ""),
  });
  if (!parsed.success) return firstIssue(parsed.error);
  const { supabase, user, error } = await requireStaff();
  if (!user) return { error: error! };

  const { customer_id, notes } = parsed.data;
  const { error: updErr } = await supabase
    .from("profiles")
    .update({ internal_notes: notes, updated_at: new Date().toISOString() })
    .eq("id", customer_id);
  if (updErr) throw updErr;

  await audit(supabase, user.id, "customer.notes", "customer", customer_id, { length: notes.length });
  revalidatePath(`/management/customers/${customer_id}`);
  return { success: true };
}

export async function setDocumentVerified(formData: FormData): Promise<ActionResult> {
  const parsed = verifyDocumentSchema.safeParse({
    document_id: String(formData.get("document_id") ?? ""),
    verified: String(formData.get("verified") ?? ""),
  });
  if (!parsed.success) return firstIssue(parsed.error);
  const { supabase, user, error } = await requireStaff();
  if (!user) return { error: error! };

  const { document_id, verified } = parsed.data;
  const { data: doc, error: fetchErr } = await supabase
    .from("customer_documents")
    .select("id, customer_id, type")
    .eq("id", document_id)
    .maybeSingle();
  if (fetchErr) throw fetchErr;
  if (!doc) return { error: "Document not found" };
  const d = doc as { id: string; customer_id: string; type: string };

  const { error: updErr } = await supabase
    .from("customer_documents")
    .update({ verified })
    .eq("id", document_id);
  if (updErr) throw updErr;

  if (verified) {
    const { error: nErr } = await supabase.from("notifications").insert({
      user_id: d.customer_id,
      type: "document_verified",
      title: "Document verified",
      body: "One of your uploaded documents has been verified by our team.",
    });
    if (nErr) console.error("notification insert failed", { document_id, nErr });
  }

  await audit(supabase, user.id, verified ? "document.verify" : "document.unverify", "customer_document", document_id, { verified });
  revalidateCustomer(d.customer_id);
  return { success: true };
}
