import { createClient } from "@/lib/supabase/server";
import { getCurrentUser } from "@/lib/utils/session";
import { uuidLike } from "@/lib/validators/shared";

export type ProfileAddress = { line1?: string | null; city?: string | null; state?: string | null; zip?: string | null };

export type MyProfile = {
  id: string;
  email: string;
  first_name: string | null;
  last_name: string | null;
  phone: string | null;
  date_of_birth: string | null;
  address: ProfileAddress | null;
};

export async function getMyProfile(): Promise<MyProfile | null> {
  const user = await getCurrentUser();
  if (!user) return null;
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("profiles")
    .select("id, first_name, last_name, phone, date_of_birth, address")
    .eq("id", user.id)
    .maybeSingle();
  if (error) throw error;
  const p = (data ?? { id: user.id }) as Partial<MyProfile>;
  return {
    id: user.id,
    email: user.email ?? "",
    first_name: p.first_name ?? null,
    last_name: p.last_name ?? null,
    phone: p.phone ?? null,
    date_of_birth: p.date_of_birth ?? null,
    address: (p.address as ProfileAddress | null) ?? null,
  };
}

export type MyBookingDetail = {
  id: string;
  reference: string;
  status: string;
  pickup_date: string;
  return_date: string;
  pickup_method: string;
  rental_days: number;
  base_price: number;
  delivery_fee: number;
  tax_amount: number;
  protection_fee: number;
  extras_fee: number;
  discount_amount: number;
  deposit_amount: number;
  total_amount: number;
  driver_name: string;
  driver_email: string;
  driver_phone: string;
  special_requests: string | null;
  created_at: string;
  vehicle: { id: string; year: number; make: string; model: string; cover_url: string | null } | null;
  location: { name: string | null; address: string | null; city: string | null; state: string | null } | null;
  extras: { name: string; quantity: number; unit_price: number }[];
  history: { status: string; note: string | null; created_at: string }[];
};

// internal_notes is deliberately NOT selected: it is staff-only.
export async function getMyBookingDetail(id: string): Promise<MyBookingDetail | null> {
  if (!uuidLike.safeParse(id).success) return null;
  const user = await getCurrentUser();
  if (!user) return null;
  const supabase = await createClient();

  const [bookingRes, historyRes, extrasRes] = await Promise.all([
    supabase
      .from("bookings")
      .select(`
        id, reference, status, pickup_date, return_date, pickup_method, rental_days,
        base_price, delivery_fee, tax_amount, protection_fee, extras_fee, discount_amount,
        deposit_amount, total_amount, driver_name, driver_email, driver_phone,
        special_requests, created_at,
        vehicles ( id, year, make, model, vehicle_images ( url, is_cover ) ),
        vehicle_locations ( name, address, city, state )
      `)
      .eq("id", id)
      .eq("customer_id", user.id)
      .maybeSingle(),
    supabase
      .from("booking_status_history")
      .select("status, note, created_at")
      .eq("booking_id", id)
      .order("created_at", { ascending: true }),
    supabase
      .from("booking_extras")
      .select("quantity, unit_price, extras ( name )")
      .eq("booking_id", id),
  ]);
  if (bookingRes.error) throw bookingRes.error;
  if (historyRes.error) throw historyRes.error;
  if (extrasRes.error) throw extrasRes.error;
  if (!bookingRes.data) return null;

  type Row = Omit<MyBookingDetail, "vehicle" | "location" | "extras" | "history"> & {
    vehicles: { id: string; year: number; make: string; model: string; vehicle_images: { url: string; is_cover: boolean }[] | null } | null;
    vehicle_locations: MyBookingDetail["location"];
  };
  const b = bookingRes.data as unknown as Row;
  const imgs = b.vehicles?.vehicle_images ?? [];
  const cover = imgs.find(i => i.is_cover) ?? imgs[0] ?? null;
  const num = (v: unknown) => Number(v ?? 0);

  return {
    id: b.id,
    reference: b.reference,
    status: b.status,
    pickup_date: b.pickup_date,
    return_date: b.return_date,
    pickup_method: b.pickup_method,
    rental_days: b.rental_days,
    base_price: num(b.base_price),
    delivery_fee: num(b.delivery_fee),
    tax_amount: num(b.tax_amount),
    protection_fee: num(b.protection_fee),
    extras_fee: num(b.extras_fee),
    discount_amount: num(b.discount_amount),
    deposit_amount: num(b.deposit_amount),
    total_amount: num(b.total_amount),
    driver_name: b.driver_name,
    driver_email: b.driver_email,
    driver_phone: b.driver_phone,
    special_requests: b.special_requests,
    created_at: b.created_at,
    vehicle: b.vehicles
      ? { id: b.vehicles.id, year: b.vehicles.year, make: b.vehicles.make, model: b.vehicles.model, cover_url: cover?.url ?? null }
      : null,
    location: b.vehicle_locations ?? null,
    extras: ((extrasRes.data ?? []) as unknown as { quantity: number; unit_price: number; extras: { name: string } | null }[]).map(e => ({
      name: e.extras?.name ?? "Extra",
      quantity: e.quantity,
      unit_price: num(e.unit_price),
    })),
    history: (historyRes.data ?? []) as MyBookingDetail["history"],
  };
}

export type FavoriteVehicle = {
  vehicle_id: string;
  make: string;
  model: string;
  year: number;
  category: string;
  daily_price: number;
  cover_url: string | null;
};

export async function listMyFavorites(): Promise<FavoriteVehicle[]> {
  const user = await getCurrentUser();
  if (!user) return [];
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("favorites")
    .select("vehicle_id, created_at, vehicles ( make, model, year, category, daily_price, vehicle_images ( url, is_cover ) )")
    .eq("customer_id", user.id)
    .order("created_at", { ascending: false });
  if (error) throw error;
  type Row = {
    vehicle_id: string;
    vehicles: { make: string; model: string; year: number; category: string; daily_price: number; vehicle_images: { url: string; is_cover: boolean }[] | null } | null;
  };
  return ((data ?? []) as unknown as Row[])
    .filter(r => r.vehicles) // RLS hides draft/inactive vehicles from customers
    .map(r => {
      const v = r.vehicles!;
      const imgs = v.vehicle_images ?? [];
      const cover = imgs.find(i => i.is_cover) ?? imgs[0] ?? null;
      return {
        vehicle_id: r.vehicle_id,
        make: v.make, model: v.model, year: v.year, category: v.category,
        daily_price: Number(v.daily_price), cover_url: cover?.url ?? null,
      };
    });
}

export async function isFavorite(vehicleId: string): Promise<boolean> {
  const user = await getCurrentUser();
  if (!user || !uuidLike.safeParse(vehicleId).success) return false;
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("favorites")
    .select("id")
    .eq("customer_id", user.id)
    .eq("vehicle_id", vehicleId)
    .maybeSingle();
  if (error) throw error;
  return !!data;
}

export type MyDocument = {
  id: string;
  type: string;
  storage_path: string;
  verified: boolean;
  uploaded_at: string;
  signed_url: string | null;
};

export { DOCUMENTS_BUCKET } from "@/lib/validators/account";
import { DOCUMENTS_BUCKET } from "@/lib/validators/account";

export async function listMyDocuments(): Promise<MyDocument[]> {
  const user = await getCurrentUser();
  if (!user) return [];
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("customer_documents")
    .select("id, type, storage_path, verified, uploaded_at")
    .eq("customer_id", user.id)
    .order("uploaded_at", { ascending: false });
  if (error) throw error;
  const rows = (data ?? []) as Omit<MyDocument, "signed_url">[];
  if (rows.length === 0) return [];
  const { data: signed } = await supabase.storage
    .from(DOCUMENTS_BUCKET)
    .createSignedUrls(rows.map(r => r.storage_path), 3600);
  const byPath = new Map((signed ?? []).map(s => [s.path, s.signedUrl]));
  return rows.map(r => ({ ...r, signed_url: byPath.get(r.storage_path) ?? null }));
}

export type MyNotification = {
  id: string;
  type: string;
  title: string;
  body: string | null;
  is_read: boolean;
  created_at: string;
};

export async function listMyNotifications(limit = 50): Promise<MyNotification[]> {
  const user = await getCurrentUser();
  if (!user) return [];
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("notifications")
    .select("id, type, title, body, is_read, created_at")
    .eq("user_id", user.id)
    .order("created_at", { ascending: false })
    .limit(limit);
  if (error) throw error;
  return (data ?? []) as MyNotification[];
}

export async function countMyUnreadNotifications(): Promise<number> {
  const user = await getCurrentUser();
  if (!user) return 0;
  const supabase = await createClient();
  const { count, error } = await supabase
    .from("notifications")
    .select("id", { count: "exact", head: true })
    .eq("user_id", user.id)
    .eq("is_read", false);
  if (error) throw error;
  return count ?? 0;
}
