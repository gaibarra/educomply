-- Ensure profiles RLS with non-recursive policies to avoid infinite recursion
ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY;

-- Drop old policies
DO $$ BEGIN
  BEGIN DROP POLICY IF EXISTS profiles_select ON public.profiles; EXCEPTION WHEN undefined_object THEN NULL; END;
  BEGIN DROP POLICY IF EXISTS profiles_admin_manage ON public.profiles; EXCEPTION WHEN undefined_object THEN NULL; END;
  BEGIN DROP POLICY IF EXISTS profiles_select_self ON public.profiles; EXCEPTION WHEN undefined_object THEN NULL; END;
  BEGIN DROP POLICY IF EXISTS profiles_write_service ON public.profiles; EXCEPTION WHEN undefined_object THEN NULL; END;
END $$;

-- Allow authenticated users to select ONLY their own profile; service role can select all
CREATE POLICY profiles_select_self ON public.profiles FOR SELECT
  USING ( auth.role() = 'service_role' OR id = auth.uid() );

-- Only service role (Edge Functions) can insert/update/delete profiles (admin actions via server)
CREATE POLICY profiles_write_service ON public.profiles FOR ALL
  USING ( auth.role() = 'service_role' )
  WITH CHECK ( auth.role() = 'service_role' );

-- Refresh PostgREST cache
DO $$ BEGIN PERFORM pg_notify('pgrst', 'reload schema'); EXCEPTION WHEN others THEN NULL; END $$;
