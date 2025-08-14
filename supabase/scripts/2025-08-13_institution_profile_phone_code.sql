-- Add phone_country_code to institution_profile for WhatsApp normalization
BEGIN;

ALTER TABLE public.institution_profile
  ADD COLUMN IF NOT EXISTS phone_country_code text;

-- Optional: set a default value for the singleton row (id = 1)
UPDATE public.institution_profile
   SET phone_country_code = COALESCE(phone_country_code, '+52')
 WHERE id = 1;

-- Refresh PostgREST cache (best-effort)
DO $$ BEGIN PERFORM pg_notify('pgrst', 'reload schema'); EXCEPTION WHEN others THEN NULL; END $$;

COMMIT;
