-- 030: vehicle image management + vehicle duplication.
--
-- Public bucket 'vehicle-images' (fleet photos are public marketing assets).
-- Object path convention: {vehicle_id}/{uuid}.{ext}. Staff-only writes.

INSERT INTO storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
VALUES ('vehicle-images', 'vehicle-images', TRUE, 10485760, ARRAY['image/jpeg','image/png','image/webp'])
ON CONFLICT (id) DO NOTHING;

-- SELECT is needed for storage .list() (used to confirm an upload exists before
-- registering it). Public buckets serve downloads without it, but listing
-- still goes through storage.objects RLS.
CREATE POLICY "vehimg_staff_select" ON storage.objects FOR SELECT TO authenticated
  USING (bucket_id = 'vehicle-images' AND get_user_role(auth.uid()) IN ('manager','admin'));
CREATE POLICY "vehimg_staff_insert" ON storage.objects FOR INSERT TO authenticated
  WITH CHECK (bucket_id = 'vehicle-images' AND get_user_role(auth.uid()) IN ('manager','admin'));
CREATE POLICY "vehimg_staff_update" ON storage.objects FOR UPDATE TO authenticated
  USING (bucket_id = 'vehicle-images' AND get_user_role(auth.uid()) IN ('manager','admin'));
CREATE POLICY "vehimg_staff_delete" ON storage.objects FOR DELETE TO authenticated
  USING (bucket_id = 'vehicle-images' AND get_user_role(auth.uid()) IN ('manager','admin'));

CREATE OR REPLACE FUNCTION assert_staff()
RETURNS VOID
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF COALESCE(get_user_role(auth.uid()), '') NOT IN ('manager','admin') THEN
    RAISE EXCEPTION 'Not authorized' USING ERRCODE = '42501';
  END IF;
END;
$$;

-- Atomic cover swap. The partial unique index from 025 forbids two covers,
-- so the old cover is cleared before the new one is set, in one transaction.
CREATE OR REPLACE FUNCTION set_vehicle_cover(p_image_id UUID)
RETURNS VOID
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_vehicle_id UUID;
BEGIN
  PERFORM assert_staff();
  SELECT vehicle_id INTO v_vehicle_id FROM vehicle_images WHERE id = p_image_id;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'Image not found' USING ERRCODE = 'P0001';
  END IF;
  UPDATE vehicle_images SET is_cover = FALSE WHERE vehicle_id = v_vehicle_id AND is_cover AND id <> p_image_id;
  UPDATE vehicle_images SET is_cover = TRUE WHERE id = p_image_id;
END;
$$;

-- Reorder: p_image_ids must be exactly the vehicle's full image set.
CREATE OR REPLACE FUNCTION reorder_vehicle_images(p_vehicle_id UUID, p_image_ids UUID[])
RETURNS VOID
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_count INT;
BEGIN
  PERFORM assert_staff();
  SELECT COUNT(*) INTO v_count FROM vehicle_images WHERE vehicle_id = p_vehicle_id;
  IF v_count <> COALESCE(array_length(p_image_ids, 1), 0)
     OR v_count <> (SELECT COUNT(*) FROM vehicle_images WHERE vehicle_id = p_vehicle_id AND id = ANY(p_image_ids)) THEN
    RAISE EXCEPTION 'Image list does not match this vehicle' USING ERRCODE = 'P0001';
  END IF;
  UPDATE vehicle_images vi
     SET sort_order = o.ord - 1
    FROM unnest(p_image_ids) WITH ORDINALITY AS o(id, ord)
   WHERE vi.id = o.id;
END;
$$;

-- Duplicate a vehicle as a draft. VIN and plate identify a physical car, so
-- they are cleared. Features, location and image rows are copied; copied
-- image rows share storage objects with the source (delete checks references).
CREATE OR REPLACE FUNCTION duplicate_vehicle(p_vehicle_id UUID)
RETURNS UUID
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_new_id UUID;
BEGIN
  PERFORM assert_staff();

  INSERT INTO vehicles (
    make, model, trim, year, category, vin, license_plate, exterior_color, interior_color,
    seats, doors, transmission, fuel_type, horsepower, drivetrain, description,
    daily_price, weekly_price, monthly_price, deposit_amount, mileage_limit, extra_mileage_price,
    min_rental_days, max_rental_days, status, is_featured, cancellation_policy, rental_requirements
  )
  SELECT
    make, model, trim, year, category, NULL, NULL, exterior_color, interior_color,
    seats, doors, transmission, fuel_type, horsepower, drivetrain, description,
    daily_price, weekly_price, monthly_price, deposit_amount, mileage_limit, extra_mileage_price,
    min_rental_days, max_rental_days, 'draft', FALSE, cancellation_policy, rental_requirements
  FROM vehicles WHERE id = p_vehicle_id
  RETURNING id INTO v_new_id;

  IF v_new_id IS NULL THEN
    RAISE EXCEPTION 'Vehicle not found' USING ERRCODE = 'P0001';
  END IF;

  INSERT INTO vehicle_features (vehicle_id, feature)
  SELECT v_new_id, feature FROM vehicle_features WHERE vehicle_id = p_vehicle_id;

  INSERT INTO vehicle_locations (vehicle_id, name, address, city, state, zip, lat, lng, delivery_available, delivery_fee)
  SELECT v_new_id, name, address, city, state, zip, lat, lng, delivery_available, delivery_fee
  FROM vehicle_locations WHERE vehicle_id = p_vehicle_id;

  INSERT INTO vehicle_images (vehicle_id, storage_path, url, is_cover, sort_order, alt_text, caption)
  SELECT v_new_id, storage_path, url, is_cover, sort_order, alt_text, caption
  FROM vehicle_images WHERE vehicle_id = p_vehicle_id;

  INSERT INTO audit_logs (actor_id, action, entity_type, entity_id, diff)
  VALUES (auth.uid(), 'vehicle.duplicate', 'vehicle', v_new_id, jsonb_build_object('source_id', p_vehicle_id));

  RETURN v_new_id;
END;
$$;

REVOKE ALL ON FUNCTION assert_staff() FROM PUBLIC;
REVOKE ALL ON FUNCTION set_vehicle_cover(UUID) FROM PUBLIC;
REVOKE ALL ON FUNCTION reorder_vehicle_images(UUID, UUID[]) FROM PUBLIC;
REVOKE ALL ON FUNCTION duplicate_vehicle(UUID) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION assert_staff() TO authenticated;
GRANT EXECUTE ON FUNCTION set_vehicle_cover(UUID) TO authenticated;
GRANT EXECUTE ON FUNCTION reorder_vehicle_images(UUID, UUID[]) TO authenticated;
GRANT EXECUTE ON FUNCTION duplicate_vehicle(UUID) TO authenticated;
