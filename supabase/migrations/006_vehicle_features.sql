CREATE TABLE vehicle_features (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  vehicle_id UUID NOT NULL REFERENCES vehicles(id) ON DELETE CASCADE,
  feature TEXT NOT NULL
);
CREATE INDEX idx_vehicle_features_vehicle_id ON vehicle_features(vehicle_id);
