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
