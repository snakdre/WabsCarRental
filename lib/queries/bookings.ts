import { createClient } from "@/lib/supabase/server";
import { getCurrentUser } from "@/lib/utils/session";

export type BookingRow = {
  id: string;
  reference: string;
  customer_id: string;
  vehicle_id: string;
  pickup_date: string;
  return_date: string;
  pickup_method: string;
  status: string;
  total_amount: number;
  deposit_amount: number;
  rental_days: number;
  driver_name: string;
  created_at: string;
};

export type BookingListItem = BookingRow & {
  vehicle_make: string;
  vehicle_model: string;
  vehicle_year: number;
};

export async function getBookingByRef(ref: string): Promise<BookingRow | null> {
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("bookings")
    .select("*")
    .eq("reference", ref)
    .maybeSingle();
  if (error) throw error;
  return (data as BookingRow) ?? null;
}

export async function listMyBookings(): Promise<BookingListItem[]> {
  const user = await getCurrentUser();
  if (!user) return [];
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("bookings")
    .select("*, vehicles(make, model, year)")
    .eq("customer_id", user.id)
    .order("created_at", { ascending: false });
  if (error) throw error;
  type Row = BookingRow & { vehicles: { make: string; model: string; year: number } | null };
  return (data ?? []).map((r: Row) => ({
    ...r,
    vehicle_make: r.vehicles?.make ?? "",
    vehicle_model: r.vehicles?.model ?? "",
    vehicle_year: r.vehicles?.year ?? 0,
  }));
}
