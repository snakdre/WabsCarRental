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
