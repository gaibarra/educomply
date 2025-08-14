-- Extend profiles with additional user fields
ALTER TABLE public.profiles
  ADD COLUMN IF NOT EXISTS mobile text,
  ADD COLUMN IF NOT EXISTS position text,
  ADD COLUMN IF NOT EXISTS campus text,
  ADD COLUMN IF NOT EXISTS area text;

-- Optional: indexes for common filters
CREATE INDEX IF NOT EXISTS idx_profiles_role ON public.profiles(role);
CREATE INDEX IF NOT EXISTS idx_profiles_campus ON public.profiles(campus);

-- Refresh PostgREST cache
DO $$ BEGIN PERFORM pg_notify('pgrst', 'reload schema'); EXCEPTION WHEN others THEN NULL; END $$;
