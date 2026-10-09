# Wabs Car Rental

Luxury car rental platform — Next.js 14 (App Router) + Supabase (Postgres + Auth + RLS).

- **Customer**: browse the fleet with date-based availability filtering, view vehicle details, run a 6-step checkout, see your bookings.
- **Management console**: dashboard KPIs, bookings workflow with status transitions and atomic refunds, vehicle CRUD, availability calendar.

## Stack

- Next.js 14.2 (App Router, Server Components, Server Actions)
- React 18
- Supabase (`@supabase/ssr` for cookie-aware server client, `@supabase/supabase-js` for cookie-less public reads)
- TailwindCSS + Radix UI primitives
- Zod for request validation
- Vitest for unit tests
- GitHub Actions for CI

## Prerequisites

- **Node 22+** (pinned via `.nvmrc`; `engines.node` in `package.json` enforces at install time)
- **npm 10+** (ships with Node 22)
- A Supabase project — free tier is fine. You need the project URL, anon key, and service-role key.

## Local setup

```bash
git clone https://github.com/snakdre/WabsCarRental.git
cd WabsCarRental
cp .env.example .env.local         # fill in your Supabase values
npm install
```

### Required env vars

```
NEXT_PUBLIC_SUPABASE_URL=
NEXT_PUBLIC_SUPABASE_ANON_KEY=
SUPABASE_SERVICE_ROLE_KEY=
NEXT_PUBLIC_APP_URL=http://localhost:3000
PAYMENT_MODE=mock
```

Payment integration is currently mock-only. Stripe keys in `.env.example` are placeholders for future work.

### Seed the database

The repo includes migrations under `supabase/migrations/` and seed data under `supabase/seed.runnable.sql`.

1. Apply migrations in order (001 → 026) via the Supabase SQL Editor or the Supabase CLI.
2. Run `scripts/seed-remaining.mjs` after seeding users:
   ```bash
   node scripts/seed-remaining.mjs
   ```
3. Demo accounts (from the design spec):
   - `customer@wabs.com` / `WabsDemo2024!`
   - `manager@wabs.com` / `WabsDemo2024!`
   - `admin@wabs.com` / `WabsDemo2024!`

### Run

```bash
npm run dev            # webpack
npm run dev:turbo      # Turbopack (faster on Windows)
```

Open http://localhost:3000.

## Scripts

| Command | What it does |
|---|---|
| `npm run dev` | Dev server (webpack) |
| `npm run dev:turbo` | Dev server (Turbopack) |
| `npm run build` | Production build |
| `npm start` | Run the production build |
| `npm run lint` | ESLint via `next lint` |
| `npm test` | Vitest, run once |
| `npm run test:watch` | Vitest in watch mode |
| `npm run test:coverage` | Vitest with v8 coverage report |

## Project layout

```
app/                     # Next.js App Router routes
  (auth)/                # login, register, forgot/reset password (middleware redirects authed users away)
  (customer)/            # public site: /, /vehicles, /vehicles/[id], /account, /checkout/*
  management/            # staff-only: /management, /bookings, /vehicles, /calendar
components/              # shared and feature-scoped React components
lib/
  actions/               # 'use server' server actions (checkout, management-*)
  queries/               # read-side Supabase helpers; see lib/supabase/* for client setup
  supabase/              # cookie-bound (SSR), cookie-less (public), and middleware clients
  utils/                 # pure helpers (format, calendar, roles, session, month-range)
  validators/            # Zod schemas and param parsers
supabase/
  migrations/            # ordered SQL migrations (001 → 026)
  seed.sql, seed.runnable.sql
scripts/                 # one-off node scripts: seeding, smoke tests, docs server
docs/superpowers/        # design spec and iterative plans
```

## Testing

```bash
npm test
```

Current coverage: pure helpers (`booking-reference`, `booking-status`, `format`, `calendar`, `month-range`) and Zod validators (`browse`, `management-vehicles`, `calendar`). Server actions and queries are not yet unit-tested — those need a mocked Supabase layer which is a planned follow-up.

CI runs typecheck + lint + tests + build on every push to `master` and every PR via `.github/workflows/ci.yml`.

## Deployment

### Docker

A multi-stage Dockerfile targeting Next.js standalone output ships in the repo root. Build and run:

```bash
docker build -t wabs-car-rental .
docker run -p 3000:3000 \
  -e NEXT_PUBLIC_SUPABASE_URL=... \
  -e NEXT_PUBLIC_SUPABASE_ANON_KEY=... \
  -e SUPABASE_SERVICE_ROLE_KEY=... \
  -e NEXT_PUBLIC_APP_URL=https://your-domain \
  -e PAYMENT_MODE=mock \
  wabs-car-rental
```

The Dockerfile builds on `node:22-alpine` and runs the standalone server as an unprivileged `nextjs` user on port 3000.

### Other targets

- **Vercel**: push to GitHub and import; environment variables go in the project settings.
- **Any Node 22 host**: `npm run build && npm start` with the env vars populated.

## Architecture notes

- **Auth**: Supabase Auth with `@supabase/ssr`. `lib/supabase/server.ts` creates a cookie-aware client memoized per request via React's `cache()`. Middleware (`middleware.ts`) refreshes the session cookie on every request and gates `/management/*` to the `manager`/`admin` role in `public.roles`.
- **Caching**: public vehicle reads use `unstable_cache` with a `vehicles` tag (60s revalidate). Server actions that mutate vehicles call `revalidateTag("vehicles")`.
- **Atomicity**: multi-table writes go through Postgres functions. See `supabase/migrations/024_create_booking_function.sql` (`create_booking_with_availability`) and `026_refund_function.sql` (`refund_booking`).
- **Payment**: currently mock-only. `confirmPayment` writes a `payments` row directly via the service-role client.

## Follow-ups (open backlog)

- Stripe payments (Payment Intents + Elements)
- Vehicle image upload + gallery management
- Click-to-create maintenance/blocked periods on the calendar
- CSV export of bookings
- Email notifications (SMTP integration documented but not wired)
- Server-action unit tests with a mocked Supabase layer
