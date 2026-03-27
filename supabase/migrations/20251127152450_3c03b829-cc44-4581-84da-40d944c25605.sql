-- Create table for sharing prediction scenarios
CREATE TABLE public.prediction_shares (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  prediction_id UUID NOT NULL REFERENCES public.saved_prediction_scenarios(id) ON DELETE CASCADE,
  share_token TEXT NOT NULL UNIQUE,
  created_by UUID NOT NULL,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  expires_at TIMESTAMP WITH TIME ZONE,
  view_count INTEGER DEFAULT 0
);

-- Enable RLS
ALTER TABLE public.prediction_shares ENABLE ROW LEVEL SECURITY;

-- RLS Policies
CREATE POLICY "Users can create shares for their predictions"
  ON public.prediction_shares
  FOR INSERT
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM public.saved_prediction_scenarios
      WHERE id = prediction_id AND created_by = auth.uid()
    )
  );

CREATE POLICY "Users can view their shares"
  ON public.prediction_shares
  FOR SELECT
  USING (created_by = auth.uid());

CREATE POLICY "Users can delete their shares"
  ON public.prediction_shares
  FOR DELETE
  USING (created_by = auth.uid());

-- Public can view shared predictions (for view-only access)
CREATE POLICY "Public can view shared predictions via token"
  ON public.saved_prediction_scenarios
  FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM public.prediction_shares
      WHERE prediction_id = id
    )
  );

-- Index for faster lookups
CREATE INDEX idx_prediction_shares_token ON public.prediction_shares(share_token);
CREATE INDEX idx_prediction_shares_prediction ON public.prediction_shares(prediction_id);