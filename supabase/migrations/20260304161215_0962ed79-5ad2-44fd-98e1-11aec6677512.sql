
CREATE TABLE public.ai_config (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  config_key text UNIQUE NOT NULL,
  config_value text NOT NULL,
  description text,
  updated_at timestamptz DEFAULT now(),
  updated_by uuid REFERENCES auth.users(id)
);

ALTER TABLE public.ai_config ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Admins can read ai_config"
ON public.ai_config FOR SELECT TO authenticated
USING (public.has_role(auth.uid(), 'admin') OR public.has_role(auth.uid(), 'super_admin'));

CREATE POLICY "Admins can insert ai_config"
ON public.ai_config FOR INSERT TO authenticated
WITH CHECK (public.has_role(auth.uid(), 'admin') OR public.has_role(auth.uid(), 'super_admin'));

CREATE POLICY "Admins can update ai_config"
ON public.ai_config FOR UPDATE TO authenticated
USING (public.has_role(auth.uid(), 'admin') OR public.has_role(auth.uid(), 'super_admin'));

CREATE POLICY "Super admins can delete ai_config"
ON public.ai_config FOR DELETE TO authenticated
USING (public.has_role(auth.uid(), 'super_admin'));

INSERT INTO public.ai_config (config_key, config_value, description) VALUES
  ('AI_PROVIDER', 'lovable', 'Fournisseur IA actif: lovable, openai, gemini, ollama, custom'),
  ('OPENAI_API_KEY', '', 'Clé API OpenAI (si provider = openai)'),
  ('GOOGLE_AI_API_KEY', '', 'Clé API Google Gemini (si provider = gemini)'),
  ('OLLAMA_BASE_URL', 'http://localhost:11434', 'URL du serveur Ollama (si provider = ollama)'),
  ('OLLAMA_MODEL', 'llama3.1:8b', 'Modèle Ollama par défaut'),
  ('CUSTOM_AI_BASE_URL', '', 'URL endpoint IA custom (si provider = custom)'),
  ('CUSTOM_AI_API_KEY', '', 'Clé API custom (si provider = custom)'),
  ('CUSTOM_AI_MODEL', '', 'Modèle IA custom par défaut')
