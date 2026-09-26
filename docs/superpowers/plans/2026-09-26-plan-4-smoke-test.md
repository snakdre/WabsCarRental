# Plan 4 — Manual Smoke Test Checklist

Prerequisites:
- `npm run dev` on http://localhost:3000
- Plans 1-3 smoke tests still green
- At least one confirmed booking in the DB (from Plan 3 smoke or manual test flow)

## Sidebar + layout
- [ ] Signed in as manager or admin, visiting `/management/bookings` shows the sidebar
- [ ] "Bookings" nav item is highlighted (gold background)
- [ ] Disabled items (Vehicles, Customers, Calendar, Maintenance, Settings) render greyed out and do not link anywhere

## List page
- [ ] Table shows all bookings sorted by created_at DESC
- [ ] Status pill matches Plan 3 /account style
- [ ] Clicking a status chip updates the URL (`?status=…`) and filters the table
- [ ] Clicking the "All" chip removes the status param
- [ ] Typing in the search input filters after ~400ms; URL updates to `?search=…`
- [ ] Search matches by reference, driver name, driver email
- [ ] Empty state renders when no bookings match

## Detail page
- [ ] Clicking a row navigates to `/management/bookings/[id]`
- [ ] All summary sections render (Trip, Driver, Pricing, Special requests when present)
- [ ] Status history timeline shows chronological transitions with timestamps
- [ ] Only valid next-status buttons visible for the current status
- [ ] Terminal states (completed, cancelled, rejected, refunded) show "This booking is in a final state" message
- [ ] Approve / Mark ready / Mark active / Mark completed submit directly
- [ ] Cancel / Reject open a confirm dialog with optional note field
- [ ] Refund opens a confirm dialog with a required note; submit is disabled while note is empty
- [ ] Notes editor prefills existing internal_notes; save shows "Saved" indicator; value persists on reload
- [ ] Direct navigation to `/management/bookings/<random-uuid>` returns 404
- [ ] Direct navigation to `/management/bookings/not-a-uuid` returns 404

## Cancel/reject side effect
- [ ] Cancel a `confirmed` booking
- [ ] Attempt Plan 3 checkout for the same vehicle + same dates as a different customer → checkout succeeds (dates freed)

## Refund flow
- [ ] From a `confirmed` booking, click Refund → dialog opens
- [ ] Submit with empty note → button disabled
- [ ] Enter a reason → submit → booking status becomes `refunded`; timeline shows the note

## Access control (regression)
- [ ] Sign in as customer → visit `/management/bookings` → redirected to `/`
- [ ] Sign out → visit `/management/bookings` → redirected to `/login`

## Full regression
- [ ] `smoke-test-auth.mjs` — 12/12
- [ ] `smoke-test-browse.mjs` — 20/20
- [ ] `smoke-test-checkout.mjs` — 11/11
- [ ] `smoke-test-management-bookings.mjs` — 17/17
