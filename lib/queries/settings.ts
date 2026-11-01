import { unstable_cache } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import { createPublicClient } from "@/lib/supabase/public";
import { coerceSetting, DEFAULTS, SETTING_KEYS, type SettingKey } from "@/lib/validators/settings";

export type SettingsMap = { [K in SettingKey]: (typeof DEFAULTS)[K] };

export type SettingRow = { key: SettingKey; value: unknown; updated_at: string | null };

// Admin page: every editable key with metadata (staff RLS can read all keys).
export async function listSettingsForAdmin(): Promise<SettingRow[]> {
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("application_settings")
    .select("key, value, updated_at")
    .in("key", SETTING_KEYS);
  if (error) throw error;
  const byKey = new Map((data ?? []).map((r: { key: string; value: unknown; updated_at: string }) => [r.key, r]));
  return SETTING_KEYS.map(key => {
    const row = byKey.get(key);
    return { key, value: row?.value ?? DEFAULTS[key], updated_at: row?.updated_at ?? null };
  });
}

// Public keys (allowlisted in 032) for the footer and business rules.
// Cached and tagged so an admin save refreshes it.
async function fetchPublicSettings(): Promise<Pick<SettingsMap, "tax_rate" | "min_driver_age" | "business_name" | "business_email" | "business_phone">> {
  const supabase = createPublicClient();
  const keys = ["tax_rate", "min_driver_age", "business_name", "business_email", "business_phone"] as const;
  const { data, error } = await supabase.from("application_settings").select("key, value").in("key", keys);
  if (error) throw error;
  const byKey = new Map((data ?? []).map((r: { key: string; value: unknown }) => [r.key, r.value]));
  return {
    tax_rate: coerceSetting("tax_rate", byKey.get("tax_rate")),
    min_driver_age: coerceSetting("min_driver_age", byKey.get("min_driver_age")),
    business_name: coerceSetting("business_name", byKey.get("business_name")),
    business_email: coerceSetting("business_email", byKey.get("business_email")),
    business_phone: coerceSetting("business_phone", byKey.get("business_phone")),
  };
}

export const getPublicSettings = unstable_cache(fetchPublicSettings, ["public-settings"], {
  revalidate: 300,
  tags: ["settings"],
});

// Server actions: read live (uncached) value with the caller's session.
export async function getMinDriverAge(): Promise<number> {
  const supabase = await createClient();
  const { data, error } = await supabase.from("application_settings").select("value").eq("key", "min_driver_age").maybeSingle();
  if (error) throw error;
  return coerceSetting("min_driver_age", (data as { value?: unknown } | null)?.value);
}
