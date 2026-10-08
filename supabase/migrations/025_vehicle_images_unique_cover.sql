-- Enforce at most one cover image per vehicle.
-- The browse-list query (lib/queries/vehicles.ts) picks vehicle_images[0] from
-- rows filtered by is_cover=true; without this index, two cover rows for the
-- same vehicle would be served nondeterministically.
CREATE UNIQUE INDEX idx_vehicle_images_one_cover
  ON vehicle_images (vehicle_id)
  WHERE is_cover = TRUE;
