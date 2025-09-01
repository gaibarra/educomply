-- 2025-09-01 Extend institution_profile with missing columns used by the app
-- Adds: legal_representative, logo_url, phone_country_code (if still missing),
--       locations (jsonb), educational_levels (text[]), authorities (jsonb)
-- NOTE: academic_programs already handled in scripts (consider consolidating), but we guard here too.

BEGIN;

ALTER TABLE public.institution_profile
  ADD COLUMN IF NOT EXISTS legal_representative text,
  ADD COLUMN IF NOT EXISTS logo_url text,
  ADD COLUMN IF NOT EXISTS phone_country_code text,
  ADD COLUMN IF NOT EXISTS locations jsonb,
  ADD COLUMN IF NOT EXISTS educational_levels text[],
  ADD COLUMN IF NOT EXISTS authorities jsonb,
  ADD COLUMN IF NOT EXISTS academic_programs jsonb; -- idempotent safeguard

-- Ensure singleton row has non-null JSON structures (optional convenience)
UPDATE public.institution_profile
   SET locations = COALESCE(locations, '[]'::jsonb),
       authorities = COALESCE(authorities, '[]'::jsonb),
       academic_programs = COALESCE(academic_programs, '[]'::jsonb)
 WHERE id = 1;

-- Refresh PostgREST schema cache so the API sees new columns immediately (no-op if listener absent)
DO $$ BEGIN PERFORM pg_notify('pgrst', 'reload schema'); EXCEPTION WHEN others THEN NULL; END $$;

COMMIT;
