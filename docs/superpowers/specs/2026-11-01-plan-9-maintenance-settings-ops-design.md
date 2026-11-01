# Plan 9 — Maintenance, Settings, Calendar Week View, Docker Compose (Design)

Source: master spec §4 (`/management/maintenance`, `/management/settings` admin only), §8
(calendar month/week view, conflict warnings), §10 (`docker compose up -d` → Next.js + Nginx).
Design Q&A skipped at user's request; decisions marked **(call)** are the builder's.

## Maintenance
- **Lifecycle (call):** `scheduled → in_progress → completed`, or `→ cancelled` from either open
  state. New columns on `maintenance_records`: status, category, availability_id, completed_at.
- Each record owns one `vehicle_availability` row of type `maintenance`, created in the same
  transaction (`staff_create_maintenance`), so the calendar and customer availability honour it
  and the exclusion constraint refuses scheduling over a booking.
- **Vehicle status (call):** goes to `maintenance` when work starts (today or earlier, or Start);
  back to `available` when the last in-progress record for that car completes or is cancelled.
  Cars out on rental aren't touched.
- **Calendar block on finish (call):** cancelled removes it; completed trims it to end today
  (history stays truthful, future days free up).
- Page: KPI tiles (in progress, scheduled next 30 days, spend this year), status filter,
  table with Start / Complete (prompts for final cost) / Cancel, scheduling form.

## Settings (admin only)
- **Typed registry (call):** `lib/validators/settings.ts` defines the editable keys, labels,
  input kind and zod bounds: tax rate (0–30%, entered as a percent), minimum driver age (18–35),
  default deposit, late fee, business name / email / phone. Unknown keys (e.g. `payment_mode`,
  which is env-driven) are ignored on save.
- Save upserts only changed keys and writes one audit log row with a from/to diff.
- **Now live:** minimum driver age is read in checkout and manual booking (was hard-coded 25);
  footer shows business name / email / phone (cached, refreshed on save). Tax was already live.
- **Security (call):** 023 let any signed-in user read every settings row. 032 replaces that
  with an allowlist of public keys plus staff read; admin write is unchanged.
- Sidebar gains Dashboard + Maintenance; Settings appears for admins only (middleware and the
  page itself also enforce it).

## Calendar
- **Week view (call):** `?view=week&start=YYYY-MM-DD` (snapped to Monday), Month / Week toggle,
  Prev / Today / Next. Week columns show weekday + date and the block's reason.
- The grid now works from a list of dates, not day-of-month numbers, so blocks spanning month
  or week boundaries clamp correctly; today's column is highlighted.
- **Conflict warnings:** the DB exclusion constraint covers booking + maintenance but not
  `blocked`, so a blocked period can sit on top of a booking. Overlaps in view are outlined in
  red with ⚠, the vehicle row is flagged, and a banner counts affected vehicles.
- Booking blocks link to the booking.

## Docker Compose
- `docker-compose.yml`: `app` (existing Dockerfile; NEXT_PUBLIC_* passed as build args) and
  `nginx` (1.27-alpine). Nginx terminates TLS, redirects 80→443, sets HSTS / nosniff /
  frame / referrer headers, caches `/_next/static` immutably, rate-limits auth pages, allows
  12 MB bodies. Health checks: `GET /api/health` (no DB call) and `/nginx-health`.
- `deploy/nginx/gen-dev-cert.sh` makes a self-signed cert for local use; certs are gitignored.
- **Not verified with Docker:** no Docker on the dev machine, so compose was syntax-checked only.

## Related fix (pushed to Plan 5, #16)
Server actions default to a 1 MB body in Next 14; `next.config.mjs` now sets
`serverActions.bodySizeLimit: "11mb"` so 10 MB document uploads work.
