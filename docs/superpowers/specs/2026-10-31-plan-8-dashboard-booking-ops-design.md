# Plan 8 — Dashboard Analytics + Booking Operations (Design)

Source: master spec §8. Dashboard: revenue trend chart, top 5 most-rented vehicles, recent
activity feed. Booking management: manual booking creation, vehicle reassignment, pickup /
return recording, document review panel. Design Q&A skipped at user's request; decisions marked
**(call)** are the builder's.

## Security fix found while building
`create_booking_with_availability` (024) is SECURITY DEFINER, trusts `customer_id` and every
price in its JSON payload, and was executable by any signed-in user through PostgREST, so a
customer could set their own total or book as someone else. Migration 031 restricts it to
`service_role`; checkout and manual booking call it through the service client after
server-side validation and pricing. `scripts/smoke-test-checkout.mjs` now asserts a customer
call is rejected.

## Dashboard
- **Revenue trend (call):** 12-month column chart, single series in brand `gold-muted`
  (#B8963E). Revenue is recognised by booking `created_at` for confirmed / ready / active /
  completed bookings. The "Revenue this month" tile reads from the same series, so the two
  always agree. (The old tile also counted `pending`; that query was removed.)
  - Dataviz rules applied: no legend (one series, title names it), ≤24px columns with a 4px
    rounded data end, 1px solid recessive grid, compact axis ticks, direct label on the latest
    month only, per-column hover/focus tooltip with a full-band hit target, and a table view.
    #B8963E is 2.74:1 on white (validator WARN), so values are always reachable via tooltip,
    the direct label and the table.
- **Top 5 vehicles (call):** last 365 days by rental count (revenue as tiebreak), ranked bars,
  every value printed.
- **Activity feed:** latest 12 `booking_status_history` rows with reference, status, note and
  relative time.
- Analytics run in staff-guarded SECURITY DEFINER functions (`staff_revenue_by_month`,
  `staff_top_vehicles`).

## Booking operations
- **Pickup / return (call):** new columns on `bookings` (recorded_at, odometer, fuel %, notes
  for each). `staff_record_pickup` moves confirmed / ready to `active` and the vehicle to
  `rented`; `staff_record_return` moves `active` to `completed`, rejects an odometer below
  pickup, and sets the vehicle back to `available` only if it's still `rented`. The generic
  status buttons no longer offer Active / Completed, so handover data is always captured.
- **Reassign (call):** pending / confirmed / ready only; target must not be draft, inactive or
  maintenance; availability block moves in the same transaction (exclusion constraint catches
  overlaps); **price stays as booked**; history and audit log rows written.
- **Manual booking (call):** existing registered customers only (no guest accounts). Staff
  choose customer, vehicle, dates, optional protection plan and driver details (prefilled from
  the profile). Same rules as checkout: 25+, licence valid past pickup, min / max days,
  delivery availability. **Price is always calculated by the server**; staff can't type a total.
  Optional "confirmed" status and in-person payment (`payments.method = 'cash'`). Customer gets
  a notification; audit log written. Pickup only (delivery and extras stay online-only, kept
  simple).
- **Document review panel:** on booking detail, shows the customer's documents with signed
  URLs, Verify / Unverify (reuses Plan 6), and a "verified licence on file" banner.
- **Payments list** on booking detail.

## Depends on
Plan 6 (#17) for customer queries + verify action and Plan 5 (#16) for document storage.
