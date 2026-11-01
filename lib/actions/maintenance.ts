"use server";

import { revalidatePath, revalidateTag } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import { getUserRole, isManagerOrAdmin } from "@/lib/utils/roles";
import { createMaintenanceSchema, maintenanceStatusSchema } from "@/lib/validators/maintenance";

type ActionResult = { success?: true; error?: string; field?: string };

function firstIssue(err: { issues: { message: string; path: PropertyKey[] }[] }): ActionResult {
  const i = err.issues[0];
  return { error: i.message, field: i.path.map(String).join(".") };
}

const s = (fd: FormData, k: string) => String(fd.get(k) ?? "");

function revalidateMaintenance(vehicleId?: string) {
  revalidateTag("vehicles");
  revalidatePath("/management/maintenance");
  revalidatePath("/management/calendar");
  revalidatePath("/management/vehicles");
  revalidatePath("/management");
  if (vehicleId) revalidatePath(`/management/vehicles/${vehicleId}`);
}

export async function createMaintenance(formData: FormData): Promise<ActionResult & { id?: string }> {
  if (!isManagerOrAdmin(await getUserRole())) return { error: "Forbidden" };
  const parsed = createMaintenanceSchema.safeParse({
    vehicle_id: s(formData, "vehicle_id"),
    category: s(formData, "category"),
    service_date: s(formData, "service_date"),
    return_date: s(formData, "return_date"),
    description: s(formData, "description"),
    vendor: s(formData, "vendor"),
    cost: s(formData, "cost"),
    odometer: s(formData, "odometer"),
  });
  if (!parsed.success) return firstIssue(parsed.error);
  const d = parsed.data;

  const supabase = await createClient();
  const { data, error } = await supabase.rpc("staff_create_maintenance", {
    p_vehicle_id: d.vehicle_id,
    p_category: d.category,
    p_service_date: d.service_date,
    p_return_date: d.return_date,
    p_description: d.description,
    p_vendor: d.vendor,
    p_cost: d.cost,
    p_odometer: d.odometer,
  });
  if (error) {
    if (error.code === "23P01") {
      return { error: "Those dates overlap a booking or another maintenance window for this vehicle.", field: "service_date" };
    }
    if (error.code === "42501") return { error: "Not authorized" };
    if (error.message?.includes("Return date")) return { error: error.message, field: "return_date" };
    throw error;
  }

  revalidateMaintenance(d.vehicle_id);
  return { success: true, id: data as string };
}

export async function setMaintenanceStatus(formData: FormData): Promise<ActionResult> {
  if (!isManagerOrAdmin(await getUserRole())) return { error: "Forbidden" };
  const parsed = maintenanceStatusSchema.safeParse({
    id: s(formData, "id"),
    status: s(formData, "status"),
    cost: s(formData, "cost"),
    odometer: s(formData, "odometer"),
  });
  if (!parsed.success) return firstIssue(parsed.error);

  const supabase = await createClient();
  const { error } = await supabase.rpc("staff_set_maintenance_status", {
    p_id: parsed.data.id,
    p_status: parsed.data.status,
    p_cost: parsed.data.cost,
    p_odometer: parsed.data.odometer,
  });
  if (error) {
    if (/not found|Cannot move/i.test(error.message ?? "")) return { error: error.message };
    if (error.code === "42501") return { error: "Not authorized" };
    throw error;
  }

  revalidateMaintenance(s(formData, "vehicle_id") || undefined);
  return { success: true };
}
