-- Enable RLS on all tables
ALTER TABLE profiles ENABLE ROW LEVEL SECURITY;
ALTER TABLE roles ENABLE ROW LEVEL SECURITY;
ALTER TABLE vehicles ENABLE ROW LEVEL SECURITY;
ALTER TABLE vehicle_images ENABLE ROW LEVEL SECURITY;
ALTER TABLE vehicle_features ENABLE ROW LEVEL SECURITY;
ALTER TABLE vehicle_locations ENABLE ROW LEVEL SECURITY;
ALTER TABLE vehicle_availability ENABLE ROW LEVEL SECURITY;
ALTER TABLE maintenance_records ENABLE ROW LEVEL SECURITY;
ALTER TABLE protection_plans ENABLE ROW LEVEL SECURITY;
ALTER TABLE extras ENABLE ROW LEVEL SECURITY;
ALTER TABLE promo_codes ENABLE ROW LEVEL SECURITY;
ALTER TABLE bookings ENABLE ROW LEVEL SECURITY;
ALTER TABLE booking_extras ENABLE ROW LEVEL SECURITY;
ALTER TABLE booking_status_history ENABLE ROW LEVEL SECURITY;
ALTER TABLE payments ENABLE ROW LEVEL SECURITY;
ALTER TABLE refunds ENABLE ROW LEVEL SECURITY;
ALTER TABLE reviews ENABLE ROW LEVEL SECURITY;
ALTER TABLE favorites ENABLE ROW LEVEL SECURITY;
ALTER TABLE customer_documents ENABLE ROW LEVEL SECURITY;
ALTER TABLE notifications ENABLE ROW LEVEL SECURITY;
ALTER TABLE audit_logs ENABLE ROW LEVEL SECURITY;
ALTER TABLE application_settings ENABLE ROW LEVEL SECURITY;
ALTER TABLE maintenance_records ENABLE ROW LEVEL SECURITY;
ALTER TABLE booking_status_history ENABLE ROW LEVEL SECURITY;

-- Helper function: get current user role
CREATE OR REPLACE FUNCTION get_user_role(uid UUID)
RETURNS TEXT AS $$
  SELECT role FROM roles WHERE user_id = uid LIMIT 1;
$$ LANGUAGE sql SECURITY DEFINER STABLE;

-- profiles: users see/edit their own; managers/admins see all
CREATE POLICY "profiles_select_own" ON profiles FOR SELECT USING (id = auth.uid());
CREATE POLICY "profiles_select_staff" ON profiles FOR SELECT USING (get_user_role(auth.uid()) IN ('manager','admin'));
CREATE POLICY "profiles_update_own" ON profiles FOR UPDATE USING (id = auth.uid());
CREATE POLICY "profiles_update_staff" ON profiles FOR UPDATE USING (get_user_role(auth.uid()) IN ('manager','admin'));

-- roles: only admins manage roles
CREATE POLICY "roles_select_own" ON roles FOR SELECT USING (user_id = auth.uid());
CREATE POLICY "roles_select_admin" ON roles FOR SELECT USING (get_user_role(auth.uid()) = 'admin');
CREATE POLICY "roles_all_admin" ON roles FOR ALL USING (get_user_role(auth.uid()) = 'admin');

-- vehicles: public read for available; staff manage
CREATE POLICY "vehicles_select_public" ON vehicles FOR SELECT USING (status != 'draft' AND status != 'inactive');
CREATE POLICY "vehicles_select_staff" ON vehicles FOR SELECT USING (get_user_role(auth.uid()) IN ('manager','admin'));
CREATE POLICY "vehicles_all_staff" ON vehicles FOR ALL USING (get_user_role(auth.uid()) IN ('manager','admin'));

-- vehicle_images, features, locations: same as vehicles
CREATE POLICY "vehicle_images_select_public" ON vehicle_images FOR SELECT USING (TRUE);
CREATE POLICY "vehicle_images_all_staff" ON vehicle_images FOR ALL USING (get_user_role(auth.uid()) IN ('manager','admin'));
CREATE POLICY "vehicle_features_select_public" ON vehicle_features FOR SELECT USING (TRUE);
CREATE POLICY "vehicle_features_all_staff" ON vehicle_features FOR ALL USING (get_user_role(auth.uid()) IN ('manager','admin'));
CREATE POLICY "vehicle_locations_select_public" ON vehicle_locations FOR SELECT USING (TRUE);
CREATE POLICY "vehicle_locations_all_staff" ON vehicle_locations FOR ALL USING (get_user_role(auth.uid()) IN ('manager','admin'));

-- vehicle_availability: public read; staff manage
CREATE POLICY "va_select_public" ON vehicle_availability FOR SELECT USING (TRUE);
CREATE POLICY "va_all_staff" ON vehicle_availability FOR ALL USING (get_user_role(auth.uid()) IN ('manager','admin'));

-- maintenance_records: staff only
CREATE POLICY "maintenance_all_staff" ON maintenance_records FOR ALL USING (get_user_role(auth.uid()) IN ('manager','admin'));

-- protection_plans, extras: public read; admin manage
CREATE POLICY "plans_select_public" ON protection_plans FOR SELECT USING (is_active = TRUE);
CREATE POLICY "plans_all_admin" ON protection_plans FOR ALL USING (get_user_role(auth.uid()) = 'admin');
CREATE POLICY "extras_select_public" ON extras FOR SELECT USING (is_active = TRUE);
CREATE POLICY "extras_all_admin" ON extras FOR ALL USING (get_user_role(auth.uid()) = 'admin');

-- promo_codes: customers can read active; admin manage
CREATE POLICY "promo_select_auth" ON promo_codes FOR SELECT USING (is_active = TRUE AND auth.uid() IS NOT NULL);
CREATE POLICY "promo_all_admin" ON promo_codes FOR ALL USING (get_user_role(auth.uid()) = 'admin');

-- bookings: customers see own; staff see all
CREATE POLICY "bookings_select_own" ON bookings FOR SELECT USING (customer_id = auth.uid());
CREATE POLICY "bookings_insert_own" ON bookings FOR INSERT WITH CHECK (customer_id = auth.uid());
CREATE POLICY "bookings_select_staff" ON bookings FOR SELECT USING (get_user_role(auth.uid()) IN ('manager','admin'));
CREATE POLICY "bookings_update_staff" ON bookings FOR UPDATE USING (get_user_role(auth.uid()) IN ('manager','admin'));

-- booking_extras, status_history: follow booking access
CREATE POLICY "booking_extras_select_own" ON booking_extras FOR SELECT USING (
  EXISTS (SELECT 1 FROM bookings WHERE id = booking_id AND customer_id = auth.uid())
);
CREATE POLICY "booking_extras_select_staff" ON booking_extras FOR SELECT USING (get_user_role(auth.uid()) IN ('manager','admin'));
CREATE POLICY "booking_extras_all_staff" ON booking_extras FOR ALL USING (get_user_role(auth.uid()) IN ('manager','admin'));
CREATE POLICY "bsh_select_own" ON booking_status_history FOR SELECT USING (
  EXISTS (SELECT 1 FROM bookings WHERE id = booking_id AND customer_id = auth.uid())
);
CREATE POLICY "bsh_select_staff" ON booking_status_history FOR SELECT USING (get_user_role(auth.uid()) IN ('manager','admin'));
CREATE POLICY "bsh_insert_staff" ON booking_status_history FOR INSERT WITH CHECK (get_user_role(auth.uid()) IN ('manager','admin'));

-- payments: customers see own; staff manage
CREATE POLICY "payments_select_own" ON payments FOR SELECT USING (
  EXISTS (SELECT 1 FROM bookings WHERE id = booking_id AND customer_id = auth.uid())
);
CREATE POLICY "payments_all_staff" ON payments FOR ALL USING (get_user_role(auth.uid()) IN ('manager','admin'));

-- refunds: staff only
CREATE POLICY "refunds_all_staff" ON refunds FOR ALL USING (get_user_role(auth.uid()) IN ('manager','admin'));

-- reviews: published reviews are public; own reviews for customers
CREATE POLICY "reviews_select_public" ON reviews FOR SELECT USING (is_published = TRUE);
CREATE POLICY "reviews_select_own" ON reviews FOR SELECT USING (customer_id = auth.uid());
CREATE POLICY "reviews_insert_own" ON reviews FOR INSERT WITH CHECK (customer_id = auth.uid());
CREATE POLICY "reviews_all_staff" ON reviews FOR ALL USING (get_user_role(auth.uid()) IN ('manager','admin'));

-- favorites, documents, notifications: own only + staff
CREATE POLICY "favorites_own" ON favorites FOR ALL USING (customer_id = auth.uid());
CREATE POLICY "documents_own" ON customer_documents FOR ALL USING (customer_id = auth.uid());
CREATE POLICY "documents_staff" ON customer_documents FOR SELECT USING (get_user_role(auth.uid()) IN ('manager','admin'));
CREATE POLICY "notifications_own" ON notifications FOR ALL USING (user_id = auth.uid());

-- audit_logs: staff read
CREATE POLICY "audit_select_staff" ON audit_logs FOR SELECT USING (get_user_role(auth.uid()) IN ('manager','admin'));

-- application_settings: all authenticated read; admin manage
CREATE POLICY "settings_select_auth" ON application_settings FOR SELECT USING (auth.uid() IS NOT NULL);
CREATE POLICY "settings_all_admin" ON application_settings FOR ALL USING (get_user_role(auth.uid()) = 'admin');
