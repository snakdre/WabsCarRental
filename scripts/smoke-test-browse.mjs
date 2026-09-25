// Automated route tests for Plan 2 (browse + home + detail).
// Requires the dev server running at NEXT_PUBLIC_APP_URL (default http://localhost:3000).
// Usage: set -a && source .env.local && set +a && node scripts/smoke-test-browse.mjs

const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL;
const ANON_KEY = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
const APP_URL = process.env.NEXT_PUBLIC_APP_URL || "http://localhost:3000";

const PROJECT_REF = SUPABASE_URL ? new URL(SUPABASE_URL).hostname.split(".")[0] : "";
const COOKIE_NAME = `sb-${PROJECT_REF}-auth-token`;

function base64url(str) {
  return Buffer.from(str, "utf8").toString("base64").replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "");
}

async function signIn(email, password) {
  const res = await fetch(`${SUPABASE_URL}/auth/v1/token?grant_type=password`, {
    method: "POST",
    headers: { apikey: ANON_KEY, "Content-Type": "application/json" },
    body: JSON.stringify({ email, password }),
  });
  if (!res.ok) throw new Error(`sign-in: ${res.status}`);
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

async function get(path, cookie) {
  const res = await fetch(`${APP_URL}${path}`, { redirect: "manual", headers: cookie ? { cookie } : {} });
  const body = res.status === 200 ? await res.text() : "";
  return { status: res.status, location: res.headers.get("location"), body };
}

const results = [];
function check(name, cond, detail = "") {
  const ok = Boolean(cond);
  console.log(`${ok ? "✓" : "✗"} ${name}${detail && !ok ? " — " + detail : ""}`);
  results.push(ok);
}

function countMatches(str, pattern) {
  return (str.match(pattern) || []).length;
}

async function run() {
  console.log(`App: ${APP_URL}\n`);

  // Home
  console.log("=== / (home) ===");
  const home = await get("/");
  check("/ → 200", home.status === 200);
  check("/ contains WABS brand", home.body.includes("WABS"));
  check("/ contains Featured Vehicles section", home.body.includes("Featured Vehicles"));
  check("/ contains at least one seed vehicle make", home.body.includes("Lamborghini") || home.body.includes("Ferrari"));
  check("/ contains category tiles", home.body.includes("Exotic") && home.body.includes("Electric"));
  check("/ shows Sign In (anonymous)", home.body.includes("Sign In"));

  // Browse
  console.log("\n=== /vehicles ===");
  const all = await get("/vehicles");
  check("/vehicles → 200", all.status === 200);
  const allCount = countMatches(all.body, /data-vehicle-id=/g);
  check(`/vehicles renders 12 cards (got ${allCount})`, allCount === 12);

  const exotic = await get("/vehicles?category=exotic");
  const exoticCount = countMatches(exotic.body, /data-vehicle-id=/g);
  check(`/vehicles?category=exotic → 3 cards (got ${exoticCount})`, exoticCount === 3);

  const priceAsc = await get("/vehicles?sort=price_asc");
  const teslaIdx = priceAsc.body.indexOf("Tesla");
  const rollsIdx = priceAsc.body.indexOf("Rolls-Royce");
  check("price_asc: Tesla appears before Rolls-Royce", teslaIdx > 0 && teslaIdx < rollsIdx);

  const empty = await get("/vehicles?category=exotic&sort=price_asc");
  check("category+sort combo → 200", empty.status === 200);

  const bogus = await get("/vehicles?category=nonexistent");
  check("bogus category still 200 (Zod defaults)", bogus.status === 200);
  const bogusCount = countMatches(bogus.body, /data-vehicle-id=/g);
  check(`bogus category falls through to all 12 (got ${bogusCount})`, bogusCount === 12);

  // Detail
  console.log("\n=== /vehicles/[id] ===");
  const detail = await get("/vehicles/aaaaaaaa-0000-0000-0000-000000000001");
  check("/vehicles/<huracan-id> → 200", detail.status === 200);
  check("detail contains 'Huracán'", detail.body.includes("Huracán"));
  check("detail contains 'Reserve'", detail.body.includes("Reserve"));

  const notFound = await get("/vehicles/00000000-0000-0000-0000-000000000000");
  check("/vehicles/<bogus> → 404", notFound.status === 404);

  // Auth-aware header
  if (SUPABASE_URL && ANON_KEY) {
    console.log("\n=== auth-aware header ===");
    const session = await signIn("customer@wabs.com", "WabsDemo2024!");
    const cookie = buildAuthCookie(session);
    const homeAuthed = await get("/", cookie);
    check("home (authed): status 200", homeAuthed.status === 200);
    check("home (authed): 'Sign In' link is gone", !homeAuthed.body.includes(">Sign In<"));
    check("home (authed): account menu marker present", homeAuthed.body.includes("account-menu-trigger"));
  } else {
    console.log("\n(skipping auth-aware checks — missing env)");
  }

  const passed = results.filter(Boolean).length;
  console.log(`\n${passed}/${results.length} checks passed`);
  process.exit(passed === results.length ? 0 : 1);
}

run().catch((err) => {
  console.error(err);
  process.exit(1);
});
