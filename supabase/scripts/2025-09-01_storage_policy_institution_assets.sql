-- 2025-09-01_storage_policy_institution_assets.sql
-- Permite a usuarios autenticados subir archivos al bucket institution_assets

CREATE POLICY "Authenticated users can upload to institution_assets"
ON storage.objects
FOR INSERT
WITH CHECK (
  bucket_id = 'institution_assets' AND auth.role() = 'authenticated'
);
