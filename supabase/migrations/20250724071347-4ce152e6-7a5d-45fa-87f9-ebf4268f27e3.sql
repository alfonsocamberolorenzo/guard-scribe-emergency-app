-- Enable realtime for guard_assignments table
ALTER TABLE public.guard_assignments REPLICA IDENTITY FULL;

-- Add the table to realtime publication
ALTER PUBLICATION supabase_realtime ADD TABLE public.guard_assignments;