import { createClient } from "@/lib/supabase/server";
import { validateAndFetchPromo } from "@/lib/queries/promo-codes";

export type PricingInput = {
  vehicle_id: string;
  pickup_date: string;      // ISO YYYY-MM-DD
  return_date: string;
  pickup_method: "pickup" | "delivery";
  pickup_location_id: string | null;
  protection_plan_id: string | null;
  extras: { extra_id: string; quantity: number }[];
  promo_code: string | null;
};

export type PricingOutput = {
  rental_days: number;
  base_price: number;
  protection_fee: number;
  extras_fee: number;
  delivery_fee: number;
  subtotal: number;
  discount_amount: number;
  tax_amount: number;
  deposit_amount: number;
  total_amount: number;
  breakdown: { label: string; value: number }[];
  promo_valid: boolean;
  promo_error: string | null;
  promo_code_id: string | null;
};

function daysBetween(pickup: string, ret: string): number {
  const p = new Date(pickup + "T00:00:00Z").getTime();
  const r = new Date(ret + "T00:00:00Z").getTime();
  const days = Math.ceil((r - p) / (1000 * 60 * 60 * 24));
  return Math.max(1, days);
}

function computeBase(days: number, daily: number, weekly: number | null, monthly: number | null): number {
  let remaining = days;
  let total = 0;
  if (monthly != null && remaining >= 30) {
    const months = Math.floor(remaining / 30);
    total += months * monthly;
    remaining -= months * 30;
  }
  if (weekly != null && remaining >= 7) {
    const weeks = Math.floor(remaining / 7);
    total += weeks * weekly;
    remaining -= weeks * 7;
  }
  total += remaining * daily;
  return total;
}

export async function calculatePricing(input: PricingInput): Promise<PricingOutput> {
  const supabase = await createClient();

  const [vehicleRes, planRes, extrasRes, locationRes, taxSettingRes] = await Promise.all([
    supabase.from("vehicles")
      .select("daily_price, weekly_price, monthly_price, deposit_amount, min_rental_days, max_rental_days")
      .eq("id", input.vehicle_id).maybeSingle(),
    input.protection_plan_id
      ? supabase.from("protection_plans").select("daily_price").eq("id", input.protection_plan_id).maybeSingle()
      : Promise.resolve({ data: null, error: null }),
    input.extras.length
      ? supabase.from("extras").select("id, price, unit").in("id", input.extras.map(e => e.extra_id))
      : Promise.resolve({ data: [], error: null }),
    input.pickup_location_id
      ? supabase.from("vehicle_locations").select("delivery_available, delivery_fee").eq("id", input.pickup_location_id).maybeSingle()
      : Promise.resolve({ data: null, error: null }),
    supabase.from("application_settings").select("value").eq("key", "tax_rate").maybeSingle(),
  ]);

  if (vehicleRes.error) throw vehicleRes.error;
  if (planRes.error) throw planRes.error;
  if (extrasRes.error) throw extrasRes.error;
  if (locationRes.error) throw locationRes.error;
  if (taxSettingRes.error) throw taxSettingRes.error;
  if (!vehicleRes.data) throw new Error("Vehicle not found");

  const v = vehicleRes.data;
  const rental_days = daysBetween(input.pickup_date, input.return_date);
  const base_price = computeBase(rental_days, Number(v.daily_price), v.weekly_price ? Number(v.weekly_price) : null, v.monthly_price ? Number(v.monthly_price) : null);
  const protection_fee = planRes.data ? Number(planRes.data.daily_price) * rental_days : 0;

  type ExtraRow = { id: string; price: number; unit: "per_day" | "flat" };
  const extrasByPrice = new Map<string, ExtraRow>();
  (extrasRes.data ?? []).forEach((e: ExtraRow) => extrasByPrice.set(e.id, e));

  let extras_fee = 0;
  for (const chosen of input.extras) {
    const e = extrasByPrice.get(chosen.extra_id);
    if (!e) continue;
    const price = Number(e.price);
    extras_fee += e.unit === "per_day"
      ? price * chosen.quantity * rental_days
      : price * chosen.quantity;
  }

  const delivery_fee = input.pickup_method === "delivery" && locationRes.data?.delivery_available
    ? Number(locationRes.data.delivery_fee ?? 0)
    : 0;

  const subtotal = base_price + protection_fee + extras_fee + delivery_fee;

  let discount_amount = 0;
  let promo_valid = false;
  let promo_error: string | null = null;
  let promo_code_id: string | null = null;
  if (input.promo_code && input.promo_code.trim()) {
    const promo = await validateAndFetchPromo(input.promo_code);
    if (promo.valid) {
      promo_valid = true;
      promo_code_id = promo.id;
      discount_amount = promo.type === "percentage"
        ? Math.round((subtotal * promo.value / 100) * 100) / 100
        : Math.min(promo.value, subtotal);
    } else {
      promo_error = promo.error;
    }
  }

  const taxRate = taxSettingRes.data?.value ? Number(taxSettingRes.data.value) : 0;
  const tax_amount = Math.round((subtotal - discount_amount) * taxRate * 100) / 100;
  const deposit_amount = v.deposit_amount ? Number(v.deposit_amount) : 0;
  const total_amount = Math.round((subtotal - discount_amount + tax_amount) * 100) / 100;

  const breakdown: { label: string; value: number }[] = [
    { label: `Base rental (${rental_days} day${rental_days === 1 ? "" : "s"})`, value: base_price },
  ];
  if (protection_fee > 0) breakdown.push({ label: "Protection plan", value: protection_fee });
  if (extras_fee > 0) breakdown.push({ label: "Extras", value: extras_fee });
  if (delivery_fee > 0) breakdown.push({ label: "Delivery", value: delivery_fee });
  if (discount_amount > 0) breakdown.push({ label: "Promo discount", value: -discount_amount });
  if (tax_amount > 0) breakdown.push({ label: "Tax", value: tax_amount });

  return {
    rental_days, base_price, protection_fee, extras_fee, delivery_fee,
    subtotal, discount_amount, tax_amount, deposit_amount, total_amount,
    breakdown, promo_valid, promo_error, promo_code_id,
  };
}
