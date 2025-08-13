// Basic tasks CRUD Edge Function (list, create, update, delete) via JSON body.
// Methods:
// GET    -> list tasks (limited fields)
// POST   -> create task { description, responsible_area_id, responsible_person_id, scope }
// PATCH  -> update task { id, ...fields }
// DELETE -> delete task { id }
// Auth enforced unless DISABLE_AUTH=true.
// deno-lint-ignore-file no-explicit-any
declare const Deno: any;
import { createClient } from 'npm:@supabase/supabase-js';
import { buildCorsHeadersForRequest } from '../_shared/cors.ts';
// Use Deno-specific handler that imports zod via npm: for Edge Function bundling.
import { handleTasksRequest } from './handler.deno.ts';

// CORS headers computed per-request to reflect correct Origin

function getClient(req: Request) {
  return createClient(
    Deno.env.get('SUPABASE_URL') || '',
    Deno.env.get('SUPABASE_ANON_KEY') || '',
    { global: { headers: { Authorization: req.headers.get('authorization') || '' } } }
  );
}

function decodeJwt(token:string){ try { return JSON.parse(atob(token.split('.')[1].replace(/-/g,'+').replace(/_/g,'/')));} catch { return null; } }

Deno.serve(async (req: Request) => {
  const corsHeaders = buildCorsHeadersForRequest(req, { 'Access-Control-Allow-Methods': 'GET,POST,PATCH,DELETE,OPTIONS' });
  if (req.method === 'OPTIONS') return new Response('ok', { headers: corsHeaders });
  const disableAuth = (Deno.env.get('DISABLE_AUTH') || 'false').toLowerCase() === 'true';
  let parsed: any = {};
  if (req.method !== 'GET') { try { parsed = await req.json(); } catch { parsed = {}; } }
  const supabase = getClient(req);
  const result = await handleTasksRequest({
    method: req.method,
    headers: req.headers,
    body: parsed,
    supabase,
    disableAuth,
    decodeJwt
  });
  return new Response(JSON.stringify(result.body), { status: result.status, headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
});
