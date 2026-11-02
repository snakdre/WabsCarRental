// Apply pending SQL migrations through the Supabase Management API.
//
// Needs (in .env.local, which is gitignored):
//   NEXT_PUBLIC_SUPABASE_URL   - used only to derive the project ref
//   SUPABASE_ACCESS_TOKEN      - personal access token (sbp_...) from
//                                https://supabase.com/dashboard/account/tokens
//
// Usage:
//   set -a && . ./.env.local && set +a
//   node scripts/apply-migrations.mjs            # dry run: report applied / pending
//   node scripts/apply-migrations.mjs --apply    # apply pending, in order, stop on first error
//
// Detection is by marker objects (a function or column each migration creates),
// because migrations 001-026 were applied by hand without a history table.
// Each file runs inside BEGIN/COMMIT, so a failure leaves nothing half-applied.

import { readFileSync } from "node:fs";
import { join, dirname } from "node:path";
import { fileURLToPath } from "node:url";

const APPLY = process.argv.includes("--apply");
const TOKEN = process.env.SUPABASE_ACCESS_TOKEN;
const URL_ = process.env.NEXT_PUBLIC_SUPABASE_URL;
if (!TOKEN || !URL_) {
  console.error("Missing SUPABASE_ACCESS_TOKEN or NEXT_PUBLIC_SUPABASE_URL (source .env.local first).");
  process.exit(1);
}
const REF = new URL(URL_).hostname.split(".")[0];
const DIR = join(dirname(fileURLToPath(import.meta.url)), "..", "supabase", "migrations");

// SQL that returns true when the migration's effects are already present.
const MARKERS = {
  "026_refund_function.sql": `SELECT to_regprocedure('public.refund_booking(uuid,uuid,text)') IS NOT NULL AS ok`,
  "027_customer_cancel_function.sql": `SELECT to_regprocedure('public.cancel_my_booking(uuid,text)') IS NOT NULL AS ok`,
  "028_customer_documents_storage.sql": `SELECT EXISTS (SELECT 1 FROM pg_policies WHERE policyname = 'documents_staff_update') AS ok`,
  "029_customer_directory.sql": `SELECT to_regprocedure('public.staff_list_customers(text,boolean)') IS NOT NULL AS ok`,
  "030_vehicle_images_management.sql": `SELECT to_regprocedure('public.duplicate_vehicle(uuid)') IS NOT NULL AS ok`,
  "031_dashboard_and_booking_ops.sql": `SELECT to_regprocedure('public.staff_record_pickup(uuid,integer,integer,text)') IS NOT NULL AS ok`,
  "032_maintenance_and_settings.sql": `SELECT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'maintenance_records' AND column_name = 'availability_id') AS ok`,
};
const ORDER = Object.keys(MARKERS);

async function query(sql) {
  const res = await fetch(`https://api.supabase.com/v1/projects/${REF}/database/query`, {
    method: "POST",
    headers: { Authorization: `Bearer ${TOKEN}`, "Content-Type": "application/json" },
    body: JSON.stringify({ query: sql }),
  });
  const text = await res.text();
  if (!res.ok) throw new Error(`HTTP ${res.status}: ${text.slice(0, 2000)}`);
  return text ? JSON.parse(text) : [];
}

const status = [];
for (const file of ORDER) {
  const rows = await query(MARKERS[file]);
  status.push({ file, applied: rows?.[0]?.ok === true });
}
console.table(status);

// Earlier migrations must already be in place; otherwise this isn't the DB we think it is.
if (!status[0].applied) {
  console.error("026 (refund_booking) is missing - 001-026 don't look applied. Stopping without changes.");
  process.exit(1);
}
// A gap (pending migration followed by an applied one) means the DB is in an unexpected state.
const firstPending = status.findIndex(s => !s.applied);
if (firstPending !== -1 && status.slice(firstPending).some(s => s.applied)) {
  console.error("Applied/pending order has a gap. Stopping without changes; inspect manually.");
  process.exit(1);
}

const pending = status.filter(s => !s.applied).map(s => s.file);
if (pending.length === 0) { console.log("Nothing to apply."); process.exit(0); }
console.log(`Pending: ${pending.join(", ")}`);
if (!APPLY) { console.log("Dry run. Re-run with --apply to execute."); process.exit(0); }

for (const file of pending) {
  const sql = readFileSync(join(DIR, file), "utf8");
  process.stdout.write(`Applying ${file} ... `);
  try {
    await query(`BEGIN;\n${sql}\nCOMMIT;`);
  } catch (e) {
    console.log("FAILED");
    console.error(e.message);
    console.error(`Stopped at ${file}; it was rolled back. Later migrations were not attempted.`);
    process.exit(1);
  }
  const rows = await query(MARKERS[file]);
  if (rows?.[0]?.ok !== true) {
    console.log("RAN, but marker not found - stopping.");
    process.exit(1);
  }
  console.log("ok");
}
console.log("All pending migrations applied.");
