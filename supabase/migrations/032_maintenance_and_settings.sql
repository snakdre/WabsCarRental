-- 032: maintenance records workflow + admin settings.

-- ------------------------------------------------------------------
-- Maintenance records
-- A record owns one vehicle_availability row (type 'maintenance') so the
-- calendar and customer availability honour it, and the exclusion
-- constraint (008) prevents scheduling over a booking.
-- ------------------------------------------------------------------
ALTER TABLE maintenance_records
  ADD COLUMN IF NOT EXISTS status TEXT NOT NULL DEFAULT 'scheduled'
    CHECK (status IN ('scheduled','in_progress','completed','cancelled')),
  ADD COLUMN IF NOT EXISTS category TEXT NOT NULL DEFAULT 'service'
    CHECK (category IN ('service','repair','inspection','tires','detailing','other')),
  ADD COLUMN IF NOT EXISTS availability_id UUID REFERENCES vehicle_availability(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS completed_at TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW();

CREATE INDEX IF NOT EXISTS idx_maintenance_status ON maintenance_records(status);
CREATE INDEX IF NOT EXISTS idx_maintenance_service_date ON maintenance_records(service_date);

-- Guard (also in 030/031; CREATE OR REPLACE keeps migrations order-independent).
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
REVOKE ALL ON FUNCTION assert_staff() FROM PUBLIC;
GRANT EXECUTE ON FUNCTION assert_staff() TO authenticated;

-- Create a record + its availability block atomically.
-- p_return_date NULL means "open-ended": blocks the service day only until
-- completed (staff should set an expected return date for multi-day work).
CREATE OR REPLACE FUNCTION staff_create_maintenance(
  p_vehicle_id UUID,
  p_category TEXT,
  p_service_date DATE,
  p_return_date DATE,
  p_description TEXT,
  p_vendor TEXT,
  p_cost NUMERIC,
  p_odometer INT
)
RETURNS UUID
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_avail_id UUID;
  v_id UUID;
  v_end DATE := COALESCE(p_return_date, p_service_date);
BEGIN
  PERFORM assert_staff();
  IF v_end < p_service_date THEN
    RAISE EXCEPTION 'Return date must be on or after service date' USING ERRCODE = 'P0001';
  END IF;

  INSERT INTO vehicle_availability (vehicle_id, start_date, end_date, type, reason, created_by)
  VALUES (p_vehicle_id, p_service_date, v_end, 'maintenance',
          INITCAP(p_category) || COALESCE(': ' || NULLIF(TRIM(p_description), ''), ''), auth.uid())
  RETURNING id INTO v_avail_id;

  INSERT INTO maintenance_records (
    vehicle_id, category, service_date, return_date, description, vendor, cost, odometer,
    status, availability_id, created_by
  ) VALUES (
    p_vehicle_id, p_category, p_service_date, p_return_date, NULLIF(TRIM(p_description), ''),
    NULLIF(TRIM(p_vendor), ''), p_cost, p_odometer,
    CASE WHEN p_service_date <= CURRENT_DATE THEN 'in_progress' ELSE 'scheduled' END,
    v_avail_id, auth.uid()
  )
  RETURNING id INTO v_id;

  UPDATE vehicle_availability SET reference_id = v_id WHERE id = v_avail_id;

  -- Vehicle goes to maintenance now only if the work starts today or earlier
  -- and the car isn't out on a rental.
  IF p_service_date <= CURRENT_DATE THEN
    UPDATE vehicles SET status = 'maintenance', updated_at = NOW()
     WHERE id = p_vehicle_id AND status IN ('available','reserved');
  END IF;

  INSERT INTO audit_logs (actor_id, action, entity_type, entity_id, diff)
  VALUES (auth.uid(), 'maintenance.create', 'maintenance', v_id,
          jsonb_build_object('vehicle_id', p_vehicle_id, 'from', p_service_date, 'to', v_end));
  RETURN v_id;
END;
$$;

-- Status transitions. Completing / cancelling releases the calendar block
-- (completing trims it to end today so history stays truthful) and frees the
-- vehicle if no other open maintenance remains.
CREATE OR REPLACE FUNCTION staff_set_maintenance_status(
  p_id UUID,
  p_status TEXT,
  p_cost NUMERIC,
  p_odometer INT
)
RETURNS VOID
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_r RECORD;
  v_open INT;
BEGIN
  PERFORM assert_staff();
  SELECT * INTO v_r FROM maintenance_records WHERE id = p_id FOR UPDATE;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'Maintenance record not found' USING ERRCODE = 'P0001';
  END IF;

  IF NOT (
    (v_r.status = 'scheduled' AND p_status IN ('in_progress','completed','cancelled')) OR
    (v_r.status = 'in_progress' AND p_status IN ('completed','cancelled'))
  ) THEN
    RAISE EXCEPTION 'Cannot move maintenance from % to %', v_r.status, p_status USING ERRCODE = 'P0001';
  END IF;

  UPDATE maintenance_records
     SET status = p_status,
         cost = COALESCE(p_cost, cost),
         odometer = COALESCE(p_odometer, odometer),
         completed_at = CASE WHEN p_status = 'completed' THEN NOW() ELSE completed_at END,
         return_date = CASE WHEN p_status = 'completed' THEN LEAST(COALESCE(return_date, CURRENT_DATE), CURRENT_DATE) ELSE return_date END,
         updated_at = NOW()
   WHERE id = p_id;

  IF p_status = 'in_progress' THEN
    UPDATE vehicles SET status = 'maintenance', updated_at = NOW()
     WHERE id = v_r.vehicle_id AND status IN ('available','reserved');
  ELSIF p_status = 'cancelled' THEN
    DELETE FROM vehicle_availability WHERE id = v_r.availability_id;
  ELSIF p_status = 'completed' THEN
    -- Keep the past part of the block (history); drop it if work never started.
    DELETE FROM vehicle_availability WHERE id = v_r.availability_id AND start_date > CURRENT_DATE;
    UPDATE vehicle_availability SET end_date = GREATEST(start_date, LEAST(end_date, CURRENT_DATE))
     WHERE id = v_r.availability_id;
  END IF;

  IF p_status IN ('completed','cancelled') THEN
    SELECT COUNT(*) INTO v_open FROM maintenance_records
     WHERE vehicle_id = v_r.vehicle_id AND status = 'in_progress' AND id <> p_id;
    IF v_open = 0 THEN
      UPDATE vehicles SET status = 'available', updated_at = NOW()
       WHERE id = v_r.vehicle_id AND status = 'maintenance';
    END IF;
  END IF;

  INSERT INTO audit_logs (actor_id, action, entity_type, entity_id, diff)
  VALUES (auth.uid(), 'maintenance.' || p_status, 'maintenance', p_id,
          jsonb_build_object('from', v_r.status, 'to', p_status, 'cost', p_cost));
END;
$$;

REVOKE ALL ON FUNCTION staff_create_maintenance(UUID, TEXT, DATE, DATE, TEXT, TEXT, NUMERIC, INT) FROM PUBLIC;
REVOKE ALL ON FUNCTION staff_set_maintenance_status(UUID, TEXT, NUMERIC, INT) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION staff_create_maintenance(UUID, TEXT, DATE, DATE, TEXT, TEXT, NUMERIC, INT) TO authenticated;
GRANT EXECUTE ON FUNCTION staff_set_maintenance_status(UUID, TEXT, NUMERIC, INT) TO authenticated;

-- ------------------------------------------------------------------
-- Settings
-- 023's settings_select_auth exposed every key (including future
-- operational ones) to any signed-in customer. Split into a public
-- allowlist + staff read; admin write is unchanged (settings_all_admin).
-- ------------------------------------------------------------------
DROP POLICY IF EXISTS "settings_select_auth" ON application_settings;

CREATE POLICY "settings_select_public_keys" ON application_settings FOR SELECT
  USING (key IN ('tax_rate','currency','min_driver_age','business_name','business_email','business_phone'));
CREATE POLICY "settings_select_staff" ON application_settings FOR SELECT
  USING (get_user_role(auth.uid()) IN ('manager','admin'));
