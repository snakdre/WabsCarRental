-- ============================================================
-- WABS CAR RENTAL — Combined migrations 001..023
-- Paste this entire file into Supabase SQL Editor and run once.
-- Order matches the individual files; do not rearrange.
-- ============================================================

-- ------------------------------------------------------------
-- 001_extensions.sql
-- ------------------------------------------------------------
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";
CREATE EXTENSION IF NOT EXISTS "btree_gist";

-- ------------------------------------------------------------
-- 002_profiles.sql
-- NOTE: handle_new_user() references the roles table created in 003.
-- Postgres stores plpgsql bodies as text and resolves references at
-- call time (when the trigger fires on auth.users INSERT), so the
-- forward reference is safe at DDL time.
-- ------------------------------------------------------------
CREATE TABLE profiles (
  id UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  first_name TEXT,
  last_name TEXT,
  phone TEXT,
  date_of_birth DATE,
  address JSONB,
  avatar_url TEXT,
  is_active BOOLEAN NOT NULL DEFAULT TRUE,
  flagged BOOLEAN NOT NULL DEFAULT FALSE,
  internal_notes TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE OR REPLACE FUNCTION handle_new_user()
RETURNS TRIGGER AS $$
BEGIN
  INSERT INTO public.profiles (id) VALUES (NEW.id);
  INSERT INTO public.roles (user_id, role) VALUES (NEW.id, 'customer');
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public;

CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW EXECUTE FUNCTION handle_new_user();

-- ------------------------------------------------------------
-- 003_roles.sql
-- ------------------------------------------------------------
CREATE TABLE roles (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id UUID NOT NULL UNIQUE REFERENCES auth.users(id) ON DELETE CASCADE,
  role TEXT NOT NULL CHECK (role IN ('customer', 'manager', 'admin')),
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- ------------------------------------------------------------
-- 004_vehicles.sql
-- ------------------------------------------------------------
CREATE TABLE vehicles (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  make TEXT NOT NULL,
  model TEXT NOT NULL,
  trim TEXT,
  year INTEGER NOT NULL CHECK (year >= 1990 AND year <= 2030),
  category TEXT NOT NULL CHECK (category IN ('exotic','sports','suv','convertible','executive','electric')),
  vin TEXT UNIQUE,
  license_plate TEXT,
  exterior_color TEXT,
  interior_color TEXT,
  seats INTEGER CHECK (seats > 0),
  doors INTEGER CHECK (doors > 0),
  transmission TEXT CHECK (transmission IN ('automatic','manual')),
  fuel_type TEXT CHECK (fuel_type IN ('gasoline','diesel','electric','hybrid')),
  horsepower INTEGER,
  drivetrain TEXT,
  description TEXT,
  daily_price NUMERIC(10,2) NOT NULL CHECK (daily_price > 0),
  weekly_price NUMERIC(10,2),
  monthly_price NUMERIC(10,2),
  deposit_amount NUMERIC(10,2) DEFAULT 0,
  mileage_limit INTEGER,
  extra_mileage_price NUMERIC(6,2) DEFAULT 0,
  min_rental_days INTEGER NOT NULL DEFAULT 1,
  max_rental_days INTEGER,
  status TEXT NOT NULL DEFAULT 'draft' CHECK (status IN ('draft','available','reserved','rented','maintenance','inactive')),
  is_featured BOOLEAN NOT NULL DEFAULT FALSE,
  cancellation_policy TEXT,
  rental_requirements TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_vehicles_status ON vehicles(status);
CREATE INDEX idx_vehicles_category ON vehicles(category);
CREATE INDEX idx_vehicles_is_featured ON vehicles(is_featured);

-- ------------------------------------------------------------
-- 005_vehicle_images.sql
-- ------------------------------------------------------------
CREATE TABLE vehicle_images (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  vehicle_id UUID NOT NULL REFERENCES vehicles(id) ON DELETE CASCADE,
  storage_path TEXT NOT NULL,
  url TEXT NOT NULL,
  is_cover BOOLEAN NOT NULL DEFAULT FALSE,
  sort_order INTEGER NOT NULL DEFAULT 0,
  alt_text TEXT,
  caption TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
CREATE INDEX idx_vehicle_images_vehicle_id ON vehicle_images(vehicle_id);
CREATE INDEX idx_vehicle_images_sort ON vehicle_images(vehicle_id, sort_order);

-- ------------------------------------------------------------
-- 006_vehicle_features.sql
-- ------------------------------------------------------------
CREATE TABLE vehicle_features (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  vehicle_id UUID NOT NULL REFERENCES vehicles(id) ON DELETE CASCADE,
  feature TEXT NOT NULL
);
CREATE INDEX idx_vehicle_features_vehicle_id ON vehicle_features(vehicle_id);

-- ------------------------------------------------------------
-- 007_vehicle_locations.sql
-- ------------------------------------------------------------
CREATE TABLE vehicle_locations (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  vehicle_id UUID NOT NULL REFERENCES vehicles(id) ON DELETE CASCADE,
  name TEXT,
  address TEXT,
  city TEXT,
  state TEXT,
  zip TEXT,
  lat NUMERIC,
  lng NUMERIC,
  delivery_available BOOLEAN NOT NULL DEFAULT FALSE,
  delivery_fee NUMERIC(8,2) NOT NULL DEFAULT 0
);
CREATE INDEX idx_vehicle_locations_vehicle_id ON vehicle_locations(vehicle_id);

-- ------------------------------------------------------------
-- 008_vehicle_availability.sql
-- ------------------------------------------------------------
CREATE TABLE vehicle_availability (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  vehicle_id UUID NOT NULL REFERENCES vehicles(id) ON DELETE CASCADE,
  start_date DATE NOT NULL,
  end_date DATE NOT NULL,
  type TEXT NOT NULL CHECK (type IN ('booking','maintenance','blocked')),
  reference_id UUID,
  reason TEXT,
  created_by UUID REFERENCES auth.users(id),
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  CONSTRAINT valid_date_range CHECK (end_date >= start_date),
  EXCLUDE USING gist (
    vehicle_id WITH =,
    daterange(start_date, end_date, '[]') WITH &&
  ) WHERE (type IN ('booking','maintenance'))
);
CREATE INDEX idx_vehicle_availability_vehicle_id ON vehicle_availability(vehicle_id);
CREATE INDEX idx_vehicle_availability_dates ON vehicle_availability(start_date, end_date);

-- ------------------------------------------------------------
-- 009_maintenance_records.sql
-- ------------------------------------------------------------
CREATE TABLE maintenance_records (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  vehicle_id UUID NOT NULL REFERENCES vehicles(id),
  service_date DATE NOT NULL,
  return_date DATE,
  odometer INTEGER,
  cost NUMERIC(10,2),
  description TEXT,
  vendor TEXT,
  created_by UUID REFERENCES auth.users(id),
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
CREATE INDEX idx_maintenance_vehicle_id ON maintenance_records(vehicle_id);

-- ------------------------------------------------------------
-- 010_extras_and_plans.sql
-- ------------------------------------------------------------
CREATE TABLE protection_plans (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  name TEXT NOT NULL,
  description TEXT,
  daily_price NUMERIC(8,2) NOT NULL CHECK (daily_price >= 0),
  coverage_details TEXT,
  is_active BOOLEAN NOT NULL DEFAULT TRUE
);

CREATE TABLE extras (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  name TEXT NOT NULL,
  description TEXT,
  price NUMERIC(8,2) NOT NULL CHECK (price >= 0),
  unit TEXT NOT NULL DEFAULT 'per_day' CHECK (unit IN ('per_day','flat')),
  is_active BOOLEAN NOT NULL DEFAULT TRUE
);

-- ------------------------------------------------------------
-- 011_promo_codes.sql
-- ------------------------------------------------------------
CREATE TABLE promo_codes (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  code TEXT UNIQUE NOT NULL,
  type TEXT NOT NULL CHECK (type IN ('percentage','fixed')),
  value NUMERIC(8,2) NOT NULL CHECK (value > 0),
  max_uses INTEGER,
  used_count INTEGER NOT NULL DEFAULT 0,
  expires_at TIMESTAMPTZ,
  is_active BOOLEAN NOT NULL DEFAULT TRUE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- ------------------------------------------------------------
-- 012_bookings.sql
-- ------------------------------------------------------------
CREATE TABLE bookings (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  reference TEXT UNIQUE NOT NULL,
  customer_id UUID NOT NULL REFERENCES auth.users(id),
  vehicle_id UUID NOT NULL REFERENCES vehicles(id),
  pickup_date TIMESTAMPTZ NOT NULL,
  return_date TIMESTAMPTZ NOT NULL,
  pickup_method TEXT NOT NULL CHECK (pickup_method IN ('pickup','delivery')),
  pickup_location_id UUID REFERENCES vehicle_locations(id),
  driver_name TEXT NOT NULL,
  driver_email TEXT NOT NULL,
  driver_phone TEXT NOT NULL,
  driver_dob DATE NOT NULL,
  license_number TEXT NOT NULL,
  license_expiry DATE NOT NULL,
  license_region TEXT NOT NULL,
  rental_days INTEGER NOT NULL CHECK (rental_days > 0),
  base_price NUMERIC(10,2) NOT NULL CHECK (base_price >= 0),
  delivery_fee NUMERIC(8,2) NOT NULL DEFAULT 0,
  tax_amount NUMERIC(10,2) NOT NULL DEFAULT 0,
  protection_fee NUMERIC(10,2) NOT NULL DEFAULT 0,
  extras_fee NUMERIC(10,2) NOT NULL DEFAULT 0,
  discount_amount NUMERIC(10,2) NOT NULL DEFAULT 0,
  deposit_amount NUMERIC(10,2) NOT NULL DEFAULT 0,
  total_amount NUMERIC(10,2) NOT NULL CHECK (total_amount >= 0),
  status TEXT NOT NULL DEFAULT 'pending' CHECK (status IN (
    'draft','pending','awaiting_payment','confirmed',
    'ready_for_pickup','active','completed',
    'cancelled','rejected','refunded'
  )),
  promo_code_id UUID REFERENCES promo_codes(id),
  protection_plan_id UUID REFERENCES protection_plans(id),
  special_requests TEXT,
  internal_notes TEXT,
  terms_accepted BOOLEAN NOT NULL DEFAULT FALSE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  CONSTRAINT valid_booking_dates CHECK (return_date > pickup_date)
);

CREATE INDEX idx_bookings_customer_id ON bookings(customer_id);
CREATE INDEX idx_bookings_vehicle_id ON bookings(vehicle_id);
CREATE INDEX idx_bookings_status ON bookings(status);
CREATE INDEX idx_bookings_pickup_date ON bookings(pickup_date);

-- ------------------------------------------------------------
-- 013_booking_extras.sql
-- ------------------------------------------------------------
CREATE TABLE booking_extras (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  booking_id UUID NOT NULL REFERENCES bookings(id) ON DELETE CASCADE,
  extra_id UUID NOT NULL REFERENCES extras(id),
  quantity INTEGER NOT NULL DEFAULT 1 CHECK (quantity > 0),
  unit_price NUMERIC(8,2) NOT NULL
);

-- ------------------------------------------------------------
-- 014_booking_status_history.sql
-- ------------------------------------------------------------
CREATE TABLE booking_status_history (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  booking_id UUID NOT NULL REFERENCES bookings(id) ON DELETE CASCADE,
  status TEXT NOT NULL,
  changed_by UUID REFERENCES auth.users(id),
  note TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
CREATE INDEX idx_booking_status_history_booking_id ON booking_status_history(booking_id);

-- ------------------------------------------------------------
-- 015_payments.sql
-- ------------------------------------------------------------
CREATE TABLE payments (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  booking_id UUID NOT NULL REFERENCES bookings(id),
  amount NUMERIC(10,2) NOT NULL CHECK (amount > 0),
  currency TEXT NOT NULL DEFAULT 'USD',
  method TEXT NOT NULL CHECK (method IN ('mock','stripe','cash')),
  status TEXT NOT NULL CHECK (status IN ('pending','completed','failed','refunded')),
  stripe_payment_intent_id TEXT,
  paid_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
CREATE INDEX idx_payments_booking_id ON payments(booking_id);

-- ------------------------------------------------------------
-- 016_refunds.sql
-- ------------------------------------------------------------
CREATE TABLE refunds (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  booking_id UUID NOT NULL REFERENCES bookings(id),
  payment_id UUID NOT NULL REFERENCES payments(id),
  amount NUMERIC(10,2) NOT NULL CHECK (amount > 0),
  reason TEXT,
  processed_by UUID REFERENCES auth.users(id),
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- ------------------------------------------------------------
-- 017_reviews.sql
-- ------------------------------------------------------------
CREATE TABLE reviews (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  booking_id UUID NOT NULL UNIQUE REFERENCES bookings(id),
  customer_id UUID NOT NULL REFERENCES auth.users(id),
  vehicle_id UUID NOT NULL REFERENCES vehicles(id),
  rating INTEGER NOT NULL CHECK (rating BETWEEN 1 AND 5),
  comment TEXT,
  is_published BOOLEAN NOT NULL DEFAULT FALSE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
CREATE INDEX idx_reviews_vehicle_id ON reviews(vehicle_id);

-- ------------------------------------------------------------
-- 018_favorites.sql
-- ------------------------------------------------------------
CREATE TABLE favorites (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  customer_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  vehicle_id UUID NOT NULL REFERENCES vehicles(id) ON DELETE CASCADE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE(customer_id, vehicle_id)
);
CREATE INDEX idx_favorites_customer_id ON favorites(customer_id);

-- ------------------------------------------------------------
-- 019_customer_documents.sql
-- ------------------------------------------------------------
CREATE TABLE customer_documents (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  customer_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  type TEXT NOT NULL CHECK (type IN ('license_front','license_back','passport','other')),
  storage_path TEXT NOT NULL,
  url TEXT NOT NULL,
  verified BOOLEAN NOT NULL DEFAULT FALSE,
  uploaded_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
CREATE INDEX idx_customer_documents_customer_id ON customer_documents(customer_id);

-- ------------------------------------------------------------
-- 020_notifications.sql
-- ------------------------------------------------------------
CREATE TABLE notifications (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  type TEXT NOT NULL,
  title TEXT NOT NULL,
  body TEXT,
  is_read BOOLEAN NOT NULL DEFAULT FALSE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
CREATE INDEX idx_notifications_user_id ON notifications(user_id, is_read);

-- ------------------------------------------------------------
-- 021_audit_logs.sql
-- ------------------------------------------------------------
CREATE TABLE audit_logs (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  actor_id UUID REFERENCES auth.users(id),
  action TEXT NOT NULL,
  entity_type TEXT NOT NULL,
  entity_id UUID,
  diff JSONB,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
CREATE INDEX idx_audit_logs_actor_id ON audit_logs(actor_id);
CREATE INDEX idx_audit_logs_entity ON audit_logs(entity_type, entity_id);

-- ------------------------------------------------------------
-- 022_application_settings.sql
-- ------------------------------------------------------------
CREATE TABLE application_settings (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  key TEXT UNIQUE NOT NULL,
  value JSONB NOT NULL,
  updated_by UUID REFERENCES auth.users(id),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

INSERT INTO application_settings (key, value) VALUES
  ('tax_rate', '0.08'),
  ('currency', '"USD"'),
  ('min_driver_age', '25'),
  ('late_return_fee_per_hour', '50'),
  ('default_deposit', '500'),
  ('business_name', '"Wabs Car Rental"'),
  ('business_email', '"hello@wabscarrental.com"'),
  ('business_phone', '"+1 (555) 000-0000"'),
  ('payment_mode', '"mock"');

-- ------------------------------------------------------------
-- 023_rls_policies.sql
-- ------------------------------------------------------------
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
