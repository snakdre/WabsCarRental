-- 033: paginate the staff customer directory.
--
-- 029's staff_list_customers(search, flagged) returned at most 500 rows with
-- no way to see the rest. This replaces it with a paged version that also
-- returns the total match count (same value on every row) so the UI can show
-- "1-50 of 1,234" and page links.

DROP FUNCTION IF EXISTS staff_list_customers(TEXT, BOOLEAN);

CREATE OR REPLACE FUNCTION staff_list_customers(
  p_search TEXT DEFAULT NULL,
  p_flagged BOOLEAN DEFAULT NULL,
  p_limit INT DEFAULT 50,
  p_offset INT DEFAULT 0
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
  unverified_documents BIGINT,
  total_count BIGINT
)
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_term TEXT := NULLIF(TRIM(p_search), '');
  v_limit INT := LEAST(GREATEST(COALESCE(p_limit, 50), 1), 200);
  v_offset INT := GREATEST(COALESCE(p_offset, 0), 0);
BEGIN
  IF COALESCE(get_user_role(auth.uid()), '') NOT IN ('manager','admin') THEN
    RAISE EXCEPTION 'Not authorized' USING ERRCODE = '42501';
  END IF;

  RETURN QUERY
  WITH matched AS (
    SELECT p.id, u.email::TEXT AS email, p.first_name, p.last_name, p.phone,
           p.flagged, p.is_active, p.created_at
      FROM profiles p
      JOIN auth.users u ON u.id = p.id
      JOIN roles r ON r.user_id = p.id AND r.role = 'customer'
     WHERE (p_flagged IS NULL OR p.flagged = p_flagged)
       AND (
         v_term IS NULL
         OR u.email ILIKE '%' || v_term || '%'
         OR p.first_name ILIKE '%' || v_term || '%'
         OR p.last_name ILIKE '%' || v_term || '%'
         OR (p.first_name || ' ' || p.last_name) ILIKE '%' || v_term || '%'
         OR p.phone ILIKE '%' || v_term || '%'
       )
  ),
  page AS (
    SELECT m.*, COUNT(*) OVER () AS total_count
      FROM matched m
     ORDER BY m.created_at DESC, m.id
     LIMIT v_limit OFFSET v_offset
  )
  SELECT
    pg.id, pg.email, pg.first_name, pg.last_name, pg.phone, pg.flagged, pg.is_active, pg.created_at,
    (SELECT COUNT(*) FROM bookings b WHERE b.customer_id = pg.id),
    (SELECT COALESCE(SUM(b.total_amount), 0) FROM bookings b
      WHERE b.customer_id = pg.id AND b.status IN ('confirmed','ready_for_pickup','active','completed')),
    (SELECT MAX(b.created_at) FROM bookings b WHERE b.customer_id = pg.id),
    (SELECT COUNT(*) FROM customer_documents d WHERE d.customer_id = pg.id AND NOT d.verified),
    pg.total_count
  FROM page pg
  ORDER BY pg.created_at DESC, pg.id;
END;
$$;

REVOKE ALL ON FUNCTION staff_list_customers(TEXT, BOOLEAN, INT, INT) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION staff_list_customers(TEXT, BOOLEAN, INT, INT) TO authenticated;
