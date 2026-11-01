-- 029: staff customer directory + audit log writes.
--
-- Customer emails live in auth.users, which RLS-scoped clients can't read.
-- These SECURITY DEFINER functions expose a staff-only, read-only projection.

CREATE OR REPLACE FUNCTION staff_list_customers(
  p_search TEXT DEFAULT NULL,
  p_flagged BOOLEAN DEFAULT NULL
)
RETURNS TABLE (
  id UUID,
  email TEXT,
  first_name TEXT,
  last_name TEXT,
  phone TEXT,
  flagged BOOLEAN,
  is_active BOOLEAN,
  created_at TIMESTAMPTZ,
  booking_count BIGINT,
  total_spent NUMERIC,
  last_booking_at TIMESTAMPTZ,
  unverified_documents BIGINT
)
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_term TEXT := NULLIF(TRIM(p_search), '');
BEGIN
  IF COALESCE(get_user_role(auth.uid()), '') NOT IN ('manager','admin') THEN
    RAISE EXCEPTION 'Not authorized' USING ERRCODE = '42501';
  END IF;

  RETURN QUERY
  SELECT
    p.id,
    u.email::TEXT,
    p.first_name,
    p.last_name,
    p.phone,
    p.flagged,
    p.is_active,
    p.created_at,
    COUNT(DISTINCT b.id) AS booking_count,
    COALESCE(SUM(b.total_amount) FILTER (WHERE b.status IN ('confirmed','ready_for_pickup','active','completed')), 0) AS total_spent,
    MAX(b.created_at) AS last_booking_at,
    (SELECT COUNT(*) FROM customer_documents d WHERE d.customer_id = p.id AND NOT d.verified) AS unverified_documents
  FROM profiles p
  JOIN auth.users u ON u.id = p.id
  JOIN roles r ON r.user_id = p.id AND r.role = 'customer'
  LEFT JOIN bookings b ON b.customer_id = p.id
  WHERE (p_flagged IS NULL OR p.flagged = p_flagged)
    AND (
      v_term IS NULL
      OR u.email ILIKE '%' || v_term || '%'
      OR p.first_name ILIKE '%' || v_term || '%'
      OR p.last_name ILIKE '%' || v_term || '%'
      OR (p.first_name || ' ' || p.last_name) ILIKE '%' || v_term || '%'
      OR p.phone ILIKE '%' || v_term || '%'
    )
  GROUP BY p.id, u.email
  ORDER BY p.created_at DESC
  LIMIT 500;
END;
$$;

REVOKE ALL ON FUNCTION staff_list_customers(TEXT, BOOLEAN) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION staff_list_customers(TEXT, BOOLEAN) TO authenticated;

CREATE OR REPLACE FUNCTION staff_customer_email(p_customer_id UUID)
RETURNS TEXT
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF COALESCE(get_user_role(auth.uid()), '') NOT IN ('manager','admin') THEN
    RAISE EXCEPTION 'Not authorized' USING ERRCODE = '42501';
  END IF;
  RETURN (SELECT email::TEXT FROM auth.users WHERE id = p_customer_id);
END;
$$;

REVOKE ALL ON FUNCTION staff_customer_email(UUID) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION staff_customer_email(UUID) TO authenticated;

-- Staff may write audit entries, only as themselves.
CREATE POLICY "audit_insert_staff" ON audit_logs FOR INSERT
  WITH CHECK (get_user_role(auth.uid()) IN ('manager','admin') AND actor_id = auth.uid());

-- Staff may create notifications for any user (e.g. "document verified").
-- 023's notifications_own policy only allows user_id = auth.uid().
CREATE POLICY "notifications_insert_staff" ON notifications FOR INSERT
  WITH CHECK (get_user_role(auth.uid()) IN ('manager','admin'));
