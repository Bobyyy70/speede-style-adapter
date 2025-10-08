-- Correction des RLS policies pour le rôle client
-- Problème : Les policies restrictives bloquent l'accès même avec des policies permissives

-- 1. Corriger les policies sur public.client
DROP POLICY IF EXISTS "Admin full access on client" ON public.client;
DROP POLICY IF EXISTS "Client read own data" ON public.client;
DROP POLICY IF EXISTS "Gestionnaire read client" ON public.client;
DROP POLICY IF EXISTS "require_authentication_client" ON public.client;
DROP POLICY IF EXISTS "Only admins can delete clients" ON public.client;

-- Base restrictive : authentification obligatoire
CREATE POLICY "authenticated_base_client" ON public.client
  AS RESTRICTIVE
  FOR ALL
  USING (auth.uid() IS NOT NULL);

-- Policies permissives pour SELECT
CREATE POLICY "admin_select_client" ON public.client
  FOR SELECT
  USING (has_role(auth.uid(), 'admin'::app_role));

CREATE POLICY "gestionnaire_select_client" ON public.client
  FOR SELECT
  USING (has_role(auth.uid(), 'gestionnaire'::app_role));

CREATE POLICY "client_select_own" ON public.client
  FOR SELECT
  USING (
    has_role(auth.uid(), 'client'::app_role) AND
    id IN (
      SELECT client_id FROM public.profiles WHERE id = auth.uid() AND client_id IS NOT NULL
    )
  );

-- Admin peut tout faire (INSERT, UPDATE, DELETE)
CREATE POLICY "admin_insert_client" ON public.client
  FOR INSERT
  WITH CHECK (has_role(auth.uid(), 'admin'::app_role));

CREATE POLICY "admin_update_client" ON public.client
  FOR UPDATE
  USING (has_role(auth.uid(), 'admin'::app_role))
  WITH CHECK (has_role(auth.uid(), 'admin'::app_role));

CREATE POLICY "admin_delete_client" ON public.client
  FOR DELETE
  USING (has_role(auth.uid(), 'admin'::app_role));

-- 2. S'assurer que les autres tables critiques ont des policies permissives pour 'client'
-- Vérifier que commande, produit, mouvement_stock ont bien des policies client

-- Note: Les policies existantes pour commande, produit, mouvement_stock semblent déjà correctes
-- Si l'utilisateur client ne voit toujours rien, vérifier user_roles avec :
-- SELECT * FROM public.user_roles WHERE user_id = auth.uid();
-- Et s'assurer que le client_id est bien renseigné dans profiles