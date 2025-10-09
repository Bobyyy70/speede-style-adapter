-- Corriger les politiques RLS restrictives sur profiles pour permettre aux admins d'insérer

-- 1. Supprimer les anciennes politiques restrictives trop strictes
DROP POLICY IF EXISTS "block_public_insert_profiles" ON public.profiles;
DROP POLICY IF EXISTS "block_public_update_profiles" ON public.profiles;
DROP POLICY IF EXISTS "block_public_delete_profiles" ON public.profiles;
DROP POLICY IF EXISTS "block_public_select_profiles" ON public.profiles;

-- 2. Créer de nouvelles politiques RESTRICTIVE qui autorisent les utilisateurs authentifiés
-- Ces politiques bloquent les non-authentifiés mais permettent aux admins d'agir

-- Bloquer les insertions non-authentifiées (mais autoriser les admins via politique PERMISSIVE)
CREATE POLICY "block_unauthenticated_insert_profiles"
ON public.profiles
AS RESTRICTIVE
FOR INSERT
TO public
WITH CHECK (
  auth.uid() IS NOT NULL
);

-- Bloquer les mises à jour non-authentifiées
CREATE POLICY "block_unauthenticated_update_profiles"
ON public.profiles
AS RESTRICTIVE
FOR UPDATE
TO public
USING (
  auth.uid() IS NOT NULL
)
WITH CHECK (
  auth.uid() IS NOT NULL
);

-- Bloquer les suppressions non-authentifiées
CREATE POLICY "block_unauthenticated_delete_profiles"
ON public.profiles
AS RESTRICTIVE
FOR DELETE
TO public
USING (
  auth.uid() IS NOT NULL
);

-- Bloquer les lectures non-authentifiées
CREATE POLICY "block_unauthenticated_select_profiles"
ON public.profiles
AS RESTRICTIVE
FOR SELECT
TO public
USING (
  auth.uid() IS NOT NULL
);

COMMENT ON POLICY "block_unauthenticated_insert_profiles" ON public.profiles IS 
  'Politique RESTRICTIVE: bloque uniquement les insertions non-authentifiées, permet aux admins via politique PERMISSIVE';

COMMENT ON POLICY "block_unauthenticated_update_profiles" ON public.profiles IS 
  'Politique RESTRICTIVE: bloque uniquement les mises à jour non-authentifiées';

COMMENT ON POLICY "block_unauthenticated_delete_profiles" ON public.profiles IS 
  'Politique RESTRICTIVE: bloque uniquement les suppressions non-authentifiées';

COMMENT ON POLICY "block_unauthenticated_select_profiles" ON public.profiles IS 
  'Politique RESTRICTIVE: bloque uniquement les lectures non-authentifiées';
