// deno-lint-ignore-file no-explicit-any
// Admin-only function to create a new auth user and insert a profile.
// Requires service role via function context. Protects via role check on caller JWT.

declare const Deno: any;
import { createClient } from 'npm:@supabase/supabase-js';
import { buildCorsHeadersForRequest } from '../_shared/cors.ts';

function getClient(req: Request) {
  return createClient(
    Deno.env.get('SUPABASE_URL') || '',
    Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') || '',
    { global: { headers: { Authorization: req.headers.get('authorization') || '' } } }
  );
}

function decodeJwt(token:string){ try { const p = token.split('.')[1]; return JSON.parse(atob(p.replace(/-/g,'+').replace(/_/g,'/')));} catch { return null; } }

Deno.serve(async (req: Request) => {
  const corsHeaders = buildCorsHeadersForRequest(req, { 'Access-Control-Allow-Methods': 'POST,OPTIONS' });
  if (req.method === 'OPTIONS') return new Response('ok',{headers:corsHeaders});
  if (req.method !== 'POST') return new Response(JSON.stringify({error:'Use POST'}),{status:405,headers:{...corsHeaders,'Content-Type':'application/json'}});

  // Require a valid user JWT and role=admin in profiles
  const authHeader = req.headers.get('authorization') || '';
  const token = authHeader.replace(/Bearer\s+/i,'');
  const jwt = decodeJwt(token);
  if (!jwt) return new Response(JSON.stringify({error:'Unauthorized'}),{status:401,headers:{...corsHeaders,'Content-Type':'application/json'}});

  const supabase = getClient(req);
  // Check caller role
  const { data: me, error: meErr } = await supabase.from('profiles').select('id, role').eq('id', jwt.sub).single();
  if (meErr || !me || me.role !== 'admin') {
    return new Response(JSON.stringify({error:'Forbidden'}),{status:403,headers:{...corsHeaders,'Content-Type':'application/json'}});
  }

  let body:any = null;
  try { body = await req.json(); } catch { body = null; }
  const { email, password, full_name, role, mobile=null, position=null, campus=null, area=null } = body || {};
  if (!email || !password || !full_name || !role) {
    return new Response(JSON.stringify({error:"Campos obligatorios: email, password, full_name, role"}),{status:400,headers:{...corsHeaders,'Content-Type':'application/json'}});
  }

  // Create auth user
  const authAdmin = supabase.auth.admin;
  const { data: created, error: createErr } = await authAdmin.createUser({ email, password, email_confirm: true });
  if (createErr) return new Response(JSON.stringify({error:createErr.message}),{status:400,headers:{...corsHeaders,'Content-Type':'application/json'}});
  const newUserId = created.user?.id;
  if (!newUserId) return new Response(JSON.stringify({error:'No se obtuvo id del nuevo usuario'}),{status:500,headers:{...corsHeaders,'Content-Type':'application/json'}});

  // Insert profile row
  const { error: profErr } = await supabase.from('profiles').insert({ id: newUserId, email, full_name, role, scope_entity: null, mobile, position, campus, area });
  if (profErr) return new Response(JSON.stringify({error:profErr.message}),{status:400,headers:{...corsHeaders,'Content-Type':'application/json'}});

  return new Response(JSON.stringify({ ok: true, user_id: newUserId }),{status:200,headers:{...corsHeaders,'Content-Type':'application/json'}});
});
