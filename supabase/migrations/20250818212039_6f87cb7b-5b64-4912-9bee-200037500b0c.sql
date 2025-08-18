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

-- Drop existing policies to replace with role-based ones
DROP POLICY IF EXISTS "Allow all operations on doctors" ON public.doctors;
DROP POLICY IF EXISTS "Allow all operations on guard_schedules" ON public.guard_schedules;
DROP POLICY IF EXISTS "Allow all operations on guard_assignments" ON public.guard_assignments;
DROP POLICY IF EXISTS "Allow all operations on guard_days" ON public.guard_days;
DROP POLICY IF EXISTS "Allow all operations on leave_requests" ON public.leave_requests;
DROP POLICY IF EXISTS "Allow all operations on doctor_incompatibilities" ON public.doctor_incompatibilities;

-- Doctors table policies
CREATE POLICY "Role-based select on doctors"
ON public.doctors
FOR SELECT
USING (
  CASE 
    WHEN public.get_user_role(auth.uid()) = 'editor' THEN true
    WHEN public.get_user_role(auth.uid()) = 'viewer' THEN id = public.get_user_doctor_id(auth.uid())
    ELSE false
  END
);

CREATE POLICY "Only editors can insert doctors"
ON public.doctors
FOR INSERT
WITH CHECK (public.get_user_role(auth.uid()) = 'editor');

CREATE POLICY "Only editors can update doctors"
ON public.doctors
FOR UPDATE
USING (public.get_user_role(auth.uid()) = 'editor');

CREATE POLICY "Only editors can delete doctors"
ON public.doctors
FOR DELETE
USING (public.get_user_role(auth.uid()) = 'editor');

-- Guard schedules policies
CREATE POLICY "Role-based select on guard_schedules"
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

CREATE POLICY "Only editors can insert guard_schedules"
ON public.guard_schedules
FOR INSERT
WITH CHECK (public.get_user_role(auth.uid()) = 'editor');

CREATE POLICY "Only editors can update guard_schedules"
ON public.guard_schedules
FOR UPDATE
USING (public.get_user_role(auth.uid()) = 'editor');

CREATE POLICY "Only editors can delete guard_schedules"
ON public.guard_schedules
FOR DELETE
USING (public.get_user_role(auth.uid()) = 'editor');

-- Guard assignments policies
CREATE POLICY "Role-based select on guard_assignments"
ON public.guard_assignments
FOR SELECT
USING (
  CASE 
    WHEN public.get_user_role(auth.uid()) = 'editor' THEN true
    WHEN public.get_user_role(auth.uid()) = 'viewer' THEN doctor_id = public.get_user_doctor_id(auth.uid())
    ELSE false
  END
);

CREATE POLICY "Only editors can insert guard_assignments"
ON public.guard_assignments
FOR INSERT
WITH CHECK (public.get_user_role(auth.uid()) = 'editor');

CREATE POLICY "Only editors can update guard_assignments"
ON public.guard_assignments
FOR UPDATE
USING (public.get_user_role(auth.uid()) = 'editor');

CREATE POLICY "Only editors can delete guard_assignments"
ON public.guard_assignments
FOR DELETE
USING (public.get_user_role(auth.uid()) = 'editor');

-- Guard days policies  
CREATE POLICY "Everyone can read guard_days"
ON public.guard_days
FOR SELECT
USING (true);

CREATE POLICY "Only editors can insert guard_days"
ON public.guard_days
FOR INSERT
WITH CHECK (public.get_user_role(auth.uid()) = 'editor');

CREATE POLICY "Only editors can update guard_days"
ON public.guard_days
FOR UPDATE
USING (public.get_user_role(auth.uid()) = 'editor');

CREATE POLICY "Only editors can delete guard_days"
ON public.guard_days
FOR DELETE
USING (public.get_user_role(auth.uid()) = 'editor');

-- Leave requests policies
CREATE POLICY "Everyone can read leave_requests"
ON public.leave_requests
FOR SELECT
USING (true);

CREATE POLICY "Only editors can insert leave_requests"
ON public.leave_requests
FOR INSERT
WITH CHECK (public.get_user_role(auth.uid()) = 'editor');

CREATE POLICY "Only editors can update leave_requests"
ON public.leave_requests
FOR UPDATE
USING (public.get_user_role(auth.uid()) = 'editor');

CREATE POLICY "Only editors can delete leave_requests"
ON public.leave_requests
FOR DELETE
USING (public.get_user_role(auth.uid()) = 'editor');

-- Doctor incompatibilities policies
CREATE POLICY "Everyone can read doctor_incompatibilities"
ON public.doctor_incompatibilities
FOR SELECT
USING (true);

CREATE POLICY "Only editors can insert doctor_incompatibilities"
ON public.doctor_incompatibilities
FOR INSERT
WITH CHECK (public.get_user_role(auth.uid()) = 'editor');

CREATE POLICY "Only editors can update doctor_incompatibilities"
ON public.doctor_incompatibilities
FOR UPDATE
USING (public.get_user_role(auth.uid()) = 'editor');

CREATE POLICY "Only editors can delete doctor_incompatibilities"
ON public.doctor_incompatibilities
FOR DELETE
USING (public.get_user_role(auth.uid()) = 'editor');

-- Add updated_at trigger for profiles
CREATE TRIGGER update_profiles_updated_at
BEFORE UPDATE ON public.profiles
FOR EACH ROW
EXECUTE FUNCTION public.update_updated_at_column();