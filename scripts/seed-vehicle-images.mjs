// Seeds vehicle_images with Unsplash URLs. Idempotent — skips vehicles that already have images.
// Usage: set -a && source .env.local && set +a && node scripts/seed-vehicle-images.mjs

const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
if (!url || !key) { console.error("Missing env vars"); process.exit(1); }

const v = (n) => `aaaaaaaa-0000-0000-0000-0000000000${String(n).padStart(2, "0")}`;

// Each vehicle: 3 Unsplash photo IDs. First is cover.
const IMAGES = {
  1:  { alt: "Lamborghini Huracán", ids: ["photo-1544636331-e26879cd4d9b", "photo-1503376780353-7e6692767b70", "photo-1592198084033-aade902d1aae"] },
  2:  { alt: "Ferrari 488 Spider", ids: ["photo-1583121274602-3e2820c69888", "photo-1626668893632-6f3a4466d109", "photo-1567818735868-e71b99932e29"] },
  3:  { alt: "McLaren 720S", ids: ["photo-1607603750909-408e193868c7", "photo-1553440569-bcc63803a83d", "photo-1611821064430-0d40291d0f0b"] },
  4:  { alt: "Porsche 911 Turbo S", ids: ["photo-1614162692292-7ac56d7f7f1e", "photo-1503376780353-7e6692767b70", "photo-1544829099-b9a0c07fad1a"] },
  5:  { alt: "BMW M8 Competition", ids: ["photo-1555215695-3004980ad54e", "photo-1520031441872-265e4ff70366", "photo-1552519507-da3b142c6e3d"] },
  6:  { alt: "Aston Martin DB11", ids: ["photo-1580414057403-c5f451f30e1c", "photo-1503376780353-7e6692767b70", "photo-1552519507-da3b142c6e3d"] },
  7:  { alt: "Range Rover Autobiography", ids: ["photo-1519641471654-76ce0107ad1b", "photo-1606664515524-ed2f786a0bd6", "photo-1546614042-7df3c24c9e5d"] },
  8:  { alt: "Mercedes G 63 AMG", ids: ["photo-1520175480921-4edfa2983e0f", "photo-1606664515524-ed2f786a0bd6", "photo-1553440569-bcc63803a83d"] },
  9:  { alt: "Cadillac Escalade", ids: ["photo-1606664515524-ed2f786a0bd6", "photo-1519641471654-76ce0107ad1b", "photo-1546614042-7df3c24c9e5d"] },
  10: { alt: "Bentley Continental GTC", ids: ["photo-1580414057403-c5f451f30e1c", "photo-1503376780353-7e6692767b70", "photo-1611821064430-0d40291d0f0b"] },
  11: { alt: "Rolls-Royce Ghost", ids: ["photo-1631295868223-63265b40d9e4", "photo-1580414057403-c5f451f30e1c", "photo-1552519507-da3b142c6e3d"] },
  12: { alt: "Tesla Model S Plaid", ids: ["photo-1560958089-b8a1929cea89", "photo-1617788138017-80ad40651399", "photo-1536700503339-1e4b06520771"] },
};

async function existingIds() {
  const res = await fetch(`${url}/rest/v1/vehicle_images?select=vehicle_id`, {
    headers: { apikey: key, Authorization: `Bearer ${key}` },
  });
  if (!res.ok) throw new Error(`GET failed: ${res.status}`);
  const rows = await res.json();
  return new Set(rows.map((r) => r.vehicle_id));
}

async function insert(rows) {
  const res = await fetch(`${url}/rest/v1/vehicle_images`, {
    method: "POST",
    headers: { apikey: key, Authorization: `Bearer ${key}`, "Content-Type": "application/json", Prefer: "return=minimal" },
    body: JSON.stringify(rows),
  });
  if (!res.ok) throw new Error(`POST failed: ${res.status} ${await res.text()}`);
}

const skip = await existingIds();
const toInsert = [];
for (const [n, { alt, ids }] of Object.entries(IMAGES)) {
  const vehicleId = v(Number(n));
  if (skip.has(vehicleId)) { console.log(`skip vehicle ${n} — already has images`); continue; }
  ids.forEach((photoId, i) => {
    toInsert.push({
      vehicle_id: vehicleId,
      storage_path: `unsplash/${photoId}`,
      url: `https://images.unsplash.com/${photoId}?auto=format&fit=crop&w=1600&q=80`,
      is_cover: i === 0,
      sort_order: i,
      alt_text: `${alt} — ${i === 0 ? "exterior" : i === 1 ? "side" : "interior"}`,
    });
  });
}
if (toInsert.length === 0) { console.log("Nothing to insert"); process.exit(0); }
await insert(toInsert);
console.log(`Inserted ${toInsert.length} rows`);
