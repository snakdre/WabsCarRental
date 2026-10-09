-- Atomic refund workflow.
-- Looks up the booking's completed payment, inserts a refunds row for the full
-- payment amount, flips the payment's status to 'refunded', updates the
-- booking's status, writes a status-history row, and deletes any
-- availability rows the booking created. All in one transaction.
--
-- SECURITY DEFINER because 'refunds' and 'payments' rows are staff-write-only
-- per migration 023 and the function is the trusted seam.
--
-- Returns the refund id on success. Raises an error if the booking has no
-- completed payment to refund.

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
  -- Find the completed payment on this booking. If multiple exist (unexpected
  -- in current flow), pick the most recent completed one.
  SELECT id, amount
    INTO v_payment_id, v_amount
    FROM payments
   WHERE booking_id = p_booking_id
     AND status = 'completed'
   ORDER BY paid_at DESC NULLS LAST, created_at DESC
   LIMIT 1;

  IF v_payment_id IS NULL THEN
    RAISE EXCEPTION 'No completed payment found for booking %', p_booking_id
      USING ERRCODE = 'P0001';
  END IF;

  -- 1. Insert refund record.
  INSERT INTO refunds (booking_id, payment_id, amount, reason, processed_by)
  VALUES (p_booking_id, v_payment_id, v_amount, p_note, p_user_id)
  RETURNING id INTO v_refund_id;

  -- 2. Mark the payment as refunded.
  UPDATE payments
     SET status = 'refunded'
   WHERE id = v_payment_id;

  -- 3. Mark the booking as refunded.
  UPDATE bookings
     SET status = 'refunded',
         updated_at = NOW()
   WHERE id = p_booking_id;

  -- 4. Status history entry.
  INSERT INTO booking_status_history (booking_id, status, changed_by, note)
  VALUES (p_booking_id, 'refunded', p_user_id, p_note);

  -- 5. Release vehicle availability so the dates become bookable again.
  DELETE FROM vehicle_availability
   WHERE reference_id = p_booking_id
     AND type = 'booking';

  RETURN v_refund_id;
END;
$$;

GRANT EXECUTE ON FUNCTION refund_booking(UUID, UUID, TEXT) TO authenticated;
