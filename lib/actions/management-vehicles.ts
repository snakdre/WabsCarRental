"use server";

import { revalidatePath, revalidateTag } from "next/cache";
import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { getUserRole, isManagerOrAdmin } from "@/lib/utils/roles";
import { updateVehicleSchema, createVehicleSchema } from "@/lib/validators/management-vehicles";

type ActionResult = { success?: true; error?: string; field?: string };

export async function updateVehicle(formData: FormData): Promise<ActionResult> {
  const role = await getUserRole();
  if (!isManagerOrAdmin(role)) return { error: "Forbidden" };

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

  const supabase = await createClient();
  const { data: updated, error } = await supabase
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
    .eq("id", parsed.data.vehicle_id)
    .select("id")
    .maybeSingle();
  if (error) throw error;
  if (!updated) return { error: "Vehicle not found" };

  revalidateTag("vehicles");
  revalidatePath("/management/vehicles");
  revalidatePath(`/management/vehicles/${parsed.data.vehicle_id}`);
  return { success: true };
}

export async function createVehicle(formData: FormData): Promise<ActionResult> {
  const role = await getUserRole();
  if (!isManagerOrAdmin(role)) return { error: "Forbidden" };

  const makeRaw = String(formData.get("make") ?? "").trim();
  const modelRaw = String(formData.get("model") ?? "").trim();
  const trimRaw = String(formData.get("trim") ?? "").trim();
  const trim = trimRaw === "" ? null : trimRaw;
  const yearRaw = String(formData.get("year") ?? "");
  const year = Number(yearRaw);
  const category = String(formData.get("category") ?? "");
  const dailyRaw = String(formData.get("daily_price") ?? "");
  const daily_price = Number(dailyRaw);
  const descRaw = String(formData.get("description") ?? "").trim();
  const description = descRaw === "" ? null : descRaw;

  const parsed = createVehicleSchema.safeParse({
    make: makeRaw,
    model: modelRaw,
    trim,
    year,
    category,
    daily_price,
    description,
  });
  if (!parsed.success) {
    const first = parsed.error.issues[0];
    return { error: first.message, field: first.path.join(".") };
  }

  const supabase = await createClient();
  const { data: inserted, error } = await supabase
    .from("vehicles")
    .insert({
      make: parsed.data.make,
      model: parsed.data.model,
      trim: parsed.data.trim,
      year: parsed.data.year,
      category: parsed.data.category,
      daily_price: parsed.data.daily_price,
      description: parsed.data.description,
    })
    .select("id")
    .maybeSingle();
  if (error) throw error;
  if (!inserted) return { error: "Insert returned no row" };

  revalidateTag("vehicles");
  revalidatePath("/management/vehicles");
  redirect(`/management/vehicles/${inserted.id}`);
}
