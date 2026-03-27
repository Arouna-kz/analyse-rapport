-- Create table for detailed view tracking
CREATE TABLE IF NOT EXISTS public.prediction_share_views (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  share_id UUID NOT NULL REFERENCES public.prediction_shares(id) ON DELETE CASCADE,
  viewed_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  ip_address INET,
  user_agent TEXT,
  country TEXT,
  city TEXT,
  referrer TEXT,
  metadata JSONB DEFAULT '{}'::jsonb
);

-- Enable RLS
ALTER TABLE public.prediction_share_views ENABLE ROW LEVEL SECURITY;

-- Policy: Users can view analytics for their own shares
CREATE POLICY "Users can view analytics for their shares"
  ON public.prediction_share_views
  FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM public.prediction_shares
      WHERE prediction_shares.id = prediction_share_views.share_id
      AND prediction_shares.created_by = auth.uid()
    )
  );

-- Policy: Service role can insert view records
CREATE POLICY "Service role can insert view records"
  ON public.prediction_share_views
  FOR INSERT
  WITH CHECK (true);

-- Index for faster queries
CREATE INDEX idx_prediction_share_views_share_id ON public.prediction_share_views(share_id);
CREATE INDEX idx_prediction_share_views_viewed_at ON public.prediction_share_views(viewed_at DESC);