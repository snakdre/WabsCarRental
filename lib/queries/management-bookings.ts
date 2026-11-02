import { createClient } from "@/lib/supabase/server";
import type { ManagementListParams } from "@/lib/validators/management-bookings";

export type ManagementBookingListItem = {
  id: string;
  reference: string;
  customer_id: string;
  vehicle_year: number;
  vehicle_make: string;
  vehicle_model: string;
  pickup_date: string;
  return_date: string;
  status: string;
  total_amount: number;
  driver_name: string;
  driver_email: string;
  created_at: string;
};

export type StatusHistoryRow = {
  status: string;
  note: string | null;
  created_at: string;
};

export type ManagementBookingDetail = ManagementBookingListItem & {
  driver_phone: string;
  driver_dob: string;
  license_number: string;
  license_expiry: string;
  license_region: string;
  pickup_method: string;
  rental_days: number;
  base_price: number;
  delivery_fee: number;
  tax_amount: number;
  protection_fee: number;
  extras_fee: number;
  discount_amount: number;
  deposit_amount: number;
  special_requests: string | null;
  internal_notes: string | null;
  history: StatusHistoryRow[];
  vehicle_id: string;
  handover: {
    pickup_recorded_at: string | null;
    pickup_odometer: number | null;
    pickup_fuel_level: number | null;
    pickup_notes: string | null;
    return_recorded_at: string | null;
    return_odometer: number | null;
    return_fuel_level: number | null;
    return_notes: string | null;
  };
  payments: { id: string; amount: number; method: string; status: string; paid_at: string | null }[];
};

type VehicleJoin = { year: number; make: string; model: string } | null;

// PostgREST .or() uses commas as separators. Strip user-provided commas / parens
// so a malicious search term can't inject additional filters.
function sanitizeSearchTerm(raw: string): string {
  return raw.trim().replace(/[,()]/g, ".").slice(0, 100);
}

export async function listAllBookings(params: ManagementListParams): Promise<ManagementBookingListItem[]> {
  const supabase = await createClient();
  let query = supabase
    .from("bookings")
    .select(`
      id, reference, customer_id, pickup_date, return_date, status, total_amount,
      driver_name, driver_email, created_at,
      vehicles ( year, make, model )
    `)
    .order("created_at", { ascending: false });

  if (params.status) query = query.eq("status", params.status);

  if (params.search) {
    const term = sanitizeSearchTerm(params.search);
    if (term) {
      query = query.or(`reference.ilike.*${term}*,driver_name.ilike.*${term}*,driver_email.ilike.*${term}*`);
    }
  }

  const { data, error } = await query;
  if (error) throw error;

  type Row = Omit<ManagementBookingListItem, "vehicle_year" | "vehicle_make" | "vehicle_model"> & { vehicles: VehicleJoin };
  return ((data ?? []) as unknown as Row[]).map((r) => ({
    id: r.id,
    reference: r.reference,
    customer_id: r.customer_id,
    vehicle_year: r.vehicles?.year ?? 0,
    vehicle_make: r.vehicles?.make ?? "",
    vehicle_model: r.vehicles?.model ?? "",
    pickup_date: r.pickup_date,
    return_date: r.return_date,
    status: r.status,
    total_amount: Number(r.total_amount),
    driver_name: r.driver_name,
    driver_email: r.driver_email,
    created_at: r.created_at,
  }));
}

export async function getManagementBookingDetail(id: string): Promise<ManagementBookingDetail | null> {
  if (!/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(id)) return null;

  const supabase = await createClient();
  const [bookingRes, historyRes, paymentsRes] = await Promise.all([
    supabase
      .from("bookings")
      .select(`
        id, reference, customer_id, pickup_date, return_date, status, total_amount,
        driver_name, driver_email, driver_phone, driver_dob, license_number, license_expiry, license_region,
        pickup_method, rental_days, base_price, delivery_fee, tax_amount, protection_fee, extras_fee,
        discount_amount, deposit_amount, special_requests, internal_notes, created_at, vehicle_id,
        pickup_recorded_at, pickup_odometer, pickup_fuel_level, pickup_notes,
        return_recorded_at, return_odometer, return_fuel_level, return_notes,
        vehicles ( year, make, model )
      `)
      .eq("id", id)
      .maybeSingle(),
    supabase
      .from("booking_status_history")
      .select("status, note, created_at")
      .eq("booking_id", id)
      .order("created_at", { ascending: true }),
    supabase
      .from("payments")
      .select("id, amount, method, status, paid_at")
      .eq("booking_id", id)
      .order("created_at", { ascending: true }),
  ]);
  if (paymentsRes.error) throw paymentsRes.error;

  if (bookingRes.error) throw bookingRes.error;
  if (historyRes.error) throw historyRes.error;
  if (!bookingRes.data) return null;

  const b = bookingRes.data as unknown as {
    id: string; reference: string; customer_id: string;
    pickup_date: string; return_date: string; status: string; total_amount: number;
    driver_name: string; driver_email: string; driver_phone: string; driver_dob: string;
    license_number: string; license_expiry: string; license_region: string;
    pickup_method: string; rental_days: number; base_price: number; delivery_fee: number;
    tax_amount: number; protection_fee: number; extras_fee: number; discount_amount: number;
    deposit_amount: number; special_requests: string | null; internal_notes: string | null;
    created_at: string; vehicles: VehicleJoin; vehicle_id: string;
    pickup_recorded_at: string | null; pickup_odometer: number | null; pickup_fuel_level: number | null; pickup_notes: string | null;
    return_recorded_at: string | null; return_odometer: number | null; return_fuel_level: number | null; return_notes: string | null;
  };

  return {
    id: b.id,
    reference: b.reference,
    customer_id: b.customer_id,
    vehicle_year: b.vehicles?.year ?? 0,
    vehicle_make: b.vehicles?.make ?? "",
    vehicle_model: b.vehicles?.model ?? "",
    pickup_date: b.pickup_date,
    return_date: b.return_date,
    status: b.status,
    total_amount: Number(b.total_amount),
    driver_name: b.driver_name,
    driver_email: b.driver_email,
    driver_phone: b.driver_phone,
    driver_dob: b.driver_dob,
    license_number: b.license_number,
    license_expiry: b.license_expiry,
    license_region: b.license_region,
    pickup_method: b.pickup_method,
    rental_days: b.rental_days,
    base_price: Number(b.base_price),
    delivery_fee: Number(b.delivery_fee),
    tax_amount: Number(b.tax_amount),
    protection_fee: Number(b.protection_fee),
    extras_fee: Number(b.extras_fee),
    discount_amount: Number(b.discount_amount),
    deposit_amount: Number(b.deposit_amount),
    special_requests: b.special_requests,
    internal_notes: b.internal_notes,
    created_at: b.created_at,
    history: (historyRes.data ?? []) as StatusHistoryRow[],
    vehicle_id: b.vehicle_id,
    handover: {
      pickup_recorded_at: b.pickup_recorded_at ?? null,
      pickup_odometer: b.pickup_odometer ?? null,
      pickup_fuel_level: b.pickup_fuel_level ?? null,
      pickup_notes: b.pickup_notes ?? null,
      return_recorded_at: b.return_recorded_at ?? null,
      return_odometer: b.return_odometer ?? null,
      return_fuel_level: b.return_fuel_level ?? null,
      return_notes: b.return_notes ?? null,
    },
    payments: ((paymentsRes.data ?? []) as { id: string; amount: number; method: string; status: string; paid_at: string | null }[])
      .map(p => ({ ...p, amount: Number(p.amount) })),
  };
}

export type BookableVehicle = {
  id: string;
  label: string;
  status: string;
  daily_price: number;
  location: { id: string; name: string | null; delivery_available: boolean; delivery_fee: number } | null;
};

// Vehicles staff can move a booking to or create a booking on.
export async function listBookableVehicles(): Promise<BookableVehicle[]> {
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("vehicles")
    .select("id, year, make, model, trim, status, daily_price, vehicle_locations ( id, name, delivery_available, delivery_fee )")
    .not("status", "in", "(draft,inactive,maintenance)")
    .order("make", { ascending: true });
  if (error) throw error;
  type Row = {
    id: string; year: number; make: string; model: string; trim: string | null; status: string; daily_price: number;
    vehicle_locations: { id: string; name: string | null; delivery_available: boolean; delivery_fee: number }[] | null;
  };
  return ((data ?? []) as unknown as Row[]).map(v => {
    const loc = v.vehicle_locations?.[0] ?? null;
    return {
      id: v.id,
      label: `${v.year} ${v.make} ${v.model}${v.trim ? " " + v.trim : ""}`,
      status: v.status,
      daily_price: Number(v.daily_price),
      location: loc ? { ...loc, delivery_fee: Number(loc.delivery_fee) } : null,
    };
  });
}
