"use server";

import { revalidatePath, revalidateTag } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import { getUserRole, isAdmin } from "@/lib/utils/roles";
import { SETTING_KEYS, parseSettingInput, type SettingKey } from "@/lib/validators/settings";

type ActionResult = { success?: true; error?: string; field?: string; changed?: number };

// Admin-only. Validates every submitted key against the typed registry,
// upserts only the keys whose value changed, and audits the diff.
export async function updateSettings(formData: FormData): Promise<ActionResult> {
  if (!isAdmin(await getUserRole())) return { error: "Only admins can change settings." };

  const next: Partial<Record<SettingKey, string | number>> = {};
  for (const key of SETTING_KEYS) {
    if (!formData.has(key)) continue;
    const r = parseSettingInput(key, String(formData.get(key) ?? ""));
    if (!r.ok) return { error: r.error, field: key };
    next[key] = r.value;
  }
  const keys = Object.keys(next) as SettingKey[];
  if (keys.length === 0) return { error: "Nothing to save." };

  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return { error: "Not signed in" };

  const { data: current, error: readErr } = await supabase
    .from("application_settings")
    .select("key, value")
    .in("key", keys);
  if (readErr) throw readErr;
  const before = new Map((current ?? []).map((r: { key: string; value: unknown }) => [r.key, r.value]));

  const changed = keys.filter(k => JSON.stringify(before.get(k)) !== JSON.stringify(next[k]));
  if (changed.length === 0) return { success: true, changed: 0 };

  const now = new Date().toISOString();
  const { error: upErr } = await supabase.from("application_settings").upsert(
    changed.map(k => ({ key: k, value: next[k], updated_by: user.id, updated_at: now })),
    { onConflict: "key" },
  );
  if (upErr) throw upErr;

  const diff = Object.fromEntries(changed.map(k => [k, { from: before.get(k) ?? null, to: next[k] }]));
  const { error: auditErr } = await supabase.from("audit_logs").insert({
    actor_id: user.id, action: "settings.update", entity_type: "settings", entity_id: null, diff,
  });
  if (auditErr) console.error("audit insert failed", { auditErr });

  revalidateTag("settings");
  revalidatePath("/management/settings");
  revalidatePath("/", "layout");
  return { success: true, changed: changed.length };
}
