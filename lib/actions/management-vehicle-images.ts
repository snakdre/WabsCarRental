"use server";

import { revalidatePath, revalidateTag } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import { getUserRole, isManagerOrAdmin } from "@/lib/utils/roles";
import {
  VEHICLE_IMAGES_BUCKET,
  MAX_IMAGES_PER_VEHICLE,
  registerImageSchema,
  imageAltSchema,
  imageIdSchema,
  reorderImagesSchema,
  vehicleIdSchema,
} from "@/lib/validators/management-vehicles";

type ActionResult = { success?: true; error?: string; field?: string };

function firstIssue(err: { issues: { message: string; path: PropertyKey[] }[] }): ActionResult {
  const i = err.issues[0];
  return { error: i.message, field: i.path.map(String).join(".") };
}

function revalidateVehicle(vehicleId: string) {
  revalidateTag("vehicles");
  revalidatePath("/management/vehicles");
  revalidatePath(`/management/vehicles/${vehicleId}`);
  revalidatePath(`/vehicles/${vehicleId}`);
}

// The browser uploads the object directly to Storage (staff-only storage RLS),
// then calls this to record it. We verify the object exists before inserting.
export async function registerVehicleImage(formData: FormData): Promise<ActionResult & { image_id?: string }> {
  if (!isManagerOrAdmin(await getUserRole())) return { error: "Forbidden" };

  const parsed = registerImageSchema.safeParse({
    vehicle_id: String(formData.get("vehicle_id") ?? ""),
    storage_path: String(formData.get("storage_path") ?? ""),
    alt_text: String(formData.get("alt_text") ?? ""),
  });
  if (!parsed.success) return firstIssue(parsed.error);
  const { vehicle_id, storage_path, alt_text } = parsed.data;

  const supabase = await createClient();

  const { data: existing, error: listErr } = await supabase
    .from("vehicle_images")
    .select("id, is_cover, sort_order")
    .eq("vehicle_id", vehicle_id);
  if (listErr) throw listErr;
  const rows = (existing ?? []) as { id: string; is_cover: boolean; sort_order: number }[];
  if (rows.length >= MAX_IMAGES_PER_VEHICLE) {
    return { error: `A vehicle can have at most ${MAX_IMAGES_PER_VEHICLE} images` };
  }

  const [folder, file] = storage_path.split("/");
  const { data: found, error: findErr } = await supabase.storage
    .from(VEHICLE_IMAGES_BUCKET)
    .list(folder, { search: file, limit: 1 });
  if (findErr) throw findErr;
  if (!found || !found.some(o => o.name === file)) return { error: "Uploaded file not found in storage" };

  const { data: pub } = supabase.storage.from(VEHICLE_IMAGES_BUCKET).getPublicUrl(storage_path);
  const nextOrder = rows.reduce((m, r) => Math.max(m, r.sort_order), -1) + 1;

  const { data: inserted, error: insErr } = await supabase
    .from("vehicle_images")
    .insert({
      vehicle_id,
      storage_path,
      url: pub.publicUrl,
      alt_text,
      sort_order: nextOrder,
      is_cover: !rows.some(r => r.is_cover), // first image becomes the cover
    })
    .select("id")
    .maybeSingle();
  if (insErr) throw insErr;

  revalidateVehicle(vehicle_id);
  return { success: true, image_id: (inserted as { id: string } | null)?.id };
}

export async function updateImageAlt(formData: FormData): Promise<ActionResult> {
  if (!isManagerOrAdmin(await getUserRole())) return { error: "Forbidden" };
  const parsed = imageAltSchema.safeParse({
    image_id: String(formData.get("image_id") ?? ""),
    alt_text: String(formData.get("alt_text") ?? ""),
  });
  if (!parsed.success) return firstIssue(parsed.error);

  const supabase = await createClient();
  const { data, error } = await supabase
    .from("vehicle_images")
    .update({ alt_text: parsed.data.alt_text })
    .eq("id", parsed.data.image_id)
    .select("vehicle_id")
    .maybeSingle();
  if (error) throw error;
  if (!data) return { error: "Image not found" };

  revalidateVehicle((data as { vehicle_id: string }).vehicle_id);
  return { success: true };
}

export async function setCoverImage(formData: FormData): Promise<ActionResult> {
  if (!isManagerOrAdmin(await getUserRole())) return { error: "Forbidden" };
  const parsed = imageIdSchema.safeParse({ image_id: String(formData.get("image_id") ?? "") });
  if (!parsed.success) return firstIssue(parsed.error);
  const vehicle_id = String(formData.get("vehicle_id") ?? "");

  const supabase = await createClient();
  const { error } = await supabase.rpc("set_vehicle_cover", { p_image_id: parsed.data.image_id });
  if (error) {
    if (error.message?.includes("not found")) return { error: "Image not found" };
    throw error;
  }

  if (vehicle_id) revalidateVehicle(vehicle_id);
  return { success: true };
}

export async function reorderVehicleImages(vehicleId: string, imageIds: string[]): Promise<ActionResult> {
  if (!isManagerOrAdmin(await getUserRole())) return { error: "Forbidden" };
  const parsed = reorderImagesSchema.safeParse({ vehicle_id: vehicleId, image_ids: imageIds });
  if (!parsed.success) return firstIssue(parsed.error);

  const supabase = await createClient();
  const { error } = await supabase.rpc("reorder_vehicle_images", {
    p_vehicle_id: parsed.data.vehicle_id,
    p_image_ids: parsed.data.image_ids,
  });
  if (error) {
    if (error.message?.includes("does not match")) return { error: "Images changed since the page loaded. Refresh and try again." };
    throw error;
  }

  revalidateVehicle(parsed.data.vehicle_id);
  return { success: true };
}

export async function deleteVehicleImage(formData: FormData): Promise<ActionResult> {
  if (!isManagerOrAdmin(await getUserRole())) return { error: "Forbidden" };
  const parsed = imageIdSchema.safeParse({ image_id: String(formData.get("image_id") ?? "") });
  if (!parsed.success) return firstIssue(parsed.error);

  const supabase = await createClient();
  const { data: img, error: fetchErr } = await supabase
    .from("vehicle_images")
    .select("id, vehicle_id, storage_path, is_cover")
    .eq("id", parsed.data.image_id)
    .maybeSingle();
  if (fetchErr) throw fetchErr;
  if (!img) return { error: "Image not found" };
  const image = img as { id: string; vehicle_id: string; storage_path: string; is_cover: boolean };

  const { error: delErr } = await supabase.from("vehicle_images").delete().eq("id", image.id);
  if (delErr) throw delErr;

  // Promote the next image to cover so the vehicle keeps a thumbnail.
  if (image.is_cover) {
    const { data: next } = await supabase
      .from("vehicle_images")
      .select("id")
      .eq("vehicle_id", image.vehicle_id)
      .order("sort_order", { ascending: true })
      .limit(1)
      .maybeSingle();
    if (next) {
      const { error: coverErr } = await supabase.rpc("set_vehicle_cover", { p_image_id: (next as { id: string }).id });
      if (coverErr) console.error("Failed to promote new cover", { vehicle_id: image.vehicle_id, coverErr });
    }
  }

  // Only remove the storage object if this was the last row pointing at it
  // (duplicated vehicles share objects) and it lives in our bucket.
  if (!image.storage_path.startsWith("unsplash/")) {
    const { data: refs, error: refErr } = await supabase
      .from("vehicle_images")
      .select("id")
      .eq("storage_path", image.storage_path)
      .limit(1);
    if (refErr) throw refErr;
    if (!refs || refs.length === 0) {
      const { error: rmErr } = await supabase.storage.from(VEHICLE_IMAGES_BUCKET).remove([image.storage_path]);
      if (rmErr) console.error("Orphaned vehicle image object", { path: image.storage_path, rmErr });
    }
  }

  revalidateVehicle(image.vehicle_id);
  return { success: true };
}

export async function duplicateVehicle(formData: FormData): Promise<ActionResult & { vehicle_id?: string }> {
  if (!isManagerOrAdmin(await getUserRole())) return { error: "Forbidden" };
  const parsed = vehicleIdSchema.safeParse({ vehicle_id: String(formData.get("vehicle_id") ?? "") });
  if (!parsed.success) return firstIssue(parsed.error);

  const supabase = await createClient();
  const { data, error } = await supabase.rpc("duplicate_vehicle", { p_vehicle_id: parsed.data.vehicle_id });
  if (error) {
    if (error.message?.includes("not found")) return { error: "Vehicle not found" };
    throw error;
  }

  revalidatePath("/management/vehicles");
  return { success: true, vehicle_id: data as string };
}
