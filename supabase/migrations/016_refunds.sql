CREATE TABLE refunds (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  booking_id UUID NOT NULL REFERENCES bookings(id),
  payment_id UUID NOT NULL REFERENCES payments(id),
  amount NUMERIC(10,2) NOT NULL CHECK (amount > 0),
  reason TEXT,
  processed_by UUID REFERENCES auth.users(id),
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
