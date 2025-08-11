# Auditoría técnica de **EduComply** — 2025-08-11

Este documento resume hallazgos y propuestas para afinar la aplicación EduComply (React + Supabase + Edge Functions con Gemini).
Enfoque: seguridad, robustez, rendimiento, DX y automatización.

## 1) Hallazgos críticos (ALTA)
1. CORS permisivo en Edge Functions (*).
2. GEMINI_API_KEY no debe exponerse en el bundle del frontend.
3. Fallback con anon key en llamadas a funciones (riesgo si RLS es laxo).
4. RLS admin sin SECURITY DEFINER puede caer en recursión.
5. Import maps en index.html junto a Vite (riesgo de duplicidad).
6. Tailwind vía CDN sin tree-shaking (solo dev).
7. README/Licencia genéricos, falta guía de despliegue.
8. Faltan índices y triggers updated_at.

## 2) Propuestas
- Restringir CORS por ALLOWED_ORIGIN y Vary: Origin.
- Mantener GEMINI_API_KEY solo en Edge Functions.
- Forzar auth en funciones; sin sesión → 401.
- Función public.is_admin(uid) SECURITY DEFINER y políticas RLS claras.
- Quitar importmap del index.html y usar Vite.
- Tailwind build con PostCSS (prod).
- Añadir índices, triggers y error_logs.
- CI/CD con despliegue de funciones y build.

## 3) Archivos incluidos
- patches/* (diffs sugeridos)
- sql/* (RLS, índices, triggers, error_logs)
- ci/github-actions.yml (ejemplo)
- cron/weekly_report.md (flujo propuesto)

Aplicar SQL primero, luego parches y despliegue de funciones.
