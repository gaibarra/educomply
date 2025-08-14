-- Add created_at column if missing to support ordering in UI
ALTER TABLE public.profiles
  ADD COLUMN IF NOT EXISTS created_at timestamptz NOT NULL DEFAULT now();

-- Index to optimize ordering/pagination
CREATE INDEX IF NOT EXISTS idx_profiles_created_at ON public.profiles(created_at DESC);

-- Broaden SELECT policy: allow admins (by role column) to view all profiles
DO $$ BEGIN
  BEGIN DROP POLICY IF EXISTS profiles_select_admin ON public.profiles; EXCEPTION WHEN undefined_object THEN NULL; END;
END $$;
CREATE POLICY profiles_select_admin ON public.profiles FOR SELECT
  USING (
    auth.role() = 'service_role' OR
    id = auth.uid() OR
    EXISTS (
      SELECT 1 FROM public.profiles p2
      WHERE p2.id = auth.uid() AND p2.role = 'admin'
    )
  );

-- Notify PostgREST to reload
DO $$ BEGIN PERFORM pg_notify('pgrst', 'reload schema'); EXCEPTION WHEN others THEN NULL; END $$;
