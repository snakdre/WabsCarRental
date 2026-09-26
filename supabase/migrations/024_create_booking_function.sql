-- Atomic booking creation.
-- Runs booking INSERT + availability INSERT + extras INSERT + promo bump
-- in one transaction. If the exclusion constraint on vehicle_availability
-- fires (dates overlap another booking or maintenance), everything rolls back.
--
-- SECURITY DEFINER because customers have no direct INSERT policy on
-- vehicle_availability (staff-only per migration 023). The function
-- is the trusted seam for the atomic write.

CREATE OR REPLACE FUNCTION create_booking_with_availability(p_booking JSONB)
RETURNS TEXT
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_ref TEXT;
  v_id UUID;
BEGIN
  v_ref := p_booking->>'reference';

  INSERT INTO bookings (
    reference, customer_id, vehicle_id, pickup_date, return_date, pickup_method,
    pickup_location_id, driver_name, driver_email, driver_phone, driver_dob,
    license_number, license_expiry, license_region, rental_days, base_price,
    delivery_fee, tax_amount, protection_fee, extras_fee, discount_amount,
    deposit_amount, total_amount, status, promo_code_id, protection_plan_id,
    special_requests, terms_accepted
  )
  SELECT
    v_ref,
    (p_booking->>'customer_id')::UUID,
    (p_booking->>'vehicle_id')::UUID,
    (p_booking->>'pickup_date')::TIMESTAMPTZ,
    (p_booking->>'return_date')::TIMESTAMPTZ,
    p_booking->>'pickup_method',
    NULLIF(p_booking->>'pickup_location_id', '')::UUID,
    p_booking->>'driver_name',
    p_booking->>'driver_email',
    p_booking->>'driver_phone',
    (p_booking->>'driver_dob')::DATE,
    p_booking->>'license_number',
    (p_booking->>'license_expiry')::DATE,
    p_booking->>'license_region',
    (p_booking->>'rental_days')::INT,
    (p_booking->>'base_price')::NUMERIC,
    COALESCE((p_booking->>'delivery_fee')::NUMERIC, 0),
    COALESCE((p_booking->>'tax_amount')::NUMERIC, 0),
    COALESCE((p_booking->>'protection_fee')::NUMERIC, 0),
    COALESCE((p_booking->>'extras_fee')::NUMERIC, 0),
    COALESCE((p_booking->>'discount_amount')::NUMERIC, 0),
    COALESCE((p_booking->>'deposit_amount')::NUMERIC, 0),
    (p_booking->>'total_amount')::NUMERIC,
    'pending',
    NULLIF(p_booking->>'promo_code_id', '')::UUID,
    NULLIF(p_booking->>'protection_plan_id', '')::UUID,
    p_booking->>'special_requests',
    TRUE
  RETURNING id INTO v_id;

  INSERT INTO vehicle_availability (
    vehicle_id, start_date, end_date, type, reference_id, created_by
  ) VALUES (
    (p_booking->>'vehicle_id')::UUID,
    (p_booking->>'pickup_date')::DATE,
    (p_booking->>'return_date')::DATE,
    'booking',
    v_id,
    (p_booking->>'customer_id')::UUID
  );

  INSERT INTO booking_extras (booking_id, extra_id, quantity, unit_price)
  SELECT
    v_id,
    (e->>'extra_id')::UUID,
    (e->>'quantity')::INT,
    (e->>'unit_price')::NUMERIC
  FROM jsonb_array_elements(COALESCE(p_booking->'extras', '[]'::jsonb)) e;

  IF p_booking->>'promo_code_id' IS NOT NULL AND p_booking->>'promo_code_id' != '' THEN
    UPDATE promo_codes
    SET used_count = used_count + 1
    WHERE id = (p_booking->>'promo_code_id')::UUID;
  END IF;

  RETURN v_ref;
END;
$$;

GRANT EXECUTE ON FUNCTION create_booking_with_availability(JSONB) TO authenticated;
