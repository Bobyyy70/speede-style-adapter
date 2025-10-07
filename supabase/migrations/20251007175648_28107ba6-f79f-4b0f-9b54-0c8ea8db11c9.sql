-- Fonction helper pour promouvoir un utilisateur en admin
CREATE OR REPLACE FUNCTION public.promote_user_to_admin(user_email TEXT)
RETURNS VOID
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  target_user_id UUID;
BEGIN
  -- Trouver l'ID utilisateur par email
  SELECT id INTO target_user_id
  FROM auth.users
  WHERE email = user_email;
  
  IF target_user_id IS NULL THEN
    RAISE EXCEPTION 'Utilisateur avec email % introuvable', user_email;
  END IF;
  
  -- Supprimer les autres rôles pour éviter les conflits
  DELETE FROM public.user_roles
  WHERE user_id = target_user_id;
  
  -- Ajouter le rôle admin
  INSERT INTO public.user_roles (user_id, role)
  VALUES (target_user_id, 'admin'::app_role)
  ON CONFLICT (user_id, role) DO NOTHING;
  
  RAISE NOTICE 'Utilisateur % promu en admin avec succès', user_email;
END;
$$;

-- Promouvoir automatiquement l'utilisateur connecté actuellement visible
-- Si vous êtes alexandre@heatzy.com, décommentez la ligne suivante :
-- SELECT public.promote_user_to_admin('alexandre@heatzy.com');

-- Si vous êtes un autre utilisateur, exécutez cette fonction avec votre email :
-- SELECT public.promote_user_to_admin('VOTRE_EMAIL@DOMAINE.com');

-- Backfill des profiles manquants
INSERT INTO public.profiles (id, email, nom_complet)
SELECT 
  au.id,
  au.email,
  COALESCE(au.raw_user_meta_data->>'nom_complet', au.email)
FROM auth.users au
LEFT JOIN public.profiles p ON p.id = au.id
WHERE p.id IS NULL
ON CONFLICT (id) DO NOTHING;