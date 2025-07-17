-- Create guard_days table to define which days require guards
CREATE TABLE public.guard_days (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  date DATE NOT NULL UNIQUE,
  is_guard_day BOOLEAN NOT NULL DEFAULT true,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Create guard_schedules table to store generated monthly schedules
CREATE TABLE public.guard_schedules (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  month INTEGER NOT NULL, -- 1-12
  year INTEGER NOT NULL,
  status TEXT NOT NULL DEFAULT 'draft', -- 'draft', 'approved', 'active'
  generated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  approved_at TIMESTAMP WITH TIME ZONE,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  CONSTRAINT unique_month_year UNIQUE (month, year, status),
  CONSTRAINT valid_month CHECK (month >= 1 AND month <= 12),
  CONSTRAINT valid_year CHECK (year >= 2020 AND year <= 2030)
);

-- Create guard_assignments table for individual guard assignments
CREATE TABLE public.guard_assignments (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  schedule_id UUID NOT NULL REFERENCES public.guard_schedules(id) ON DELETE CASCADE,
  date DATE NOT NULL,
  shift_type TEXT NOT NULL, -- '7h' or '17h'
  shift_position INTEGER, -- For 17h shifts: 1 or 2 (since there are two 17h guards)
  doctor_id UUID NOT NULL REFERENCES public.doctors(id) ON DELETE CASCADE,
  is_original BOOLEAN NOT NULL DEFAULT true, -- false if it's a swap
  original_doctor_id UUID REFERENCES public.doctors(id), -- for tracking swaps
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  CONSTRAINT valid_shift_type CHECK (shift_type IN ('7h', '17h')),
  CONSTRAINT valid_shift_position CHECK (
    (shift_type = '7h' AND shift_position IS NULL) OR 
    (shift_type = '17h' AND shift_position IN (1, 2))
  ),
  CONSTRAINT unique_assignment UNIQUE (schedule_id, date, shift_type, shift_position)
);

-- Enable RLS on all tables
ALTER TABLE public.guard_days ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.guard_schedules ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.guard_assignments ENABLE ROW LEVEL SECURITY;

-- Create policies for public access (no authentication required)
CREATE POLICY "Allow all operations on guard_days" 
ON public.guard_days 
FOR ALL 
USING (true) 
WITH CHECK (true);

CREATE POLICY "Allow all operations on guard_schedules" 
ON public.guard_schedules 
FOR ALL 
USING (true) 
WITH CHECK (true);

CREATE POLICY "Allow all operations on guard_assignments" 
ON public.guard_assignments 
FOR ALL 
USING (true) 
WITH CHECK (true);

-- Add update triggers
CREATE TRIGGER update_guard_days_updated_at
  BEFORE UPDATE ON public.guard_days
  FOR EACH ROW
  EXECUTE FUNCTION public.update_updated_at_column();

-- Create indexes for better performance
CREATE INDEX idx_guard_days_date ON public.guard_days(date);
CREATE INDEX idx_guard_days_is_guard_day ON public.guard_days(is_guard_day);
CREATE INDEX idx_guard_schedules_month_year ON public.guard_schedules(month, year);
CREATE INDEX idx_guard_schedules_status ON public.guard_schedules(status);
CREATE INDEX idx_guard_assignments_schedule_id ON public.guard_assignments(schedule_id);
CREATE INDEX idx_guard_assignments_date ON public.guard_assignments(date);
CREATE INDEX idx_guard_assignments_doctor_id ON public.guard_assignments(doctor_id);