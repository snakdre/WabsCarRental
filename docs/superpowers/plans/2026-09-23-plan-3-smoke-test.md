# Plan 3 — Manual Smoke Test Checklist

Prerequisites:
- `npm run dev` on http://localhost:3000
- Migration 024 applied
- Plans 1 & 2 smoke tests still green

## Full happy-path booking
- [ ] `/vehicles/aaaaaaaa-0000-0000-0000-000000000001` — click Reserve
- [ ] Redirected to `/checkout/dates?vehicle=…`
- [ ] Pick pickup date (30 days out) and return date (34 days out); choose "Pickup"; continue
- [ ] Fill driver form with real-looking data; DOB before 2000; license expiry 1 year out; continue
- [ ] On extras: pick "Premium Guard" + GPS Navigation; enter `WABS10`; continue
- [ ] Review page shows correct breakdown with 10% discount and tax
- [ ] Accept terms; submit; land on `/checkout/payment?booking_ref=WBS-…`
- [ ] Enter card number 4242 4242 4242 4242, exp 12/28, cvc 123, zip 90210; submit
- [ ] Land on `/checkout/confirmation/WBS-…` with reference and summary
- [ ] Visit `/account` — new booking appears with `confirmed` status pill

## Step guards
- [ ] `/checkout/driver` without params → redirects to `/checkout/dates` (or `/vehicles`)
- [ ] `/checkout/review` without driver params → redirects earlier
- [ ] `/checkout/payment?booking_ref=<someone-elses>` → 404
- [ ] `/checkout/confirmation/<bogus>` → 404
- [ ] Direct navigation to `/checkout` (no vehicle) → redirects to `/vehicles`

## Business rules
- [ ] DOB making driver <25 at pickup → error at Step 4 submit
- [ ] License expiring before pickup date → error at Step 4 submit
- [ ] Return date before/equal pickup → client-side error at Step 1
- [ ] Bogus promo code → server error at Step 4 submit (no discount)

## Payment validation
- [ ] Card 1234 1234 1234 1234 (fails Luhn) → error before server call
- [ ] Missing CVC → HTML5 required error

## Overlap
- [ ] Complete a booking for dates A-B
- [ ] Try to book same vehicle for A-B (different customer) → error "these dates were just taken"

## Regression
- [ ] Plan 1 smoke test: 12/12
- [ ] Plan 2 smoke test: 20/20
