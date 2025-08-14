```markdown
# EduComply

Aplicación de gestión de cumplimiento normativo para instituciones educativas (México). Permite:
* Analizar normativas y extraer obligaciones (IA Gemini)
* Generar documentos formales Markdown con fuentes citadas
* Planear auditorías y sub‑tareas sugeridas por IA
* Gestionar tareas, sub‑tareas, adjuntos y comentarios
* Generar reportes agregados (estado general, tareas críticas, etc.)

## Tech Stack
Frontend: React + Vite + TailwindCSS
Backend: Supabase (PostgreSQL + Auth + Storage) + Edge Functions (Deno)
IA: Google Generative AI (gemini-2.5-flash)

## Estructura Clave
```
supabase/functions/        # Edge Functions (analyze-compliance, generate-document, etc.)
supabase/functions/_shared # utilidades compartidas (CORS)
components/                # UI React
services/                  # clientes (supabase, gemini)
audit-review/              # artefactos de auditoría y SQL sugerido
```

## Configuración Rápida
1. Clonar repo y entrar al directorio.
2. Copiar `.env.example` a `.env` y definir:
```
VITE_SUPABASE_URL=...
VITE_SUPABASE_ANON_KEY=...
GEMINI_API_KEY=...
ALLOWED_ORIGIN=http://localhost:5173
```
3. Instalar dependencias: `npm install`
4. Ejecutar en desarrollo: `npm run dev`

## Scripts
| Script        | Descripción |
|---------------|-------------|
| dev           | Dev server Vite |
| build:css     | Genera CSS Tailwind minificado |
| build         | build:css + bundle Vite |
| typecheck     | Verificación estricta TS |
| lint          | ESLint (sin warnings permitidos) |

## Pipeline de Build
`npm run build` genera primero el CSS (Tailwind purge) y luego el bundle.

## Edge Functions Principales
| Función              | Propósito |
|----------------------|----------|
| analyze-compliance   | Analiza texto normativo y retorna obligaciones estructuradas |
| suggest-subtasks     | Propone sub-tareas (3-5) a partir de una obligación |
| suggest-audit-plan   | Genera metadatos básicos de plan de auditoría |
| generate-document    | Produce documento formal (Markdown) con secciones y fuentes |
| generate-report      | Reportes agregados (estado general, tareas por área, etc.) |
| tasks-crud           | CRUD básico de tareas (GET/POST/PATCH/DELETE) |

## Funciones RPC (PostgreSQL) para Estado de Tareas
Se incluyen funciones SQL (archivo `supabase/sql/functions_tasks.sql`) para operaciones rápidas de cambio de estado sin depender de lógica compleja en el cliente.

| Función | Parámetros | Acción | Notas |
|---------|------------|--------|-------|
| `mark_task_completed(p_task_id uuid)` | `p_task_id` id de la tarea | Marca todas las sub_tareas como `Completada`; si no existen crea una sub_tarea marcador | `SECURITY DEFINER`, otorgar EXECUTE a `authenticated` y `service_role` |
| `reopen_task(p_task_id uuid)` | `p_task_id` | Cambia sub_tareas a `Pendiente` | Similar patrón de permisos |

Estrategia de fallback en frontend (`ComplianceItemCard`):
1. Intenta `supabase.rpc('mark_task_completed', { task_id })` o `reopen_task`.
2. Si la función no existe (404 / Not Found), el componente:
	- Marca directamente las filas de `sub_tasks` (o inserta una nueva al completar).
	- Emite evento `task-status-changed` para refrescar Gantt y Dashboard.
3. Muestra toasts de éxito/error y ofrece undo vía acción en toast.

Para eliminar el fallback (cuando las funciones ya están desplegadas y probadas) puedes limpiar la rama de código que detecta 404. Mientras tanto garantiza resiliencia en entornos donde la migración SQL aún no se aplicó.

Pasos para desplegar las funciones:
```sql
-- Ejecutar en panel SQL de Supabase
\i supabase/sql/functions_tasks.sql
```
Verifica después con:
```sql
select proname from pg_proc where proname in ('mark_task_completed','reopen_task');
```

Si recibes `permission denied for function ...` añade:
```sql
grant execute on function public.mark_task_completed(uuid) to authenticated;
grant execute on function public.reopen_task(uuid) to authenticated;
```

Recomendado: revisar políticas RLS de `sub_tasks` / `tasks` para que la ejecución vía funciones (SECURITY DEFINER) sea segura y no exponga datos no relacionados al usuario.

## CORS Centralizado
`supabase/functions/_shared/cors.ts` expone `buildCorsHeaders()`. Ajustar `ALLOWED_ORIGIN` para producción segura.

## Autenticación
Las funciones verifican JWT (role, expiración) salvo que `DISABLE_AUTH=true`. Útil en pruebas locales controladas.

## Subida de Archivos
`SubTaskItem` maneja adjuntos al bucket `task_documents`. Cada archivo crea registro en tabla `documents` con URL pública.

## Generación de Documentos (AI)
La función `generate-document` retorna JSON con: filename, title, summary, body_markdown, sources[], disclaimer. El frontend descarga un `.md` listo.

## Reportes
`generate-report` compone Markdown dinámico según tipo (general_status, overdue_tasks, etc.).

## Lint & Types
`npm run typecheck` y `npm run lint` aseguran consistencia. CI ejecuta ambos antes de construir.

## CI
Workflow: `.github/workflows/ci.yml` (install -> typecheck -> lint -> build). Extender con pruebas si se añaden.

## Despliegue de Edge Functions y CORS
Para habilitar CORS correcto en funciones como `suggest-subtasks`:

Opción CLI (local):
- Instala y autentica Supabase CLI (`npm i -g supabase@^2` y `supabase login`).
- Exporta variables:
	- `SUPABASE_PROJECT_REF=raiccyhtjhsgmouzulhn`
	- `ALLOWED_ORIGIN='http://localhost:5173'`
	- `GEMINI_API_KEY='...'`
- Sube secrets y despliega:
	- `supabase functions secrets set --project-ref "$SUPABASE_PROJECT_REF" ALLOWED_ORIGIN="$ALLOWED_ORIGIN" GEMINI_API_KEY="$GEMINI_API_KEY"`
	- `supabase functions deploy suggest-subtasks --project-ref "$SUPABASE_PROJECT_REF"`

Opción GitHub Actions:
- Define secrets `SUPABASE_ACCESS_TOKEN` y `GEMINI_API_KEY` en el repo.
- Ejecuta manualmente el workflow `Deploy Supabase Functions` pasando `project_ref` y `allowed_origin`.

Verificación rápida:
- GET `https://<ref>.supabase.co/functions/v1/suggest-subtasks?health=1` debe responder 200 con `Access-Control-Allow-Origin` para tu localhost.

## Auditoría / SQL Sugerido
Ver `audit-review/` para RLS, índices, triggers y logging recomendado (aplicar manualmente en tu instancia según necesidad).

## Próximos Pasos Sugeridos
* Añadir pruebas unitarias ligeras para servicios.
* Implementar cache distribuida (Redis) para análisis repetidos.
* Endurecer validaciones de entrada (zod) en Edge Functions.
* Implementar control de versiones de documentos generados.

## Licencia
Ver archivo LICENSE.
```
