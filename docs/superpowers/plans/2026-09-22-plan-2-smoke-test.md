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
