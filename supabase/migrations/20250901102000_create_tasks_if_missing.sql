-- 2025-09-01 Ensure tasks and related tables exist before reminders migration
BEGIN;

-- Create tasks table if missing
CREATE TABLE IF NOT EXISTS public.tasks (
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

-- Create sub_tasks table if missing
CREATE TABLE IF NOT EXISTS public.sub_tasks (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  task_id uuid REFERENCES public.tasks(id) ON DELETE CASCADE,
  title text NOT NULL,
  description text,
  status text DEFAULT 'Pendiente',
  assigned_to_id uuid REFERENCES public.profiles(id) ON DELETE SET NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

COMMIT;
