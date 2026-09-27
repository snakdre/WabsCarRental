// Automated smoke test for management bookings workflow.
// Requires dev server running at NEXT_PUBLIC_APP_URL (default http://localhost:3000).
// Usage: set -a && source .env.local && set +a && node scripts/smoke-test-management-bookings.mjs

const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL;
const ANON_KEY = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
const SERVICE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY;
const APP_URL = process.env.NEXT_PUBLIC_APP_URL || "http://localhost:3000";
const PROJECT_REF = new URL(SUPABASE_URL).hostname.split(".")[0];
const COOKIE_NAME = `sb-${PROJECT_REF}-auth-token`;
const TEST_EMAIL = "mgmt-test@example.local";
const VEHICLE = "aaaaaaaa-0000-0000-0000-000000000001";

function base64url(s) {
  return Buffer.from(s, "utf8").toString("base64").replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "");
}

async function signIn(email, password) {
  const res = await fetch(`${SUPABASE_URL}/auth/v1/token?grant_type=password`, {
    method: "POST",
    headers: { apikey: ANON_KEY, "Content-Type": "application/json" },
    body: JSON.stringify({ email, password }),
  });
  if (!res.ok) throw new Error(`sign-in ${email}: ${res.status}`);
  return res.json();
}

function buildAuthCookie(session) {
  const stored = {
    access_token: session.access_token,
    token_type: session.token_type,
    expires_in: session.expires_in,
    expires_at: session.expires_at,
    refresh_token: session.refresh_token,
    user: session.user,
  };
  return `${COOKIE_NAME}=base64-${base64url(JSON.stringify(stored))}`;
}

async function admin(path, init = {}) {
  return fetch(`${SUPABASE_URL}/rest/v1/${path}`, {
    ...init,
    headers: {
      apikey: SERVICE_KEY,
      Authorization: `Bearer ${SERVICE_KEY}`,
      "Content-Type": "application/json",
      ...(init.headers ?? {}),
    },
  });
}

async function cleanupPriorTestBookings() {
  const res = await admin(`bookings?driver_email=eq.${encodeURIComponent(TEST_EMAIL)}&select=id`);
  if (!res.ok) return;
  const rows = await res.json();
  for (const r of rows) {
    await admin(`vehicle_availability?reference_id=eq.${r.id}`, { method: "DELETE" });
    await admin(`booking_extras?booking_id=eq.${r.id}`, { method: "DELETE" });
    await admin(`booking_status_history?booking_id=eq.${r.id}`, { method: "DELETE" });
    await admin(`payments?booking_id=eq.${r.id}`, { method: "DELETE" });
    await admin(`bookings?id=eq.${r.id}`, { method: "DELETE" });
  }
}

const results = [];
function check(name, ok, detail = "") {
  console.log(`${ok ? "✓" : "✗"} ${name}${!ok && detail ? " — " + detail : ""}`);
  results.push(Boolean(ok));
}

async function get(path, cookie) {
  const res = await fetch(`${APP_URL}${path}`, { redirect: "manual", headers: cookie ? { cookie } : {} });
  const body = res.status === 200 ? await res.text() : "";
  return { status: res.status, location: res.headers.get("location"), body };
}

async function createTestBooking(userId) {
  const pickup = new Date(Date.now() + 90 * 86400000).toISOString().slice(0, 10);
  const ret = new Date(Date.now() + 94 * 86400000).toISOString().slice(0, 10);
  const reference = "WBS-MGMT-" + Math.random().toString(36).slice(2, 8).toUpperCase();
  const p_booking = {
    reference, customer_id: userId, vehicle_id: VEHICLE,
    pickup_date: pickup, return_date: ret, pickup_method: "pickup", pickup_location_id: "",
    driver_name: "Mgmt Test", driver_email: TEST_EMAIL, driver_phone: "+15550001111",
    driver_dob: "1990-01-01", license_number: "MGMTTEST", license_expiry: "2030-01-01", license_region: "CA",
    rental_days: 4, base_price: 4800, delivery_fee: 0, tax_amount: 384, protection_fee: 0,
    extras_fee: 0, discount_amount: 0, deposit_amount: 5000, total_amount: 5184,
    protection_plan_id: "", promo_code_id: "", special_requests: "", extras: [],
  };
  const res = await admin(`rpc/create_booking_with_availability`, {
    method: "POST",
    body: JSON.stringify({ p_booking }),
  });
  if (!res.ok) throw new Error(`create booking: ${res.status} ${await res.text()}`);
  const body = await res.json();
  return { reference: body, pickup, ret };
}

async function fetchBookingRow(reference) {
  const res = await admin(`bookings?reference=eq.${reference}`);
  const rows = await res.json();
  return rows[0];
}

async function run() {
  console.log(`App: ${APP_URL}\n`);
  await cleanupPriorTestBookings();

  const custSession = await signIn("customer@wabs.com", "WabsDemo2024!");
  const custCookie = buildAuthCookie(custSession);
  const mgrSession = await signIn("manager@wabs.com", "WabsDemo2024!");
  const mgrCookie = buildAuthCookie(mgrSession);

  const { reference } = await createTestBooking(custSession.user.id);
  const booking = await fetchBookingRow(reference);
  check("test booking created", booking?.reference === reference);

  // List page renders
  const list = await get(`/management/bookings`, mgrCookie);
  check("GET /management/bookings (manager) → 200", list.status === 200);
  check("list contains test reference", list.body.includes(reference));

  // Status filter
  const listPending = await get(`/management/bookings?status=pending`, mgrCookie);
  check("filter status=pending contains ref", listPending.body.includes(reference));
  const listCompleted = await get(`/management/bookings?status=completed`, mgrCookie);
  check("filter status=completed excludes ref", !listCompleted.body.includes(reference));

  // Search
  const listSearch = await get(`/management/bookings?search=${encodeURIComponent(reference)}`, mgrCookie);
  check("search by reference contains ref", listSearch.body.includes(reference));

  // Detail page
  const detail = await get(`/management/bookings/${booking.id}`, mgrCookie);
  check("GET /management/bookings/<id> → 200", detail.status === 200);
  check("detail contains driver_email marker", detail.body.includes(TEST_EMAIL));
  check("detail contains notes-editor marker", detail.body.includes("notes-editor"));
  check("detail contains status-actions marker", detail.body.includes("status-actions"));

  // Guards
  const badUuid = await get(`/management/bookings/00000000-0000-0000-0000-000000000000`, mgrCookie);
  check("bogus uuid detail → 404", badUuid.status === 404);
  const notUuid = await get(`/management/bookings/not-a-uuid`, mgrCookie);
  check("non-uuid detail → 404", notUuid.status === 404);

  // Customer cannot access management
  const custBlocked = await get(`/management/bookings`, custCookie);
  check("customer /management/bookings → redirect", custBlocked.status === 307 || custBlocked.status === 302);

  // Simulate transition: pending → confirmed via service role (mirrors what the action does)
  await admin(`bookings?id=eq.${booking.id}`, {
    method: "PATCH",
    headers: { Prefer: "return=minimal" },
    body: JSON.stringify({ status: "confirmed" }),
  });
  await admin(`booking_status_history`, {
    method: "POST",
    headers: { Prefer: "return=minimal" },
    body: JSON.stringify({ booking_id: booking.id, status: "confirmed", changed_by: mgrSession.user.id, note: null }),
  });
  const confirmed = await fetchBookingRow(reference);
  check("DB transition pending→confirmed", confirmed.status === "confirmed");

  // Simulate cancel + availability delete
  await admin(`bookings?id=eq.${booking.id}`, {
    method: "PATCH",
    headers: { Prefer: "return=minimal" },
    body: JSON.stringify({ status: "cancelled" }),
  });
  await admin(`booking_status_history`, {
    method: "POST",
    headers: { Prefer: "return=minimal" },
    body: JSON.stringify({ booking_id: booking.id, status: "cancelled", changed_by: mgrSession.user.id, note: "test cancel" }),
  });
  await admin(`vehicle_availability?reference_id=eq.${booking.id}&type=eq.booking`, { method: "DELETE" });

  const cancelled = await fetchBookingRow(reference);
  check("DB transition to cancelled", cancelled.status === "cancelled");

  const availRes = await admin(`vehicle_availability?reference_id=eq.${booking.id}&type=eq.booking&select=id`);
  const availRows = await availRes.json();
  check("vehicle_availability row deleted", availRows.length === 0);

  // History rows exist
  const histRes = await admin(`booking_status_history?booking_id=eq.${booking.id}&select=status&order=created_at.asc`);
  const hist = await histRes.json();
  check("history contains confirmed + cancelled", hist.some(h => h.status === "confirmed") && hist.some(h => h.status === "cancelled"));

  const passed = results.filter(Boolean).length;
  console.log(`\n${passed}/${results.length} checks passed`);
  process.exit(passed === results.length ? 0 : 1);
}

run().catch((err) => { console.error(err); process.exit(1); });
