-- Adds phase tracking structure to audits
ALTER TABLE public.audits ADD COLUMN IF NOT EXISTS current_phase text DEFAULT 'planificacion';
ALTER TABLE public.audits ADD COLUMN IF NOT EXISTS phase_activities jsonb;
ALTER TABLE public.audits ADD COLUMN IF NOT EXISTS phase_log jsonb; -- array of {ts, from, to, actor}

-- Initialize phase_activities for existing rows if null with default structure (all activities incomplete)
UPDATE public.audits 
SET phase_activities = '{
  "planificacion": {"activities": [
    {"key": "definir_objetivos_alcance", "title": "Definición de objetivos y alcance", "completed": false},
    {"key": "recopilar_info_previa", "title": "Recopilación y análisis de información previa", "completed": false},
    {"key": "asignar_tareas_responsables", "title": "Asignación de tareas y responsabilidades", "completed": false},
    {"key": "valoracion_contexto_hipotesis", "title": "Valoración de contexto e hipótesis preliminares", "completed": false},
    {"key": "cronograma_actividades", "title": "Elaboración del cronograma y carta de contacto", "completed": false}
  ]},
  "ejecucion": {"activities": [
    {"key": "visita_institucion", "title": "Visita a la institución educativa", "completed": false},
    {"key": "entrevistas", "title": "Entrevistas y conversatorios", "completed": false},
    {"key": "revision_documentos", "title": "Revisión de documentos", "completed": false},
    {"key": "observacion_aulas", "title": "Observación de aulas", "completed": false},
    {"key": "registro_hallazgos", "title": "Registro de hallazgos", "completed": false}
  ]},
  "evaluacion": {"activities": [
    {"key": "analisis_resultados", "title": "Análisis de resultados y evidencias", "completed": false},
    {"key": "identificacion_fortalezas_mejoras", "title": "Identificación de fortalezas y áreas de mejora", "completed": false},
    {"key": "redaccion_informe", "title": "Redacción del informe", "completed": false},
    {"key": "emision_informe", "title": "Emisión del informe", "completed": false}
  ]},
  "seguimiento": {"activities": [
    {"key": "retroalimentacion", "title": "Retroalimentación a la institución", "completed": false},
    {"key": "planes_accion", "title": "Propuesta de planes de acción", "completed": false},
    {"key": "monitoreo_continuo", "title": "Monitoreo continuo", "completed": false},
    {"key": "difusion_resultados", "title": "Difusión de resultados", "completed": false}
  ]}
}'::jsonb
WHERE phase_activities IS NULL;

-- Initialize phase_log if null
UPDATE public.audits SET phase_log = '[]'::jsonb WHERE phase_log IS NULL;
