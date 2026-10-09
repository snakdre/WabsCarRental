"use server";

import { revalidatePath, revalidateTag } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import { getUserRole, isManagerOrAdmin } from "@/lib/utils/roles";
import { updateVehicleSchema } from "@/lib/validators/management-vehicles";

type ActionResult = { success?: true; error?: string; field?: string };

export async function updateVehicle(formData: FormData): Promise<ActionResult> {
  const vehicle_id = String(formData.get("vehicle_id") ?? "");
  const status = String(formData.get("status") ?? "");
  const is_featured = formData.get("is_featured") === "on";

  const dailyRaw = String(formData.get("daily_price") ?? "");
  const daily_price = Number(dailyRaw);

  const weeklyRaw = String(formData.get("weekly_price") ?? "");
  const weekly_price = weeklyRaw === "" || isNaN(Number(weeklyRaw)) ? null : Number(weeklyRaw);

  const monthlyRaw = String(formData.get("monthly_price") ?? "");
  const monthly_price = monthlyRaw === "" || isNaN(Number(monthlyRaw)) ? null : Number(monthlyRaw);

  const descRaw = String(formData.get("description") ?? "");
  const description = descRaw.trim() === "" ? null : descRaw;

  const parsed = updateVehicleSchema.safeParse({
    vehicle_id,
    status,
    is_featured,
    daily_price,
    weekly_price,
    monthly_price,
    description,
  });

  if (!parsed.success) {
    const first = parsed.error.issues[0];
    return { error: first.message, field: first.path.join(".") };
  }

  const role = await getUserRole();
  if (!isManagerOrAdmin(role)) return { error: "Forbidden" };

  const supabase = await createClient();
  const { error } = await supabase
    .from("vehicles")
    .update({
      status: parsed.data.status,
      is_featured: parsed.data.is_featured,
      daily_price: parsed.data.daily_price,
      weekly_price: parsed.data.weekly_price,
      monthly_price: parsed.data.monthly_price,
      description: parsed.data.description,
      updated_at: new Date().toISOString(),
    })
    .eq("id", parsed.data.vehicle_id);
  if (error) throw error;

  revalidateTag("vehicles");
  revalidatePath("/management/vehicles");
  revalidatePath(`/management/vehicles/${parsed.data.vehicle_id}`);
  return { success: true };
}
