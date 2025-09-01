-- Restore reminders and responsible_areas tables and RLS policies
-- Added safeguard: create public.tasks (and optionally sub_tasks) if missing so FK in reminders works.
DO $$ BEGIN
	IF NOT EXISTS (
		SELECT 1 FROM information_schema.tables 
		WHERE table_schema = 'public' AND table_name = 'tasks'
	) THEN
		CREATE TABLE public.tasks (
			id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
			title text NOT NULL,
			description text,
			owner_id uuid REFERENCES public.profiles(id) ON DELETE SET NULL,
			responsible_person_id uuid REFERENCES public.profiles(id) ON DELETE SET NULL,
			scope jsonb DEFAULT '{}'::jsonb,
			status text DEFAULT 'Pendiente',
			completed_by uuid REFERENCES public.profiles(id) ON DELETE SET NULL,
			completed_at timestamptz,
			suspended boolean DEFAULT false,
			suspension_reason text,
			suspended_by uuid REFERENCES public.profiles(id) ON DELETE SET NULL,
			suspended_at timestamptz,
			created_at timestamptz NOT NULL DEFAULT now(),
			updated_at timestamptz NOT NULL DEFAULT now()
		);
	END IF;
	IF NOT EXISTS (
		SELECT 1 FROM information_schema.tables 
		WHERE table_schema = 'public' AND table_name = 'sub_tasks'
	) THEN
		CREATE TABLE public.sub_tasks (
			id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
			task_id uuid REFERENCES public.tasks(id) ON DELETE CASCADE,
			title text NOT NULL,
			description text,
			status text DEFAULT 'Pendiente',
			assigned_to_id uuid REFERENCES public.profiles(id) ON DELETE SET NULL,
			created_at timestamptz NOT NULL DEFAULT now(),
			updated_at timestamptz NOT NULL DEFAULT now()
		);
	END IF;
END $$;

-- Ensure helper function public.is_admin(uuid) exists for policy checks
DO $$ BEGIN
	IF NOT EXISTS (
		SELECT 1 FROM pg_proc p
		JOIN pg_namespace n ON n.oid = p.pronamespace
		WHERE p.proname = 'is_admin' AND n.nspname = 'public'
	) THEN
		CREATE FUNCTION public.is_admin(user_id uuid)
		RETURNS boolean
		LANGUAGE sql STABLE AS $fn$
			SELECT EXISTS(
				SELECT 1 FROM public.profiles pr
				WHERE pr.id = user_id AND pr.role = 'admin'
			);
		$fn$;
	END IF;
END $$;
CREATE TABLE IF NOT EXISTS public.reminders (
	id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
	task_id uuid NOT NULL REFERENCES public.tasks(id) ON DELETE CASCADE,
	user_id uuid NOT NULL DEFAULT auth.uid() REFERENCES public.profiles(id) ON DELETE CASCADE,
	remind_at timestamptz NULL,
	meta jsonb NULL,
	created_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS public.responsible_areas (
	id bigserial PRIMARY KEY,
	name text NOT NULL
);

ALTER TABLE public.reminders ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.responsible_areas ENABLE ROW LEVEL SECURITY;

CREATE POLICY reminders_select_own ON public.reminders FOR SELECT USING (auth.uid() = user_id);
CREATE POLICY reminders_insert_own ON public.reminders FOR INSERT WITH CHECK (auth.uid() = user_id);
CREATE POLICY reminders_update_own ON public.reminders FOR UPDATE USING (auth.uid() = user_id);
CREATE POLICY reminders_delete_own ON public.reminders FOR DELETE USING (auth.uid() = user_id);

CREATE POLICY responsible_areas_select ON public.responsible_areas FOR SELECT USING (true);
CREATE POLICY responsible_areas_insert ON public.responsible_areas FOR INSERT WITH CHECK (public.is_admin(auth.uid()));
CREATE POLICY responsible_areas_update ON public.responsible_areas FOR UPDATE USING (public.is_admin(auth.uid()));
CREATE POLICY responsible_areas_delete ON public.responsible_areas FOR DELETE USING (public.is_admin(auth.uid()));
