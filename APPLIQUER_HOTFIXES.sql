-- =====================================================
-- APPLIQUER TOUS LES HOTFIXES
-- =====================================================
-- Instructions:
-- 1. Ouvrir https://supabase.com/dashboard/project/tggdjeoxvpzbigbikpfy/sql
-- 2. Copier/coller TOUT ce fichier
-- 3. Cliquer sur "Run"
-- 4. C'est fini!
-- =====================================================

-- =====================================================
-- HOTFIX 005: Ajout statuts manquants
-- =====================================================

ALTER TABLE public.commande DROP CONSTRAINT IF EXISTS commande_statut_wms_check;

ALTER TABLE public.commande ADD CONSTRAINT commande_statut_wms_check
  CHECK (statut_wms IN (
    -- Anciens statuts (legacy)
    'En attente de réappro',
    'Prêt à préparer',
    'Réservé',
    'En préparation',
    'En attente d''expédition',
    'Expédié',
    'Livré',
    'Annulée',
    'prete',
    'expediee',
    -- NOUVEAUX statuts (automation)
    'stock_reserve',
    'en_picking',
    'pret_expedition',
    'etiquette_generee',
    'expedie',
    'livre',
    'retour',
    'erreur',
    'annule'
  ));

-- =====================================================
-- HOTFIX 006: Fix RLS policies NULL-safe
-- =====================================================

-- Drop anciennes policies sur commande
DROP POLICY IF EXISTS "Admin full access on commande" ON public.commande;
DROP POLICY IF EXISTS "Gestionnaire full access on commande" ON public.commande;
DROP POLICY IF EXISTS "Operateur read own commande" ON public.commande;
DROP POLICY IF EXISTS "Client read own commande" ON public.commande;
DROP POLICY IF EXISTS "Service role full access on commande" ON public.commande;

-- POLICY ADMIN: Accès complet
CREATE POLICY "Admin full access on commande"
  ON public.commande FOR ALL TO authenticated
  USING (has_role(auth.uid(), 'admin'::app_role))
  WITH CHECK (has_role(auth.uid(), 'admin'::app_role));

-- POLICY GESTIONNAIRE: Accès complet
CREATE POLICY "Gestionnaire full access on commande"
  ON public.commande FOR ALL TO authenticated
  USING (has_role(auth.uid(), 'gestionnaire'::app_role))
  WITH CHECK (has_role(auth.uid(), 'gestionnaire'::app_role));

-- POLICY OPERATEUR: Lecture seule
CREATE POLICY "Operateur read own commande"
  ON public.commande FOR SELECT TO authenticated
  USING (has_role(auth.uid(), 'operateur'::app_role));

-- POLICY CLIENT: Lecture avec gestion NULL-safe
CREATE POLICY "Client read own commande"
  ON public.commande FOR SELECT TO authenticated
  USING (
    has_role(auth.uid(), 'client'::app_role)
    AND (
      -- Cas 1: Commande avec client_id correspondant
      (client_id IS NOT NULL AND client_id IN (
        SELECT client_id FROM public.profiles WHERE id = auth.uid()
      ))
      -- Cas 2: User sans client_id peut voir commandes sans client_id
      OR (
        client_id IS NULL
        AND NOT EXISTS (SELECT 1 FROM public.profiles WHERE id = auth.uid() AND client_id IS NOT NULL)
      )
    )
  );

-- POLICY SERVICE ROLE: Accès complet pour Edge Functions
CREATE POLICY "Service role full access on commande"
  ON public.commande FOR ALL TO service_role
  USING (true)
  WITH CHECK (true);

-- =====================================================
-- Même logique pour ligne_commande
-- =====================================================

-- Drop anciennes policies sur ligne_commande
DROP POLICY IF EXISTS "Admin full access on ligne_commande" ON public.ligne_commande;
DROP POLICY IF EXISTS "Gestionnaire full access on ligne_commande" ON public.ligne_commande;
DROP POLICY IF EXISTS "Operateur read ligne_commande" ON public.ligne_commande;
DROP POLICY IF EXISTS "Client read own ligne_commande" ON public.ligne_commande;
DROP POLICY IF EXISTS "Service role full access on ligne_commande" ON public.ligne_commande;

CREATE POLICY "Admin full access on ligne_commande"
  ON public.ligne_commande FOR ALL TO authenticated
  USING (has_role(auth.uid(), 'admin'::app_role))
  WITH CHECK (has_role(auth.uid(), 'admin'::app_role));

CREATE POLICY "Gestionnaire full access on ligne_commande"
  ON public.ligne_commande FOR ALL TO authenticated
  USING (has_role(auth.uid(), 'gestionnaire'::app_role))
  WITH CHECK (has_role(auth.uid(), 'gestionnaire'::app_role));

CREATE POLICY "Operateur read ligne_commande"
  ON public.ligne_commande FOR SELECT TO authenticated
  USING (
    has_role(auth.uid(), 'operateur'::app_role)
    AND commande_id IN (SELECT id FROM public.commande)
  );

CREATE POLICY "Client read own ligne_commande"
  ON public.ligne_commande FOR SELECT TO authenticated
  USING (
    has_role(auth.uid(), 'client'::app_role)
    AND commande_id IN (
      SELECT id FROM public.commande
      WHERE (
        (client_id IS NOT NULL AND client_id IN (
          SELECT client_id FROM public.profiles WHERE id = auth.uid()
        ))
        OR (
          client_id IS NULL
          AND NOT EXISTS (SELECT 1 FROM public.profiles WHERE id = auth.uid() AND client_id IS NOT NULL)
        )
      )
    )
  );

CREATE POLICY "Service role full access on ligne_commande"
  ON public.ligne_commande FOR ALL TO service_role
  USING (true)
  WITH CHECK (true);

-- =====================================================
-- Indexes pour performance
-- =====================================================

CREATE INDEX IF NOT EXISTS idx_profiles_client_id_lookup ON public.profiles(id, client_id);
CREATE INDEX IF NOT EXISTS idx_commande_client_id_lookup ON public.commande(client_id, id);
CREATE INDEX IF NOT EXISTS idx_ligne_commande_commande_id_lookup ON public.ligne_commande(commande_id);

-- =====================================================
-- Notification de succès
-- =====================================================

DO $$
BEGIN
  RAISE NOTICE '======================================';
  RAISE NOTICE '   ✅ TOUS LES HOTFIXES APPLIQUÉS';
  RAISE NOTICE '======================================';
  RAISE NOTICE 'HOTFIX 005: Statuts ajoutés (9)';
  RAISE NOTICE 'HOTFIX 006: RLS policies NULL-safe (10)';
  RAISE NOTICE 'Indexes créés: 3';
  RAISE NOTICE '======================================';
  RAISE NOTICE 'Rafraîchissez votre application!';
  RAISE NOTICE '======================================';
END $$;
