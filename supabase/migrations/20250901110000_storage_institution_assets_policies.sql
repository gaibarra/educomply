-- 2025-09-01 Ensure storage bucket and RLS policies for institution_assets (logo uploads)
-- Problema: Error "new row violates row-level security policy" al subir logo.
-- Causas probables: (1) Falta bucket, (2) Sólo existe policy INSERT sin UPDATE para upsert, (3) Usuario no autenticado.

BEGIN;

-- 1. Crear bucket si falta (público para servir logo)
INSERT INTO storage.buckets (id, name, public)
VALUES ('institution_assets','institution_assets', true)
ON CONFLICT (id) DO NOTHING;

-- 2. Políticas (idempotentes). No existe IF NOT EXISTS para CREATE POLICY => borramos si existen.
DO $$ BEGIN
  PERFORM 1 FROM pg_policies WHERE schemaname='storage' AND tablename='objects' AND policyname='Authenticated users can upload to institution_assets';
  IF FOUND THEN EXECUTE 'DROP POLICY "Authenticated users can upload to institution_assets" ON storage.objects'; END IF;
  PERFORM 1 FROM pg_policies WHERE schemaname='storage' AND tablename='objects' AND policyname='Authenticated users can update institution_assets';
  IF FOUND THEN EXECUTE 'DROP POLICY "Authenticated users can update institution_assets" ON storage.objects'; END IF;
END $$;

-- (Opcional) permitir DELETE (limpieza de logos antiguos) solo a usuarios autenticados admins
DO $$ BEGIN
  PERFORM 1 FROM pg_policies WHERE schemaname='storage' AND tablename='objects' AND policyname='Authenticated users can delete institution_assets';
  IF FOUND THEN EXECUTE 'DROP POLICY "Authenticated users can delete institution_assets" ON storage.objects'; END IF;
END $$;
CREATE POLICY "Authenticated users can delete institution_assets"
ON storage.objects
FOR DELETE USING (
  bucket_id = 'institution_assets' AND auth.role() = 'authenticated'
);

-- INSERT (nueva subida)
CREATE POLICY "Authenticated users can upload to institution_assets"
ON storage.objects
FOR INSERT
WITH CHECK (
  bucket_id = 'institution_assets' AND auth.role() = 'authenticated'
);

-- UPDATE (upsert = reemplazo de archivo existente)
CREATE POLICY "Authenticated users can update institution_assets"
ON storage.objects
FOR UPDATE USING (
  bucket_id = 'institution_assets' AND auth.role() = 'authenticated'
) WITH CHECK (
  bucket_id = 'institution_assets' AND auth.role() = 'authenticated'
);

-- (Opcional) SELECT abierto ya que el bucket es público; no se requiere policy adicional.

COMMIT;
