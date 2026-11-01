-- 031: dashboard analytics, booking operations (reassign, pickup/return),
-- and a security fix for create_booking_with_availability.

-- ------------------------------------------------------------------
-- SECURITY FIX
-- create_booking_with_availability (024) is SECURITY DEFINER and trusted
-- customer_id + every price field from its JSON argument, while being
-- executable by any authenticated user via PostgREST. A customer could
-- book on behalf of another user or choose their own total.
-- From now on only the service role (server actions, after server-side
-- validation and pricing) may call it.
-- ------------------------------------------------------------------
REVOKE EXECUTE ON FUNCTION create_booking_with_availability(JSONB) FROM PUBLIC;
REVOKE EXECUTE ON FUNCTION create_booking_with_availability(JSONB) FROM authenticated;
REVOKE EXECUTE ON FUNCTION create_booking_with_availability(JSONB) FROM anon;
GRANT EXECUTE ON FUNCTION create_booking_with_availability(JSONB) TO service_role;

-- ------------------------------------------------------------------
-- Pickup / return recording columns
-- ------------------------------------------------------------------
ALTER TABLE bookings
  ADD COLUMN IF NOT EXISTS pickup_recorded_at TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS pickup_odometer INTEGER CHECK (pickup_odometer >= 0),
  ADD COLUMN IF NOT EXISTS pickup_fuel_level INTEGER CHECK (pickup_fuel_level BETWEEN 0 AND 100),
  ADD COLUMN IF NOT EXISTS pickup_notes TEXT,
  ADD COLUMN IF NOT EXISTS return_recorded_at TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS return_odometer INTEGER CHECK (return_odometer >= 0),
  ADD COLUMN IF NOT EXISTS return_fuel_level INTEGER CHECK (return_fuel_level BETWEEN 0 AND 100),
  ADD COLUMN IF NOT EXISTS return_notes TEXT;

-- Staff-only role guard (also defined in 030; CREATE OR REPLACE keeps the
-- two migrations independent of merge order).
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

-- ------------------------------------------------------------------
-- Dashboard analytics
-- Revenue is recognised by booking created_at, matching the existing
-- "Revenue this month" KPI so the tile and the chart agree.
-- ------------------------------------------------------------------
CREATE OR REPLACE FUNCTION staff_revenue_by_month(p_months INT DEFAULT 12)
RETURNS TABLE (month DATE, revenue NUMERIC, bookings BIGINT)
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  PERFORM assert_staff();
  RETURN QUERY
  WITH months AS (
    SELECT generate_series(
      date_trunc('month', NOW() AT TIME ZONE 'UTC') - make_interval(months => GREATEST(p_months, 1) - 1),
      date_trunc('month', NOW() AT TIME ZONE 'UTC'),
      INTERVAL '1 month'
    )::DATE AS m
  )
  SELECT
    months.m,
    COALESCE(SUM(b.total_amount), 0)::NUMERIC,
    COUNT(b.id)
  FROM months
  LEFT JOIN bookings b
    ON date_trunc('month', b.created_at AT TIME ZONE 'UTC')::DATE = months.m
   AND b.status IN ('confirmed','ready_for_pickup','active','completed')
  GROUP BY months.m
  ORDER BY months.m;
END;
$$;

CREATE OR REPLACE FUNCTION staff_top_vehicles(p_limit INT DEFAULT 5, p_days INT DEFAULT 365)
RETURNS TABLE (vehicle_id UUID, label TEXT, rentals BIGINT, revenue NUMERIC)
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  PERFORM assert_staff();
  RETURN QUERY
  SELECT
    v.id,
    (v.year || ' ' || v.make || ' ' || v.model)::TEXT,
    COUNT(b.id),
    COALESCE(SUM(b.total_amount), 0)::NUMERIC
  FROM bookings b
  JOIN vehicles v ON v.id = b.vehicle_id
  WHERE b.status IN ('confirmed','ready_for_pickup','active','completed')
    AND b.created_at >= NOW() - make_interval(days => GREATEST(p_days, 1))
  GROUP BY v.id
  ORDER BY COUNT(b.id) DESC, SUM(b.total_amount) DESC
  LIMIT LEAST(GREATEST(p_limit, 1), 20);
END;
$$;

REVOKE ALL ON FUNCTION staff_revenue_by_month(INT) FROM PUBLIC;
REVOKE ALL ON FUNCTION staff_top_vehicles(INT, INT) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION staff_revenue_by_month(INT) TO authenticated;
GRANT EXECUTE ON FUNCTION staff_top_vehicles(INT, INT) TO authenticated;

-- ------------------------------------------------------------------
-- Vehicle reassignment: moves the booking's availability block to the new
-- vehicle in the same transaction. The exclusion constraint on
-- vehicle_availability (008) rejects overlaps with SQLSTATE 23P01.
-- Price is intentionally left unchanged (staff can note any adjustment).
-- ------------------------------------------------------------------
CREATE OR REPLACE FUNCTION staff_reassign_vehicle(p_booking_id UUID, p_vehicle_id UUID, p_note TEXT)
RETURNS VOID
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_b RECORD;
  v_vehicle_status TEXT;
  v_label TEXT;
BEGIN
  PERFORM assert_staff();

  SELECT id, vehicle_id, status INTO v_b FROM bookings WHERE id = p_booking_id FOR UPDATE;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'Booking not found' USING ERRCODE = 'P0001';
  END IF;
  IF v_b.status NOT IN ('pending','confirmed','ready_for_pickup') THEN
    RAISE EXCEPTION 'Booking cannot be reassigned in status %', v_b.status USING ERRCODE = 'P0001';
  END IF;
  IF v_b.vehicle_id = p_vehicle_id THEN
    RAISE EXCEPTION 'Booking is already on this vehicle' USING ERRCODE = 'P0001';
  END IF;

  SELECT status, year || ' ' || make || ' ' || model INTO v_vehicle_status, v_label
    FROM vehicles WHERE id = p_vehicle_id;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'Vehicle not found' USING ERRCODE = 'P0001';
  END IF;
  IF v_vehicle_status IN ('draft','inactive','maintenance') THEN
    RAISE EXCEPTION 'Vehicle is not bookable (status %)', v_vehicle_status USING ERRCODE = 'P0001';
  END IF;

  UPDATE vehicle_availability
     SET vehicle_id = p_vehicle_id
   WHERE reference_id = p_booking_id AND type = 'booking';

  UPDATE bookings SET vehicle_id = p_vehicle_id, updated_at = NOW() WHERE id = p_booking_id;

  INSERT INTO booking_status_history (booking_id, status, changed_by, note)
  VALUES (p_booking_id, v_b.status, auth.uid(),
          'Vehicle reassigned to ' || v_label || COALESCE(': ' || NULLIF(TRIM(p_note), ''), ''));

  INSERT INTO audit_logs (actor_id, action, entity_type, entity_id, diff)
  VALUES (auth.uid(), 'booking.reassign_vehicle', 'booking', p_booking_id,
          jsonb_build_object('from', v_b.vehicle_id, 'to', p_vehicle_id));
END;
$$;

-- ------------------------------------------------------------------
-- Pickup / return recording. These are the only path to 'active' and
-- 'completed' from the console so odometer + fuel are always captured.
-- ------------------------------------------------------------------
CREATE OR REPLACE FUNCTION staff_record_pickup(
  p_booking_id UUID, p_odometer INT, p_fuel INT, p_notes TEXT
)
RETURNS VOID
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_b RECORD;
BEGIN
  PERFORM assert_staff();
  SELECT id, vehicle_id, status INTO v_b FROM bookings WHERE id = p_booking_id FOR UPDATE;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'Booking not found' USING ERRCODE = 'P0001';
  END IF;
  IF v_b.status NOT IN ('confirmed','ready_for_pickup') THEN
    RAISE EXCEPTION 'Pickup can only be recorded for confirmed or ready bookings (status %)', v_b.status USING ERRCODE = 'P0001';
  END IF;

  UPDATE bookings
     SET status = 'active',
         pickup_recorded_at = NOW(),
         pickup_odometer = p_odometer,
         pickup_fuel_level = p_fuel,
         pickup_notes = NULLIF(TRIM(p_notes), ''),
         updated_at = NOW()
   WHERE id = p_booking_id;

  UPDATE vehicles SET status = 'rented', updated_at = NOW() WHERE id = v_b.vehicle_id;

  INSERT INTO booking_status_history (booking_id, status, changed_by, note)
  VALUES (p_booking_id, 'active', auth.uid(),
          'Picked up · ' || p_odometer || ' mi · fuel ' || p_fuel || '%' || COALESCE(' · ' || NULLIF(TRIM(p_notes), ''), ''));

  INSERT INTO audit_logs (actor_id, action, entity_type, entity_id, diff)
  VALUES (auth.uid(), 'booking.record_pickup', 'booking', p_booking_id,
          jsonb_build_object('odometer', p_odometer, 'fuel', p_fuel));
END;
$$;

CREATE OR REPLACE FUNCTION staff_record_return(
  p_booking_id UUID, p_odometer INT, p_fuel INT, p_notes TEXT
)
RETURNS VOID
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_b RECORD;
BEGIN
  PERFORM assert_staff();
  SELECT id, vehicle_id, status, pickup_odometer INTO v_b FROM bookings WHERE id = p_booking_id FOR UPDATE;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'Booking not found' USING ERRCODE = 'P0001';
  END IF;
  IF v_b.status <> 'active' THEN
    RAISE EXCEPTION 'Return can only be recorded for active bookings (status %)', v_b.status USING ERRCODE = 'P0001';
  END IF;
  IF v_b.pickup_odometer IS NOT NULL AND p_odometer < v_b.pickup_odometer THEN
    RAISE EXCEPTION 'Return odometer is below pickup odometer (%)', v_b.pickup_odometer USING ERRCODE = 'P0001';
  END IF;

  UPDATE bookings
     SET status = 'completed',
         return_recorded_at = NOW(),
         return_odometer = p_odometer,
         return_fuel_level = p_fuel,
         return_notes = NULLIF(TRIM(p_notes), ''),
         updated_at = NOW()
   WHERE id = p_booking_id;

  -- Only flip the car back to available if it is still marked rented
  -- (staff may have moved it to maintenance meanwhile).
  UPDATE vehicles SET status = 'available', updated_at = NOW()
   WHERE id = v_b.vehicle_id AND status = 'rented';

  INSERT INTO booking_status_history (booking_id, status, changed_by, note)
  VALUES (p_booking_id, 'completed', auth.uid(),
          'Returned · ' || p_odometer || ' mi · fuel ' || p_fuel || '%' || COALESCE(' · ' || NULLIF(TRIM(p_notes), ''), ''));

  INSERT INTO audit_logs (actor_id, action, entity_type, entity_id, diff)
  VALUES (auth.uid(), 'booking.record_return', 'booking', p_booking_id,
          jsonb_build_object('odometer', p_odometer, 'fuel', p_fuel,
                             'distance', p_odometer - COALESCE(v_b.pickup_odometer, p_odometer)));
END;
$$;

REVOKE ALL ON FUNCTION staff_reassign_vehicle(UUID, UUID, TEXT) FROM PUBLIC;
REVOKE ALL ON FUNCTION staff_record_pickup(UUID, INT, INT, TEXT) FROM PUBLIC;
REVOKE ALL ON FUNCTION staff_record_return(UUID, INT, INT, TEXT) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION staff_reassign_vehicle(UUID, UUID, TEXT) TO authenticated;
GRANT EXECUTE ON FUNCTION staff_record_pickup(UUID, INT, INT, TEXT) TO authenticated;
GRANT EXECUTE ON FUNCTION staff_record_return(UUID, INT, INT, TEXT) TO authenticated;
