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

-- Core transactional/link tables (order not required due to CASCADE, but explicit list for clarity)
TRUNCATE TABLE
  audit_findings,
  audit_tasks,
  comments,
  documents,
  sub_tasks,
  tasks,
  audits
RESTART IDENTITY CASCADE;

-- Optional: clear institution profile (single-row table)
-- TRUNCATE TABLE institution_profile RESTART IDENTITY CASCADE;

-- Optional: clear responsible areas catalog
-- TRUNCATE TABLE responsible_areas RESTART IDENTITY CASCADE;

-- DO NOT truncate profiles here; they are tied to auth and app users
-- TRUNCATE TABLE profiles RESTART IDENTITY CASCADE; -- not recommended

COMMIT;

-- After running, verify row counts:
-- SELECT 'audits' tbl, count(*) FROM audits
-- UNION ALL SELECT 'tasks', count(*) FROM tasks
-- UNION ALL SELECT 'sub_tasks', count(*) FROM sub_tasks
-- UNION ALL SELECT 'audit_findings', count(*) FROM audit_findings
-- UNION ALL SELECT 'audit_tasks', count(*) FROM audit_tasks
-- UNION ALL SELECT 'comments', count(*) FROM comments
-- UNION ALL SELECT 'documents', count(*) FROM documents;
