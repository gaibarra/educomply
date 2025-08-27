-- functions_audits.sql
-- Tablas y funciones para una gestión de auditorías más robusta.

-- 1. Tabla para actividades de fase de auditoría
-- Reemplaza el campo JSONB 'phase_activities' en la tabla 'audits'.
CREATE TABLE IF NOT EXISTS public.audit_phase_activities (
    id bigserial PRIMARY KEY,
    audit_id bigint NOT NULL REFERENCES public.audits(id) ON DELETE CASCADE,
    phase text NOT NULL,
    description text NOT NULL,
    completed boolean NOT NULL DEFAULT false,
    notes text,
    created_at timestamptz NOT NULL DEFAULT now(),
    updated_at timestamptz NOT NULL DEFAULT now()
);

-- 2. Tabla para el historial de eventos de auditoría
-- Reemplaza el campo JSONB 'phase_log'.
CREATE TABLE IF NOT EXISTS public.audit_history_log (
    id bigserial PRIMARY KEY,
    audit_id bigint NOT NULL REFERENCES public.audits(id) ON DELETE CASCADE,
    actor_id uuid REFERENCES public.profiles(id) ON DELETE SET NULL,
    actor_name text,
    event_type text NOT NULL,
    detail jsonb,
    created_at timestamptz NOT NULL DEFAULT now()
);

-- 3. Función para obtener todos los detalles de una auditoría
-- Simplifica la carga de datos en el cliente.
CREATE OR REPLACE FUNCTION public.get_audit_details(p_audit_id bigint)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER SET search_path = public
AS $$
DECLARE
    audit_details jsonb;
BEGIN
    -- Solo usuarios autorizados (admin o auditor asignado)
    IF NOT (is_admin(auth.uid()) OR EXISTS (SELECT 1 FROM audits WHERE id = p_audit_id AND auditor_id = auth.uid())) THEN
        RAISE EXCEPTION 'permission denied';
    END IF;

    SELECT jsonb_build_object(
        'audit', to_jsonb(a),
        'auditor', to_jsonb(p),
        'findings', (SELECT jsonb_agg(f) FROM audit_findings f WHERE f.audit_id = a.id),
        'activities', (SELECT jsonb_agg(act) FROM audit_phase_activities act WHERE act.audit_id = a.id),
        'history', (SELECT jsonb_agg(h) FROM audit_history_log h WHERE h.audit_id = a.id ORDER BY h.created_at DESC)
    )
    INTO audit_details
    FROM audits a
    LEFT JOIN profiles p ON a.auditor_id = p.id
    WHERE a.id = p_audit_id;

    RETURN audit_details;
END;
$$;

-- 4. Función para avanzar la fase de una auditoría
CREATE OR REPLACE FUNCTION public.advance_audit_phase(p_audit_id bigint, p_new_phase text)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER SET search_path = public
AS $$
DECLARE
    old_phase text;
BEGIN
    -- Solo admin o auditor asignado
    IF NOT (is_admin(auth.uid()) OR EXISTS (SELECT 1 FROM audits WHERE id = p_audit_id AND auditor_id = auth.uid())) THEN
        RAISE EXCEPTION 'permission denied';
    END IF;

    SELECT current_phase INTO old_phase FROM audits WHERE id = p_audit_id;

    UPDATE audits SET current_phase = p_new_phase, updated_at = now() WHERE id = p_audit_id;

    INSERT INTO audit_history_log (audit_id, actor_id, actor_name, event_type, detail)
    VALUES (p_audit_id, auth.uid(), (SELECT full_name FROM profiles WHERE id = auth.uid()), 'phase_change', jsonb_build_object('from', old_phase, 'to', p_new_phase));
END;
$$;

-- 5. Función para actualizar una actividad de auditoría
CREATE OR REPLACE FUNCTION public.update_audit_activity(p_activity_id bigint, p_completed boolean, p_notes text)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER SET search_path = public
AS $$
DECLARE
    v_audit_id bigint;
    v_activity_desc text;
BEGIN
    SELECT audit_id, description INTO v_audit_id, v_activity_desc FROM audit_phase_activities WHERE id = p_activity_id;

    IF v_audit_id IS NULL THEN RAISE EXCEPTION 'Activity not found'; END IF;

    -- Solo admin o auditor asignado
    IF NOT (is_admin(auth.uid()) OR EXISTS (SELECT 1 FROM audits WHERE id = v_audit_id AND auditor_id = auth.uid())) THEN
        RAISE EXCEPTION 'permission denied';
    END IF;

    UPDATE audit_phase_activities SET completed = p_completed, notes = p_notes, updated_at = now() WHERE id = p_activity_id;

    INSERT INTO audit_history_log (audit_id, actor_id, actor_name, event_type, detail)
    VALUES (v_audit_id, auth.uid(), (SELECT full_name FROM profiles WHERE id = auth.uid()), 'activity_update', jsonb_build_object('activity', v_activity_desc, 'completed', p_completed));
END;
$$;

GRANT EXECUTE ON FUNCTION public.get_audit_details(bigint) TO authenticated;
GRANT EXECUTE ON FUNCTION public.advance_audit_phase(bigint, text) TO authenticated;
GRANT EXECUTE ON FUNCTION public.update_audit_activity(bigint, boolean, text) TO authenticated;