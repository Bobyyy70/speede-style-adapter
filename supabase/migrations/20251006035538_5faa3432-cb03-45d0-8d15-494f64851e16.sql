-- Remove overly restrictive policies blocking all access on commande
DROP POLICY IF EXISTS "block_anon_commande_restrictive" ON public.commande;
DROP POLICY IF EXISTS "block_public_commande" ON public.commande;

-- Note: existing role-based policies remain in place (admin/gestionnaire/operateur/client)
