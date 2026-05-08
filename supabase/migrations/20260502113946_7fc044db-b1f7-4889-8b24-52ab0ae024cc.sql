
-- Table pour stocker les fournisseurs Arena externes configurés par l'admin
CREATE TABLE public.arena_providers (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  name TEXT NOT NULL,
  provider_type TEXT NOT NULL CHECK (provider_type IN ('openai', 'gemini', 'ollama', 'custom')),
  base_url TEXT NOT NULL,
  model_name TEXT NOT NULL,
  api_key TEXT,
  enabled BOOLEAN NOT NULL DEFAULT false,
  priority INTEGER NOT NULL DEFAULT 100,
  role_description TEXT,
  last_test_status TEXT CHECK (last_test_status IN ('success', 'error', 'untested')),
  last_test_at TIMESTAMPTZ,
  last_test_message TEXT,
  last_test_latency_ms INTEGER,
  created_by UUID,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX idx_arena_providers_enabled ON public.arena_providers(enabled) WHERE enabled = true;

ALTER TABLE public.arena_providers ENABLE ROW LEVEL SECURITY;

-- RLS: Admins uniquement (clés API = données sensibles, jamais exposées au client direct)
CREATE POLICY "Admins can view arena_providers"
  ON public.arena_providers FOR SELECT
  TO authenticated
  USING (public.has_role(auth.uid(), 'admin'::app_role) OR public.has_role(auth.uid(), 'super_admin'::app_role));

CREATE POLICY "Admins can insert arena_providers"
  ON public.arena_providers FOR INSERT
  TO authenticated
  WITH CHECK (public.has_role(auth.uid(), 'admin'::app_role) OR public.has_role(auth.uid(), 'super_admin'::app_role));

CREATE POLICY "Admins can update arena_providers"
  ON public.arena_providers FOR UPDATE
  TO authenticated
  USING (public.has_role(auth.uid(), 'admin'::app_role) OR public.has_role(auth.uid(), 'super_admin'::app_role));

CREATE POLICY "Admins can delete arena_providers"
  ON public.arena_providers FOR DELETE
  TO authenticated
  USING (public.has_role(auth.uid(), 'admin'::app_role) OR public.has_role(auth.uid(), 'super_admin'::app_role));

-- Trigger updated_at
CREATE TRIGGER set_arena_providers_updated_at
  BEFORE UPDATE ON public.arena_providers
  FOR EACH ROW
  EXECUTE FUNCTION public.update_updated_at_column();

-- Fonction: lister les fournisseurs SANS exposer les clés API (pour UI admin)
CREATE OR REPLACE FUNCTION public.admin_list_arena_providers()
RETURNS TABLE(
  id UUID,
  name TEXT,
  provider_type TEXT,
  base_url TEXT,
  model_name TEXT,
  has_api_key BOOLEAN,
  api_key_masked TEXT,
  enabled BOOLEAN,
  priority INTEGER,
  role_description TEXT,
  last_test_status TEXT,
  last_test_at TIMESTAMPTZ,
  last_test_message TEXT,
  last_test_latency_ms INTEGER,
  created_at TIMESTAMPTZ,
  updated_at TIMESTAMPTZ
)
LANGUAGE plpgsql
STABLE SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF NOT (public.has_role(auth.uid(), 'admin'::app_role) OR public.has_role(auth.uid(), 'super_admin'::app_role)) THEN
    RAISE EXCEPTION 'Accès refusé: privilèges admin requis';
  END IF;

  RETURN QUERY
  SELECT
    p.id, p.name, p.provider_type, p.base_url, p.model_name,
    (p.api_key IS NOT NULL AND length(p.api_key) > 0) AS has_api_key,
    CASE
      WHEN p.api_key IS NULL OR length(p.api_key) = 0 THEN NULL
      WHEN length(p.api_key) <= 8 THEN '••••'
      ELSE substring(p.api_key, 1, 4) || '••••' || substring(p.api_key, length(p.api_key) - 3)
    END AS api_key_masked,
    p.enabled, p.priority, p.role_description,
    p.last_test_status, p.last_test_at, p.last_test_message, p.last_test_latency_ms,
    p.created_at, p.updated_at
  FROM public.arena_providers p
  ORDER BY p.priority ASC, p.created_at DESC;
END;
$$;

-- Fonction: upsert d'un fournisseur. Si _api_key est NULL on garde l'existant, sinon on remplace.
CREATE OR REPLACE FUNCTION public.admin_upsert_arena_provider(
  _id UUID,
  _name TEXT,
  _provider_type TEXT,
  _base_url TEXT,
  _model_name TEXT,
  _api_key TEXT,
  _enabled BOOLEAN,
  _priority INTEGER,
  _role_description TEXT
)
RETURNS UUID
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  result_id UUID;
BEGIN
  IF NOT (public.has_role(auth.uid(), 'admin'::app_role) OR public.has_role(auth.uid(), 'super_admin'::app_role)) THEN
    RAISE EXCEPTION 'Accès refusé';
  END IF;

  IF _provider_type NOT IN ('openai', 'gemini', 'ollama', 'custom') THEN
    RAISE EXCEPTION 'Type de fournisseur invalide';
  END IF;

  IF _id IS NULL THEN
    INSERT INTO public.arena_providers (
      name, provider_type, base_url, model_name, api_key,
      enabled, priority, role_description, created_by
    ) VALUES (
      _name, _provider_type, _base_url, _model_name, _api_key,
      COALESCE(_enabled, false), COALESCE(_priority, 100), _role_description, auth.uid()
    )
    RETURNING id INTO result_id;
  ELSE
    UPDATE public.arena_providers
    SET name = _name,
        provider_type = _provider_type,
        base_url = _base_url,
        model_name = _model_name,
        api_key = CASE WHEN _api_key IS NOT NULL AND length(_api_key) > 0 THEN _api_key ELSE api_key END,
        enabled = COALESCE(_enabled, enabled),
        priority = COALESCE(_priority, priority),
        role_description = _role_description,
        updated_at = now()
    WHERE id = _id
    RETURNING id INTO result_id;
  END IF;

  RETURN result_id;
END;
$$;

-- Fonction: suppression
CREATE OR REPLACE FUNCTION public.admin_delete_arena_provider(_id UUID)
RETURNS VOID
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF NOT (public.has_role(auth.uid(), 'admin'::app_role) OR public.has_role(auth.uid(), 'super_admin'::app_role)) THEN
    RAISE EXCEPTION 'Accès refusé';
  END IF;
  DELETE FROM public.arena_providers WHERE id = _id;
END;
$$;

-- Fonction: enregistrer le résultat d'un test (admin OU service role)
CREATE OR REPLACE FUNCTION public.admin_record_arena_provider_test(
  _id UUID,
  _status TEXT,
  _message TEXT,
  _latency_ms INTEGER
)
RETURNS VOID
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF NOT (public.has_role(auth.uid(), 'admin'::app_role) OR public.has_role(auth.uid(), 'super_admin'::app_role)) THEN
    RAISE EXCEPTION 'Accès refusé';
  END IF;

  UPDATE public.arena_providers
  SET last_test_status = _status,
      last_test_message = _message,
      last_test_latency_ms = _latency_ms,
      last_test_at = now()
  WHERE id = _id;
END;
$$;
