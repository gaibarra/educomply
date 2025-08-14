import { supabase } from './supabaseClient';

// Expected columns per table aligned with types & migrations
const EXPECTED: Record<string,string[]> = {
  audits: ['id','created_at','name','scope_level','scope_entity','status','start_date','end_date','auditor_id','project_id','ai_description','ai_raw_suggestion','current_phase','phase_activities','phase_log'],
  audit_findings: ['id','created_at','audit_id','description','severity','status','recommendation','related_task_id'],
  audit_tasks: ['audit_id','task_id'],
  tasks: ['id','created_at','description','documents','responsible_area_id','responsible_person_id','owner_id','project_id','scope']
};

export interface TableHealth {
  table: string;
  missing: string[];
  extra: string[];
  ok: boolean;
  columns: string[];
}

async function inspectTable(table: string): Promise<TableHealth> {
  const expected = EXPECTED[table] || [];
  // Attempt RPC first if available
  try {
    const { data, error } = await supabase.rpc('introspect_columns', { p_table: table }) as any;
    if (!error && Array.isArray(data)) {
      const cols = data.map((r: any)=> r.column_name).sort();
      const missing = expected.filter(c=> !cols.includes(c));
      const extra = cols.filter((c:string)=> !expected.includes(c));
      return { table, missing, extra, ok: missing.length===0, columns: cols };
    }
  } catch {/* ignore */}
  // Fallback select
  try {
    const { data, error } = await supabase.from(table).select('*').limit(1);
    if (error) throw error;
    const cols = data && data.length ? Object.keys(data[0]).sort() : expected; // if empty assume expected
    const missing = expected.filter(c=> !cols.includes(c));
    const extra = cols.filter(c=> !expected.includes(c));
    return { table, missing, extra, ok: missing.length===0, columns: cols };
  } catch {
    return { table, missing: expected, extra: [], ok: false, columns: [] };
  }
}

export async function checkAuditsTable(): Promise<TableHealth> { return inspectTable('audits'); }
export async function checkMultipleTables(tables: string[] = Object.keys(EXPECTED)): Promise<TableHealth[]> {
  const results: TableHealth[] = [];
  for (const t of tables) {
    // sequential to reduce load / allow RLS differences
    // eslint-disable-next-line no-await-in-loop
    results.push(await inspectTable(t));
  }
  return results;
}
