import { createClient } from "@/lib/supabase/server";

export type ExtraOption = {
  id: string;
  name: string;
  description: string | null;
  price: number;
  unit: "per_day" | "flat";
};

export type ProtectionPlanOption = {
  id: string;
  name: string;
  description: string | null;
  daily_price: number;
  coverage_details: string | null;
};

export async function listActiveExtras(): Promise<ExtraOption[]> {
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("extras")
    .select("id, name, description, price, unit")
    .eq("is_active", true)
    .order("name");
  if (error) throw error;
  return (data ?? []) as ExtraOption[];
}

export async function listActivePlans(): Promise<ProtectionPlanOption[]> {
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("protection_plans")
    .select("id, name, description, daily_price, coverage_details")
    .eq("is_active", true)
    .order("daily_price");
  if (error) throw error;
  return (data ?? []) as ProtectionPlanOption[];
}
