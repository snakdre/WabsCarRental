import { createClient } from "@/lib/supabase/server";
import { currentMonthRangeUTC, todayUTC } from "@/lib/utils/month-range";

export type UpcomingBooking = {
  id: string;
  reference: string;
  driver_name: string;
  vehicle_make: string;
  vehicle_model: string;
  vehicle_year: number;
};

export type DashboardKpis = {
  // vehicle counts
  totalVehicles: number;
  availableVehicles: number;
  rentedVehicles: number;
  maintenanceVehicles: number;
  // booking counts
  pendingBookings: number;
  bookingsThisMonth: number;
  // today's lists
  todayPickups: UpcomingBooking[];
  todayReturns: UpcomingBooking[];
};

type NestedBookingRow = {
  id: string;
  reference: string;
  driver_name: string;
  vehicles: { make: string; model: string; year: number } | null;
};

const mapUpcoming = (rows: NestedBookingRow[]): UpcomingBooking[] =>
  rows.map((r) => ({
    id: r.id,
    reference: r.reference,
    driver_name: r.driver_name,
    vehicle_make: r.vehicles?.make ?? "",
    vehicle_model: r.vehicles?.model ?? "",
    vehicle_year: r.vehicles?.year ?? 0,
  }));

export async function getDashboardKpis(): Promise<DashboardKpis> {
  const supabase = await createClient();
  const { startISO, endISO } = currentMonthRangeUTC();
  const today = todayUTC();

  const [
    totalVehiclesRes,
    availableVehiclesRes,
    rentedVehiclesRes,
    maintenanceVehiclesRes,
    pendingBookingsRes,
    bookingsThisMonthRes,
    todayPickupsRes,
    todayReturnsRes,
  ] = await Promise.all([
    supabase.from("vehicles").select("id", { count: "exact", head: true }),
    supabase.from("vehicles").select("id", { count: "exact", head: true }).eq("status", "available"),
    supabase.from("vehicles").select("id", { count: "exact", head: true }).eq("status", "rented"),
    supabase.from("vehicles").select("id", { count: "exact", head: true }).eq("status", "maintenance"),
    supabase.from("bookings").select("id", { count: "exact", head: true }).eq("status", "pending"),
    supabase
      .from("bookings")
      .select("id", { count: "exact", head: true })
      .gte("created_at", startISO)
      .lt("created_at", endISO),
    // Today's pickups: confirmed or ready_for_pickup
    supabase
      .from("bookings")
      .select(`id, reference, driver_name, vehicles ( make, model, year )`)
      .gte("pickup_date", `${today}T00:00:00Z`)
      .lt("pickup_date", `${today}T23:59:59.999Z`)
      .in("status", ["confirmed", "ready_for_pickup"])
      .order("pickup_date", { ascending: true }),
    // Today's returns: active or ready_for_pickup
    supabase
      .from("bookings")
      .select(`id, reference, driver_name, vehicles ( make, model, year )`)
      .gte("return_date", `${today}T00:00:00Z`)
      .lt("return_date", `${today}T23:59:59.999Z`)
      .in("status", ["active", "ready_for_pickup"])
      .order("return_date", { ascending: true }),
  ]);

  // Check for errors
  if (totalVehiclesRes.error) throw totalVehiclesRes.error;
  if (availableVehiclesRes.error) throw availableVehiclesRes.error;
  if (rentedVehiclesRes.error) throw rentedVehiclesRes.error;
  if (maintenanceVehiclesRes.error) throw maintenanceVehiclesRes.error;
  if (pendingBookingsRes.error) throw pendingBookingsRes.error;
  if (bookingsThisMonthRes.error) throw bookingsThisMonthRes.error;
  if (todayPickupsRes.error) throw todayPickupsRes.error;
  if (todayReturnsRes.error) throw todayReturnsRes.error;

  return {
    totalVehicles: totalVehiclesRes.count ?? 0,
    availableVehicles: availableVehiclesRes.count ?? 0,
    rentedVehicles: rentedVehiclesRes.count ?? 0,
    maintenanceVehicles: maintenanceVehiclesRes.count ?? 0,
    pendingBookings: pendingBookingsRes.count ?? 0,
    bookingsThisMonth: bookingsThisMonthRes.count ?? 0,
    todayPickups: mapUpcoming((todayPickupsRes.data ?? []) as unknown as NestedBookingRow[]),
    todayReturns: mapUpcoming((todayReturnsRes.data ?? []) as unknown as NestedBookingRow[]),
  };
}

export type RevenueMonth = { month: string; revenue: number; bookings: number };
export type TopVehicle = { vehicle_id: string; label: string; rentals: number; revenue: number };
export type ActivityItem = {
  id: string;
  booking_id: string;
  reference: string;
  status: string;
  note: string | null;
  created_at: string;
};

export async function getRevenueTrend(months = 12): Promise<RevenueMonth[]> {
  const supabase = await createClient();
  const { data, error } = await supabase.rpc("staff_revenue_by_month", { p_months: months });
  if (error) throw error;
  return ((data ?? []) as { month: string; revenue: number; bookings: number }[]).map(r => ({
    month: r.month,
    revenue: Number(r.revenue),
    bookings: Number(r.bookings),
  }));
}

export async function getTopVehicles(limit = 5, days = 365): Promise<TopVehicle[]> {
  const supabase = await createClient();
  const { data, error } = await supabase.rpc("staff_top_vehicles", { p_limit: limit, p_days: days });
  if (error) throw error;
  return ((data ?? []) as TopVehicle[]).map(r => ({ ...r, rentals: Number(r.rentals), revenue: Number(r.revenue) }));
}

export async function getRecentActivity(limit = 12): Promise<ActivityItem[]> {
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("booking_status_history")
    .select("id, booking_id, status, note, created_at, bookings ( reference )")
    .order("created_at", { ascending: false })
    .limit(limit);
  if (error) throw error;
  type Row = { id: string; booking_id: string; status: string; note: string | null; created_at: string; bookings: { reference: string } | null };
  return ((data ?? []) as unknown as Row[]).map(r => ({
    id: r.id,
    booking_id: r.booking_id,
    reference: r.bookings?.reference ?? "—",
    status: r.status,
    note: r.note,
    created_at: r.created_at,
  }));
}
