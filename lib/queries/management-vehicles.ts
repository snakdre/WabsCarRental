import { createClient } from "@/lib/supabase/server";

export type ManagementVehicleListItem = {
  id: string;
  make: string;
  model: string;
  trim: string | null;
  year: number;
  category: string;
  status: string;
  daily_price: number;
  is_featured: boolean;
  cover_url: string | null;
};

export type ManagementVehicleDetail = {
  id: string;
  make: string;
  model: string;
  trim: string | null;
  year: number;
  category: string;
  status: string;
  is_featured: boolean;
  daily_price: number;
  weekly_price: number | null;
  monthly_price: number | null;
  description: string | null;
};

type ImageJoin = { url: string }[] | null;

type VehicleRow = {
  id: string;
  make: string;
  model: string;
  trim: string | null;
  year: number;
  category: string;
  status: string;
  daily_price: number;
  is_featured: boolean;
  vehicle_images: ImageJoin;
};

export async function listAllVehicles(): Promise<ManagementVehicleListItem[]> {
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("vehicles")
    .select(`
      id, make, model, trim, year, category, status, daily_price, is_featured,
      vehicle_images ( url )
    `)
    .eq("vehicle_images.is_cover", true)
    .order("is_featured", { ascending: false })
    .order("created_at", { ascending: false });

  if (error) throw error;

  return ((data ?? []) as unknown as VehicleRow[]).map((r) => ({
    id: r.id,
    make: r.make,
    model: r.model,
    trim: r.trim,
    year: r.year,
    category: r.category,
    status: r.status,
    daily_price: Number(r.daily_price),
    is_featured: r.is_featured,
    cover_url: r.vehicle_images?.[0]?.url ?? null,
  }));
}

export async function getManagementVehicleById(id: string): Promise<ManagementVehicleDetail | null> {
  if (!/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(id)) return null;

  const supabase = await createClient();
  const { data, error } = await supabase
    .from("vehicles")
    .select("id, make, model, trim, year, category, status, is_featured, daily_price, weekly_price, monthly_price, description")
    .eq("id", id)
    .maybeSingle();

  if (error) throw error;
  if (!data) return null;

  const v = data as unknown as ManagementVehicleDetail;
  return {
    id: v.id,
    make: v.make,
    model: v.model,
    trim: v.trim,
    year: v.year,
    category: v.category,
    status: v.status,
    is_featured: v.is_featured,
    daily_price: Number(v.daily_price),
    weekly_price: v.weekly_price !== null ? Number(v.weekly_price) : null,
    monthly_price: v.monthly_price !== null ? Number(v.monthly_price) : null,
    description: v.description,
  };
}
