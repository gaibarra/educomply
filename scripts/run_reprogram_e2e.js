#!/usr/bin/env node
// scripts/run_reprogram_e2e.js
// Ejecuta el flujo e2e para tareas suspendidas usando la service_role key de Supabase.
// USO:
//   export SUPABASE_URL="https://xyz.supabase.co"
//   export SUPABASE_SERVICE_ROLE_KEY="<service-role-key>"
//   node scripts/run_reprogram_e2e.js

import('dotenv/config');
import { createClient } from '@supabase/supabase-js';

const SUPABASE_URL = process.env.SUPABASE_URL;
const SERVICE_ROLE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!SUPABASE_URL || !SERVICE_ROLE_KEY) {
  console.error('Faltan SUPABASE_URL o SUPABASE_SERVICE_ROLE_KEY. Exporta ambas antes de ejecutar.');
  process.exit(1);
}

const supabase = createClient(SUPABASE_URL, SERVICE_ROLE_KEY);

async function run() {
  console.log('Iniciando e2e reprogram_task (service role)');

  // IDs fijos para prueba
  const TASK_ID = '22222222-2222-2222-2222-222222222222';
  try {
    // 1) Insertar tarea suspendida (owner_id omitido para evitar FK)
    console.log('\n1) Insertando tarea suspendida...');
    const insertResp = await supabase
      .from('tasks')
      .upsert([
        {
          id: TASK_ID,
          title: 'E2E Task suspended',
          scope: {},
          suspended: true,
          suspension_reason: 'Motivo de prueba',
          suspended_by: null,
        },
      ], { onConflict: 'id' });
    if (insertResp.error) throw insertResp.error;
    console.log('Insert OK');

    // 2) Listar tareas suspendidas sin due_date
    console.log('\n2) Listando tareas suspendidas sin due_date...');
    const { data: suspended, error: selectErr } = await supabase
      .from('tasks')
      .select('*')
      .eq('suspended', true);
    if (selectErr) throw selectErr;
    console.log('Encontradas:', suspended?.length || 0);
    const found = (suspended || []).filter(t => !t.scope || !(t.scope.due_date));
    console.log('Sin due_date:', found.map(f => ({ id: f.id, title: f.title })));

    // 3) Reprogramar: actualizar scope->due_date y reanudar
    console.log('\n3) Reprogramando (actualizando scope.due_date y reanudando)...');
    const newDue = new Date(Date.UTC(2025, 8 - 1, 1, 12, 0, 0)).toISOString(); // 2025-09-01T12:00:00Z
    const { error: updErr } = await supabase.rpc('reprogram_task', { p_task_id: TASK_ID, p_new_due_date: newDue });
    if (updErr) {
      // Si la RPC falla por autenticación/privilegios, caeremos al update directo usando service role
      console.warn('RPC reprogram_task falló, intentaremos actualización directa con service role:', updErr.message);
      const { error: directErr } = await supabase
        .from('tasks')
        .update({
          scope: supabase.rpc ? { due_date: newDue } : { due_date: newDue },
          suspended: false,
          suspension_reason: null,
          suspended_by: null,
          updated_at: new Date().toISOString(),
        })
        .eq('id', TASK_ID);
      if (directErr) throw directErr;
      console.log('Actualización directa OK');
    } else {
      console.log('RPC reprogram_task OK');
    }

    // 4) Verificar
    console.log('\n4) Verificando tarea...');
    const { data: after, error: afterErr } = await supabase.from('tasks').select('id,suspended,scope').eq('id', TASK_ID).single();
    if (afterErr) throw afterErr;
    console.log('Tarea:', { id: after.id, suspended: after.suspended, due_date: after.scope?.due_date });

    // 5) Insertar entrada de log simulada
    console.log('\n5) Insertando entrada en task_activity_log...');
    const { error: logErr } = await supabase.from('task_activity_log').insert([
      { task_id: TASK_ID, event_type: 'task_reprogrammed', detail: `Reprogramada a ${newDue}`, actor_id: null, actor_name: 'E2E (service-role)' }
    ]);
    if (logErr) throw logErr;
    console.log('Log insertado');

    // 6) Mostrar últimos logs
    const { data: logs, error: logsErr } = await supabase.from('task_activity_log').select('id,task_id,event_type,detail,actor_name,created_at').eq('task_id', TASK_ID).order('created_at', { ascending: false }).limit(5);
    if (logsErr) throw logsErr;
    console.log('\nLogs recientes:', logs);

    console.log('\nE2E complete. NOTA: Este script no deshace los cambios; si quieres revertirlos elimina la tarea manualmente.');

  } catch (err) {
    console.error('Error durante e2e:', err.message || err);
    process.exitCode = 2;
  }
}

run();
