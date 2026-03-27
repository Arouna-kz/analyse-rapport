-- Enable realtime for reports table
ALTER TABLE public.reports REPLICA IDENTITY FULL;

-- Add reports table to realtime publication
ALTER PUBLICATION supabase_realtime ADD TABLE public.reports;