# Plan 2 — Customer Browse & Discovery — Design Spec

**Date:** 2026-09-22
**Status:** Approved
**Depends on:** Plan 1 (foundation, auth, migrations)
**Stack:** Next.js 14 App Router · Server Components · Supabase JS SSR · Tailwind · shadcn/ui

---

## 1. Scope

Plan 2 ships the **customer discovery flow**: users can land on the home page, browse the fleet, and inspect any vehicle in detail. No booking; the "Reserve" button links to `/checkout`, which will 404 until Plan 3.

**In scope:**
1. Customer shell — auth-aware header + footer on every customer route.
2. Home page (`/`) — full 8-section landing: hero (with working search form), featured vehicles, category tiles, how it works, testimonials (hardcoded), FAQ (accordion), newsletter (UI only), footer.
3. Browse page (`/vehicles`) — server-rendered grid with category filter + price sort, driven by URL search params.
4. Detail page (`/vehicles/[id]`) — gallery, specs, features, location, pricing card, Reserve CTA.
5. Vehicle images — seed extension inserting `vehicle_images` rows with Unsplash CDN URLs. Next config allows Unsplash `remotePatterns`.
6. Sign-out — wires the existing `signOut` server action into the header account dropdown.

**Out of scope (deferred to later plans):**
- Availability calendar on detail page
- Reviews section
- Checkout / booking creation (Plan 3)
- Account dashboard, bookings list, favorites, documents (Plan 4)
- Newsletter backend
- Vehicle image upload flow (management console)

---

## 2. Architecture

**Rendering:**
- Server Components for all data-fetching pages (SEO, no hydration flicker on auth state).
- Client Components only for interactive bits: search form, category chips, sort select, gallery carousel, FAQ accordion, newsletter form, header account dropdown, mobile menu.
- No client-side data fetching. No `useEffect`.

**Data access:**
- `lib/queries/vehicles.ts` — pure DB helpers (`getFeatured`, `list`, `getById`). Called from Server Components.
- RLS from Plan 1 already scopes reads: public sees `status IN ('available','reserved','rented','maintenance')`; `draft` and `inactive` are hidden automatically.
- Queries include defensive WHERE clauses in addition to RLS — belt and suspenders.

**Filter/sort state:**
- URL search params drive everything. Clicking a category chip navigates to `/vehicles?category=X`. Server re-renders with the new filter.
- Small Zod schema (`browseParamsSchema`) validates and defaults incoming params. Malformed values fall through to defaults; no error surface.

**Auth-aware header:**
- Server component reads `supabase.auth.getSession()`.
- Renders "Sign In / Register" for anonymous users, or `<HeaderAccountMenu>` (client component) with the user's initial + dropdown for authenticated users.
- Dropdown contains Account link and Sign Out (a small form that POSTs to the existing `signOut` server action).

---

## 3. File Map

```
app/(customer)/
├── layout.tsx                      # UPDATE: wraps children in <CustomerHeader> + <CustomerFooter>
├── page.tsx                        # NEW: home page
├── error.tsx                       # NEW: client error boundary for the customer route group
└── vehicles/
    ├── page.tsx                    # NEW: browse (server, reads searchParams)
    └── [id]/
        └── page.tsx                # NEW: detail (server, notFound() on miss)

app/page.tsx                        # DELETE: throwaway brand-showcase page

components/customer/
├── header.tsx                      # server, decides which auth pill to render
├── header-account-menu.tsx         # client, dropdown + sign-out form
├── header-mobile-menu.tsx          # client, hamburger drawer
├── footer.tsx                      # server, static
├── home/
│   ├── hero.tsx                    # client (search form + hero art)
│   ├── featured-vehicles.tsx       # server, fetches is_featured
│   ├── categories.tsx              # server, static tiles linking to /vehicles?category=
│   ├── how-it-works.tsx            # server, static 3-step
│   ├── testimonials.tsx            # server, hardcoded content
│   ├── faq.tsx                     # client (shadcn Accordion)
│   └── newsletter.tsx              # client (form + toast, no persist)
└── vehicles/
    ├── vehicle-card.tsx            # server, one card (used by grid + featured)
    ├── vehicle-grid.tsx            # server, wraps cards + empty state
    ├── category-chips.tsx          # client, links to ?category=X
    ├── sort-select.tsx             # client, links to ?sort=X
    ├── gallery.tsx                 # client, image carousel with prev/next
    ├── specs-table.tsx             # server
    ├── features-list.tsx           # server
    └── pricing-card.tsx            # server, reserve button

lib/
├── queries/
│   └── vehicles.ts                 # getFeaturedVehicles, listVehicles, getVehicleById
├── validators/
│   └── browse.ts                   # Zod schema for /vehicles searchParams
└── utils/
    ├── format.ts                   # formatMoney, formatMileage, formatYear
    └── session.ts                  # getSession() helper for header

scripts/
└── seed-vehicle-images.mjs         # extends seed with vehicle_images rows

next.config.mjs                     # UPDATE: images.remotePatterns for images.unsplash.com
```

---

## 4. Data & Queries

### `lib/queries/vehicles.ts`

```ts
export async function getFeaturedVehicles(limit = 4)
  // SELECT vehicles.*, cover:vehicle_images!inner(url, alt_text)
  // WHERE status = 'available' AND is_featured = true
  //   AND vehicle_images.is_cover = true
  // ORDER BY created_at DESC
  // LIMIT ?

export async function listVehicles(params: BrowseParams)
  // SELECT vehicles.*, cover:vehicle_images(url, alt_text)
  // WHERE status = 'available'
  //   AND (category = params.category if provided)
  // ORDER BY
  //   sort='price_asc'  → daily_price ASC
  //   sort='price_desc' → daily_price DESC
  //   default            → is_featured DESC, created_at DESC

export async function getVehicleById(id: string)
  // Returns { vehicle, images[], features[], locations[] } or null
  // Uses parallel fetches (Promise.all)
```

### Search params contract (`/vehicles`)

| Param | Values | Behavior |
|---|---|---|
| `category` | `exotic`, `sports`, `suv`, `convertible`, `executive`, `electric` | Filter |
| `sort` | `price_asc`, `price_desc` | Sort direction |
| `pickup` / `return` | ISO dates | Captured, ignored by Plan 2 (Plan 3 consumes) |
| Unknown / missing | — | Defaults: no category filter, default sort |

Zod schema drops unknown enum values silently.

---

## 5. Business Rules

- **Featured cap:** max 4 cards on home. Fewer than 4 featured vehicles → show what exists, no non-featured backfill.
- **Empty browse result:** friendly empty state, not a blank grid.
- **Reserve button:** `<Link href={"/checkout?vehicle=" + id}>`. Not disabled. Middleware handles unauthenticated → login redirect. Authenticated users hit 404 until Plan 3 — planned dead-end.
- **Pricing display:** `formatMoney` takes a number in dollars, returns `$1,200/day`. Weekly and monthly displayed only if set.
- **Draft/inactive vehicles:** hidden by RLS + defensive WHERE. `getVehicleById` returns null for these → `notFound()`.
- **Newsletter:** submit shows a success toast. No persistence, no email. UI-only.
- **Home search form:** submits to `/vehicles?category=X&pickup=Y&return=Z`. Category filter applies; dates pass through unread.

---

## 6. Vehicle Images (Seed Extension)

`scripts/seed-vehicle-images.mjs` inserts 3–5 `vehicle_images` rows per seed vehicle, using curated Unsplash URLs. The script is idempotent (checks existence before inserting) so it can be re-run.

**Format per row:**
```json
{
  "vehicle_id": "aaaaaaaa-...",
  "storage_path": "unsplash/<slug>",
  "url": "https://images.unsplash.com/photo-...",
  "is_cover": true,        // first row only
  "sort_order": 0,
  "alt_text": "<make> <model> <angle>"
}
```

Cover images (`is_cover = true`) are what `vehicle-card.tsx` renders. Gallery on the detail page renders all images sorted by `sort_order`.

**Next.js config:**
```js
images: {
  remotePatterns: [
    { protocol: "https", hostname: "images.unsplash.com" }
  ]
}
```

---

## 7. Auth-Aware Header

**Server component** (`components/customer/header.tsx`):
- Reads `supabase.auth.getUser()`.
- If null → renders `<Link href="/login">Sign In</Link>` and `<Link href="/register">Register</Link>`.
- If user → renders `<HeaderAccountMenu email={user.email} />`.

**Client component** (`components/customer/header-account-menu.tsx`):
- shadcn `<DropdownMenu>` with the user's email initial as trigger.
- Menu items: "Account" (link to `/account`), "Sign Out" (form → `signOut` action).
- Sign-out is a `<form action={signOut}>` with a button styled as a menu item. No `useTransition` needed.

**Mobile menu** (`components/customer/header-mobile-menu.tsx`):
- shadcn `<Sheet>` opened by a hamburger button on small screens.
- Contains the same nav links + account/sign-out.

---

## 8. Error Handling

- `getVehicleById` returns null → `notFound()` (built-in 404).
- Supabase network errors in Server Components → bubble to `app/(customer)/error.tsx`, a minimal client error boundary with "Something went wrong" and a retry button.
- Malformed search params → Zod defaults; no error UI.
- Broken Unsplash URLs → `next/image` renders empty; a Tailwind gradient underneath prevents card collapse.
- Empty `is_featured` set → Featured section header renders with an empty grid (no crash).

No per-route `loading.tsx` files. Server rendering is fast enough for 12 vehicles.

---

## 9. Testing & Acceptance

**Automated (`scripts/smoke-test-browse.mjs`):**
- `GET /` → 200, contains "Wabs" + at least one seed make ("Lamborghini")
- `GET /vehicles` → 200, contains 12 vehicle-card markers (`data-vehicle-id=`)
- `GET /vehicles?category=exotic` → 200, exactly 3 cards
- `GET /vehicles?sort=price_asc` → 200, "Tesla" appears before "Rolls-Royce" in the HTML
- `GET /vehicles?category=nonexistent` → 200, empty-state text visible
- `GET /vehicles/aaaaaaaa-0000-0000-0000-000000000001` → 200, contains "Huracán" and "Reserve"
- `GET /vehicles/00000000-0000-0000-0000-000000000000` → 404
- Header — anonymous request: "Sign In" link visible
- Header — authenticated (customer cookie from Plan 1's smoke test script pattern): account menu marker visible, no "Sign In" link

**Build/type:**
- `npm run build` — all routes emit
- `npx tsc --noEmit` — clean

**Manual smoke checklist** (`docs/superpowers/plans/2026-09-22-plan-2-smoke-test.md`):
- Hero search submits and lands on `/vehicles?category=…`
- Category chip click updates URL
- Sort select updates URL
- Gallery prev/next cycles images
- FAQ accordion opens/closes
- Newsletter form shows toast
- Mobile menu opens on narrow viewport
- Account dropdown opens; Sign Out returns to `/` and clears session

**Acceptance:**
1. `npm run build` passes
2. `npx tsc --noEmit` passes
3. Automated smoke script passes all checks
4. Manual checklist confirmed by user
5. All 12 seed vehicles have ≥ 1 `vehicle_images` row with `is_cover = true`
6. Plan 1's route protection continues to work (`/account`, `/management` still redirect unauthenticated)
7. Sign-out from the header returns to `/` and clears the session

---

## 10. Known Deferred Items

- Reserve button links to `/checkout` which 404s until Plan 3. Documented in the manual smoke test.
- Testimonials are hardcoded strings, not from any table.
- Newsletter form is UI-only.
- FAQ content is hardcoded.
- No availability filtering on browse (would require Plan 3's booking data).
