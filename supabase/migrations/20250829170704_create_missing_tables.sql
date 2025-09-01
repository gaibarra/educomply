-- Missing tables that need to be created after db reset
-- These tables are required by the application but were not included in the schema files

-- Extensions
CREATE EXTENSION IF NOT EXISTS pgcrypto;
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- Types
DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'user_role') THEN
    CREATE TYPE user_role AS ENUM ('admin','director_campus','director_facultad','usuario');
  END IF;
END $$;

-- Table: profiles (corrected definition)
CREATE TABLE IF NOT EXISTS public.profiles (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  full_name text,
  role user_role DEFAULT 'usuario',
  email text UNIQUE,
  scope_entity text NULL,
  mobile text NULL,
  position text NULL,
  campus text NULL,
  area text NULL,
  created_at timestamptz NOT NULL DEFAULT now()
);

-- Table: institution_profile
CREATE TABLE IF NOT EXISTS public.institution_profile (
  id serial PRIMARY KEY,
  name text NOT NULL,
  address text,
  phone text,
  email text,
  website text,
  created_at timestamptz DEFAULT timezone('utc'::text, now()) NOT NULL,
  updated_at timestamptz DEFAULT timezone('utc'::text, now()) NOT NULL
);

-- Enable RLS
ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.institution_profile ENABLE ROW LEVEL SECURITY;

-- RLS Policies for profiles
CREATE POLICY "Users can view their own profile" ON public.profiles
  FOR SELECT USING (auth.uid() = id);

CREATE POLICY "Users can update their own profile" ON public.profiles
  FOR UPDATE USING (auth.uid() = id);

CREATE POLICY "Admins can view all profiles" ON public.profiles
  FOR SELECT USING (
    EXISTS (
      SELECT 1 FROM public.profiles
      WHERE id = auth.uid() AND role = 'admin'
    )
  );

-- RLS Policies for institution_profile
CREATE POLICY "Anyone can view institution profile" ON public.institution_profile
  FOR SELECT USING (true);

-- Insert default institution profile
INSERT INTO public.institution_profile (name, address, phone, email, website)
VALUES ('Default Institution', 'Default Address', '000-000-0000', 'info@default.edu', 'https://default.edu')
ON CONFLICT DO NOTHING;

CREATE POLICY "Only admins can update institution profile" ON public.institution_profile
  FOR ALL USING (
    EXISTS (
      SELECT 1 FROM public.profiles
      WHERE id = auth.uid() AND role = 'admin'
    )
  );

-- Insert default institution profile if it doesn't exist
INSERT INTO public.institution_profile (id, name, address, phone, email)
VALUES (1, 'Institución Educativa', 'Dirección por defecto', '123-456-7890', 'contacto@institucion.edu')
ON CONFLICT (id) DO NOTHING;

-- Create indexes for better performance
CREATE INDEX IF NOT EXISTS idx_profiles_role ON public.profiles(role);
CREATE INDEX IF NOT EXISTS idx_profiles_campus ON public.profiles(campus);
CREATE INDEX IF NOT EXISTS idx_profiles_email ON public.profiles(email);
CREATE INDEX IF NOT EXISTS idx_profiles_created_at ON public.profiles(created_at);