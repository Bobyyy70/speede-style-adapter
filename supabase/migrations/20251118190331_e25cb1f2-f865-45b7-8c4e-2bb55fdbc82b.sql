-- Fix RLS policies NULL-safe pour commande
DROP POLICY IF EXISTS "Client read own commande" ON public.commande;
DROP POLICY IF EXISTS "Service role full access on commande" ON public.commande;
DROP POLICY IF EXISTS "Admin full access on commande" ON public.commande;
DROP POLICY IF EXISTS "Gestionnaire full access on commande" ON public.commande;
DROP POLICY IF EXISTS "Operateur read own commande" ON public.commande;

-- Admin: accès total
CREATE POLICY "Admin full access on commande"
  ON public.commande FOR ALL TO authenticated
  USING (
    EXISTS (SELECT 1 FROM public.user_roles WHERE user_id = auth.uid() AND role = 'admin')
  )
  WITH CHECK (
    EXISTS (SELECT 1 FROM public.user_roles WHERE user_id = auth.uid() AND role = 'admin')
  );

-- Gestionnaire: accès total
CREATE POLICY "Gestionnaire full access on commande"
  ON public.commande FOR ALL TO authenticated
  USING (
    EXISTS (SELECT 1 FROM public.user_roles WHERE user_id = auth.uid() AND role = 'gestionnaire')
  )
  WITH CHECK (
    EXISTS (SELECT 1 FROM public.user_roles WHERE user_id = auth.uid() AND role = 'gestionnaire')
  );

-- Opérateur: lecture seule
CREATE POLICY "Operateur read own commande"
  ON public.commande FOR SELECT TO authenticated
  USING (
    EXISTS (SELECT 1 FROM public.user_roles WHERE user_id = auth.uid() AND role = 'operateur')
  );

-- Client: lecture avec NULL-safe
CREATE POLICY "Client read own commande"
  ON public.commande FOR SELECT TO authenticated
  USING (
    EXISTS (SELECT 1 FROM public.user_roles WHERE user_id = auth.uid() AND role = 'client')
    AND (
      client_id IN (SELECT client_id FROM public.profiles WHERE id = auth.uid() AND client_id IS NOT NULL)
      OR (client_id IS NULL AND NOT EXISTS (SELECT 1 FROM public.profiles WHERE id = auth.uid() AND client_id IS NOT NULL))
    )
  );

-- Service role: accès complet pour edge functions
CREATE POLICY "Service role full access on commande"
  ON public.commande FOR ALL TO service_role
  USING (true)
  WITH CHECK (true);

-- Index performance
CREATE INDEX IF NOT EXISTS idx_commande_client_id ON public.commande(client_id);
CREATE INDEX IF NOT EXISTS idx_profiles_user_client ON public.profiles(id, client_id);