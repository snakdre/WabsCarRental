# Plan 5 — Customer Account Area (Design)

Source: master spec §4 (`/account`, `/account/bookings/[id]`) and §5 (profiles, favorites,
customer_documents, notifications). The user asked to implement all remaining spec work and
skipped design Q&A; every decision below not in the master spec is the builder's call and is
marked **(call)**.

## Intent
Give a signed-in customer one place to manage their relationship with Wabs: see and cancel
bookings, keep their profile current, keep favorite cars, upload licence/passport documents
for staff review, and read notifications.

## Goals
- `/account` with five tabs: Bookings (default), Profile, Favorites, Documents, Notifications.
- `/account/bookings/[id]` — full booking detail, price breakdown, status timeline, cancel.
- Favorite toggle on `/vehicles/[id]`.

## Non-goals
- Email delivery (master spec §11). Reviews submission (not in page map).
- Avatar upload. Account deletion.

## Decisions
- **Tabs (call):** `?tab=` query param links, each tab a server component. No client tab state.
- **Cancellation window (call):** customer may cancel when status ∈ {pending, confirmed,
  ready_for_pickup} AND pickup is more than 24 h away. Enforced in the server action *and*
  inside the RPC.
- **Cancellation RPC (call):** new `cancel_my_booking(p_booking_id, p_reason)` SECURITY DEFINER
  function (migration 027). Verifies `customer_id = auth.uid()`, status, and window; sets
  status `cancelled`; inserts status history (changed_by = customer); deletes `booking`
  availability rows; if a completed payment exists, inserts a full refund row and marks the
  payment `refunded` (booking stays `cancelled` — the history note records the refund);
  inserts a notification for the customer. Needed because RLS gives customers no UPDATE on
  bookings.
- **Documents (call):** private Storage bucket `customer-documents` (migration 028), object
  path `{user_id}/{uuid}.{ext}`, storage RLS restricted to the owner's folder plus staff read.
  `url` column stores the storage path (column is NOT NULL); viewing uses 1-hour signed URLs.
  Allowed: JPEG/PNG/WebP/PDF, ≤10 MB. Customers may delete only unverified documents.
- **Profile:** edit first/last name, phone, date of birth, address {line1, city, state, zip}.
  Email is shown read-only.
- **Notifications:** list newest first, mark one / mark all read. Unread count shown on the tab.

## Constraints
- Follow existing patterns: zod validators in `lib/validators`, `"use server"` actions returning
  `{ success | error, field }`, queries in `lib/queries`, `uuidLike` for IDs, vitest with
  `createMockSupabase`.
