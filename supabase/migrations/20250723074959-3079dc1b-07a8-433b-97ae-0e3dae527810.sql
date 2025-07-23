-- Add substitute fields to leave_requests table
ALTER TABLE public.leave_requests 
ADD COLUMN has_substitute BOOLEAN DEFAULT false,
ADD COLUMN substitute_name TEXT;