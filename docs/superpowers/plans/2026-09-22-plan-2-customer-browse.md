# Wabs Car Rental — Plan 2: Customer Browse & Discovery

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Ship the customer discovery flow — home page, browse fleet, and vehicle detail — with an auth-aware shell and Unsplash-backed vehicle imagery.

**Architecture:** Server Components fetch from Supabase via `lib/queries/vehicles.ts`. Filters/sort are URL search params driven, server-rendered. Interactive bits (gallery, chips, accordion, dropdown, mobile menu, forms) are small Client Components. RLS from Plan 1 already scopes public reads.

**Tech Stack:** Next.js 14 App Router, Server Components, `@supabase/ssr`, shadcn/ui (Accordion, DropdownMenu, Sheet, Select), Tailwind, Zod, `next/image` with Unsplash `remotePatterns`.

**Related spec:** `docs/superpowers/specs/2026-09-22-plan-2-customer-browse-design.md`

---

## File Map

```
app/
├── (customer)/
│   ├── layout.tsx                       # UPDATE: wraps children in <CustomerHeader> + <CustomerFooter>
│   ├── page.tsx                         # NEW: home
│   ├── error.tsx                        # NEW: client error boundary
│   └── vehicles/
│       ├── page.tsx                     # NEW: browse
│       └── [id]/page.tsx                # NEW: detail
└── page.tsx                             # DELETE: throwaway brand-showcase page

components/customer/
├── header.tsx                           # server, decides auth pill
├── header-account-menu.tsx              # client, dropdown + sign-out
├── header-mobile-menu.tsx               # client, Sheet drawer
├── footer.tsx                           # server, static
├── home/
│   ├── hero.tsx                         # client, search form
│   ├── featured-vehicles.tsx            # server
│   ├── categories.tsx                   # server
│   ├── how-it-works.tsx                 # server, static
│   ├── testimonials.tsx                 # server, hardcoded
│   ├── faq.tsx                          # client, accordion
│   └── newsletter.tsx                   # client, form + toast
└── vehicles/
    ├── vehicle-card.tsx                 # server
    ├── vehicle-grid.tsx                 # server
    ├── category-chips.tsx               # client
    ├── sort-select.tsx                  # client
    ├── gallery.tsx                      # client, carousel
    ├── specs-table.tsx                  # server
    ├── features-list.tsx                # server
    └── pricing-card.tsx                 # server, reserve button

lib/
├── queries/vehicles.ts                  # getFeaturedVehicles, listVehicles, getVehicleById
├── validators/browse.ts                 # Zod schema for /vehicles searchParams
└── utils/
    ├── format.ts                        # formatMoney, formatMileage
    └── session.ts                       # getSession() helper

scripts/
├── seed-vehicle-images.mjs              # NEW: inserts vehicle_images
└── smoke-test-browse.mjs                # NEW: automated route checks

next.config.mjs                          # UPDATE: images.remotePatterns
```

---

## Task 1: Config + shadcn additions (Sheet, Accordion, DropdownMenu, Select)

**Files:**
- Modify: `next.config.mjs`
- Add via shadcn CLI: `components/ui/sheet.tsx` (DropdownMenu, Select, Accordion already present from Plan 1)

- [ ] **Step 1: Update `next.config.mjs`** to allow Unsplash CDN

Replace the entire file:
```javascript
/** @type {import('next').NextConfig} */
const nextConfig = {
  images: {
    remotePatterns: [
      { protocol: "https", hostname: "images.unsplash.com" },
    ],
  },
};

export default nextConfig;
```

- [ ] **Step 2: Verify Plan 1's shadcn components are present**

Run: `ls components/ui/`
Expected: `accordion.tsx`, `dropdown-menu.tsx`, `select.tsx` all present (installed in Plan 1).

- [ ] **Step 3: Add `sheet.tsx` via shadcn CLI (only new one)**

Run: `npx --yes shadcn@2.3.0 add sheet --yes --overwrite`
Expected: `components/ui/sheet.tsx` created.

- [ ] **Step 4: Commit**

```bash
git add next.config.mjs components/ui/sheet.tsx
git commit -m "feat(plan2): allow Unsplash images and add Sheet component"
```

---

## Task 2: Formatting utilities + session helper

**Files:**
- Create: `lib/utils/format.ts`
- Create: `lib/utils/session.ts`

- [ ] **Step 1: Create `lib/utils/format.ts`**

```typescript
export function formatMoney(amount: number | null | undefined): string {
  if (amount == null) return "—";
  return new Intl.NumberFormat("en-US", {
    style: "currency",
    currency: "USD",
    maximumFractionDigits: 0,
  }).format(amount);
}

export function formatMileage(miles: number | null | undefined): string {
  if (miles == null) return "Unlimited";
  return `${miles.toLocaleString("en-US")} mi/day`;
}

export function formatHorsepower(hp: number | null | undefined): string {
  if (hp == null) return "—";
  return `${hp.toLocaleString("en-US")} hp`;
}
```

- [ ] **Step 2: Create `lib/utils/session.ts`**

```typescript
import { createClient } from "@/lib/supabase/server";

export async function getSession() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  return user;
}
```

- [ ] **Step 3: Verify tsc**

Run: `npx tsc --noEmit`
Expected: no errors.

- [ ] **Step 4: Commit**

```bash
git add lib/utils/format.ts lib/utils/session.ts
git commit -m "feat(plan2): add money/mileage formatters and session helper"
```

---

## Task 3: Zod schema for /vehicles search params

**Files:**
- Create: `lib/validators/browse.ts`

- [ ] **Step 1: Create `lib/validators/browse.ts`**

```typescript
import { z } from "zod";

export const CATEGORIES = ["exotic", "sports", "suv", "convertible", "executive", "electric"] as const;
export const SORTS = ["price_asc", "price_desc"] as const;

export const browseParamsSchema = z.object({
  category: z.enum(CATEGORIES).optional(),
  sort: z.enum(SORTS).optional(),
  pickup: z.string().optional(),
  return: z.string().optional(),
});

export type BrowseParams = z.infer<typeof browseParamsSchema>;

export function parseBrowseParams(raw: Record<string, string | string[] | undefined>): BrowseParams {
  const flat: Record<string, string | undefined> = {};
  for (const [k, v] of Object.entries(raw)) {
    flat[k] = Array.isArray(v) ? v[0] : v;
  }
  const parsed = browseParamsSchema.safeParse(flat);
  return parsed.success ? parsed.data : {};
}
```

- [ ] **Step 2: Verify tsc**

Run: `npx tsc --noEmit`
Expected: no errors.

- [ ] **Step 3: Commit**

```bash
git add lib/validators/browse.ts
git commit -m "feat(plan2): add browse search-params validator"
```

---

## Task 4: Vehicle query helpers

**Files:**
- Create: `lib/queries/vehicles.ts`

- [ ] **Step 1: Create `lib/queries/vehicles.ts`**

```typescript
import { createClient } from "@/lib/supabase/server";
import type { BrowseParams } from "@/lib/validators/browse";

export type VehicleCardData = {
  id: string;
  make: string;
  model: string;
  trim: string | null;
  year: number;
  category: string;
  daily_price: number;
  is_featured: boolean;
  cover_url: string | null;
  cover_alt: string | null;
};

export type VehicleDetail = {
  vehicle: {
    id: string;
    make: string;
    model: string;
    trim: string | null;
    year: number;
    category: string;
    exterior_color: string | null;
    interior_color: string | null;
    seats: number | null;
    doors: number | null;
    transmission: string | null;
    fuel_type: string | null;
    horsepower: number | null;
    drivetrain: string | null;
    description: string | null;
    daily_price: number;
    weekly_price: number | null;
    monthly_price: number | null;
    deposit_amount: number | null;
    mileage_limit: number | null;
    min_rental_days: number;
    cancellation_policy: string | null;
    rental_requirements: string | null;
    status: string;
  };
  images: { url: string; alt_text: string | null; sort_order: number }[];
  features: string[];
  location: {
    name: string | null;
    address: string | null;
    city: string | null;
    state: string | null;
    zip: string | null;
    delivery_available: boolean;
    delivery_fee: number;
  } | null;
};

const CARD_COLUMNS = "id, make, model, trim, year, category, daily_price, is_featured";

async function attachCovers(rows: any[]): Promise<VehicleCardData[]> {
  if (rows.length === 0) return [];
  const supabase = await createClient();
  const ids = rows.map((r) => r.id);
  const { data: covers } = await supabase
    .from("vehicle_images")
    .select("vehicle_id, url, alt_text")
    .in("vehicle_id", ids)
    .eq("is_cover", true);
  const byId = new Map<string, { url: string; alt_text: string | null }>();
  (covers ?? []).forEach((c: any) => byId.set(c.vehicle_id, { url: c.url, alt_text: c.alt_text }));
  return rows.map((r) => ({
    ...r,
    cover_url: byId.get(r.id)?.url ?? null,
    cover_alt: byId.get(r.id)?.alt_text ?? null,
  }));
}

export async function getFeaturedVehicles(limit = 4): Promise<VehicleCardData[]> {
  const supabase = await createClient();
  const { data } = await supabase
    .from("vehicles")
    .select(CARD_COLUMNS)
    .eq("status", "available")
    .eq("is_featured", true)
    .order("created_at", { ascending: false })
    .limit(limit);
  return attachCovers(data ?? []);
}

export async function listVehicles(params: BrowseParams): Promise<VehicleCardData[]> {
  const supabase = await createClient();
  let query = supabase.from("vehicles").select(CARD_COLUMNS).eq("status", "available");
  if (params.category) query = query.eq("category", params.category);
  if (params.sort === "price_asc") query = query.order("daily_price", { ascending: true });
  else if (params.sort === "price_desc") query = query.order("daily_price", { ascending: false });
  else query = query.order("is_featured", { ascending: false }).order("created_at", { ascending: false });
  const { data } = await query;
  return attachCovers(data ?? []);
}

export async function getVehicleById(id: string): Promise<VehicleDetail | null> {
  const supabase = await createClient();
  const [vehicleRes, imagesRes, featuresRes, locationsRes] = await Promise.all([
    supabase.from("vehicles").select("*").eq("id", id).maybeSingle(),
    supabase.from("vehicle_images").select("url, alt_text, sort_order").eq("vehicle_id", id).order("sort_order"),
    supabase.from("vehicle_features").select("feature").eq("vehicle_id", id),
    supabase.from("vehicle_locations").select("name, address, city, state, zip, delivery_available, delivery_fee").eq("vehicle_id", id).limit(1),
  ]);
  if (!vehicleRes.data) return null;
  const v = vehicleRes.data;
  if (v.status === "draft" || v.status === "inactive") return null;
  return {
    vehicle: v,
    images: imagesRes.data ?? [],
    features: (featuresRes.data ?? []).map((f: any) => f.feature),
    location: locationsRes.data?.[0] ?? null,
  };
}
```

- [ ] **Step 2: Verify tsc**

Run: `npx tsc --noEmit`
Expected: no errors.

- [ ] **Step 3: Commit**

```bash
git add lib/queries/vehicles.ts
git commit -m "feat(plan2): add vehicle query helpers"
```

---

## Task 5: Seed vehicle_images with Unsplash URLs

**Files:**
- Create: `scripts/seed-vehicle-images.mjs`

- [ ] **Step 1: Create `scripts/seed-vehicle-images.mjs`**

```javascript
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
```

- [ ] **Step 2: Run the seed**

Run: `set -a && source .env.local && set +a && node scripts/seed-vehicle-images.mjs`
Expected output: `Inserted 36 rows` (12 vehicles × 3 images).

- [ ] **Step 3: Verify**

Run:
```bash
curl -s "$NEXT_PUBLIC_SUPABASE_URL/rest/v1/vehicle_images?select=count" \
  -H "apikey: $SUPABASE_SERVICE_ROLE_KEY" \
  -H "Authorization: Bearer $SUPABASE_SERVICE_ROLE_KEY" \
  -H "Prefer: count=exact"
```
Expected: `[{"count":36}]`

- [ ] **Step 4: Commit**

```bash
git add scripts/seed-vehicle-images.mjs
git commit -m "feat(plan2): seed vehicle_images with Unsplash CDN URLs"
```

---

## Task 6: Customer shell — footer, header, mobile menu, account menu

**Files:**
- Create: `components/customer/footer.tsx`
- Create: `components/customer/header.tsx`
- Create: `components/customer/header-account-menu.tsx`
- Create: `components/customer/header-mobile-menu.tsx`
- Modify: `app/(customer)/layout.tsx`

- [ ] **Step 1: Create `components/customer/footer.tsx`**

```typescript
import Link from "next/link";

export function CustomerFooter() {
  return (
    <footer className="bg-deep text-white mt-24">
      <div className="max-w-7xl mx-auto px-6 py-12 grid grid-cols-1 md:grid-cols-4 gap-8">
        <div>
          <div className="flex items-center gap-2 mb-4">
            <span className="text-xl font-bold tracking-widest uppercase">WABS</span>
            <span className="text-xs tracking-[0.3em] text-gold uppercase">Car Rental</span>
          </div>
          <p className="text-text-muted-wabs text-sm">Premium luxury car rentals for those who demand exceptional.</p>
        </div>
        <div>
          <h4 className="text-gold text-sm font-semibold uppercase tracking-wider mb-3">Fleet</h4>
          <ul className="space-y-2 text-sm text-text-muted-wabs">
            <li><Link href="/vehicles?category=exotic" className="hover:text-gold">Exotic</Link></li>
            <li><Link href="/vehicles?category=sports" className="hover:text-gold">Sports</Link></li>
            <li><Link href="/vehicles?category=suv" className="hover:text-gold">SUV</Link></li>
            <li><Link href="/vehicles?category=electric" className="hover:text-gold">Electric</Link></li>
          </ul>
        </div>
        <div>
          <h4 className="text-gold text-sm font-semibold uppercase tracking-wider mb-3">Company</h4>
          <ul className="space-y-2 text-sm text-text-muted-wabs">
            <li><Link href="/" className="hover:text-gold">About</Link></li>
            <li><Link href="/" className="hover:text-gold">Locations</Link></li>
            <li><Link href="/" className="hover:text-gold">Contact</Link></li>
          </ul>
        </div>
        <div>
          <h4 className="text-gold text-sm font-semibold uppercase tracking-wider mb-3">Contact</h4>
          <ul className="space-y-2 text-sm text-text-muted-wabs">
            <li>hello@wabscarrental.com</li>
            <li>+1 (555) 000-0000</li>
            <li>Beverly Hills · Malibu · LAX</li>
          </ul>
        </div>
      </div>
      <div className="border-t border-navy-light">
        <div className="max-w-7xl mx-auto px-6 py-4 text-xs text-text-muted-wabs">
          © 2026 Wabs Car Rental. All rights reserved.
        </div>
      </div>
    </footer>
  );
}
```

- [ ] **Step 2: Create `components/customer/header-account-menu.tsx`**

```typescript
"use client";

import Link from "next/link";
import { signOut } from "@/lib/actions/auth";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Button } from "@/components/ui/button";

export function HeaderAccountMenu({ email }: { email: string }) {
  const initial = email.charAt(0).toUpperCase();
  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button variant="ghost" className="rounded-full w-10 h-10 p-0 bg-gold text-deep font-semibold hover:bg-gold-muted" data-testid="account-menu-trigger">
          {initial}
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end" className="bg-navy border-navy-light text-white">
        <DropdownMenuLabel className="text-text-muted-wabs text-xs font-normal">
          {email}
        </DropdownMenuLabel>
        <DropdownMenuSeparator className="bg-navy-light" />
        <DropdownMenuItem asChild className="focus:bg-navy-light focus:text-gold">
          <Link href="/account">Account</Link>
        </DropdownMenuItem>
        <DropdownMenuSeparator className="bg-navy-light" />
        <form action={signOut}>
          <button type="submit" className="w-full text-left px-2 py-1.5 text-sm rounded-sm hover:bg-navy-light hover:text-gold">
            Sign out
          </button>
        </form>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
```

- [ ] **Step 3: Create `components/customer/header-mobile-menu.tsx`**

```typescript
"use client";

import Link from "next/link";
import { Menu } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Sheet, SheetContent, SheetTrigger } from "@/components/ui/sheet";

export function HeaderMobileMenu({ authed }: { authed: boolean }) {
  return (
    <Sheet>
      <SheetTrigger asChild>
        <Button variant="ghost" size="icon" className="md:hidden text-white hover:bg-navy-light">
          <Menu className="h-5 w-5" />
        </Button>
      </SheetTrigger>
      <SheetContent side="right" className="bg-navy border-navy-light text-white">
        <nav className="flex flex-col gap-4 mt-8">
          <Link href="/vehicles" className="text-lg hover:text-gold">Fleet</Link>
          <Link href="/" className="text-lg hover:text-gold">How It Works</Link>
          <Link href="/" className="text-lg hover:text-gold">About</Link>
          {!authed && (
            <>
              <Link href="/login" className="text-lg text-gold">Sign In</Link>
              <Link href="/register" className="text-lg hover:text-gold">Register</Link>
            </>
          )}
          {authed && (
            <Link href="/account" className="text-lg text-gold">Account</Link>
          )}
        </nav>
      </SheetContent>
    </Sheet>
  );
}
```

- [ ] **Step 4: Create `components/customer/header.tsx`**

```typescript
import Link from "next/link";
import { getSession } from "@/lib/utils/session";
import { HeaderAccountMenu } from "./header-account-menu";
import { HeaderMobileMenu } from "./header-mobile-menu";

export async function CustomerHeader() {
  const user = await getSession();
  const authed = Boolean(user);

  return (
    <header className="bg-navy text-white sticky top-0 z-40 border-b border-navy-light">
      <div className="max-w-7xl mx-auto px-6 py-4 flex items-center justify-between">
        <Link href="/" className="inline-flex items-center gap-2">
          <span className="text-xl font-bold tracking-widest uppercase">WABS</span>
          <span className="text-xs tracking-[0.3em] text-gold uppercase hidden sm:inline">Car Rental</span>
        </Link>
        <nav className="hidden md:flex items-center gap-8 text-sm">
          <Link href="/vehicles" className="hover:text-gold">Fleet</Link>
          <Link href="/" className="hover:text-gold">How It Works</Link>
          <Link href="/" className="hover:text-gold">About</Link>
        </nav>
        <div className="flex items-center gap-3">
          {!authed && (
            <div className="hidden md:flex items-center gap-4">
              <Link href="/login" className="text-sm hover:text-gold">Sign In</Link>
              <Link href="/register" className="text-sm bg-gold text-deep px-4 py-2 rounded font-semibold hover:bg-gold-muted">Register</Link>
            </div>
          )}
          {authed && user?.email && (
            <div className="hidden md:block">
              <HeaderAccountMenu email={user.email} />
            </div>
          )}
          <HeaderMobileMenu authed={authed} />
        </div>
      </div>
    </header>
  );
}
```

- [ ] **Step 5: Replace `app/(customer)/layout.tsx`**

```typescript
import { CustomerHeader } from "@/components/customer/header";
import { CustomerFooter } from "@/components/customer/footer";

export default function CustomerLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className="min-h-screen bg-warm-white text-navy flex flex-col">
      <CustomerHeader />
      <main className="flex-1">{children}</main>
      <CustomerFooter />
    </div>
  );
}
```

- [ ] **Step 6: Verify tsc + build**

Run: `npx tsc --noEmit`
Expected: no errors.

Run: `npm run build`
Expected: build succeeds. `/account` route still emits.

- [ ] **Step 7: Commit**

```bash
git add components/customer/ "app/(customer)/layout.tsx"
git commit -m "feat(plan2): add customer shell — header, footer, mobile menu, account dropdown"
```

---

## Task 7: Home page — subcomponents (part A)

**Files:**
- Create: `components/customer/home/hero.tsx`
- Create: `components/customer/home/featured-vehicles.tsx`
- Create: `components/customer/vehicles/vehicle-card.tsx`

- [ ] **Step 1: Create `components/customer/vehicles/vehicle-card.tsx`**

```typescript
import Link from "next/link";
import Image from "next/image";
import type { VehicleCardData } from "@/lib/queries/vehicles";
import { formatMoney } from "@/lib/utils/format";

export function VehicleCard({ vehicle }: { vehicle: VehicleCardData }) {
  return (
    <Link
      href={`/vehicles/${vehicle.id}`}
      data-vehicle-id={vehicle.id}
      className="group block bg-white rounded-lg overflow-hidden shadow-sm hover:shadow-xl transition-all duration-200"
    >
      <div className="aspect-[4/3] relative bg-gradient-to-br from-navy to-navy-light">
        {vehicle.cover_url && (
          <Image
            src={vehicle.cover_url}
            alt={vehicle.cover_alt ?? `${vehicle.make} ${vehicle.model}`}
            fill
            sizes="(max-width: 768px) 100vw, 33vw"
            className="object-cover group-hover:scale-105 transition-transform duration-500"
          />
        )}
        <div className="absolute top-3 left-3 bg-navy/80 text-white text-xs uppercase tracking-wider px-2 py-1 rounded">
          {vehicle.category}
        </div>
      </div>
      <div className="p-5">
        <p className="text-text-muted-wabs text-xs uppercase tracking-wider">{vehicle.year}</p>
        <h3 className="text-lg font-semibold text-navy mt-1">{vehicle.make} {vehicle.model}</h3>
        {vehicle.trim && <p className="text-sm text-text-muted-wabs">{vehicle.trim}</p>}
        <div className="mt-4 flex items-baseline justify-between">
          <span className="text-2xl font-bold text-navy">{formatMoney(vehicle.daily_price)}</span>
          <span className="text-xs text-text-muted-wabs">/ day</span>
        </div>
      </div>
    </Link>
  );
}
```

- [ ] **Step 2: Create `components/customer/home/featured-vehicles.tsx`**

```typescript
import { getFeaturedVehicles } from "@/lib/queries/vehicles";
import { VehicleCard } from "@/components/customer/vehicles/vehicle-card";
import Link from "next/link";

export async function FeaturedVehicles() {
  const vehicles = await getFeaturedVehicles(4);
  return (
    <section className="max-w-7xl mx-auto px-6 py-20">
      <div className="flex items-end justify-between mb-10">
        <div>
          <p className="text-gold text-xs uppercase tracking-[0.3em] mb-2">Featured Vehicles</p>
          <h2 className="text-3xl md:text-4xl font-bold text-navy">Curated for the discerning</h2>
        </div>
        <Link href="/vehicles" className="hidden md:inline text-sm text-gold hover:underline">
          View entire fleet →
        </Link>
      </div>
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
        {vehicles.map((v) => <VehicleCard key={v.id} vehicle={v} />)}
      </div>
    </section>
  );
}
```

- [ ] **Step 3: Create `components/customer/home/hero.tsx`**

```typescript
"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";
import { Button } from "@/components/ui/button";
import { CATEGORIES } from "@/lib/validators/browse";

export function Hero() {
  const router = useRouter();
  const [category, setCategory] = useState("");
  const [pickup, setPickup] = useState("");
  const [ret, setRet] = useState("");

  const onSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    const params = new URLSearchParams();
    if (category) params.set("category", category);
    if (pickup) params.set("pickup", pickup);
    if (ret) params.set("return", ret);
    router.push(`/vehicles${params.toString() ? `?${params.toString()}` : ""}`);
  };

  return (
    <section className="relative bg-deep text-white overflow-hidden">
      <div className="absolute inset-0 bg-gradient-to-br from-deep via-navy to-navy-light opacity-90" />
      <div className="relative max-w-7xl mx-auto px-6 py-24 md:py-32">
        <p className="text-gold text-xs uppercase tracking-[0.4em] mb-4">Luxury · Performance · Exclusivity</p>
        <h1 className="text-4xl md:text-6xl font-bold leading-tight max-w-3xl">
          Drive the extraordinary.
        </h1>
        <p className="mt-6 text-lg text-text-muted-wabs max-w-2xl">
          From Ferraris on Pacific Coast Highway to a Rolls-Royce for the black-tie gala.
          Handpicked vehicles, hand-delivered.
        </p>
        <form onSubmit={onSubmit} className="mt-12 bg-white/5 backdrop-blur-md border border-navy-light rounded-lg p-6 max-w-4xl">
          <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
            <div className="col-span-1 md:col-span-2">
              <label className="block text-xs uppercase tracking-wider text-text-muted-wabs mb-2">Category</label>
              <select
                value={category}
                onChange={(e) => setCategory(e.target.value)}
                className="w-full bg-navy-light border border-navy-light text-white rounded px-3 py-2 focus:border-gold focus:outline-none"
              >
                <option value="">All categories</option>
                {CATEGORIES.map((c) => (
                  <option key={c} value={c}>{c.charAt(0).toUpperCase() + c.slice(1)}</option>
                ))}
              </select>
            </div>
            <div>
              <label className="block text-xs uppercase tracking-wider text-text-muted-wabs mb-2">Pickup</label>
              <input
                type="date"
                value={pickup}
                onChange={(e) => setPickup(e.target.value)}
                className="w-full bg-navy-light border border-navy-light text-white rounded px-3 py-2 focus:border-gold focus:outline-none"
              />
            </div>
            <div>
              <label className="block text-xs uppercase tracking-wider text-text-muted-wabs mb-2">Return</label>
              <input
                type="date"
                value={ret}
                onChange={(e) => setRet(e.target.value)}
                className="w-full bg-navy-light border border-navy-light text-white rounded px-3 py-2 focus:border-gold focus:outline-none"
              />
            </div>
          </div>
          <Button type="submit" className="mt-4 bg-gold hover:bg-gold-muted text-deep font-semibold w-full md:w-auto md:px-8">
            Search fleet
          </Button>
        </form>
      </div>
    </section>
  );
}
```

- [ ] **Step 4: Verify tsc**

Run: `npx tsc --noEmit`
Expected: no errors.

- [ ] **Step 5: Commit**

```bash
git add components/customer/home/hero.tsx components/customer/home/featured-vehicles.tsx components/customer/vehicles/vehicle-card.tsx
git commit -m "feat(plan2): add hero, featured-vehicles, vehicle-card"
```

---

## Task 8: Home page — remaining sections + page wire-up (part B)

**Files:**
- Create: `components/customer/home/categories.tsx`
- Create: `components/customer/home/how-it-works.tsx`
- Create: `components/customer/home/testimonials.tsx`
- Create: `components/customer/home/faq.tsx`
- Create: `components/customer/home/newsletter.tsx`
- Create: `app/(customer)/page.tsx`
- Delete: `app/page.tsx`

- [ ] **Step 1: Create `components/customer/home/categories.tsx`**

```typescript
import Link from "next/link";

const CATEGORY_TILES = [
  { key: "exotic", label: "Exotic", tagline: "Ferrari, Lamborghini, McLaren" },
  { key: "sports", label: "Sports", tagline: "Porsche, BMW, Aston Martin" },
  { key: "suv", label: "SUV", tagline: "Range Rover, G-Wagen, Escalade" },
  { key: "convertible", label: "Convertible", tagline: "Open air, uncompromised" },
  { key: "executive", label: "Executive", tagline: "Rolls-Royce, Bentley" },
  { key: "electric", label: "Electric", tagline: "Tesla and the future" },
];

export function Categories() {
  return (
    <section className="bg-navy text-white py-20">
      <div className="max-w-7xl mx-auto px-6">
        <p className="text-gold text-xs uppercase tracking-[0.3em] mb-2 text-center">Browse by category</p>
        <h2 className="text-3xl md:text-4xl font-bold text-center mb-12">Every occasion, matched</h2>
        <div className="grid grid-cols-2 md:grid-cols-3 gap-4">
          {CATEGORY_TILES.map((c) => (
            <Link
              key={c.key}
              href={`/vehicles?category=${c.key}`}
              className="group block bg-navy-light border border-navy-light hover:border-gold rounded-lg p-8 transition-all duration-200"
            >
              <h3 className="text-xl font-semibold group-hover:text-gold transition-colors">{c.label}</h3>
              <p className="text-sm text-text-muted-wabs mt-2">{c.tagline}</p>
            </Link>
          ))}
        </div>
      </div>
    </section>
  );
}
```

- [ ] **Step 2: Create `components/customer/home/how-it-works.tsx`**

```typescript
const STEPS = [
  { n: "01", title: "Choose your vehicle", body: "Browse our fleet or filter by category, budget, or occasion." },
  { n: "02", title: "Reserve your dates", body: "Pick your pickup date and location, delivery to your door available." },
  { n: "03", title: "Drive the extraordinary", body: "Meet your vehicle at Beverly Hills, Malibu, or LAX — or we come to you." },
];

export function HowItWorks() {
  return (
    <section className="max-w-7xl mx-auto px-6 py-20">
      <p className="text-gold text-xs uppercase tracking-[0.3em] mb-2 text-center">How it works</p>
      <h2 className="text-3xl md:text-4xl font-bold text-navy text-center mb-12">Simple, from search to seat</h2>
      <div className="grid grid-cols-1 md:grid-cols-3 gap-8">
        {STEPS.map((s) => (
          <div key={s.n} className="text-center md:text-left">
            <p className="text-gold text-4xl font-bold mb-4">{s.n}</p>
            <h3 className="text-xl font-semibold text-navy mb-2">{s.title}</h3>
            <p className="text-text-muted-wabs">{s.body}</p>
          </div>
        ))}
      </div>
    </section>
  );
}
```

- [ ] **Step 3: Create `components/customer/home/testimonials.tsx`**

```typescript
const REVIEWS = [
  { name: "Marcus H.", quote: "Delivered the Huracán to my hotel exactly on time. Wabs makes rentals feel like concierge service.", vehicle: "Lamborghini Huracán" },
  { name: "Sophia K.", quote: "The Rolls-Royce for our anniversary — impeccable. Return was as easy as arrival.", vehicle: "Rolls-Royce Ghost" },
  { name: "Ethan R.", quote: "I compared five other companies. Wabs won on selection and service. The G 63 was flawless.", vehicle: "Mercedes G 63 AMG" },
];

export function Testimonials() {
  return (
    <section className="bg-navy text-white py-20">
      <div className="max-w-7xl mx-auto px-6">
        <p className="text-gold text-xs uppercase tracking-[0.3em] mb-2 text-center">What they say</p>
        <h2 className="text-3xl md:text-4xl font-bold text-center mb-12">Trusted by the discerning</h2>
        <div className="grid grid-cols-1 md:grid-cols-3 gap-8">
          {REVIEWS.map((r) => (
            <div key={r.name} className="bg-navy-light rounded-lg p-6">
              <p className="text-gold text-3xl leading-none mb-4">"</p>
              <p className="text-text-muted-wabs italic mb-6">{r.quote}</p>
              <p className="text-sm font-semibold">{r.name}</p>
              <p className="text-xs text-text-muted-wabs">{r.vehicle}</p>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}
```

- [ ] **Step 4: Create `components/customer/home/faq.tsx`**

```typescript
"use client";

import { Accordion, AccordionContent, AccordionItem, AccordionTrigger } from "@/components/ui/accordion";

const FAQS = [
  { q: "What's the minimum driver age?", a: "You must be at least 25 years old with a valid driver's license and clean record to rent from Wabs." },
  { q: "Is insurance included?", a: "Basic collision coverage is available; premium and elite tiers add lower deductibles and full coverage. Selected at checkout." },
  { q: "Can you deliver the vehicle?", a: "Yes, delivery is available at select locations (Beverly Hills, Malibu, LAX). Fees vary by vehicle." },
  { q: "What if I go over the mileage limit?", a: "Each vehicle has a daily mileage limit. Overage fees are shown on the vehicle page and applied at return." },
  { q: "Can I cancel my booking?", a: "Cancellations up to 48 hours before pickup are fully refundable. Later cancellations incur a fee based on the cancellation policy." },
];

export function Faq() {
  return (
    <section className="max-w-4xl mx-auto px-6 py-20">
      <p className="text-gold text-xs uppercase tracking-[0.3em] mb-2 text-center">Common questions</p>
      <h2 className="text-3xl md:text-4xl font-bold text-navy text-center mb-12">Answers, upfront</h2>
      <Accordion type="single" collapsible className="space-y-2">
        {FAQS.map((f, i) => (
          <AccordionItem key={i} value={`item-${i}`} className="bg-white rounded-lg border border-gray-200 px-6">
            <AccordionTrigger className="text-navy font-semibold hover:no-underline">{f.q}</AccordionTrigger>
            <AccordionContent className="text-text-muted-wabs">{f.a}</AccordionContent>
          </AccordionItem>
        ))}
      </Accordion>
    </section>
  );
}
```

- [ ] **Step 5: Create `components/customer/home/newsletter.tsx`**

```typescript
"use client";

import { useState } from "react";
import { Button } from "@/components/ui/button";
import { useToast } from "@/hooks/use-toast";

export function Newsletter() {
  const [email, setEmail] = useState("");
  const { toast } = useToast();

  const onSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!email) return;
    toast({ title: "You're on the list", description: `We'll send exclusive fleet updates to ${email}.` });
    setEmail("");
  };

  return (
    <section className="bg-deep text-white py-20">
      <div className="max-w-3xl mx-auto px-6 text-center">
        <p className="text-gold text-xs uppercase tracking-[0.3em] mb-2">Stay in the fast lane</p>
        <h2 className="text-3xl md:text-4xl font-bold mb-4">First to know, first to drive</h2>
        <p className="text-text-muted-wabs mb-8">Fleet updates, seasonal offers, and preview access to new arrivals.</p>
        <form onSubmit={onSubmit} className="flex flex-col sm:flex-row gap-3 max-w-lg mx-auto">
          <input
            type="email"
            required
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            placeholder="you@example.com"
            className="flex-1 bg-navy-light border border-navy-light text-white placeholder:text-text-muted-wabs rounded px-4 py-3 focus:border-gold focus:outline-none"
          />
          <Button type="submit" className="bg-gold hover:bg-gold-muted text-deep font-semibold px-8">
            Subscribe
          </Button>
        </form>
      </div>
    </section>
  );
}
```

- [ ] **Step 6: Create `app/(customer)/page.tsx`** — the new home page

```typescript
import { Hero } from "@/components/customer/home/hero";
import { FeaturedVehicles } from "@/components/customer/home/featured-vehicles";
import { Categories } from "@/components/customer/home/categories";
import { HowItWorks } from "@/components/customer/home/how-it-works";
import { Testimonials } from "@/components/customer/home/testimonials";
import { Faq } from "@/components/customer/home/faq";
import { Newsletter } from "@/components/customer/home/newsletter";

export default function HomePage() {
  return (
    <>
      <Hero />
      <FeaturedVehicles />
      <Categories />
      <HowItWorks />
      <Testimonials />
      <Faq />
      <Newsletter />
    </>
  );
}
```

- [ ] **Step 7: Delete `app/page.tsx`**

Run: `rm app/page.tsx`

Rationale: the throwaway brand-showcase page from Plan 1 conflicted with the new `app/(customer)/page.tsx`, both resolving to `/`. The customer-shell version wins.

- [ ] **Step 8: Verify build**

Run: `npm run build`
Expected: build succeeds. `/` route emits and now resolves via `(customer)/page.tsx`.

- [ ] **Step 9: Commit**

```bash
git add components/customer/home/ "app/(customer)/page.tsx"
git rm app/page.tsx
git commit -m "feat(plan2): assemble home page — hero, featured, categories, how-it-works, testimonials, FAQ, newsletter"
```

---

## Task 9: Browse page — filters, sort, grid

**Files:**
- Create: `components/customer/vehicles/vehicle-grid.tsx`
- Create: `components/customer/vehicles/category-chips.tsx`
- Create: `components/customer/vehicles/sort-select.tsx`
- Create: `app/(customer)/vehicles/page.tsx`

- [ ] **Step 1: Create `components/customer/vehicles/vehicle-grid.tsx`**

```typescript
import type { VehicleCardData } from "@/lib/queries/vehicles";
import { VehicleCard } from "./vehicle-card";

export function VehicleGrid({ vehicles }: { vehicles: VehicleCardData[] }) {
  if (vehicles.length === 0) {
    return (
      <div className="text-center py-24">
        <p className="text-2xl font-semibold text-navy mb-2">No vehicles match your filters</p>
        <p className="text-text-muted-wabs">Try a different category or clear filters.</p>
      </div>
    );
  }
  return (
    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
      {vehicles.map((v) => <VehicleCard key={v.id} vehicle={v} />)}
    </div>
  );
}
```

- [ ] **Step 2: Create `components/customer/vehicles/category-chips.tsx`**

```typescript
"use client";

import Link from "next/link";
import { CATEGORIES } from "@/lib/validators/browse";

export function CategoryChips({ active, sort }: { active?: string; sort?: string }) {
  const chip = (key: string | null, label: string) => {
    const params = new URLSearchParams();
    if (key) params.set("category", key);
    if (sort) params.set("sort", sort);
    const href = `/vehicles${params.toString() ? `?${params.toString()}` : ""}`;
    const isActive = key === (active ?? null);
    return (
      <Link
        key={key ?? "all"}
        href={href}
        className={`px-4 py-2 rounded-full text-sm border transition-colors ${
          isActive
            ? "bg-gold border-gold text-deep font-semibold"
            : "bg-white border-gray-300 text-navy hover:border-gold"
        }`}
      >
        {label}
      </Link>
    );
  };

  return (
    <div className="flex flex-wrap gap-2">
      {chip(null, "All")}
      {CATEGORIES.map((c) => chip(c, c.charAt(0).toUpperCase() + c.slice(1)))}
    </div>
  );
}
```

- [ ] **Step 3: Create `components/customer/vehicles/sort-select.tsx`**

```typescript
"use client";

import { useRouter, useSearchParams } from "next/navigation";

export function SortSelect({ current }: { current?: string }) {
  const router = useRouter();
  const searchParams = useSearchParams();

  const onChange = (e: React.ChangeEvent<HTMLSelectElement>) => {
    const params = new URLSearchParams(searchParams.toString());
    if (e.target.value) params.set("sort", e.target.value);
    else params.delete("sort");
    router.push(`/vehicles${params.toString() ? `?${params.toString()}` : ""}`);
  };

  return (
    <select
      value={current ?? ""}
      onChange={onChange}
      className="bg-white border border-gray-300 text-navy rounded px-3 py-2 text-sm focus:border-gold focus:outline-none"
    >
      <option value="">Featured first</option>
      <option value="price_asc">Price: Low to High</option>
      <option value="price_desc">Price: High to Low</option>
    </select>
  );
}
```

- [ ] **Step 4: Create `app/(customer)/vehicles/page.tsx`**

```typescript
import { parseBrowseParams } from "@/lib/validators/browse";
import { listVehicles } from "@/lib/queries/vehicles";
import { CategoryChips } from "@/components/customer/vehicles/category-chips";
import { SortSelect } from "@/components/customer/vehicles/sort-select";
import { VehicleGrid } from "@/components/customer/vehicles/vehicle-grid";

export const dynamic = "force-dynamic";

export default async function VehiclesPage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const raw = await searchParams;
  const params = parseBrowseParams(raw);
  const vehicles = await listVehicles(params);

  return (
    <div className="max-w-7xl mx-auto px-6 py-12">
      <div className="mb-8">
        <p className="text-gold text-xs uppercase tracking-[0.3em] mb-2">Fleet</p>
        <h1 className="text-4xl font-bold text-navy">Browse every vehicle</h1>
        <p className="text-text-muted-wabs mt-2">{vehicles.length} vehicle{vehicles.length === 1 ? "" : "s"} available</p>
      </div>
      <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4 mb-8">
        <CategoryChips active={params.category} sort={params.sort} />
        <SortSelect current={params.sort} />
      </div>
      <VehicleGrid vehicles={vehicles} />
    </div>
  );
}
```

- [ ] **Step 5: Verify tsc + build**

Run: `npx tsc --noEmit`
Expected: no errors.

Run: `npm run build`
Expected: build succeeds. `/vehicles` route emits (as dynamic).

- [ ] **Step 6: Commit**

```bash
git add components/customer/vehicles/vehicle-grid.tsx components/customer/vehicles/category-chips.tsx components/customer/vehicles/sort-select.tsx "app/(customer)/vehicles/page.tsx"
git commit -m "feat(plan2): add browse page with category chips, sort select, and grid"
```

---

## Task 10: Vehicle detail page — gallery, specs, features, pricing

**Files:**
- Create: `components/customer/vehicles/gallery.tsx`
- Create: `components/customer/vehicles/specs-table.tsx`
- Create: `components/customer/vehicles/features-list.tsx`
- Create: `components/customer/vehicles/pricing-card.tsx`
- Create: `app/(customer)/vehicles/[id]/page.tsx`

- [ ] **Step 1: Create `components/customer/vehicles/gallery.tsx`**

```typescript
"use client";

import Image from "next/image";
import { useState } from "react";
import { ChevronLeft, ChevronRight } from "lucide-react";

type Img = { url: string; alt_text: string | null };

export function Gallery({ images, alt }: { images: Img[]; alt: string }) {
  const [idx, setIdx] = useState(0);
  if (images.length === 0) {
    return <div className="aspect-[16/10] rounded-lg bg-gradient-to-br from-navy to-navy-light" />;
  }
  const prev = () => setIdx((i) => (i - 1 + images.length) % images.length);
  const next = () => setIdx((i) => (i + 1) % images.length);
  const active = images[idx];

  return (
    <div>
      <div className="relative aspect-[16/10] rounded-lg overflow-hidden bg-gradient-to-br from-navy to-navy-light">
        <Image
          src={active.url}
          alt={active.alt_text ?? alt}
          fill
          sizes="(max-width: 1024px) 100vw, 66vw"
          className="object-cover"
          priority={idx === 0}
        />
        {images.length > 1 && (
          <>
            <button
              onClick={prev}
              aria-label="Previous image"
              className="absolute left-4 top-1/2 -translate-y-1/2 bg-white/80 hover:bg-white text-navy rounded-full p-2"
            >
              <ChevronLeft className="w-5 h-5" />
            </button>
            <button
              onClick={next}
              aria-label="Next image"
              className="absolute right-4 top-1/2 -translate-y-1/2 bg-white/80 hover:bg-white text-navy rounded-full p-2"
            >
              <ChevronRight className="w-5 h-5" />
            </button>
          </>
        )}
      </div>
      {images.length > 1 && (
        <div className="mt-3 flex gap-2 overflow-x-auto">
          {images.map((img, i) => (
            <button
              key={i}
              onClick={() => setIdx(i)}
              className={`relative w-20 h-16 rounded overflow-hidden flex-shrink-0 border-2 transition-colors ${
                i === idx ? "border-gold" : "border-transparent"
              }`}
              aria-label={`View image ${i + 1}`}
            >
              <Image src={img.url} alt="" fill sizes="80px" className="object-cover" />
            </button>
          ))}
        </div>
      )}
    </div>
  );
}
```

- [ ] **Step 2: Create `components/customer/vehicles/specs-table.tsx`**

```typescript
import { formatHorsepower, formatMileage } from "@/lib/utils/format";
import type { VehicleDetail } from "@/lib/queries/vehicles";

type V = VehicleDetail["vehicle"];

const cap = (s: string | null) => s ? s.charAt(0).toUpperCase() + s.slice(1) : "—";

export function SpecsTable({ v }: { v: V }) {
  const rows: [string, string][] = [
    ["Year", String(v.year)],
    ["Category", cap(v.category)],
    ["Transmission", cap(v.transmission)],
    ["Fuel Type", cap(v.fuel_type)],
    ["Horsepower", formatHorsepower(v.horsepower)],
    ["Drivetrain", v.drivetrain ?? "—"],
    ["Seats", v.seats?.toString() ?? "—"],
    ["Doors", v.doors?.toString() ?? "—"],
    ["Exterior", v.exterior_color ?? "—"],
    ["Interior", v.interior_color ?? "—"],
    ["Mileage / day", formatMileage(v.mileage_limit)],
    ["Min rental", `${v.min_rental_days} day${v.min_rental_days === 1 ? "" : "s"}`],
  ];
  return (
    <div className="bg-white rounded-lg border border-gray-200 overflow-hidden">
      <table className="w-full text-sm">
        <tbody>
          {rows.map(([label, value]) => (
            <tr key={label} className="border-b border-gray-100 last:border-b-0">
              <td className="px-4 py-3 text-text-muted-wabs w-1/2">{label}</td>
              <td className="px-4 py-3 text-navy font-medium">{value}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
```

- [ ] **Step 3: Create `components/customer/vehicles/features-list.tsx`**

```typescript
import { Check } from "lucide-react";

export function FeaturesList({ features }: { features: string[] }) {
  if (features.length === 0) return null;
  return (
    <div>
      <h3 className="text-lg font-semibold text-navy mb-3">Features</h3>
      <ul className="grid grid-cols-1 sm:grid-cols-2 gap-2">
        {features.map((f) => (
          <li key={f} className="flex items-center gap-2 text-sm text-navy">
            <Check className="w-4 h-4 text-gold flex-shrink-0" />
            {f}
          </li>
        ))}
      </ul>
    </div>
  );
}
```

- [ ] **Step 4: Create `components/customer/vehicles/pricing-card.tsx`**

```typescript
import Link from "next/link";
import { formatMoney } from "@/lib/utils/format";
import { Button } from "@/components/ui/button";
import type { VehicleDetail } from "@/lib/queries/vehicles";

type V = VehicleDetail["vehicle"];

export function PricingCard({ v, location }: { v: V; location: VehicleDetail["location"] }) {
  return (
    <div className="bg-white border border-gray-200 rounded-lg p-6 sticky top-24">
      <p className="text-text-muted-wabs text-xs uppercase tracking-wider">Starting at</p>
      <div className="mt-2 flex items-baseline gap-2">
        <span className="text-4xl font-bold text-navy">{formatMoney(v.daily_price)}</span>
        <span className="text-text-muted-wabs">/ day</span>
      </div>
      <div className="mt-6 space-y-3 text-sm border-t border-gray-100 pt-6">
        {v.weekly_price != null && (
          <div className="flex justify-between">
            <span className="text-text-muted-wabs">Weekly rate</span>
            <span className="text-navy font-medium">{formatMoney(v.weekly_price)}</span>
          </div>
        )}
        {v.monthly_price != null && (
          <div className="flex justify-between">
            <span className="text-text-muted-wabs">Monthly rate</span>
            <span className="text-navy font-medium">{formatMoney(v.monthly_price)}</span>
          </div>
        )}
        {v.deposit_amount != null && (
          <div className="flex justify-between">
            <span className="text-text-muted-wabs">Security deposit</span>
            <span className="text-navy font-medium">{formatMoney(v.deposit_amount)}</span>
          </div>
        )}
      </div>
      {location && (location.city || location.name) && (
        <div className="mt-6 pt-6 border-t border-gray-100 text-sm">
          <p className="text-text-muted-wabs text-xs uppercase tracking-wider mb-2">Location</p>
          <p className="text-navy">{location.name}</p>
          {location.city && <p className="text-text-muted-wabs">{location.city}, {location.state}</p>}
          {location.delivery_available && (
            <p className="text-gold text-xs mt-2">
              Delivery available · {formatMoney(location.delivery_fee)}
            </p>
          )}
        </div>
      )}
      <Button asChild className="w-full mt-6 bg-gold hover:bg-gold-muted text-deep font-semibold">
        <Link href={`/checkout?vehicle=${v.id}`}>Reserve this vehicle</Link>
      </Button>
    </div>
  );
}
```

- [ ] **Step 5: Create `app/(customer)/vehicles/[id]/page.tsx`**

```typescript
import { notFound } from "next/navigation";
import { getVehicleById } from "@/lib/queries/vehicles";
import { Gallery } from "@/components/customer/vehicles/gallery";
import { SpecsTable } from "@/components/customer/vehicles/specs-table";
import { FeaturesList } from "@/components/customer/vehicles/features-list";
import { PricingCard } from "@/components/customer/vehicles/pricing-card";

export const dynamic = "force-dynamic";

export default async function VehicleDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const detail = await getVehicleById(id);
  if (!detail) notFound();

  const { vehicle, images, features, location } = detail;
  const heading = `${vehicle.year} ${vehicle.make} ${vehicle.model}${vehicle.trim ? " " + vehicle.trim : ""}`;

  return (
    <div className="max-w-7xl mx-auto px-6 py-12">
      <div className="mb-8">
        <p className="text-gold text-xs uppercase tracking-[0.3em]">{vehicle.category}</p>
        <h1 className="text-4xl font-bold text-navy mt-1">{heading}</h1>
      </div>
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
        <div className="lg:col-span-2 space-y-8">
          <Gallery images={images} alt={heading} />
          {vehicle.description && (
            <div>
              <h3 className="text-lg font-semibold text-navy mb-3">About this vehicle</h3>
              <p className="text-navy leading-relaxed">{vehicle.description}</p>
            </div>
          )}
          <SpecsTable v={vehicle} />
          <FeaturesList features={features} />
        </div>
        <div className="lg:col-span-1">
          <PricingCard v={vehicle} location={location} />
        </div>
      </div>
    </div>
  );
}
```

- [ ] **Step 6: Verify tsc + build**

Run: `npx tsc --noEmit`
Expected: no errors.

Run: `npm run build`
Expected: build succeeds. `/vehicles/[id]` route emits (dynamic).

- [ ] **Step 7: Commit**

```bash
git add components/customer/vehicles/gallery.tsx components/customer/vehicles/specs-table.tsx components/customer/vehicles/features-list.tsx components/customer/vehicles/pricing-card.tsx "app/(customer)/vehicles/[id]/page.tsx"
git commit -m "feat(plan2): add vehicle detail page — gallery, specs, features, pricing"
```

---

## Task 11: Customer error boundary

**Files:**
- Create: `app/(customer)/error.tsx`

- [ ] **Step 1: Create `app/(customer)/error.tsx`**

```typescript
"use client";

import { Button } from "@/components/ui/button";

export default function CustomerError({ reset }: { error: Error; reset: () => void }) {
  return (
    <div className="max-w-2xl mx-auto px-6 py-24 text-center">
      <h1 className="text-3xl font-bold text-navy mb-2">Something went wrong</h1>
      <p className="text-text-muted-wabs mb-8">
        We couldn't load this page. It may be a temporary issue.
      </p>
      <Button onClick={reset} className="bg-gold hover:bg-gold-muted text-deep font-semibold">
        Try again
      </Button>
    </div>
  );
}
```

- [ ] **Step 2: Verify build**

Run: `npm run build`
Expected: build succeeds.

- [ ] **Step 3: Commit**

```bash
git add "app/(customer)/error.tsx"
git commit -m "feat(plan2): add customer route-group error boundary"
```

---

## Task 12: Automated smoke test script

**Files:**
- Create: `scripts/smoke-test-browse.mjs`

- [ ] **Step 1: Create `scripts/smoke-test-browse.mjs`**

```javascript
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
  // sanity - filtered set should still render
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
```

- [ ] **Step 2: Start the dev server (background)**

Run: `npm run dev` — leave running.

- [ ] **Step 3: Run the smoke test**

In another terminal:
```bash
set -a && source .env.local && set +a && node scripts/smoke-test-browse.mjs
```
Expected: all checks pass.

If checks fail: investigate. Do NOT paper over failures.

- [ ] **Step 4: Commit**

```bash
git add scripts/smoke-test-browse.mjs
git commit -m "feat(plan2): add automated smoke test for browse/detail/home"
```

---

## Task 13: Manual smoke test checklist

**Files:**
- Create: `docs/superpowers/plans/2026-09-22-plan-2-smoke-test.md`

- [ ] **Step 1: Create the checklist**

```markdown
# Plan 2 — Manual Smoke Test Checklist

The automated script (`scripts/smoke-test-browse.mjs`) covers routes, filters,
role-aware header markup, and 404. The items below need a real browser.

## Prerequisites
- `npm run dev` running on http://localhost:3000
- Plan 1 completed (users, migrations, seed) and Task 5 seed (`vehicle_images`) applied

## Home (/)
- [ ] Hero renders with search form (category dropdown + two date inputs)
- [ ] Submitting the form with `category=exotic` navigates to `/vehicles?category=exotic`
- [ ] Submitting with dates includes `pickup=...&return=...` in the URL
- [ ] Featured Vehicles section shows up to 4 cards with Unsplash imagery
- [ ] Category tiles link correctly (e.g., clicking "Sports" lands at `/vehicles?category=sports`)
- [ ] FAQ accordion opens/closes on click
- [ ] Newsletter form submission shows a success toast
- [ ] Footer renders on all pages

## Browse (/vehicles)
- [ ] All 12 cards visible with imagery
- [ ] Clicking a category chip updates the URL and filters results
- [ ] "All" chip clears the category filter
- [ ] Sort select updates URL; ordering changes visibly
- [ ] Empty state renders when no vehicles match

## Detail (/vehicles/[id])
- [ ] Gallery renders with cover image
- [ ] Prev/Next arrows cycle images; thumbnails switch
- [ ] Specs table populated
- [ ] Features list matches seed data (e.g., Huracán shows "Carbon Ceramic Brakes")
- [ ] Reserve button links to `/checkout?vehicle=<id>`
  - Anonymous user clicking → redirected to `/login?redirect=...`
  - Authenticated customer clicking → lands on `/checkout` (currently 404, planned dead-end)

## Header (all pages)
- [ ] Anonymous: "Sign In" + "Register" pills visible
- [ ] Sign in via /login → header shows gold circle with user initial
- [ ] Click circle → dropdown with email, Account link, Sign Out
- [ ] Sign Out → returned to `/`, header shows "Sign In" again
- [ ] Mobile viewport (< 768px): hamburger opens Sheet with nav links

## Regression (Plan 1)
- [ ] Unauthenticated `/account` still → `/login`
- [ ] Unauthenticated `/management` still → `/login`
- [ ] Manager can access `/management`; customer cannot
```

- [ ] **Step 2: Commit**

```bash
git add docs/superpowers/plans/2026-09-22-plan-2-smoke-test.md
git commit -m "docs(plan2): add manual smoke test checklist"
```

---

## Task 14: Final verification

**Files:**
- No new files.

- [ ] **Step 1: Full clean build**

Run: `npm run build`
Expected: build succeeds. Routes emitted include `/`, `/vehicles`, `/vehicles/[id]`, `/account`, `/management`, `/login`, `/register`, `/forgot-password`, `/reset-password`.

- [ ] **Step 2: Type check**

Run: `npx tsc --noEmit`
Expected: no errors.

- [ ] **Step 3: Automated smoke test (with dev server running)**

Run: `set -a && source .env.local && set +a && node scripts/smoke-test-browse.mjs`
Expected: all checks pass.

- [ ] **Step 4: Automated smoke test from Plan 1 (regression check)**

Run: `set -a && source .env.local && set +a && node scripts/smoke-test-auth.mjs`
Expected: 12/12 still pass.

- [ ] **Step 5: Report status**

At this point, Plan 2 is functionally complete. Report to the user:
- Both smoke tests green
- Manual checklist ready at `docs/superpowers/plans/2026-09-22-plan-2-smoke-test.md`
- Suggest running the manual checklist in a browser before merging

No commit needed for Task 14 — it's verification only.
