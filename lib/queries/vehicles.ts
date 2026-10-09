import { unstable_cache } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import { createPublicClient } from "@/lib/supabase/public";
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

const CARD_SELECT = `
  id, make, model, trim, year, category, daily_price, is_featured,
  vehicle_images ( url, alt_text )
`;

type NestedRow = {
  id: string;
  make: string;
  model: string;
  trim: string | null;
  year: number;
  category: string;
  daily_price: number;
  is_featured: boolean;
  vehicle_images: { url: string; alt_text: string | null }[] | null;
};

function mapRow(r: NestedRow): VehicleCardData {
  const cover = r.vehicle_images?.[0] ?? null;
  return {
    id: r.id,
    make: r.make,
    model: r.model,
    trim: r.trim,
    year: r.year,
    category: r.category,
    daily_price: r.daily_price,
    is_featured: r.is_featured,
    cover_url: cover?.url ?? null,
    cover_alt: cover?.alt_text ?? null,
  };
}

async function fetchFeatured(limit: number): Promise<VehicleCardData[]> {
  const supabase = createPublicClient();
  const { data, error } = await supabase
    .from("vehicles")
    .select(CARD_SELECT)
    .eq("status", "available")
    .eq("is_featured", true)
    .eq("vehicle_images.is_cover", true)
    .order("created_at", { ascending: false })
    .limit(limit);
  if (error) throw error;
  return (data ?? []).map((r) => mapRow(r as unknown as NestedRow));
}

export const getFeaturedVehicles = unstable_cache(
  fetchFeatured,
  ["featured-vehicles"],
  { revalidate: 60, tags: ["vehicles"] }
);

async function fetchList(params: BrowseParams): Promise<VehicleCardData[]> {
  const supabase = createPublicClient();
  let query = supabase
    .from("vehicles")
    .select(CARD_SELECT)
    .eq("status", "available")
    .eq("vehicle_images.is_cover", true);
  if (params.category) query = query.eq("category", params.category);
  if (params.sort === "price_asc") query = query.order("daily_price", { ascending: true });
  else if (params.sort === "price_desc") query = query.order("daily_price", { ascending: false });
  else query = query.order("is_featured", { ascending: false }).order("created_at", { ascending: false });
  const { data, error } = await query;
  if (error) throw error;
  const rows = (data ?? []).map((r) => mapRow(r as unknown as NestedRow));

  // Filter by date availability when both pickup and return are present.
  // A vehicle_availability row [start_date, end_date] overlaps the requested
  // range [pickup, return] iff start_date <= return AND end_date >= pickup.
  if (params.pickup && params.return) {
    const { data: blocked, error: blockedErr } = await supabase
      .from("vehicle_availability")
      .select("vehicle_id")
      .in("type", ["booking", "maintenance", "blocked"])
      .lte("start_date", params.return)
      .gte("end_date", params.pickup);
    if (blockedErr) throw blockedErr;
    const blockedSet = new Set((blocked ?? []).map((r: { vehicle_id: string }) => r.vehicle_id));
    return rows.filter((r) => !blockedSet.has(r.id));
  }

  return rows;
}

// unstable_cache serializes function arguments as part of the cache key, so
// distinct BrowseParams values (including pickup/return) produce distinct cache
// entries automatically. No manual key extension is needed.
export const listVehicles = unstable_cache(
  fetchList,
  ["list-vehicles"],
  { revalidate: 60, tags: ["vehicles"] }
);

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
