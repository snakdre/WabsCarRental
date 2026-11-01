-- 028: private storage bucket for customer documents (licence / passport).
-- Object path convention: {auth.uid()}/{uuid}.{ext}

INSERT INTO storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
VALUES (
  'customer-documents', 'customer-documents', FALSE, 10485760,
  ARRAY['image/jpeg','image/png','image/webp','application/pdf']
)
ON CONFLICT (id) DO NOTHING;

CREATE POLICY "custdocs_owner_insert" ON storage.objects FOR INSERT TO authenticated
  WITH CHECK (bucket_id = 'customer-documents' AND (storage.foldername(name))[1] = auth.uid()::text);
CREATE POLICY "custdocs_owner_select" ON storage.objects FOR SELECT TO authenticated
  USING (bucket_id = 'customer-documents' AND (storage.foldername(name))[1] = auth.uid()::text);
CREATE POLICY "custdocs_owner_delete" ON storage.objects FOR DELETE TO authenticated
  USING (bucket_id = 'customer-documents' AND (storage.foldername(name))[1] = auth.uid()::text);
CREATE POLICY "custdocs_staff_select" ON storage.objects FOR SELECT TO authenticated
  USING (bucket_id = 'customer-documents' AND get_user_role(auth.uid()) IN ('manager','admin'));

-- Staff need to flip customer_documents.verified (023 only granted staff SELECT).
CREATE POLICY "documents_staff_update" ON customer_documents FOR UPDATE
  USING (get_user_role(auth.uid()) IN ('manager','admin'));
