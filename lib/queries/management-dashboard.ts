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
  // revenue
  revenueThisMonth: number;
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
    revenueRowsRes,
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
    // Revenue: fetch rows and sum in JS (PostgREST doesn't easily return server-side SUM).
    // Exclude cancelled/rejected/refunded statuses.
    supabase
      .from("bookings")
      .select("total_amount, status")
      .gte("created_at", startISO)
      .lt("created_at", endISO)
      .not("status", "in", "(cancelled,rejected,refunded)"),
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
  if (revenueRowsRes.error) throw revenueRowsRes.error;
  if (todayPickupsRes.error) throw todayPickupsRes.error;
  if (todayReturnsRes.error) throw todayReturnsRes.error;

  const revenueThisMonth = (revenueRowsRes.data ?? []).reduce(
    (s, r) => s + Number((r as { total_amount: number | null }).total_amount || 0),
    0
  );

  return {
    totalVehicles: totalVehiclesRes.count ?? 0,
    availableVehicles: availableVehiclesRes.count ?? 0,
    rentedVehicles: rentedVehiclesRes.count ?? 0,
    maintenanceVehicles: maintenanceVehiclesRes.count ?? 0,
    pendingBookings: pendingBookingsRes.count ?? 0,
    bookingsThisMonth: bookingsThisMonthRes.count ?? 0,
    revenueThisMonth,
    todayPickups: mapUpcoming((todayPickupsRes.data ?? []) as unknown as NestedBookingRow[]),
    todayReturns: mapUpcoming((todayReturnsRes.data ?? []) as unknown as NestedBookingRow[]),
  };
}
