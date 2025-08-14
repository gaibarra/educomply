-- Fix recursive RLS on profiles causing infinite recursion (500 errors)
-- Strategy: introduce SECURITY DEFINER function is_admin() to avoid selecting from profiles inside policy body.

-- 1. Create / replace helper function (runs with owner privileges, bypassing RLS internally)
CREATE OR REPLACE FUNCTION public.is_admin() RETURNS boolean
LANGUAGE sql SECURITY DEFINER SET search_path = public AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.profiles p WHERE p.id = auth.uid() AND p.role = 'admin'
  );
$$;

GRANT EXECUTE ON FUNCTION public.is_admin() TO authenticated; -- allow authenticated users to evaluate

-- 2. Enable RLS (idempotent)
ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY;

-- 3. Drop old recursive policies
DO $$ BEGIN
  BEGIN DROP POLICY IF EXISTS profiles_select_self ON public.profiles; EXCEPTION WHEN undefined_object THEN NULL; END;
  BEGIN DROP POLICY IF EXISTS profiles_select_admin ON public.profiles; EXCEPTION WHEN undefined_object THEN NULL; END;
  BEGIN DROP POLICY IF EXISTS profiles_write_service ON public.profiles; EXCEPTION WHEN undefined_object THEN NULL; END;
  BEGIN DROP POLICY IF EXISTS profiles_admin_manage ON public.profiles; EXCEPTION WHEN undefined_object THEN NULL; END;
END $$;

-- 4. Minimal safe policies
-- SELECT: service role OR owner OR admin (via helper)
CREATE POLICY profiles_select ON public.profiles FOR SELECT
  USING ( auth.role() = 'service_role' OR id = auth.uid() OR public.is_admin() );

-- WRITE (insert/update/delete): service role only (Edge Functions)
CREATE POLICY profiles_write_service ON public.profiles FOR ALL
  USING ( auth.role() = 'service_role' )
  WITH CHECK ( auth.role() = 'service_role' );

-- 5. Ensure created_at exists for ordering
ALTER TABLE public.profiles
  ADD COLUMN IF NOT EXISTS created_at timestamptz NOT NULL DEFAULT now();
CREATE INDEX IF NOT EXISTS idx_profiles_created_at ON public.profiles(created_at DESC);

-- 6. Refresh PostgREST cache
DO $$ BEGIN PERFORM pg_notify('pgrst', 'reload schema'); EXCEPTION WHEN others THEN NULL; END $$;

-- Usage note: After applying, 500 recursion errors should cease; clients can order by created_at.
