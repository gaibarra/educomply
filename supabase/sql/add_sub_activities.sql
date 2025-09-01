
CREATE TABLE audit_phase_sub_activities (
  id uuid DEFAULT gen_random_uuid() PRIMARY KEY,
  audit_id uuid NOT NULL REFERENCES audits(id) ON DELETE CASCADE,
  activity_id INTEGER NOT NULL REFERENCES audit_phase_activities(id) ON DELETE CASCADE,
  phase TEXT NOT NULL,
  description TEXT NOT NULL,
  start_date DATE NOT NULL,
  end_date DATE NOT NULL,
  completed BOOLEAN NOT NULL DEFAULT false,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

ALTER TABLE audit_phase_sub_activities ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Allow all for authenticated users" ON audit_phase_sub_activities FOR ALL
USING (auth.role() = 'authenticated');
