-- Create table for saved multi-scenario predictions
CREATE TABLE public.saved_prediction_scenarios (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  name TEXT NOT NULL,
  created_by UUID NOT NULL,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  base_report_ids UUID[] NOT NULL,
  predictions JSONB NOT NULL DEFAULT '[]'::jsonb,
  metadata JSONB DEFAULT '{}'::jsonb
);

-- Enable RLS
ALTER TABLE public.saved_prediction_scenarios ENABLE ROW LEVEL SECURITY;

-- RLS Policies
CREATE POLICY "Users can create their saved predictions"
  ON public.saved_prediction_scenarios
  FOR INSERT
  WITH CHECK (auth.uid() = created_by);

CREATE POLICY "Users can view their saved predictions"
  ON public.saved_prediction_scenarios
  FOR SELECT
  USING (auth.uid() = created_by);

CREATE POLICY "Users can update their saved predictions"
  ON public.saved_prediction_scenarios
  FOR UPDATE
  USING (auth.uid() = created_by);

CREATE POLICY "Users can delete their saved predictions"
  ON public.saved_prediction_scenarios
  FOR DELETE
  USING (auth.uid() = created_by);

-- Index for faster queries
CREATE INDEX idx_saved_predictions_user ON public.saved_prediction_scenarios(created_by, created_at DESC);