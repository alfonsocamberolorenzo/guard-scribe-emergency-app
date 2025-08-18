-- Create user roles enum
CREATE TYPE public.user_role AS ENUM ('editor', 'viewer');

-- Create profiles table for user data
CREATE TABLE public.profiles (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID NOT NULL UNIQUE REFERENCES auth.users(id) ON DELETE CASCADE,
  role user_role NOT NULL DEFAULT 'viewer',
  associated_doctor_id UUID REFERENCES public.doctors(id) ON DELETE SET NULL,
  full_name TEXT,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Enable RLS
ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY;

-- Create policies for profiles
CREATE POLICY "Users can view their own profile" 
ON public.profiles 
FOR SELECT 
USING (auth.uid() = user_id);

CREATE POLICY "Users can update their own profile" 
ON public.profiles 
FOR UPDATE 
USING (auth.uid() = user_id);

CREATE POLICY "Only editors can view all profiles" 
ON public.profiles 
FOR SELECT 
USING (
  EXISTS (
    SELECT 1 FROM public.profiles p 
    WHERE p.user_id = auth.uid() AND p.role = 'editor'
  )
);

-- Create function to check user roles
CREATE OR REPLACE FUNCTION public.get_user_role(user_uuid UUID)
RETURNS user_role
LANGUAGE sql
STABLE
SECURITY DEFINER
AS $$
  SELECT role FROM public.profiles WHERE user_id = user_uuid;
$$;

-- Create function to get associated doctor
CREATE OR REPLACE FUNCTION public.get_user_doctor_id(user_uuid UUID)
RETURNS UUID
LANGUAGE sql
STABLE
SECURITY DEFINER
AS $$
  SELECT associated_doctor_id FROM public.profiles WHERE user_id = user_uuid;
$$;

-- Function to handle new user registration
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER SET search_path = public
AS $$
BEGIN
  INSERT INTO public.profiles (user_id, full_name, role)
  VALUES (
    NEW.id, 
    NEW.raw_user_meta_data->>'full_name',
    'viewer'::user_role
  );
  RETURN NEW;
END;
$$;

-- Trigger for automatic profile creation
CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW EXECUTE FUNCTION public.handle_new_user();

-- Update RLS policies for existing tables to respect roles

-- Doctors table - viewers can only see their associated doctor
CREATE POLICY "Viewers can only see their associated doctor"
ON public.doctors
FOR SELECT
USING (
  CASE 
    WHEN public.get_user_role(auth.uid()) = 'editor' THEN true
    WHEN public.get_user_role(auth.uid()) = 'viewer' THEN id = public.get_user_doctor_id(auth.uid())
    ELSE false
  END
);

-- Guard schedules - viewers restricted to their doctor's schedules
CREATE POLICY "Role-based access to guard schedules"
ON public.guard_schedules
FOR SELECT
USING (
  CASE 
    WHEN public.get_user_role(auth.uid()) = 'editor' THEN true
    WHEN public.get_user_role(auth.uid()) = 'viewer' THEN 
      EXISTS (
        SELECT 1 FROM public.guard_assignments ga 
        WHERE ga.schedule_id = id 
        AND ga.doctor_id = public.get_user_doctor_id(auth.uid())
      )
    ELSE false
  END
);

-- Guard assignments - viewers restricted to their doctor's assignments
CREATE POLICY "Role-based access to guard assignments"
ON public.guard_assignments
FOR SELECT
USING (
  CASE 
    WHEN public.get_user_role(auth.uid()) = 'editor' THEN true
    WHEN public.get_user_role(auth.uid()) = 'viewer' THEN doctor_id = public.get_user_doctor_id(auth.uid())
    ELSE false
  END
);

-- Only editors can modify data
CREATE POLICY "Only editors can modify doctors"
ON public.doctors
FOR ALL
USING (public.get_user_role(auth.uid()) = 'editor')
WITH CHECK (public.get_user_role(auth.uid()) = 'editor');

CREATE POLICY "Only editors can modify guard schedules"
ON public.guard_schedules
FOR INSERT, UPDATE, DELETE
USING (public.get_user_role(auth.uid()) = 'editor')
WITH CHECK (public.get_user_role(auth.uid()) = 'editor');

CREATE POLICY "Only editors can modify guard assignments"
ON public.guard_assignments
FOR INSERT, UPDATE, DELETE
USING (public.get_user_role(auth.uid()) = 'editor')
WITH CHECK (public.get_user_role(auth.uid()) = 'editor');

CREATE POLICY "Only editors can modify guard days"
ON public.guard_days
FOR INSERT, UPDATE, DELETE
USING (public.get_user_role(auth.uid()) = 'editor')
WITH CHECK (public.get_user_role(auth.uid()) = 'editor');

CREATE POLICY "Only editors can modify leave requests"
ON public.leave_requests
FOR INSERT, UPDATE, DELETE
USING (public.get_user_role(auth.uid()) = 'editor')
WITH CHECK (public.get_user_role(auth.uid()) = 'editor');

CREATE POLICY "Only editors can modify doctor incompatibilities"
ON public.doctor_incompatibilities
FOR INSERT, UPDATE, DELETE
USING (public.get_user_role(auth.uid()) = 'editor')
WITH CHECK (public.get_user_role(auth.uid()) = 'editor');

-- Add updated_at trigger for profiles
CREATE TRIGGER update_profiles_updated_at
BEFORE UPDATE ON public.profiles
FOR EACH ROW
EXECUTE FUNCTION public.update_updated_at_column();