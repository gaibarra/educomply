-- Migration script to add missing columns to audit_phase_sub_activities table
-- Run this if you have an existing table that needs the new columns

-- Add missing columns to existing table
ALTER TABLE audit_phase_sub_activities
ADD COLUMN IF NOT EXISTS audit_id uuid REFERENCES audits(id) ON DELETE CASCADE,
ADD COLUMN IF NOT EXISTS phase TEXT;

-- Update existing records to populate the new columns
-- This query joins with audit_phase_activities to get the audit_id
UPDATE audit_phase_sub_activities
SET
  audit_id = apa.audit_id,
  phase = 'planificacion' -- Default phase, adjust as needed
FROM audit_phase_activities apa
WHERE audit_phase_sub_activities.activity_id = apa.id
  AND (audit_phase_sub_activities.audit_id IS NULL OR audit_phase_sub_activities.phase IS NULL);

-- Make the new columns NOT NULL after populating data
ALTER TABLE audit_phase_sub_activities
ALTER COLUMN audit_id SET NOT NULL,
ALTER COLUMN phase SET NOT NULL;
