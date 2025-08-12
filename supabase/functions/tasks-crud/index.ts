// Basic tasks CRUD Edge Function (list, create, update, delete) via JSON body.
// Methods:
// GET    -> list tasks (limited fields)
// POST   -> create task { description, responsible_area_id, responsible_person_id, scope }
// PATCH  -> update task { id, ...fields }
// DELETE -> delete task { id }
// Auth enforced unless DISABLE_AUTH=true.
// deno-lint-ignore-file no-explicit-any
declare const Deno: any;
import { createClient } from '@supabase/supabase-js';
import { buildCorsHeaders } from '../_shared/cors.ts';
const corsHeaders = buildCorsHeaders({ 'Access-Control-Allow-Methods': 'GET,POST,PATCH,DELETE,OPTIONS' });

function decodeJwt(token:string){ try { return JSON.parse(atob(token.split('.')[1].replace(/-/g,'+').replace(/_/g,'/')));} catch { return null; } }

function getClient(req: Request) {
  return createClient(
    Deno.env.get('SUPABASE_URL') || '',
    Deno.env.get('SUPABASE_ANON_KEY') || '',
    { global: { headers: { Authorization: req.headers.get('authorization') || '' } } }
  );
}

Deno.serve(async (req: Request) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: corsHeaders });

  const disableAuth = (Deno.env.get('DISABLE_AUTH') || 'false').toLowerCase() === 'true';
  if (!disableAuth) {
    const auth = req.headers.get('authorization');
    if (!auth) return new Response(JSON.stringify({ error: 'Missing authorization header' }), { status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
    const payload = decodeJwt(auth.replace(/Bearer\s+/i,''));
    if (!payload) return new Response(JSON.stringify({ error: 'Invalid JWT' }), { status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
  }

  const supabase = getClient(req);
  try {
    if (req.method === 'GET') {
      const { data, error } = await supabase.from('tasks').select('id, description, responsible_area_id, responsible_person_id, scope').limit(100);
      if (error) throw error;
      return new Response(JSON.stringify({ tasks: data }), { headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
    }

    let body: any = null;
    if (req.method !== 'GET') {
      try { body = await req.json(); } catch { body = {}; }
    }

    if (req.method === 'POST') {
      const { description, responsible_area_id, responsible_person_id, scope } = body || {};
      if (!description) return new Response(JSON.stringify({ error: 'description required' }), { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
      const { data, error } = await supabase.from('tasks').insert([{ description, responsible_area_id, responsible_person_id, scope }]).select().single();
      if (error) throw error;
      return new Response(JSON.stringify(data), { status: 201, headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
    }

    if (req.method === 'PATCH') {
      const { id, ...fields } = body || {};
      if (!id) return new Response(JSON.stringify({ error: 'id required' }), { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
      const { data, error } = await supabase.from('tasks').update(fields).eq('id', id).select().single();
      if (error) throw error;
      return new Response(JSON.stringify(data), { headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
    }

    if (req.method === 'DELETE') {
      const { id } = body || {};
      if (!id) return new Response(JSON.stringify({ error: 'id required' }), { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
      const { error } = await supabase.from('tasks').delete().eq('id', id);
      if (error) throw error;
      return new Response(JSON.stringify({ success: true }), { headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
    }

    return new Response(JSON.stringify({ error: 'Method not allowed' }), { status: 405, headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
  } catch (e) {
    const message = e instanceof Error ? e.message : 'Unknown error';
    return new Response(JSON.stringify({ error: message }), { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
  }
});
