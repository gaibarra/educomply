-- Set the first existing profile as admin
-- Useful bootstrap when there is only one user and you need admin access

DO $$
DECLARE
  v_id uuid;
BEGIN
  -- Pick the earliest created profile (assumes there is at least one)
  SELECT id INTO v_id
  FROM public.profiles
  ORDER BY created_at ASC
  LIMIT 1;

  IF v_id IS NULL THEN
    RAISE NOTICE 'No profiles found. Nothing to update.';
  ELSE
    UPDATE public.profiles
    SET role = 'admin'
    WHERE id = v_id;
    RAISE NOTICE 'Granted admin role to user %', v_id;
  END IF;
END $$;

-- Refresh PostgREST cache so policies reflecting admin take effect in REST immediately
DO $$ BEGIN PERFORM pg_notify('pgrst', 'reload schema'); EXCEPTION WHEN others THEN NULL; END $$;
