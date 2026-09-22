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
