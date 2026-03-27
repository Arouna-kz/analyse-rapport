DROP POLICY IF EXISTS "Audit logs are insert-only" ON public.audit_logs;
CREATE POLICY "Service role can insert audit logs"
  ON public.audit_logs FOR INSERT
  WITH CHECK (auth.jwt()->>'role' = 'service_role');