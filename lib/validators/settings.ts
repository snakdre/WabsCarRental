import { z } from "zod";

// Typed registry of editable application settings. Values are stored as JSONB
// in application_settings; the schema here is the single source of truth for
// what admins may write.
export const SETTINGS = {
  tax_rate: {
    label: "Sales tax rate",
    help: "Applied to the rental subtotal at checkout. Enter a percentage, e.g. 8 for 8%.",
    kind: "percent",
    schema: z.number().min(0).max(0.3),
  },
  min_driver_age: {
    label: "Minimum driver age",
    help: "Checked against the driver's date of birth on the pickup date.",
    kind: "integer",
    schema: z.number().int().min(18).max(35),
  },
  default_deposit: {
    label: "Default security deposit",
    help: "Suggested deposit for new vehicles (USD).",
    kind: "money",
    schema: z.number().min(0).max(100_000),
  },
  late_return_fee_per_hour: {
    label: "Late return fee per hour",
    help: "Shown in rental terms (USD).",
    kind: "money",
    schema: z.number().min(0).max(10_000),
  },
  business_name: {
    label: "Business name",
    help: "Shown in the site footer.",
    kind: "text",
    schema: z.string().trim().min(1).max(100),
  },
  business_email: {
    label: "Contact email",
    help: "Shown in the site footer.",
    kind: "email",
    schema: z.string().trim().email().max(200),
  },
  business_phone: {
    label: "Contact phone",
    help: "Shown in the site footer.",
    kind: "text",
    schema: z.string().trim().regex(/^[+()\d\s.-]{7,30}$/, "Enter a valid phone number"),
  },
} as const;

export type SettingKey = keyof typeof SETTINGS;
export const SETTING_KEYS = Object.keys(SETTINGS) as SettingKey[];

export const DEFAULTS: { [K in SettingKey]: z.infer<(typeof SETTINGS)[K]["schema"]> } = {
  tax_rate: 0.08,
  min_driver_age: 25,
  default_deposit: 500,
  late_return_fee_per_hour: 50,
  business_name: "Wabs Car Rental",
  business_email: "hello@wabscarrental.com",
  business_phone: "+1 (555) 000-0000",
};

// Convert a submitted form string into the stored value for a key.
// Percent fields are entered as whole percentages (8 → 0.08).
export function parseSettingInput(key: SettingKey, raw: string):
  { ok: true; value: string | number } | { ok: false; error: string } {
  const def = SETTINGS[key];
  let candidate: unknown = raw;
  if (def.kind === "percent" || def.kind === "integer" || def.kind === "money") {
    const n = Number(raw.trim());
    if (raw.trim() === "" || !Number.isFinite(n)) return { ok: false, error: `${def.label} must be a number` };
    candidate = def.kind === "percent" ? Math.round(n * 100) / 10_000 : n;
  }
  const parsed = def.schema.safeParse(candidate);
  if (!parsed.success) {
    const issue = parsed.error.issues[0];
    if (def.kind === "percent" && (issue.code === "too_big" || issue.code === "too_small")) {
      return { ok: false, error: `${def.label} must be between 0% and 30%` };
    }
    return { ok: false, error: `${def.label}: ${issue.message}` };
  }
  return { ok: true, value: parsed.data as string | number };
}

// Display a stored value in its form field.
export function settingToInput(key: SettingKey, value: unknown): string {
  const def = SETTINGS[key];
  if (value === null || value === undefined) return "";
  if (def.kind === "percent") return String(Math.round(Number(value) * 10_000) / 100);
  return String(value);
}

// Coerce a raw JSONB value to the typed setting, falling back to the default.
export function coerceSetting<K extends SettingKey>(key: K, value: unknown): (typeof DEFAULTS)[K] {
  const parsed = SETTINGS[key].schema.safeParse(value);
  return (parsed.success ? parsed.data : DEFAULTS[key]) as (typeof DEFAULTS)[K];
}
