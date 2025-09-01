-- Add responsible_area_id column to tasks table
ALTER TABLE public.tasks ADD COLUMN IF NOT EXISTS responsible_area_id bigint REFERENCES public.responsible_areas(id);
