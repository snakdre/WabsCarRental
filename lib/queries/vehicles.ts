import { createClient } from "@/lib/supabase/server";
import type { BrowseParams } from "@/lib/validators/browse";

export type VehicleCardData = {
  id: string;
  make: string;
  model: string;
  trim: string | null;
  year: number;
  category: string;
  daily_price: number;
  is_featured: boolean;
  cover_url: string | null;
  cover_alt: string | null;
};

export type VehicleDetail = {
  vehicle: {
    id: string;
    make: string;
    model: string;
    trim: string | null;
    year: number;
    category: string;
    exterior_color: string | null;
    interior_color: string | null;
    seats: number | null;
    doors: number | null;
    transmission: string | null;
    fuel_type: string | null;
    horsepower: number | null;
    drivetrain: string | null;
    description: string | null;
    daily_price: number;
    weekly_price: number | null;
    monthly_price: number | null;
    deposit_amount: number | null;
    mileage_limit: number | null;
    min_rental_days: number;
    cancellation_policy: string | null;
    rental_requirements: string | null;
    status: string;
  };
  images: { url: string; alt_text: string | null; sort_order: number }[];
  features: string[];
  location: {
    name: string | null;
    address: string | null;
    city: string | null;
    state: string | null;
    zip: string | null;
    delivery_available: boolean;
    delivery_fee: number;
  } | null;
};

const CARD_COLUMNS = "id, make, model, trim, year, category, daily_price, is_featured";

type CardRow = Omit<VehicleCardData, "cover_url" | "cover_alt">;
type CoverRow = { vehicle_id: string; url: string; alt_text: string | null };

async function attachCovers(rows: CardRow[]): Promise<VehicleCardData[]> {
  if (rows.length === 0) return [];
  const supabase = await createClient();
  const ids = rows.map((r) => r.id);
  const { data: covers, error } = await supabase
    .from("vehicle_images")
    .select("vehicle_id, url, alt_text")
    .in("vehicle_id", ids)
    .eq("is_cover", true);
  if (error) throw error;
  const byId = new Map<string, { url: string; alt_text: string | null }>();
  (covers ?? []).forEach((c: CoverRow) => byId.set(c.vehicle_id, { url: c.url, alt_text: c.alt_text }));
  return rows.map((r) => ({
    ...r,
    cover_url: byId.get(r.id)?.url ?? null,
    cover_alt: byId.get(r.id)?.alt_text ?? null,
  }));
}

export async function getFeaturedVehicles(limit = 4): Promise<VehicleCardData[]> {
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("vehicles")
    .select(CARD_COLUMNS)
    .eq("status", "available")
    .eq("is_featured", true)
    .order("created_at", { ascending: false })
    .limit(limit);
  if (error) throw error;
  return attachCovers((data ?? []) as unknown as CardRow[]);
}

export async function listVehicles(params: BrowseParams): Promise<VehicleCardData[]> {
  const supabase = await createClient();
  let query = supabase.from("vehicles").select(CARD_COLUMNS).eq("status", "available");
  if (params.category) query = query.eq("category", params.category);
  if (params.sort === "price_asc") query = query.order("daily_price", { ascending: true });
  else if (params.sort === "price_desc") query = query.order("daily_price", { ascending: false });
  else query = query.order("is_featured", { ascending: false }).order("created_at", { ascending: false });
  const { data, error } = await query;
  if (error) throw error;
  return attachCovers((data ?? []) as unknown as CardRow[]);
}

export async function getVehicleById(id: string): Promise<VehicleDetail | null> {
  if (!/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(id)) {
    return null;
  }
  const supabase = await createClient();
  const [vehicleRes, imagesRes, featuresRes, locationsRes] = await Promise.all([
    supabase.from("vehicles").select("*").eq("id", id).maybeSingle(),
    supabase.from("vehicle_images").select("url, alt_text, sort_order").eq("vehicle_id", id).order("sort_order"),
    supabase.from("vehicle_features").select("feature").eq("vehicle_id", id),
    supabase.from("vehicle_locations").select("name, address, city, state, zip, delivery_available, delivery_fee").eq("vehicle_id", id).limit(1),
  ]);
  if (vehicleRes.error) throw vehicleRes.error;
  if (imagesRes.error) throw imagesRes.error;
  if (featuresRes.error) throw featuresRes.error;
  if (locationsRes.error) throw locationsRes.error;
  if (!vehicleRes.data) return null;
  const v = vehicleRes.data;
  if (v.status === "draft" || v.status === "inactive") return null;
  return {
    vehicle: v as VehicleDetail["vehicle"],
    images: imagesRes.data ?? [],
    features: (featuresRes.data ?? []).map((f: { feature: string }) => f.feature),
    location: locationsRes.data?.[0] ?? null,
  };
}
