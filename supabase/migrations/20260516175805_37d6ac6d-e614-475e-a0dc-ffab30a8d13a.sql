CREATE TABLE public.allowed_redirect_domains (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  origin TEXT NOT NULL UNIQUE,
  description TEXT,
  is_active BOOLEAN NOT NULL DEFAULT true,
  created_by UUID,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

ALTER TABLE public.allowed_redirect_domains ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Authenticated users can view active domains"
ON public.allowed_redirect_domains FOR SELECT
TO authenticated
USING (is_active = true OR public.has_role(auth.uid(), 'admin'::app_role) OR public.has_role(auth.uid(), 'super_admin'::app_role));

CREATE POLICY "Admins can insert domains"
ON public.allowed_redirect_domains FOR INSERT
TO authenticated
WITH CHECK (public.has_role(auth.uid(), 'admin'::app_role) OR public.has_role(auth.uid(), 'super_admin'::app_role));

CREATE POLICY "Admins can update domains"
ON public.allowed_redirect_domains FOR UPDATE
TO authenticated
USING (public.has_role(auth.uid(), 'admin'::app_role) OR public.has_role(auth.uid(), 'super_admin'::app_role));

CREATE POLICY "Admins can delete domains"
ON public.allowed_redirect_domains FOR DELETE
TO authenticated
USING (public.has_role(auth.uid(), 'admin'::app_role) OR public.has_role(auth.uid(), 'super_admin'::app_role));

CREATE TRIGGER update_allowed_redirect_domains_updated_at
BEFORE UPDATE ON public.allowed_redirect_domains
FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- Seed with current known domains
INSERT INTO public.allowed_redirect_domains (origin, description, is_active) VALUES
  ('https://report-whisperer-41.lovable.app', 'Domaine Lovable (relais principal)', true),
  ('https://analyse-rapport.vercel.app', 'Déploiement Vercel', true)
ON CONFLICT (origin) DO NOTHING;