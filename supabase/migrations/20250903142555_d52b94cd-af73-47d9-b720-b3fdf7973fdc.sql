-- Add guard_substitute_name column to leave_requests table
ALTER TABLE public.leave_requests 
ADD COLUMN guard_substitute_name TEXT;