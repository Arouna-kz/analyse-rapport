-- Allow users to delete analyses of their own reports
CREATE POLICY "Users can delete analyses of their reports"
ON public.report_analyses
FOR DELETE
USING (EXISTS (
  SELECT 1 FROM reports
  WHERE reports.id = report_analyses.report_id
  AND reports.user_id = auth.uid()
));
