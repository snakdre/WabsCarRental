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
