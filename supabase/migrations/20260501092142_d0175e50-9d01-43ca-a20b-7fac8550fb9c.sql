
-- Table d'autorisations d'accès à la plateforme
CREATE TABLE IF NOT EXISTS public.user_access (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL UNIQUE,
  is_approved boolean NOT NULL DEFAULT false,
  approved_by uuid,
  approved_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.user_access ENABLE ROW LEVEL SECURITY;

-- Les utilisateurs peuvent voir leur propre statut
CREATE POLICY "Users can view their own access" ON public.user_access
  FOR SELECT USING (auth.uid() = user_id);

-- Les admins peuvent tout voir
CREATE POLICY "Admins can view all access" ON public.user_access
  FOR SELECT USING (has_role(auth.uid(), 'admin'::app_role) OR has_role(auth.uid(), 'super_admin'::app_role));

-- Les admins peuvent insérer
CREATE POLICY "Admins can insert access" ON public.user_access
  FOR INSERT WITH CHECK (has_role(auth.uid(), 'admin'::app_role) OR has_role(auth.uid(), 'super_admin'::app_role));

-- Les admins peuvent modifier
CREATE POLICY "Admins can update access" ON public.user_access
  FOR UPDATE USING (has_role(auth.uid(), 'admin'::app_role) OR has_role(auth.uid(), 'super_admin'::app_role));

-- Les admins peuvent supprimer
CREATE POLICY "Admins can delete access" ON public.user_access
  FOR DELETE USING (has_role(auth.uid(), 'admin'::app_role) OR has_role(auth.uid(), 'super_admin'::app_role));

-- Trigger updated_at
CREATE TRIGGER update_user_access_updated_at
  BEFORE UPDATE ON public.user_access
  FOR EACH ROW
  EXECUTE FUNCTION public.update_updated_at_column();

-- Fonction pour vérifier si un utilisateur est approuvé
CREATE OR REPLACE FUNCTION public.is_user_approved(_user_id uuid)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT COALESCE(
    (SELECT is_approved FROM public.user_access WHERE user_id = _user_id),
    false
  ) OR public.has_role(_user_id, 'admin'::app_role)
    OR public.has_role(_user_id, 'super_admin'::app_role);
$$;

-- Mise à jour du trigger handle_new_user pour créer une entrée user_access selon la config
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  auto_approve_enabled boolean := false;
BEGIN
  INSERT INTO public.profiles (user_id, full_name)
  VALUES (NEW.id, COALESCE(NEW.raw_user_meta_data->>'full_name', ''));

  -- Lecture de la configuration d'auto-approbation
  SELECT (config_value = 'true') INTO auto_approve_enabled
  FROM public.ai_config
  WHERE config_key = 'AUTO_APPROVE_NEW_USERS'
  LIMIT 1;

  INSERT INTO public.user_access (user_id, is_approved, approved_at)
  VALUES (
    NEW.id,
    COALESCE(auto_approve_enabled, false),
    CASE WHEN COALESCE(auto_approve_enabled, false) THEN now() ELSE NULL END
  )
  ON CONFLICT (user_id) DO NOTHING;

  RETURN NEW;
END;
$$;

-- S'assurer que le trigger existe
DROP TRIGGER IF EXISTS on_auth_user_created ON auth.users;
CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW EXECUTE FUNCTION public.handle_new_user();

-- Backfill : créer des entrées user_access pour les utilisateurs existants
-- Selon la décision : tous en attente sauf admins
INSERT INTO public.user_access (user_id, is_approved, approved_at)
SELECT 
  u.id,
  EXISTS(SELECT 1 FROM public.user_roles ur WHERE ur.user_id = u.id AND ur.role IN ('admin','super_admin')),
  CASE WHEN EXISTS(SELECT 1 FROM public.user_roles ur WHERE ur.user_id = u.id AND ur.role IN ('admin','super_admin')) THEN now() ELSE NULL END
FROM auth.users u
ON CONFLICT (user_id) DO NOTHING;

-- Insérer la config par défaut (auto-approbation désactivée)
INSERT INTO public.ai_config (config_key, config_value, description)
VALUES ('AUTO_APPROVE_NEW_USERS', 'false', 'Si true, les nouveaux inscrits sont automatiquement approuvés sans attente admin')
ON CONFLICT DO NOTHING;

-- Vue pour permettre aux admins de lister les utilisateurs avec leurs infos
CREATE OR REPLACE VIEW public.admin_users_view
WITH (security_invoker=on) AS
SELECT
  u.id AS user_id,
  u.email,
  u.created_at AS signed_up_at,
  u.last_sign_in_at,
  p.full_name,
  p.display_name,
  p.company,
  p.job_title,
  COALESCE(ua.is_approved, false) AS is_approved,
  ua.approved_at,
  EXISTS(SELECT 1 FROM public.user_roles ur WHERE ur.user_id = u.id AND ur.role = 'admin') AS is_admin,
  EXISTS(SELECT 1 FROM public.user_roles ur WHERE ur.user_id = u.id AND ur.role = 'super_admin') AS is_super_admin
FROM auth.users u
LEFT JOIN public.profiles p ON p.user_id = u.id
LEFT JOIN public.user_access ua ON ua.user_id = u.id;

-- Fonction admin pour lister les utilisateurs (contourne les restrictions auth.users)
CREATE OR REPLACE FUNCTION public.admin_list_users()
RETURNS TABLE (
  user_id uuid,
  email text,
  signed_up_at timestamptz,
  last_sign_in_at timestamptz,
  full_name text,
  display_name text,
  company text,
  job_title text,
  is_approved boolean,
  approved_at timestamptz,
  is_admin boolean,
  is_super_admin boolean
)
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF NOT (public.has_role(auth.uid(), 'admin'::app_role) OR public.has_role(auth.uid(), 'super_admin'::app_role)) THEN
    RAISE EXCEPTION 'Accès refusé: privilèges admin requis';
  END IF;

  RETURN QUERY
  SELECT
    u.id,
    u.email::text,
    u.created_at,
    u.last_sign_in_at,
    p.full_name,
    p.display_name,
    p.company,
    p.job_title,
    COALESCE(ua.is_approved, false),
    ua.approved_at,
    EXISTS(SELECT 1 FROM public.user_roles ur WHERE ur.user_id = u.id AND ur.role = 'admin'),
    EXISTS(SELECT 1 FROM public.user_roles ur WHERE ur.user_id = u.id AND ur.role = 'super_admin')
  FROM auth.users u
  LEFT JOIN public.profiles p ON p.user_id = u.id
  LEFT JOIN public.user_access ua ON ua.user_id = u.id
  ORDER BY u.created_at DESC;
END;
$$;

-- Fonction admin pour approuver/révoquer
CREATE OR REPLACE FUNCTION public.admin_set_user_approval(_target_user_id uuid, _approved boolean)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF NOT (public.has_role(auth.uid(), 'admin'::app_role) OR public.has_role(auth.uid(), 'super_admin'::app_role)) THEN
    RAISE EXCEPTION 'Accès refusé';
  END IF;

  INSERT INTO public.user_access (user_id, is_approved, approved_by, approved_at)
  VALUES (_target_user_id, _approved, auth.uid(), CASE WHEN _approved THEN now() ELSE NULL END)
  ON CONFLICT (user_id) DO UPDATE
  SET is_approved = EXCLUDED.is_approved,
      approved_by = auth.uid(),
      approved_at = CASE WHEN EXCLUDED.is_approved THEN now() ELSE NULL END,
      updated_at = now();
END;
$$;

-- Fonction admin pour promouvoir/rétrograder admin
CREATE OR REPLACE FUNCTION public.admin_set_user_role(_target_user_id uuid, _make_admin boolean)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF NOT (public.has_role(auth.uid(), 'admin'::app_role) OR public.has_role(auth.uid(), 'super_admin'::app_role)) THEN
    RAISE EXCEPTION 'Accès refusé';
  END IF;

  -- Empêcher la modification d'un super_admin
  IF public.has_role(_target_user_id, 'super_admin'::app_role) THEN
    RAISE EXCEPTION 'Impossible de modifier le rôle d''un super admin';
  END IF;

  IF _make_admin THEN
    INSERT INTO public.user_roles (user_id, role, granted_by)
    VALUES (_target_user_id, 'admin'::app_role, auth.uid())
    ON CONFLICT DO NOTHING;
  ELSE
    DELETE FROM public.user_roles
    WHERE user_id = _target_user_id AND role = 'admin'::app_role;
  END IF;
END;
$$;

-- Fonction admin pour supprimer un utilisateur
CREATE OR REPLACE FUNCTION public.admin_delete_user(_target_user_id uuid)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF NOT (public.has_role(auth.uid(), 'admin'::app_role) OR public.has_role(auth.uid(), 'super_admin'::app_role)) THEN
    RAISE EXCEPTION 'Accès refusé';
  END IF;

  IF _target_user_id = auth.uid() THEN
    RAISE EXCEPTION 'Vous ne pouvez pas vous supprimer vous-même';
  END IF;

  IF public.has_role(_target_user_id, 'super_admin'::app_role) THEN
    RAISE EXCEPTION 'Impossible de supprimer un super admin';
  END IF;

  DELETE FROM auth.users WHERE id = _target_user_id;
END;
$$;
