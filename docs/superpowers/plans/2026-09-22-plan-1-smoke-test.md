# Plan 1 — Smoke Test Checklist (Task 8, deferred)

Task 8 in `2026-09-22-plan-1-foundation.md` requires a live Supabase project. Run these steps once your Supabase project is provisioned and env vars are set.

## Prerequisites

1. Supabase project created; project URL + anon key + service role key copied.
2. `.env.local` created from `.env.example` with real values for:
   - `NEXT_PUBLIC_SUPABASE_URL`
   - `NEXT_PUBLIC_SUPABASE_ANON_KEY`
   - `SUPABASE_SERVICE_ROLE_KEY`
   - `NEXT_PUBLIC_APP_URL=http://localhost:3000`
3. Migrations applied: paste each file in `supabase/migrations/001_*.sql` through `023_*.sql` into Supabase SQL Editor in order, or `supabase db push` if the CLI is set up.
4. Demo users created in Supabase Dashboard → Authentication → Users:
   - `customer@wabs.com` / `WabsDemo2024!`
   - `manager@wabs.com` / `WabsDemo2024!`
   - `admin@wabs.com` / `WabsDemo2024!`
5. Copy each user's UUID from the Users table, then in `supabase/seed.sql`:
   - Uncomment the two `UPDATE roles` lines
   - Replace `MANAGER_UUID` / `ADMIN_UUID` with real UUIDs
   - Run the seed in the SQL Editor.

## Run

```bash
npm run dev
```

Expected: server on http://localhost:3000

## Verification

### Redirect / RBAC
- [ ] Visit `/account` unauthenticated → redirects to `/login`
- [ ] Visit `/management` unauthenticated → redirects to `/login`
- [ ] Log in as `manager@wabs.com` → `/management` loads (currently a stub 404 or blank — that's fine for Plan 1; the point is no redirect)
- [ ] Log in as `customer@wabs.com` → `/management` redirects to `/`
- [ ] As `manager@wabs.com`, `/management/settings` redirects to `/management`
- [ ] As `admin@wabs.com`, `/management/settings` loads (stub is fine)

### Registration
- [ ] `/register` — create a fresh account
- [ ] Redirects to `/account` on success
- [ ] Supabase Dashboard → Auth → Users shows the new user
- [ ] `profiles` table has a row for the new user (auto-created by trigger in migration 002)
- [ ] `roles` table has `role='customer'` for the new user

### Password reset
- [ ] `/forgot-password` — enter a valid email → shows "Check your email"
- [ ] Actual email delivery depends on Supabase email config; UI success is enough for Plan 1

## Notes
- `/management`, `/management/settings`, `/account`, `/account/bookings/[id]`, `/checkout` are not yet implemented (planned for later plans). The middleware still enforces access; those routes will 404 for now, but the redirect behavior is what we're verifying.
- If migrations fail, check that PostgreSQL extensions `uuid-ossp` and `btree_gist` are enabled in your project.
