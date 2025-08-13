// Deno-friendly copy of handler.ts for Edge Function bundling (imports zod via npm:)
// deno-lint-ignore-file no-explicit-any
import { z } from 'npm:zod';
export interface TasksHandlerArgs {
  method: string;
  headers: { get(name: string): string | null };
  body: any;
  supabase: any; // expects from(table) API similar to supabase-js
  disableAuth: boolean;
  decodeJwt?: (token: string) => any;
}

export interface TasksHandlerResult {
  status: number;
  body: any;
}

const createSchema = z.object({
  description: z.string().min(1, 'description required'),
  responsible_area_id: z.any().optional(),
  responsible_person_id: z.any().optional(),
  scope: z.any().optional()
});

const patchSchema = z.object({
  id: z.union([
    z.number({ invalid_type_error: 'id must be number' }),
    z.string().regex(/^\d+$/, 'id must be number').transform(v => Number(v))
  ]),
  description: z.string().min(1).optional(),
  responsible_area_id: z.any().optional(),
  responsible_person_id: z.any().optional(),
  scope: z.any().optional()
});

const recentCalls: Record<string, number[]> = {};
const RATE_LIMIT = 30; // per minute per key
function prune(key: string) { const now = Date.now(); recentCalls[key] = (recentCalls[key] || []).filter(t => now - t < 60000); }
function recordAndCheck(key: string) { prune(key); if (recentCalls[key].length >= RATE_LIMIT) return false; recentCalls[key].push(Date.now()); return true; }
function generateCorrelationId() { return 'req_' + Math.random().toString(36).slice(2,10); }

function defaultDecodeJwt(token: string) {
  try {
    const payload = token.split('.')[1];
    if (!payload) return null;
    const b64 = payload.replace(/-/g, '+').replace(/_/g, '/');
    const bin = typeof atob === 'function' ? atob(b64) : (globalThis as any).Buffer.from(b64, 'base64').toString('binary');
    const json = decodeURIComponent(
      bin
        .split('')
        .map(c => '%' + c.charCodeAt(0).toString(16).padStart(2, '0'))
        .join('')
    );
    return JSON.parse(json);
  } catch {
    return null;
  }
}

export async function handleTasksRequest(args: TasksHandlerArgs): Promise<TasksHandlerResult> {
  const { method, headers, body, supabase, disableAuth, decodeJwt = defaultDecodeJwt } = args;
  const correlationId = headers.get('x-correlation-id') || generateCorrelationId();

  if (!disableAuth) {
    const auth = headers.get('authorization');
    if (!auth) {
      return { status: 401, body: { error: 'Missing authorization header', correlationId } };
    }
    const token = auth.replace(/Bearer\s+/i, '');
    if (!decodeJwt(token)) {
      return { status: 401, body: { error: 'Invalid JWT', correlationId } };
    }
  }

  try {
    // Basic validation helpers
    const sanitizeString = (v: any) => typeof v === 'string' ? v.trim() : v;
    const allowedFields = ['description','responsible_area_id','responsible_person_id','scope'];
    const authForKey = headers.get('authorization') || 'anon';
    const rlKey = method + ':' + authForKey.slice(-16);
    if (!recordAndCheck(rlKey)) {
      return { status: 429, body: { error: 'rate limit exceeded', correlationId } };
    }

    if (method === 'GET') {
      const { data, error } = await supabase
        .from('tasks')
        .select('id, description, responsible_area_id, responsible_person_id, scope')
        .limit(100);
      if (error) throw error;
      return { status: 200, body: { tasks: data, correlationId } };
    }

    const b = (body && typeof body === 'object') ? body : {};

    if (method === 'POST') {
      const parse = createSchema.safeParse({ ...b, description: sanitizeString(b.description) });
      if (!parse.success) {
        return { status: 400, body: { errors: parse.error.issues.map(i => i.message), correlationId } };
      }
      const { description, responsible_area_id, responsible_person_id, scope } = parse.data;
      const { data, error } = await supabase
        .from('tasks')
        .insert([{ description, responsible_area_id, responsible_person_id, scope }])
        .select()
        .single();
      if (error) throw error;
      return { status: 201, body: { ...data, correlationId } };
    }

    if (method === 'PATCH') {
      const parse = patchSchema.safeParse(b);
      if (!parse.success) {
        return { status: 400, body: { errors: parse.error.issues.map(i => i.message), correlationId } };
      }
      const { id, ...fields } = parse.data as any;
      const updatePayload: Record<string, any> = {};
      for (const k of Object.keys(fields)) {
        if (allowedFields.includes(k)) updatePayload[k] = fields[k];
      }
      const { data, error } = await supabase
        .from('tasks')
        .update(updatePayload)
        .eq('id', id)
        .select()
        .single();
      if (error) throw error;
      return { status: 200, body: { ...data, correlationId } };
    }

    if (method === 'DELETE') {
      const idRaw = b.id;
      const idNum = typeof idRaw === 'string' ? Number(idRaw) : idRaw;
      if (!idNum) return { status: 400, body: { errors: ['id required'], correlationId } };
      const { error } = await supabase
        .from('tasks')
        .delete()
        .eq('id', idNum);
      if (error) throw error;
      return { status: 200, body: { success: true, correlationId } };
    }

    return { status: 405, body: { error: 'Method not allowed', correlationId } };
  } catch (e) {
    const message = e instanceof Error ? e.message : 'Unknown error';
    return { status: 500, body: { error: message, correlationId } };
  }
}

export default handleTasksRequest;
