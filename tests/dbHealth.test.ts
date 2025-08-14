import { describe, it, expect } from 'vitest';
import { checkAuditsTable } from '../services/dbHealth';
import { supabase } from '../services/supabaseClient';

// Simple mock of supabase.from(...).select().limit()
function mockSelect(returnData: any) {
  (supabase as any).from = () => ({
    select: () => ({ limit: () => Promise.resolve({ data: returnData, error: null }) })
  });
}

describe('checkAuditsTable', () => {
  it('reports ok when expected cols present', async () => {
    const row = { id:1, created_at:'', name:'A', scope_level:'General', scope_entity:null, status:'Planificada', start_date:'2025-01-01', end_date:'2025-01-02', auditor_id:null, project_id:null, ai_description:null, ai_raw_suggestion:null, current_phase:'planificacion', phase_activities:null, phase_log:[] };
    mockSelect([row]);
    const res = await checkAuditsTable();
    expect(res.ok).toBe(true);
    expect(res.missing.length).toBe(0);
  });
  it('flags missing columns', async () => {
    const row = { id:1, created_at:'', status:'Planificada' }; // intentionally minimal
    mockSelect([row]);
    const res = await checkAuditsTable();
    expect(res.ok).toBe(false);
    expect(res.missing).toContain('name');
  });
});
