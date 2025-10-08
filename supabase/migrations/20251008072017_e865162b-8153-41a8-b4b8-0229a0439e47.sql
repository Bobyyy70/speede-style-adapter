-- Ajouter colonne tabs_access pour piloter l'UI des onglets clients
ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS tabs_access text[];

-- Activer realtime pour profiles
ALTER TABLE public.profiles REPLICA IDENTITY FULL;

-- Ajouter profiles à la publication realtime
ALTER PUBLICATION supabase_realtime ADD TABLE public.profiles;

-- Fonction RPC pour backfill des profils manquants
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
  WHERE p.id IS NULL
  ON CONFLICT (id) DO NOTHING;
END;
$$;