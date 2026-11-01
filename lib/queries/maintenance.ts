import { createClient } from "@/lib/supabase/server";
import type { MaintenanceListParams, MaintenanceStatus } from "@/lib/validators/maintenance";

export type MaintenanceRow = {
  id: string;
  vehicle_id: string;
  vehicle_label: string;
  category: string;
  status: MaintenanceStatus;
  service_date: string;
  return_date: string | null;
  description: string | null;
  vendor: string | null;
  cost: number | null;
  odometer: number | null;
  completed_at: string | null;
  created_at: string;
};

export type MaintenanceSummary = {
  open: number;
  scheduledNext30: number;
  costThisYear: number;
};

export async function listMaintenance(params: MaintenanceListParams): Promise<MaintenanceRow[]> {
  const supabase = await createClient();
  let q = supabase
    .from("maintenance_records")
    .select("id, vehicle_id, category, status, service_date, return_date, description, vendor, cost, odometer, completed_at, created_at, vehicles ( year, make, model )")
    .order("service_date", { ascending: false })
    .limit(300);
  if (params.status) q = q.eq("status", params.status);
  if (params.vehicle) q = q.eq("vehicle_id", params.vehicle);
  const { data, error } = await q;
  if (error) throw error;
  type Row = Omit<MaintenanceRow, "vehicle_label"> & { vehicles: { year: number; make: string; model: string } | null };
  return ((data ?? []) as unknown as Row[]).map(({ vehicles, ...r }) => ({
    ...r,
    cost: r.cost === null ? null : Number(r.cost),
    vehicle_label: vehicles ? `${vehicles.year} ${vehicles.make} ${vehicles.model}` : "—",
  }));
}

export async function getMaintenanceSummary(): Promise<MaintenanceSummary> {
  const supabase = await createClient();
  const today = new Date().toISOString().slice(0, 10);
  const in30 = new Date(Date.now() + 30 * 86_400_000).toISOString().slice(0, 10);
  const yearStart = `${today.slice(0, 4)}-01-01`;
  const [openRes, nextRes, costRes] = await Promise.all([
    supabase.from("maintenance_records").select("id", { count: "exact", head: true }).eq("status", "in_progress"),
    supabase.from("maintenance_records").select("id", { count: "exact", head: true })
      .eq("status", "scheduled").gte("service_date", today).lte("service_date", in30),
    supabase.from("maintenance_records").select("cost").eq("status", "completed").gte("service_date", yearStart),
  ]);
  if (openRes.error) throw openRes.error;
  if (nextRes.error) throw nextRes.error;
  if (costRes.error) throw costRes.error;
  return {
    open: openRes.count ?? 0,
    scheduledNext30: nextRes.count ?? 0,
    costThisYear: (costRes.data ?? []).reduce((s, r: { cost: number | null }) => s + Number(r.cost ?? 0), 0),
  };
}

export async function listMaintenanceVehicles(): Promise<{ id: string; label: string }[]> {
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("vehicles")
    .select("id, year, make, model, trim")
    .neq("status", "inactive")
    .order("make");
  if (error) throw error;
  return ((data ?? []) as { id: string; year: number; make: string; model: string; trim: string | null }[])
    .map(v => ({ id: v.id, label: `${v.year} ${v.make} ${v.model}${v.trim ? " " + v.trim : ""}` }));
}
