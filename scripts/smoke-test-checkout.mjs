// End-to-end checkout smoke test.
// Requires dev server running at NEXT_PUBLIC_APP_URL (default http://localhost:3000).
// Usage: set -a && source .env.local && set +a && node scripts/smoke-test-checkout.mjs

const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL;
const ANON_KEY = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
const SERVICE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY;
const APP_URL = process.env.NEXT_PUBLIC_APP_URL || "http://localhost:3000";
const PROJECT_REF = new URL(SUPABASE_URL).hostname.split(".")[0];
const COOKIE_NAME = `sb-${PROJECT_REF}-auth-token`;

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

async function fetchAdmin(path, init = {}) {
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

// Clean up any prior test bookings so the test is repeatable.
async function cleanupPriorBookings() {
  const res = await fetchAdmin("bookings?driver_email=eq.alex@test.local&select=id");
  if (!res.ok) return;
  const rows = await res.json();
  for (const r of rows) {
    await fetchAdmin(`vehicle_availability?reference_id=eq.${r.id}`, { method: "DELETE" });
    await fetchAdmin(`booking_extras?booking_id=eq.${r.id}`, { method: "DELETE" });
    await fetchAdmin(`booking_status_history?booking_id=eq.${r.id}`, { method: "DELETE" });
    await fetchAdmin(`payments?booking_id=eq.${r.id}`, { method: "DELETE" });
    await fetchAdmin(`bookings?id=eq.${r.id}`, { method: "DELETE" });
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

async function run() {
  console.log(`App: ${APP_URL}\n`);
  await cleanupPriorBookings();

  const custSession = await signIn("customer@wabs.com", "WabsDemo2024!");
  const custCookie = buildAuthCookie(custSession);
  const VEHICLE = "aaaaaaaa-0000-0000-0000-000000000001"; // Huracán

  // Step 1 page
  const dates = await get(`/checkout/dates?vehicle=${VEHICLE}`, custCookie);
  check("GET /checkout/dates → 200", dates.status === 200);

  // Compute pickup 30 days out; return 34 days
  const pickup = new Date(Date.now() + 30 * 86400000).toISOString().slice(0, 10);
  const ret = new Date(Date.now() + 34 * 86400000).toISOString().slice(0, 10);

  const dobOK = "1990-01-01";
  const licExpiry = new Date(Date.now() + 365 * 86400000).toISOString().slice(0, 10);
  const sp = new URLSearchParams({
    vehicle: VEHICLE, pickup, return: ret, pickup_method: "pickup",
    driver_name: "Alex Test", driver_email: "alex@test.local", driver_phone: "+15551230000",
    driver_dob: dobOK,
    license_number: "TEST123", license_expiry: licExpiry, license_region: "CA",
    extras: JSON.stringify([]),
    promo_code: "WABS10",
  });
  const review = await get(`/checkout/review?${sp.toString()}`, custCookie);
  check("GET /checkout/review → 200", review.status === 200);
  const hasDiscount = review.body.includes("Promo discount") || review.body.toLowerCase().includes("discount");
  check("review shows discount", hasDiscount);

  // RPC test: verify booking function works end-to-end
  const reference = "WBS-2026-" + Math.random().toString(36).slice(2, 8).toUpperCase();
  const p_booking = {
    reference,
    customer_id: custSession.user.id,
    vehicle_id: VEHICLE,
    pickup_date: pickup,
    return_date: ret,
    pickup_method: "pickup",
    pickup_location_id: "",
    driver_name: "Alex Test",
    driver_email: "alex@test.local",
    driver_phone: "+15551230000",
    driver_dob: dobOK,
    license_number: "TEST123",
    license_expiry: licExpiry,
    license_region: "CA",
    rental_days: 4,
    base_price: 4800,
    delivery_fee: 0,
    tax_amount: 384,
    protection_fee: 0,
    extras_fee: 0,
    discount_amount: 480,
    deposit_amount: 5000,
    total_amount: 4704,
    protection_plan_id: "",
    promo_code_id: "",
    special_requests: "",
    extras: [],
  };

  const rpcRes = await fetch(`${SUPABASE_URL}/rest/v1/rpc/create_booking_with_availability`, {
    method: "POST",
    headers: {
      apikey: ANON_KEY,
      Authorization: `Bearer ${custSession.access_token}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({ p_booking }),
  });
  const rpcBody = await rpcRes.text();
  check("RPC create_booking_with_availability succeeds", rpcRes.ok, `${rpcRes.status} ${rpcBody}`);

  // Overlap test — must fail
  const p2 = { ...p_booking, reference: reference + "X" };
  const rpc2 = await fetch(`${SUPABASE_URL}/rest/v1/rpc/create_booking_with_availability`, {
    method: "POST",
    headers: {
      apikey: ANON_KEY,
      Authorization: `Bearer ${custSession.access_token}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({ p_booking: p2 }),
  });
  check("RPC on overlapping dates fails", !rpc2.ok);

  // Booking in DB
  const confRes = await fetch(`${SUPABASE_URL}/rest/v1/bookings?reference=eq.${reference}`, {
    headers: { apikey: SERVICE_KEY, Authorization: `Bearer ${SERVICE_KEY}` },
  });
  const [confBooking] = await confRes.json();
  check("booking exists in DB", confBooking?.reference === reference);

  // Simulate confirmed status (mirrors confirmPayment)
  if (confBooking) {
    await fetchAdmin(`bookings?id=eq.${confBooking.id}`, {
      method: "PATCH",
      body: JSON.stringify({ status: "confirmed" }),
      headers: { Prefer: "return=minimal" },
    });
  }

  // Confirmation page
  const conf = await get(`/checkout/confirmation/${reference}`, custCookie);
  check("GET /checkout/confirmation/<ref> → 200", conf.status === 200);
  check("confirmation page contains reference", conf.body.includes(reference));

  // /account bookings list
  const accountPage = await get(`/account`, custCookie);
  check("GET /account → 200", accountPage.status === 200);
  check("/account contains new booking reference", accountPage.body.includes(reference));

  // Guard: /checkout/payment for wrong user → 404
  const mgrSession = await signIn("manager@wabs.com", "WabsDemo2024!");
  const mgrCookie = buildAuthCookie(mgrSession);
  const wrongUser = await get(`/checkout/payment?booking_ref=${reference}`, mgrCookie);
  check("cross-user /checkout/payment → 404", wrongUser.status === 404);

  const passed = results.filter(Boolean).length;
  console.log(`\n${passed}/${results.length} checks passed`);
  process.exit(passed === results.length ? 0 : 1);
}

run().catch((err) => { console.error(err); process.exit(1); });
