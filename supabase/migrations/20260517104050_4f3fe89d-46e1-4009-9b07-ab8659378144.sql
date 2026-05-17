CREATE OR REPLACE FUNCTION public.handle_new_user()
 RETURNS trigger
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
DECLARE
  auto_approve_enabled boolean := false;
  is_first_user boolean := false;
BEGIN
  INSERT INTO public.profiles (user_id, full_name)
  VALUES (NEW.id, COALESCE(NEW.raw_user_meta_data->>'full_name', ''));

  -- Détection du premier utilisateur de la plateforme
  SELECT NOT EXISTS (SELECT 1 FROM public.user_roles WHERE role IN ('admin'::app_role, 'super_admin'::app_role))
  INTO is_first_user;

  IF is_first_user THEN
    INSERT INTO public.user_roles (user_id, role, granted_by)
    VALUES (NEW.id, 'super_admin'::app_role, NEW.id)
    ON CONFLICT DO NOTHING;

    INSERT INTO public.user_access (user_id, is_approved, approved_at, approved_by)
    VALUES (NEW.id, true, now(), NEW.id)
    ON CONFLICT (user_id) DO UPDATE
    SET is_approved = true, approved_at = now(), approved_by = NEW.id, updated_at = now();

    RETURN NEW;
  END IF;

  -- Comportement standard
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
$function$;