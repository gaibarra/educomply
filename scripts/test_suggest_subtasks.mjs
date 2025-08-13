#!/usr/bin/env node
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';

function parseDotEnv(path) {
  const content = readFileSync(path, 'utf8');
  const lines = content.split(/\r?\n/);
  const env = {};
  for (const line of lines) {
    const m = line.match(/^\s*([A-Z0-9_]+)\s*=\s*(.*)\s*$/);
    if (!m) continue;
    let [, k, v] = m;
    v = v.replace(/^"|"$/g, '').replace(/^'|'$/g, '');
    env[k] = v;
  }
  return env;
}

async function main() {
  const envPath = resolve(process.cwd(), '.env');
  const env = parseDotEnv(envPath);
  const supaUrl = env.VITE_SUPABASE_URL;
  const anon = env.VITE_SUPABASE_ANON_KEY;
  if (!supaUrl || !anon) {
    console.error('[test] Faltan VITE_SUPABASE_URL o VITE_SUPABASE_ANON_KEY en .env');
    process.exit(1);
  }
  const base = supaUrl.replace(/\/$/, '') + '/functions/v1/suggest-subtasks';
  const origin = env.ALLOWED_ORIGIN?.split(',')[0] || 'http://localhost:5173';

  console.log('== Health check ==');
  const r1 = await fetch(base + '?health=1', { headers: { 'Origin': origin } });
  console.log('Status:', r1.status);
  console.log('Allow-Origin:', r1.headers.get('access-control-allow-origin'));
  console.log('Allow-Methods:', r1.headers.get('access-control-allow-methods'));
  console.log('Allow-Headers:', r1.headers.get('access-control-allow-headers'));
  const t1 = await r1.text();
  console.log('Body:', t1);

  console.log('\n== POST suggest-subtasks ==');
  const payload = {
    obligation: 'Implementar políticas de protección de datos personales conforme a la LFPDPPP',
    category: 'Protección de Datos'
  };
  const r2 = await fetch(base, {
    method: 'POST',
    headers: {
      'Origin': origin,
      'Content-Type': 'application/json',
      'apikey': anon,
      'Authorization': `Bearer ${anon}`
    },
    body: JSON.stringify(payload)
  });
  const text = await r2.text();
  console.log('Status:', r2.status);
  console.log('Allow-Origin:', r2.headers.get('access-control-allow-origin'));
  console.log('Content-Type:', r2.headers.get('content-type'));
  console.log('Body (truncated):', text.slice(0, 500));
  let json;
  try { json = JSON.parse(text); } catch (e) { /* ignore parse error */ }
  if (json && Array.isArray(json.subTasks)) {
    console.log('\nOK: subTasks recibidas:', json.subTasks);
    process.exit(0);
  } else {
    console.error('\nFallo: Respuesta sin subTasks:', text);
    process.exit(2);
  }
}

main().catch(err => { console.error('Error en test:', err); process.exit(1); });
