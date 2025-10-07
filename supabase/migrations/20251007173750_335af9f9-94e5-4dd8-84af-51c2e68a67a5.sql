-- Créer une vue sécurisée pour lister tous les utilisateurs avec leurs rôles et clients
CREATE OR REPLACE VIEW public.users_overview AS
SELECT 
  p.id,
  p.email,
  p.nom_complet,
  p.client_id,
  c.nom_entreprise AS client_nom,
  public.get_user_role(p.id) AS role
FROM public.profiles p
LEFT JOIN public.client c ON c.id = p.client_id;

-- La vue hérite automatiquement des RLS policies des tables sous-jacentes

-- Fonction pour backfill les profils manquants depuis auth.users
CREATE OR REPLACE FUNCTION public.backfill_missing_profiles()
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  INSERT INTO public.profiles (id, email, nom_complet)
  SELECT 
    au.id,
    au.email,
    COALESCE(au.raw_user_meta_data->>'nom_complet', au.email)
  FROM auth.users au
  LEFT JOIN public.profiles p ON p.id = au.id
  WHERE p.id IS NULL;
END;
$$;

-- Exécuter le backfill
SELECT public.backfill_missing_profiles();