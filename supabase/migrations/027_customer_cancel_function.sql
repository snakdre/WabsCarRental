-- 027: customer self-service cancellation + hardening of refund_booking.
--
-- cancel_my_booking: customers have no UPDATE policy on bookings (023), so
-- self-cancel goes through this SECURITY DEFINER seam. It re-checks ownership,
-- status, and the 24h window server-side so the client can't bypass them.
-- If a completed payment exists it is refunded in full in the same txn.

CREATE OR REPLACE FUNCTION cancel_my_booking(
  p_booking_id UUID,
  p_reason TEXT
)
RETURNS TEXT
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_uid UUID := auth.uid();
  v_booking RECORD;
  v_payment_id UUID;
  v_amount NUMERIC(10,2);
  v_note TEXT;
BEGIN
  IF v_uid IS NULL THEN
    RAISE EXCEPTION 'Not signed in' USING ERRCODE = 'P0001';
  END IF;

  SELECT id, customer_id, status, pickup_date, reference
    INTO v_booking
    FROM bookings
   WHERE id = p_booking_id
   FOR UPDATE;

  IF NOT FOUND OR v_booking.customer_id <> v_uid THEN
    RAISE EXCEPTION 'Booking not found' USING ERRCODE = 'P0001';
  END IF;

  IF v_booking.status NOT IN ('pending','confirmed','ready_for_pickup') THEN
    RAISE EXCEPTION 'Booking cannot be cancelled in status %', v_booking.status USING ERRCODE = 'P0001';
  END IF;

  IF v_booking.pickup_date <= NOW() + INTERVAL '24 hours' THEN
    RAISE EXCEPTION 'Cancellation window has closed' USING ERRCODE = 'P0001';
  END IF;

  v_note := 'Cancelled by customer' || COALESCE(': ' || NULLIF(TRIM(p_reason), ''), '');

  SELECT id, amount INTO v_payment_id, v_amount
    FROM payments
   WHERE booking_id = p_booking_id AND status = 'completed'
   ORDER BY paid_at DESC NULLS LAST, created_at DESC
   LIMIT 1;

  IF v_payment_id IS NOT NULL THEN
    INSERT INTO refunds (booking_id, payment_id, amount, reason, processed_by)
    VALUES (p_booking_id, v_payment_id, v_amount, v_note, v_uid);
    UPDATE payments SET status = 'refunded' WHERE id = v_payment_id;
    v_note := v_note || ' (payment of ' || v_amount || ' refunded)';
  END IF;

  UPDATE bookings SET status = 'cancelled', updated_at = NOW() WHERE id = p_booking_id;

  INSERT INTO booking_status_history (booking_id, status, changed_by, note)
  VALUES (p_booking_id, 'cancelled', v_uid, v_note);

  DELETE FROM vehicle_availability
   WHERE reference_id = p_booking_id AND type = 'booking';

  INSERT INTO notifications (user_id, type, title, body)
  VALUES (v_uid, 'booking_cancelled', 'Booking ' || v_booking.reference || ' cancelled', v_note);

  RETURN v_booking.reference;
END;
$$;

REVOKE ALL ON FUNCTION cancel_my_booking(UUID, TEXT) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION cancel_my_booking(UUID, TEXT) TO authenticated;

-- Hardening: refund_booking (026) is SECURITY DEFINER and was callable by any
-- authenticated user. Wrap it with a staff-role guard.
CREATE OR REPLACE FUNCTION refund_booking(
  p_booking_id UUID,
  p_user_id UUID,
  p_note TEXT
)
RETURNS UUID
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_payment_id UUID;
  v_amount NUMERIC(10,2);
  v_refund_id UUID;
BEGIN
  IF COALESCE(get_user_role(auth.uid()), '') NOT IN ('manager','admin') THEN
    RAISE EXCEPTION 'Not authorized' USING ERRCODE = '42501';
  END IF;

  SELECT id, amount INTO v_payment_id, v_amount
    FROM payments
   WHERE booking_id = p_booking_id AND status = 'completed'
   ORDER BY paid_at DESC NULLS LAST, created_at DESC
   LIMIT 1;

  IF v_payment_id IS NULL THEN
    RAISE EXCEPTION 'No completed payment found for booking %', p_booking_id USING ERRCODE = 'P0001';
  END IF;

  INSERT INTO refunds (booking_id, payment_id, amount, reason, processed_by)
  VALUES (p_booking_id, v_payment_id, v_amount, p_note, auth.uid())
  RETURNING id INTO v_refund_id;

  UPDATE payments SET status = 'refunded' WHERE id = v_payment_id;
  UPDATE bookings SET status = 'refunded', updated_at = NOW() WHERE id = p_booking_id;

  INSERT INTO booking_status_history (booking_id, status, changed_by, note)
  VALUES (p_booking_id, 'refunded', auth.uid(), p_note);

  DELETE FROM vehicle_availability WHERE reference_id = p_booking_id AND type = 'booking';

  RETURN v_refund_id;
END;
$$;

REVOKE ALL ON FUNCTION refund_booking(UUID, UUID, TEXT) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION refund_booking(UUID, UUID, TEXT) TO authenticated;
