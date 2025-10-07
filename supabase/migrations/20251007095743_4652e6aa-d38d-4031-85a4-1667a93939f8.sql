-- Fonction trigger pour assigner automatiquement le rôle client
CREATE OR REPLACE FUNCTION public.assign_client_role()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
BEGIN
  -- Si le profil a un client_id, assigner le rôle client
  IF NEW.client_id IS NOT NULL THEN
    INSERT INTO public.user_roles (user_id, role)
    VALUES (NEW.id, 'client'::app_role)
    ON CONFLICT (user_id, role) DO NOTHING;
  END IF;
  RETURN NEW;
END;
$$;

-- Créer le trigger sur la table profiles
DROP TRIGGER IF EXISTS assign_client_role_trigger ON public.profiles;
CREATE TRIGGER assign_client_role_trigger
  AFTER INSERT OR UPDATE OF client_id ON public.profiles
  FOR EACH ROW
  EXECUTE FUNCTION public.assign_client_role();

-- Assigner le rôle client à tous les profils existants avec un client_id
INSERT INTO public.user_roles (user_id, role)
SELECT p.id, 'client'::app_role
FROM public.profiles p
WHERE p.client_id IS NOT NULL
  AND NOT EXISTS (
    SELECT 1 FROM public.user_roles ur 
    WHERE ur.user_id = p.id AND ur.role = 'client'::app_role
  )
ON CONFLICT (user_id, role) DO NOTHING;

COMMENT ON FUNCTION public.assign_client_role() IS 'Trigger automatique pour assigner le rôle client aux profils avec client_id';
COMMENT ON TRIGGER assign_client_role_trigger ON public.profiles IS 'Assigne automatiquement le rôle client quand un profil reçoit un client_id';