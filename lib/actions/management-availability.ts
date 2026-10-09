"use server";

import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import { getUserRole, isManagerOrAdmin } from "@/lib/utils/roles";
import { createAvailabilityBlockSchema } from "@/lib/validators/management-availability";

type ActionResult = { success?: true; error?: string; field?: string };

export async function createAvailabilityBlock(formData: FormData): Promise<ActionResult> {
  const role = await getUserRole();
  if (!isManagerOrAdmin(role)) return { error: "Forbidden" };

  const vehicle_id = String(formData.get("vehicle_id") ?? "");
  const type = String(formData.get("type") ?? "");
  const start_date = String(formData.get("start_date") ?? "");
  const end_date = String(formData.get("end_date") ?? "");
  const reasonRaw = String(formData.get("reason") ?? "").trim();
  const reason = reasonRaw === "" ? null : reasonRaw;

  const parsed = createAvailabilityBlockSchema.safeParse({
    vehicle_id,
    type,
    start_date,
    end_date,
    reason,
  });
  if (!parsed.success) {
    const first = parsed.error.issues[0];
    return { error: first.message, field: first.path.join(".") };
  }

  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { error: "Not signed in" };

  const { error } = await supabase.from("vehicle_availability").insert({
    vehicle_id: parsed.data.vehicle_id,
    start_date: parsed.data.start_date,
    end_date: parsed.data.end_date,
    type: parsed.data.type,
    reason: parsed.data.reason,
    created_by: user.id,
  });

  if (error) {
    // PostgreSQL exclusion-constraint violation.
    if (error.code === "23P01") {
      return { error: "Those dates overlap an existing booking or maintenance window." };
    }
    throw error;
  }

  revalidatePath("/management/calendar");
  revalidatePath("/vehicles"); // customer availability filter cache tag
  return { success: true };
}
