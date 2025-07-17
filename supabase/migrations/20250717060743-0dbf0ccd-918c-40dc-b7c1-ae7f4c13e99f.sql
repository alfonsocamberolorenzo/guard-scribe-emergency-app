-- Create leave requests table
CREATE TABLE public.leave_requests (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  doctor_id UUID NOT NULL,
  start_date DATE NOT NULL,
  end_date DATE NOT NULL,
  reason TEXT,
  status TEXT NOT NULL DEFAULT 'pending',
  requested_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  reviewed_at TIMESTAMP WITH TIME ZONE,
  reviewed_by UUID,
  notes TEXT,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  CONSTRAINT leave_requests_status_check CHECK (status IN ('pending', 'approved', 'rejected')),
  CONSTRAINT leave_requests_date_check CHECK (end_date >= start_date)
);

-- Enable Row Level Security
ALTER TABLE public.leave_requests ENABLE ROW LEVEL SECURITY;

-- Create policies for leave requests (public access for now)
CREATE POLICY "Allow all operations on leave_requests" 
ON public.leave_requests 
FOR ALL 
USING (true) 
WITH CHECK (true);

-- Add foreign key constraint to doctors table
ALTER TABLE public.leave_requests 
ADD CONSTRAINT leave_requests_doctor_id_fkey 
FOREIGN KEY (doctor_id) REFERENCES public.doctors(id) ON DELETE CASCADE;

-- Create trigger for automatic timestamp updates
CREATE TRIGGER update_leave_requests_updated_at
BEFORE UPDATE ON public.leave_requests
FOR EACH ROW
EXECUTE FUNCTION public.update_updated_at_column();

-- Create index for performance
CREATE INDEX idx_leave_requests_doctor_id ON public.leave_requests(doctor_id);
CREATE INDEX idx_leave_requests_status ON public.leave_requests(status);
CREATE INDEX idx_leave_requests_dates ON public.leave_requests(start_date, end_date);