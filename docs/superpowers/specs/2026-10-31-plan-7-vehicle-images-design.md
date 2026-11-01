# Plan 7 — Vehicle Images, Duplicate, Booking History (Design)

Source: master spec §8 "Vehicle Management": image management with drag-and-drop reorder,
cover selection, alt text, upload progress, file validation (JPEG/PNG/WebP, max 10 MB);
duplicate vehicle record; view booking history. Design Q&A skipped at user's request;
decisions marked **(call)** are the builder's.

## Decisions
- **Storage (call):** public bucket `vehicle-images` (fleet photos are public marketing assets),
  path `{vehicle_id}/{uuid}.{ext}`, staff-only write/delete policies (migration 030).
- **Upload path (call):** the browser uploads straight to Storage with the staff user's session
  (avoids pushing 10 MB bodies through server actions), then calls `registerVehicleImage`, which
  validates the path belongs to the vehicle, confirms the object exists, and inserts the row.
  On register failure the client removes the object.
- **Progress (call):** supabase-js exposes no byte-level progress, so progress is stage-based
  (uploading → registering → done). Good enough for ≤10 MB files.
- **Limit (call):** 20 images per vehicle.
- **Cover:** first image auto-becomes cover; `set_vehicle_cover` RPC swaps atomically (025's
  partial unique index forbids two covers). Deleting the cover promotes the next image.
- **Reorder:** native HTML5 drag-and-drop plus ← / → buttons (keyboard / touch fallback);
  `reorder_vehicle_images` RPC requires the full, exact image set to prevent stale overwrites.
- **Alt text:** inline field, saves on blur / Enter. Upload defaults it from the filename.
- **Duplicate (call):** `duplicate_vehicle` RPC copies the vehicle as **draft, not featured**,
  clears VIN + licence plate (unique per physical car), copies features, location and image
  rows. Copied image rows share storage objects; delete only removes an object when no row
  references it. Seeded `unsplash/` images never touch storage. Writes an audit log.
- **Booking history:** latest 100 bookings for the vehicle with revenue total
  (confirmed / ready_for_pickup / active / completed).
- `next.config.mjs` allows `*.supabase.co/storage/v1/object/public/**` for `next/image`.

## Non-goals
Image cropping / resizing, captions UI (column exists, unused), bulk delete.
