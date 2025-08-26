run_reprogram_e2e.js
---------------------

Script Node para ejecutar un E2E del flujo de reprogramación usando la service_role key.

Uso:

export SUPABASE_URL="https://<your>.supabase.co"
export SUPABASE_SERVICE_ROLE_KEY="<service-role-key>"
node scripts/run_reprogram_e2e.js

Nota: usa esta key solo en entornos seguros (CI o máquina local de desarrollo). El script intentará usar la RPC `reprogram_task` y, si falla por permisos, actualizará directamente la fila usando la service role.
