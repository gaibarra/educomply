import { describe, it, expect, vi, beforeEach } from 'vitest';
import { handleTasksRequest } from '../supabase/functions/tasks-crud/handler';

// Simple in-memory mock for supabase.from('tasks') chain
function makeSupabaseMock() {
  const rows: any[] = [];
  return {
    _rows: rows,
    from: vi.fn().mockImplementation((table: string) => {
      if (table !== 'tasks') throw new Error('Unexpected table');
      return {
        select: vi.fn().mockReturnThis(),
        limit: vi.fn().mockImplementation((n: number) => ({ data: rows.slice(0, n), error: null })),
        insert: vi.fn().mockImplementation((records: any[]) => ({
          select: () => ({ single: () => ({ data: (rows.push({ id: rows.length + 1, ...records[0] }), rows[rows.length - 1]), error: null }) })
        })),
        update: vi.fn().mockImplementation((fields: any) => ({
          eq: (_col: string, id: number) => ({ select: () => ({ single: () => {
            const idx = rows.findIndex(r => r.id === id);
            if (idx === -1) return { data: null, error: new Error('not found') };
            rows[idx] = { ...rows[idx], ...fields };
            return { data: rows[idx], error: null };
          } }) })
        })),
        delete: vi.fn().mockImplementation(() => ({
          eq: (_: string, id: number) => {
            const idx = rows.findIndex(r => r.id === id);
            if (idx !== -1) rows.splice(idx, 1);
            return { error: null };
          }
        })),
        eq: vi.fn()
      };
    })
  };
}

const validJwt = 'x.' + Buffer.from(JSON.stringify({ sub: '123' })).toString('base64url') + '.y';

const headersWithAuth = new Map([['authorization', 'Bearer ' + validJwt]]);
const headerShim = { get: (k: string) => headersWithAuth.get(k.toLowerCase()) || null };

describe('handleTasksRequest', () => {
  let supabase: any;
  beforeEach(() => { supabase = makeSupabaseMock(); });

  it('rejects missing auth when disabledAuth=false', async () => {
    const res = await handleTasksRequest({ method: 'GET', headers: { get: () => null }, body: null, supabase, disableAuth: false });
    expect(res.status).toBe(401);
  });

  it('lists tasks (empty)', async () => {
    const res = await handleTasksRequest({ method: 'GET', headers: headerShim, body: null, supabase, disableAuth: false });
    expect(res.status).toBe(200);
    expect(res.body.tasks).toEqual([]);
  });

  it('creates then updates and deletes a task', async () => {
    const create = await handleTasksRequest({ method: 'POST', headers: headerShim, body: { description: 'Task A' }, supabase, disableAuth: false });
    expect(create.status).toBe(201);
    const id = create.body.id;

    const update = await handleTasksRequest({ method: 'PATCH', headers: headerShim, body: { id, description: 'Task A+' }, supabase, disableAuth: false });
    expect(update.body.description).toBe('Task A+');

    const list = await handleTasksRequest({ method: 'GET', headers: headerShim, body: null, supabase, disableAuth: false });
    expect(list.body.tasks.length).toBe(1);

    const del = await handleTasksRequest({ method: 'DELETE', headers: headerShim, body: { id }, supabase, disableAuth: false });
    expect(del.body.success).toBe(true);

    const list2 = await handleTasksRequest({ method: 'GET', headers: headerShim, body: null, supabase, disableAuth: false });
    expect(list2.body.tasks.length).toBe(0);
  });

  it('rejects invalid create payload', async () => {
    const res = await handleTasksRequest({ method: 'POST', headers: headerShim, body: { description: '' }, supabase, disableAuth: false });
    expect(res.status).toBe(400);
    expect(res.body.errors).toContain('description required');
  });

  it('rejects patch without id', async () => {
    const res = await handleTasksRequest({ method: 'PATCH', headers: headerShim, body: { description: 'x' }, supabase, disableAuth: false });
    expect(res.status).toBe(400);
  expect(res.body.errors.length).toBeGreaterThan(0);
  });
});
