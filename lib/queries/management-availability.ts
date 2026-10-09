import { createClient } from "@/lib/supabase/server";

export type AvailabilityBlock = {
  id: string;
  vehicle_id: string;
  start_date: string; // YYYY-MM-DD
  end_date: string; // YYYY-MM-DD
  type: "booking" | "maintenance" | "blocked";
  reason: string | null;
};

export type CalendarVehicle = {
  id: string;
  make: string;
  model: string;
  year: number;
  trim: string | null;
};

export type CalendarData = {
  vehicles: CalendarVehicle[];
  blocks: AvailabilityBlock[]; // only blocks that overlap the queried month
};

export async function getCalendarData(year: number, month: number): Promise<CalendarData> {
  const supabase = await createClient();

  const monthStart = `${year}-${String(month).padStart(2, "0")}-01`;
  const lastDay = new Date(year, month, 0).getDate();
  const monthEnd = `${year}-${String(month).padStart(2, "0")}-${String(lastDay).padStart(2, "0")}`;

  const [vehiclesRes, blocksRes] = await Promise.all([
    supabase
      .from("vehicles")
      .select("id, make, model, year, trim")
      .not("status", "in", '("inactive","draft")')
      .order("make", { ascending: true })
      .order("model", { ascending: true })
      .order("year", { ascending: true }),
    supabase
      .from("vehicle_availability")
      .select("id, vehicle_id, start_date, end_date, type, reason")
      .lte("start_date", monthEnd)
      .gte("end_date", monthStart),
  ]);

  if (vehiclesRes.error) throw vehiclesRes.error;
  if (blocksRes.error) throw blocksRes.error;

  const vehicles = (vehiclesRes.data ?? []) as CalendarVehicle[];
  const blocks = (blocksRes.data ?? []) as AvailabilityBlock[];

  return { vehicles, blocks };
}
