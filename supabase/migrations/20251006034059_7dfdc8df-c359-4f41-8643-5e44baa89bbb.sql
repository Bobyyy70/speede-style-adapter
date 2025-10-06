-- Trigger pour créer automatiquement le profil lors de l'inscription
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  INSERT INTO public.profiles (id, email, nom_complet)
  VALUES (
    NEW.id,
    NEW.email,
    COALESCE(NEW.raw_user_meta_data->>'nom_complet', NEW.email)
  )
  ON CONFLICT (id) DO NOTHING;
  RETURN NEW;
END;
$$;

-- Trigger pour mettre à jour updated_at sur profiles
CREATE OR REPLACE FUNCTION public.update_profiles_updated_at()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$;

-- Créer le trigger on_auth_user_created si pas déjà existant
DROP TRIGGER IF EXISTS on_auth_user_created ON auth.users;
CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW EXECUTE PROCEDURE public.handle_new_user();

-- Créer le trigger profiles_updated_at si pas déjà existant
DROP TRIGGER IF EXISTS profiles_updated_at ON public.profiles;
CREATE TRIGGER profiles_updated_at
  BEFORE UPDATE ON public.profiles
  FOR EACH ROW EXECUTE PROCEDURE public.update_profiles_updated_at();

-- Fix RLS pour permettre aux clients d'insérer leurs propres commandes
DROP POLICY IF EXISTS "Client insert own commande" ON public.commande;
CREATE POLICY "Client insert own commande"
ON public.commande
FOR INSERT
TO authenticated
WITH CHECK (
  has_role(auth.uid(), 'client'::app_role) 
  AND client_id IN (
    SELECT client_id 
    FROM public.profiles 
    WHERE id = auth.uid()
  )
);

-- Permettre aux gestionnaires d'insérer des commandes
DROP POLICY IF EXISTS "Gestionnaire insert commande" ON public.commande;
CREATE POLICY "Gestionnaire insert commande"
ON public.commande
FOR INSERT
TO authenticated
WITH CHECK (has_role(auth.uid(), 'gestionnaire'::app_role));