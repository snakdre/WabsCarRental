# Plan 6 — Management Customers (Design)

Source: master spec §4 (`/management/customers`, `/management/customers/[id]`) and §6 (audit trail).
Design Q&A skipped at user's request; decisions marked **(call)** are the builder's.

## Goals
- Customer list: search (name / email / phone), flagged filter, booking count, total spent,
  last booking, documents awaiting review.
- Customer profile: contact info, booking history (linked), documents with view + verify,
  flag / unflag, deactivate / reactivate, internal notes.
- Every mutation writes `audit_logs` (spec §6).

## Decisions
- **Emails (call):** `auth.users` isn't readable through RLS, so migration 029 adds
  SECURITY DEFINER `staff_list_customers(search, flagged)` and `staff_customer_email(id)`,
  both guarded by manager/admin role. No service-role key in request paths.
- **List scope (call):** only users whose role is `customer`; capped at 500 rows (no pagination
  yet, fleet business scale).
- **"Spent" (call):** sum of `total_amount` for confirmed / ready_for_pickup / active / completed.
- **Deactivate (call):** sets `profiles.is_active = false` only — informational; does not block
  sign-in (would need auth admin API). Flag is likewise a staff-visible marker.
- **Verify document (call):** also inserts a customer notification. Staff notification-insert
  and audit-insert policies added in 029.
- Server actions re-check staff role (defence in depth beyond middleware + RLS).

## Depends on
Plan 5 migration 028 (storage bucket, staff UPDATE on customer_documents).
