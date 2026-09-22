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
