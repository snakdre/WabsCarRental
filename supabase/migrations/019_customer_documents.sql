CREATE TABLE customer_documents (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  customer_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  type TEXT NOT NULL CHECK (type IN ('license_front','license_back','passport','other')),
  storage_path TEXT NOT NULL,
  url TEXT NOT NULL,
  verified BOOLEAN NOT NULL DEFAULT FALSE,
  uploaded_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
CREATE INDEX idx_customer_documents_customer_id ON customer_documents(customer_id);
