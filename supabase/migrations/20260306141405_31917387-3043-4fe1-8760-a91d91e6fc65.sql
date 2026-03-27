
INSERT INTO public.user_roles (user_id, role, granted_at)
SELECT id, 'admin'::app_role, now()
FROM auth.users
WHERE email = 'zkone403@gmail.com'
ON CONFLICT DO NOTHING;
