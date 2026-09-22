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
