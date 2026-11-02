import { createClient } from "@/lib/supabase/server";
import { uuidLike } from "@/lib/validators/shared";
import { DOCUMENTS_BUCKET } from "@/lib/validators/account";
import { CUSTOMERS_PAGE_SIZE, type CustomerListParams } from "@/lib/validators/management-customers";

export type CustomerListItem = {
  id: string;
  email: string;
  first_name: string | null;
  last_name: string | null;
  phone: string | null;
  flagged: boolean;
  is_active: boolean;
  created_at: string;
  booking_count: number;
  total_spent: number;
  last_booking_at: string | null;
  unverified_documents: number;
};

export type CustomerPage = { customers: CustomerListItem[]; total: number; page: number; pageSize: number };

export async function listCustomers(params: CustomerListParams, pageSize = CUSTOMERS_PAGE_SIZE): Promise<CustomerPage> {
  const supabase = await createClient();
  const page = params.page ?? 1;
  const { data, error } = await supabase.rpc("staff_list_customers", {
    p_search: params.search ?? null,
    p_flagged: params.flagged === undefined ? null : params.flagged === "yes",
    p_limit: pageSize,
    p_offset: (page - 1) * pageSize,
  });
  if (error) throw error;
  const rows = (data ?? []) as (CustomerListItem & { total_count: number })[];
  return {
    customers: rows.map(r => ({
      id: r.id, email: r.email, first_name: r.first_name, last_name: r.last_name, phone: r.phone,
      flagged: r.flagged, is_active: r.is_active, created_at: r.created_at, last_booking_at: r.last_booking_at,
      booking_count: Number(r.booking_count),
      total_spent: Number(r.total_spent),
      unverified_documents: Number(r.unverified_documents),
    })),
    total: rows.length ? Number(rows[0].total_count) : 0,
    page,
    pageSize,
  };
}

export type CustomerDocument = {
  id: string;
  type: string;
  verified: boolean;
  uploaded_at: string;
  signed_url: string | null;
};

export type CustomerBooking = {
  id: string;
  reference: string;
  status: string;
  pickup_date: string;
  return_date: string;
  total_amount: number;
  vehicle: string;
};

export type CustomerDetail = {
  id: string;
  email: string;
  first_name: string | null;
  last_name: string | null;
  phone: string | null;
  date_of_birth: string | null;
  address: { line1?: string | null; city?: string | null; state?: string | null; zip?: string | null } | null;
  flagged: boolean;
  is_active: boolean;
  internal_notes: string | null;
  created_at: string;
  bookings: CustomerBooking[];
  documents: CustomerDocument[];
  stats: { booking_count: number; total_spent: number };
};

const SPENT_STATUSES = new Set(["confirmed", "ready_for_pickup", "active", "completed"]);

export async function getCustomerDetail(id: string): Promise<CustomerDetail | null> {
  if (!uuidLike.safeParse(id).success) return null;
  const supabase = await createClient();

  const [profileRes, emailRes, bookingsRes, docsRes] = await Promise.all([
    supabase
      .from("profiles")
      .select("id, first_name, last_name, phone, date_of_birth, address, flagged, is_active, internal_notes, created_at")
      .eq("id", id)
      .maybeSingle(),
    supabase.rpc("staff_customer_email", { p_customer_id: id }),
    supabase
      .from("bookings")
      .select("id, reference, status, pickup_date, return_date, total_amount, vehicles ( year, make, model )")
      .eq("customer_id", id)
      .order("created_at", { ascending: false }),
    supabase
      .from("customer_documents")
      .select("id, type, storage_path, verified, uploaded_at")
      .eq("customer_id", id)
      .order("uploaded_at", { ascending: false }),
  ]);
  if (profileRes.error) throw profileRes.error;
  if (emailRes.error) throw emailRes.error;
  if (bookingsRes.error) throw bookingsRes.error;
  if (docsRes.error) throw docsRes.error;
  if (!profileRes.data) return null;

  const p = profileRes.data as Omit<CustomerDetail, "email" | "bookings" | "documents" | "stats">;

  type BookingRow = Omit<CustomerBooking, "vehicle"> & { vehicles: { year: number; make: string; model: string } | null };
  const bookings: CustomerBooking[] = ((bookingsRes.data ?? []) as unknown as BookingRow[]).map(b => ({
    id: b.id,
    reference: b.reference,
    status: b.status,
    pickup_date: b.pickup_date,
    return_date: b.return_date,
    total_amount: Number(b.total_amount),
    vehicle: b.vehicles ? `${b.vehicles.year} ${b.vehicles.make} ${b.vehicles.model}` : "—",
  }));

  type DocRow = { id: string; type: string; storage_path: string; verified: boolean; uploaded_at: string };
  const docRows = (docsRes.data ?? []) as DocRow[];
  let signedByPath = new Map<string, string>();
  if (docRows.length > 0) {
    const { data: signed } = await supabase.storage
      .from(DOCUMENTS_BUCKET)
      .createSignedUrls(docRows.map(d => d.storage_path), 900);
    signedByPath = new Map((signed ?? []).flatMap(s => (s.signedUrl && s.path ? [[s.path, s.signedUrl] as [string, string]] : [])));
  }

  return {
    ...p,
    email: (emailRes.data as string | null) ?? "",
    bookings,
    documents: docRows.map(d => ({
      id: d.id, type: d.type, verified: d.verified, uploaded_at: d.uploaded_at,
      signed_url: signedByPath.get(d.storage_path) ?? null,
    })),
    stats: {
      booking_count: bookings.length,
      total_spent: bookings.filter(b => SPENT_STATUSES.has(b.status)).reduce((s, b) => s + b.total_amount, 0),
    },
  };
}

// Documents for one customer with short-lived signed URLs (booking detail panel).
export async function listCustomerDocuments(customerId: string): Promise<CustomerDocument[]> {
  if (!uuidLike.safeParse(customerId).success) return [];
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("customer_documents")
    .select("id, type, storage_path, verified, uploaded_at")
    .eq("customer_id", customerId)
    .order("uploaded_at", { ascending: false });
  if (error) throw error;
  const rows = (data ?? []) as { id: string; type: string; storage_path: string; verified: boolean; uploaded_at: string }[];
  if (rows.length === 0) return [];
  const { data: signed } = await supabase.storage
    .from(DOCUMENTS_BUCKET)
    .createSignedUrls(rows.map(r => r.storage_path), 900);
  const byPath = new Map((signed ?? []).flatMap(s => (s.signedUrl && s.path ? [[s.path, s.signedUrl] as [string, string]] : [])));
  return rows.map(r => ({
    id: r.id, type: r.type, verified: r.verified, uploaded_at: r.uploaded_at,
    signed_url: byPath.get(r.storage_path) ?? null,
  }));
}
