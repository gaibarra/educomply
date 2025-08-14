-- Adds AI-related columns to audits
ALTER TABLE public.audits
  ADD COLUMN IF NOT EXISTS ai_description text,
  ADD COLUMN IF NOT EXISTS ai_raw_suggestion jsonb;

-- Optional: future index if filtering by presence of AI data becomes common
-- CREATE INDEX IF NOT EXISTS idx_audits_ai_raw_suggestion ON public.audits USING gin(ai_raw_suggestion);
