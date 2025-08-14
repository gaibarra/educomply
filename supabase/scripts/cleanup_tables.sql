-- Cleanup script for application tables
-- WARNING: This will DELETE data. Review before running in production.
--
-- Usage:
-- 1) Run in Supabase Dashboard > SQL Editor, or
-- 2) Use psql against your database URL.
--
-- Notes:
-- - TRUNCATE ... RESTART IDENTITY CASCADE removes all rows and resets sequences.
-- - We preserve profiles, responsible_areas and institution_profile by default.
--   Uncomment the optional lines if you also want to clear them.

BEGIN;

SET search_path TO public;

-- Truncate only if the table exists to avoid errors on environments without all tables
DO $$
DECLARE
  tbl text;
  exists boolean;
  tables text[] := ARRAY[
    'audit_findings',
    'audit_tasks',
    'comments',
    'documents',
    'sub_tasks',
    'tasks',
    'audits'
  ];
BEGIN
  FOREACH tbl IN ARRAY tables LOOP
    SELECT EXISTS (
      SELECT 1 FROM information_schema.tables
      WHERE table_schema = 'public' AND table_name = tbl
    ) INTO exists;
    IF exists THEN
      EXECUTE format('TRUNCATE TABLE %I.%I RESTART IDENTITY CASCADE', 'public', tbl);
      RAISE NOTICE 'Truncated table: %', tbl;
    ELSE
      RAISE NOTICE 'Skipping missing table: %', tbl;
    END IF;
  END LOOP;
END $$;

-- Optional: also clear catalogs. Uncomment to enable.
-- DO $$
-- DECLARE tbl text; exists boolean; tables text[] := ARRAY['institution_profile','responsible_areas'];
-- BEGIN
--   FOREACH tbl IN ARRAY tables LOOP
--     SELECT EXISTS (
--       SELECT 1 FROM information_schema.tables WHERE table_schema='public' AND table_name=tbl
--     ) INTO exists;
--     IF exists THEN
--       EXECUTE format('TRUNCATE TABLE %I.%I RESTART IDENTITY CASCADE', 'public', tbl);
--       RAISE NOTICE 'Truncated catalog table: %', tbl;
--     ELSE
--       RAISE NOTICE 'Skipping missing catalog table: %', tbl;
--     END IF;
--   END LOOP;
-- END $$;

-- DO NOT truncate profiles here; they are tied to auth and app users
-- Uncomment at your own risk
-- DO $$ BEGIN
--   IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_schema='public' AND table_name='profiles') THEN
--     EXECUTE 'TRUNCATE TABLE public.profiles RESTART IDENTITY CASCADE';
--     RAISE NOTICE 'Truncated table: profiles';
--   END IF;
-- END $$;

COMMIT;

-- After running, verify row counts (tables that exist will appear):
-- SELECT 'audits' tbl, count(*) FROM audits
-- UNION ALL SELECT 'tasks', count(*) FROM tasks
-- UNION ALL SELECT 'sub_tasks', count(*) FROM sub_tasks
-- UNION ALL SELECT 'audit_findings', count(*) FROM audit_findings
-- UNION ALL SELECT 'audit_tasks', count(*) FROM audit_tasks
-- UNION ALL SELECT 'comments', count(*) FROM comments
-- UNION ALL SELECT 'documents', count(*) FROM documents;
