-- Trigger pour attribution automatique du rôle client
CREATE TRIGGER assign_client_role_after_profile
AFTER INSERT OR UPDATE OF client_id ON public.profiles
FOR EACH ROW EXECUTE FUNCTION public.assign_client_role();

-- Backfill : attribuer le rôle 'client' aux profils existants avec client_id
INSERT INTO public.user_roles (user_id, role)
SELECT p.id, 'client'::app_role
FROM public.profiles p
LEFT JOIN public.user_roles ur ON ur.user_id = p.id AND ur.role = 'client'
WHERE p.client_id IS NOT NULL AND ur.user_id IS NULL
ON CONFLICT (user_id, role) DO NOTHING;