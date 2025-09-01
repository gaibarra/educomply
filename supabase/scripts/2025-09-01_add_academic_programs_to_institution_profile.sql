-- 2025-09-01_add_academic_programs_to_institution_profile.sql
-- Adds the academic_programs column to the institution_profile table

ALTER TABLE public.institution_profile
  ADD COLUMN IF NOT EXISTS academic_programs jsonb;
