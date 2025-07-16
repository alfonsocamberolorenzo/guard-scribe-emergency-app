-- Create doctors table with all required fields
CREATE TABLE public.doctors (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  full_name TEXT NOT NULL,
  alias TEXT NOT NULL UNIQUE,
  unavailable_weekdays INTEGER[] DEFAULT ARRAY[]::INTEGER[], -- 0=Sunday, 1=Monday, etc.
  max_7h_guards INTEGER DEFAULT NULL, -- NULL means no limit
  max_17h_guards INTEGER DEFAULT NULL, -- NULL means no limit
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Create doctor_incompatibilities table for many-to-many relationships
CREATE TABLE public.doctor_incompatibilities (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  doctor_id UUID NOT NULL REFERENCES public.doctors(id) ON DELETE CASCADE,
  incompatible_doctor_id UUID NOT NULL REFERENCES public.doctors(id) ON DELETE CASCADE,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  CONSTRAINT no_self_incompatibility CHECK (doctor_id != incompatible_doctor_id),
  CONSTRAINT unique_incompatibility UNIQUE (doctor_id, incompatible_doctor_id)
);

-- Enable Row Level Security (RLS) but allow all operations since no authentication
ALTER TABLE public.doctors ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.doctor_incompatibilities ENABLE ROW LEVEL SECURITY;

-- Create policies for public access (no authentication required)
CREATE POLICY "Allow all operations on doctors" 
ON public.doctors 
FOR ALL 
USING (true) 
WITH CHECK (true);

CREATE POLICY "Allow all operations on doctor_incompatibilities" 
ON public.doctor_incompatibilities 
FOR ALL 
USING (true) 
WITH CHECK (true);

-- Create function to update timestamps
CREATE OR REPLACE FUNCTION public.update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Create trigger for automatic timestamp updates
CREATE TRIGGER update_doctors_updated_at
  BEFORE UPDATE ON public.doctors
  FOR EACH ROW
  EXECUTE FUNCTION public.update_updated_at_column();

-- Create indexes for better performance
CREATE INDEX idx_doctors_alias ON public.doctors(alias);
CREATE INDEX idx_doctor_incompatibilities_doctor_id ON public.doctor_incompatibilities(doctor_id);
CREATE INDEX idx_doctor_incompatibilities_incompatible_doctor_id ON public.doctor_incompatibilities(incompatible_doctor_id);