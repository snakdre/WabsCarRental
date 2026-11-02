// Automated smoke test for authenticated route protection.
// Signs in each demo user via /auth/v1/token, mints the sb-<ref>-auth-token
// cookie the way @supabase/ssr expects, and hits protected app routes.
//
// Usage:  set -a && source .env.local && set +a && node scripts/smoke-test-auth.mjs

const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL;
const ANON_KEY = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
const APP_URL = process.env.NEXT_PUBLIC_APP_URL || "http://localhost:3000";

if (!SUPABASE_URL || !ANON_KEY) {
  console.error("Missing NEXT_PUBLIC_SUPABASE_URL or NEXT_PUBLIC_SUPABASE_ANON_KEY");
  process.exit(1);
}

const PROJECT_REF = new URL(SUPABASE_URL).hostname.split(".")[0];
const COOKIE_NAME = `sb-${PROJECT_REF}-auth-token`;

// base64url encoder used by @supabase/ssr (RFC 4648 §5, no padding)
function base64url(str) {
  return Buffer.from(str, "utf8")
    .toString("base64")
    .replace(/\+/g, "-")
    .replace(/\//g, "_")
    .replace(/=+$/, "");
}

async function signIn(email, password) {
  const res = await fetch(`${SUPABASE_URL}/auth/v1/token?grant_type=password`, {
    method: "POST",
    headers: { apikey: ANON_KEY, "Content-Type": "application/json" },
    body: JSON.stringify({ email, password }),
  });
  if (!res.ok) throw new Error(`sign-in ${email}: ${res.status} ${await res.text()}`);
  return res.json();
}

// Build the cookie value the way @supabase/ssr's storage adapter writes it.
// The storage value is the session object serialized to JSON — matching what
// GoTrueClient persists under storageKey when using localStorage semantics.
function buildAuthCookie(session) {
  const stored = {
    access_token: session.access_token,
    token_type: session.token_type,
    expires_in: session.expires_in,
    expires_at: session.expires_at,
    refresh_token: session.refresh_token,
    user: session.user,
  };
  const value = "base64-" + base64url(JSON.stringify(stored));
  // For small sessions no chunking is needed; @supabase/ssr chunks over ~3180 chars.
  // Our JWTs fit comfortably in one cookie.
  return `${COOKIE_NAME}=${value}`;
}

async function get(path, cookie) {
  const res = await fetch(`${APP_URL}${path}`, {
    method: "GET",
    redirect: "manual",
    headers: cookie ? { cookie } : {},
  });
  return { status: res.status, location: res.headers.get("location") };
}

function fmt({ status, location }) {
  return `${status}${location ? " → " + location : ""}`;
}

function check(name, actual, expected) {
  const ok =
    actual.status === expected.status &&
    (expected.location === undefined || actual.location === expected.location);
  console.log(`${ok ? "✓" : "✗"} ${name}: ${fmt(actual)}${ok ? "" : `  (expected ${fmt(expected)})`}`);
  return ok;
}

async function run() {
  console.log(`Project: ${PROJECT_REF}`);
  console.log(`App: ${APP_URL}\n`);

  const results = [];

  // --- Unauthenticated ---
  console.log("=== unauthenticated ===");
  results.push(check("/account → /login", await get("/account"), { status: 307, location: "/login" }));
  results.push(check("/management → /login", await get("/management"), { status: 307, location: "/login" }));
  results.push(check("/login → 200", await get("/login"), { status: 200 }));
  results.push(check("/ → 200", await get("/"), { status: 200 }));

  // --- Customer ---
  console.log("\n=== customer@wabs.com ===");
  const cust = await signIn("customer@wabs.com", "WabsDemo2024!");
  const custCookie = buildAuthCookie(cust);
  results.push(check("/account → 200", await get("/account", custCookie), { status: 200 }));
  results.push(check("/management → / (not staff)", await get("/management", custCookie), { status: 307, location: "/" }));
  results.push(check("/login → /account (already signed in)", await get("/login", custCookie), { status: 307, location: "/account" }));

  // --- Manager ---
  console.log("\n=== manager@wabs.com ===");
  const mgr = await signIn("manager@wabs.com", "WabsDemo2024!");
  const mgrCookie = buildAuthCookie(mgr);
  results.push(check("/management → 200", await get("/management", mgrCookie), { status: 200 }));
  results.push(check("/management/settings → /management (not admin)", await get("/management/settings", mgrCookie), { status: 307, location: "/management" }));
  results.push(check("/account → 200", await get("/account", mgrCookie), { status: 200 }));

  // --- Admin ---
  console.log("\n=== admin@wabs.com ===");
  const adm = await signIn("admin@wabs.com", "WabsDemo2024!");
  const admCookie = buildAuthCookie(adm);
  results.push(check("/management → 200", await get("/management", admCookie), { status: 200 }));
  // /management/settings has no page yet, so it 404s — but the middleware role gate must pass
  const admSettings = await get("/management/settings", admCookie);
  const admSettingsOk = admSettings.status === 200 || admSettings.status === 404;
  console.log(`${admSettingsOk ? "✓" : "✗"} /management/settings passes admin gate: ${fmt(admSettings)}${admSettingsOk ? "" : "  (expected 200 or 404, not a redirect)"}`);
  results.push(admSettingsOk);

  const passed = results.filter(Boolean).length;
  console.log(`\n${passed}/${results.length} checks passed`);
  process.exit(passed === results.length ? 0 : 1);
}

run().catch((err) => {
  console.error(err);
  process.exit(1);
});
