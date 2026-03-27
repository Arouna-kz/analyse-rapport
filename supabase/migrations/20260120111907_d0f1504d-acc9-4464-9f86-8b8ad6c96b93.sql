ALTER TABLE public.report_analyses
ADD COLUMN IF NOT EXISTS arena_metadata jsonb NULL,
ADD COLUMN IF NOT EXISTS arena_score numeric NULL;

CREATE INDEX IF NOT EXISTS idx_report_analyses_report_id_created_at
ON public.report_analyses (report_id, created_at DESC);