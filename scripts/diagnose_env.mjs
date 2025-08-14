#!/usr/bin/env node
/**
 * Diagnóstico rápido de entorno Supabase:
 * - Verifica CORS (OPTIONS) función admin-create-user
 * - Prueba SELECT profiles con y sin order=created_at.desc
 * - Sugiere SQL para created_at faltante
 * - Test POST (opcional) para admin-create-user
 *
 * Uso:
 *  node scripts/diagnose_env.mjs --url https://<project>.supabase.co \
 *    --anon <ANON_KEY> [--service <SERVICE_ROLE_KEY>] \
 *    [--origin http://localhost:5176] [--token <USER_JWT>] [--no-post]
 */
import process from 'node:process';

function parseArgs() {
  const args = process.argv.slice(2);
  const out = { origin: 'http://localhost:5173', noPost: false };
  for (let i = 0; i < args.length; i++) {
    const a = args[i];
    if (a === '--url') out.url = args[++i];
    else if (a === '--anon') out.anon = args[++i];
    else if (a === '--service') out.service = args[++i];
    else if (a === '--origin') out.origin = args[++i];
    else if (a === '--token') out.token = args[++i];
    else if (a === '--no-post') out.noPost = true;
  }
  out.url ||= process.env.SUPABASE_URL;
  out.anon ||= process.env.SUPABASE_ANON_KEY;
  out.service ||= process.env.SUPABASE_SERVICE_ROLE_KEY;
  out.token ||= process.env.SUPABASE_USER_JWT;
  return out;
}

async function fetchJSON(url, opts={}) {
  const res = await fetch(url, opts);
  const text = await res.text();
  let data; try { data = text ? JSON.parse(text) : null; } catch { data = text; }
  return { res, data };
}

function logSection(title) { console.log(`\n=== ${title} ===`); }

async function testCors(fnUrl, origin) {
  logSection('CORS OPTIONS admin-create-user');
  try {
    const res = await fetch(fnUrl, {
      method: 'OPTIONS',
      headers: {
        'Origin': origin,
        'Access-Control-Request-Method': 'POST',
        'Access-Control-Request-Headers': 'authorization,content-type'
      }
    });
    console.log('Status:', res.status);
    console.log('Access-Control-Allow-Origin:', res.headers.get('access-control-allow-origin'));
    if (res.status !== 200) {
      console.log('Sugerencia: Verifica variable ALLOWED_ORIGIN y redeploy function.');
    } else if (res.headers.get('access-control-allow-origin') !== origin && res.headers.get('access-control-allow-origin') !== '*') {
      console.log('Sugerencia: la función no refleja el origin actual; ajusta ALLOWED_ORIGIN.');
    }
  } catch (e) {
    console.error('Fallo OPTIONS:', e.message);
  }
}

async function testProfiles(url, anon, token) {
  logSection('Profiles SELECT con order');
  const base = `${url}/rest/v1/profiles`;
  const q = '?select=id,full_name,role,scope_entity,mobile,position,campus,area,email&order=created_at.desc&limit=1';
  const headers = { apikey: anon, Authorization: token ? `Bearer ${token}` : undefined };
  const { res } = await fetchJSON(base + q, { headers });
  console.log('Status:', res.status);
  if (res.status === 400) {
    console.log('Posible: columna created_at faltante o alguna columna en select no existe. Reintentando sin order...');
    const { res: res2, data: data2 } = await fetchJSON(base + '?select=id,full_name,role&limit=1', { headers });
    console.log('Reintento sin order status:', res2.status);
    if (res2.status === 200) {
      console.log('Confirmado: ORDER por created_at causa el 400. Falta created_at o índice.');
      console.log('SQL sugerido:\nALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS created_at timestamptz NOT NULL DEFAULT now();\nCREATE INDEX IF NOT EXISTS idx_profiles_created_at ON public.profiles(created_at DESC);\nNOTIFY pgrst, ' + "'reload schema'" + ';');
    } else {
      console.log('Persistente 400 sin order: revisa nombres de columnas id/full_name/role o RLS (debería ser 401/403 para RLS). Data:', data2);
    }
  }
}

async function testAdminCreateUserPost(fnUrl, origin, token, noPost) {
  logSection('POST admin-create-user (prueba)');
  if (noPost) { console.log('Omitido (--no-post).'); return; }
  if (!token) { console.log('Falta --token (JWT usuario admin) para probar POST.'); return; }
  const body = { email: `diagnose+${Date.now()}@example.com`, password: 'DiagTest123!', full_name: 'Diagnose User', role: 'auditor' };
  try {
    const { res, data } = await fetchJSON(fnUrl, {
      method: 'POST',
      headers: { 'Origin': origin, 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
      body: JSON.stringify(body)
    });
    console.log('Status:', res.status, 'Respuesta:', data);
    if (res.status === 403) console.log('Sugerencia: El JWT no pertenece a perfil con role=admin.');
    if (res.status === 400) console.log('Sugerencia: Verifica campos requeridos o RLS insert en profiles.');
  } catch (e) {
    console.error('Error POST:', e.message);
  }
}

async function main() {
  const cfg = parseArgs();
  if (!cfg.url || !cfg.anon) {
    console.error('Requiere --url y --anon (o variables SUPABASE_URL / SUPABASE_ANON_KEY)');
    process.exit(1);
  }
  const fnUrl = `${cfg.url}/functions/v1/admin-create-user`;
  await testCors(fnUrl, cfg.origin);
  await testProfiles(cfg.url, cfg.anon, cfg.token);
  await testAdminCreateUserPost(fnUrl, cfg.origin, cfg.token, cfg.noPost);
  logSection('Resumen');
  console.log('Si CORS falló: Ajusta ALLOWED_ORIGIN y redeploy.');
  console.log('Si profiles 400 sólo con order: añade created_at.');
  console.log('Si POST 403: añade role=admin a tu perfil.');
}

main().catch(e => { console.error(e); process.exit(1); });
