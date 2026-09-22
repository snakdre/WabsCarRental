CREATE TABLE booking_status_history (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  booking_id UUID NOT NULL REFERENCES bookings(id) ON DELETE CASCADE,
  status TEXT NOT NULL,
  changed_by UUID REFERENCES auth.users(id),
  note TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
CREATE INDEX idx_booking_status_history_booking_id ON booking_status_history(booking_id);
