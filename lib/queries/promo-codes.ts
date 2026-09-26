import { createClient } from "@/lib/supabase/server";

export type PromoLookup =
  | { valid: true; id: string; type: "percentage" | "fixed"; value: number }
  | { valid: false; error: string };

export async function validateAndFetchPromo(code: string): Promise<PromoLookup> {
  const trimmed = code.trim();
  if (!trimmed) return { valid: false, error: "Empty promo code" };

  const supabase = await createClient();
  const { data, error } = await supabase
    .from("promo_codes")
    .select("id, code, type, value, max_uses, used_count, expires_at, is_active")
    .eq("code", trimmed)
    .maybeSingle();

  if (error) throw error;
  if (!data) return { valid: false, error: "Promo code not found" };
  if (!data.is_active) return { valid: false, error: "Promo code inactive" };
  if (data.expires_at && new Date(data.expires_at) < new Date()) {
    return { valid: false, error: "Promo code expired" };
  }
  if (data.max_uses != null && data.used_count >= data.max_uses) {
    return { valid: false, error: "Promo code no longer available" };
  }
  return { valid: true, id: data.id, type: data.type, value: Number(data.value) };
}
