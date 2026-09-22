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
