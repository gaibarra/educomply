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
