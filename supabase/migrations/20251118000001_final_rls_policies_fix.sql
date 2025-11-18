-- =====================================================
-- HOTFIX FINAL: Fix RLS policies pour récupération commandes
-- Date: 2025-11-18
-- Problème: Les policies utilisaient has_role() qui n'existe plus
--          + Logic NULL-safe pour client_id manquante
-- =====================================================

-- Supprimer toutes les anciennes policies
DROP POLICY IF EXISTS "Client read own commande" ON public.commande;
DROP POLICY IF EXISTS "Service role full access on commande" ON public.commande;
DROP POLICY IF EXISTS "Admin full access on commande" ON public.commande;
DROP POLICY IF EXISTS "Gestionnaire full access on commande" ON public.commande;
DROP POLICY IF EXISTS "Operateur read own commande" ON public.commande;

-- =====================================================
-- NOUVELLE APPROCHE: Utiliser user_roles directement
-- =====================================================

-- POLICY 1: ADMIN - Accès total
CREATE POLICY "Admin full access on commande"
  ON public.commande FOR ALL TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM public.user_roles
      WHERE user_id = auth.uid()
      AND role = 'admin'
    )
  )
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM public.user_roles
      WHERE user_id = auth.uid()
      AND role = 'admin'
    )
  );

-- POLICY 2: GESTIONNAIRE - Accès total
CREATE POLICY "Gestionnaire full access on commande"
  ON public.commande FOR ALL TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM public.user_roles
      WHERE user_id = auth.uid()
      AND role = 'gestionnaire'
    )
  )
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM public.user_roles
      WHERE user_id = auth.uid()
      AND role = 'gestionnaire'
    )
  );

-- POLICY 3: OPERATEUR - Lecture seule
CREATE POLICY "Operateur read own commande"
  ON public.commande FOR SELECT TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM public.user_roles
      WHERE user_id = auth.uid()
      AND role = 'operateur'
    )
  );

-- POLICY 4: CLIENT - Lecture avec NULL-safe logic
CREATE POLICY "Client read own commande"
  ON public.commande FOR SELECT TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM public.user_roles
      WHERE user_id = auth.uid()
      AND role = 'client'
    )
    AND (
      -- Cas 1: Client a un client_id et la commande correspond
      client_id IN (
        SELECT client_id
        FROM public.profiles
        WHERE id = auth.uid()
        AND client_id IS NOT NULL
      )
      -- Cas 2: Client n'a pas de client_id et la commande non plus
      OR (
        client_id IS NULL
        AND NOT EXISTS (
          SELECT 1 FROM public.profiles
          WHERE id = auth.uid()
          AND client_id IS NOT NULL
        )
      )
    )
  );

-- POLICY 5: SERVICE ROLE - Accès complet pour Edge Functions
CREATE POLICY "Service role full access on commande"
  ON public.commande FOR ALL TO service_role
  USING (true)
  WITH CHECK (true);

-- =====================================================
-- Indexes pour optimiser les performances RLS
-- =====================================================

CREATE INDEX IF NOT EXISTS idx_commande_client_id
  ON public.commande(client_id);

CREATE INDEX IF NOT EXISTS idx_profiles_user_client
  ON public.profiles(id, client_id);

CREATE INDEX IF NOT EXISTS idx_user_roles_user_role
  ON public.user_roles(user_id, role);

-- =====================================================
-- Même logique pour ligne_commande
-- =====================================================

DROP POLICY IF EXISTS "Client read own ligne_commande" ON public.ligne_commande;
DROP POLICY IF EXISTS "Service role full access on ligne_commande" ON public.ligne_commande;
DROP POLICY IF EXISTS "Admin full access on ligne_commande" ON public.ligne_commande;
DROP POLICY IF EXISTS "Gestionnaire full access on ligne_commande" ON public.ligne_commande;
DROP POLICY IF EXISTS "Operateur read ligne_commande" ON public.ligne_commande;

CREATE POLICY "Admin full access on ligne_commande"
  ON public.ligne_commande FOR ALL TO authenticated
  USING (
    EXISTS (SELECT 1 FROM public.user_roles WHERE user_id = auth.uid() AND role = 'admin')
  )
  WITH CHECK (
    EXISTS (SELECT 1 FROM public.user_roles WHERE user_id = auth.uid() AND role = 'admin')
  );

CREATE POLICY "Gestionnaire full access on ligne_commande"
  ON public.ligne_commande FOR ALL TO authenticated
  USING (
    EXISTS (SELECT 1 FROM public.user_roles WHERE user_id = auth.uid() AND role = 'gestionnaire')
  )
  WITH CHECK (
    EXISTS (SELECT 1 FROM public.user_roles WHERE user_id = auth.uid() AND role = 'gestionnaire')
  );

CREATE POLICY "Operateur read ligne_commande"
  ON public.ligne_commande FOR SELECT TO authenticated
  USING (
    EXISTS (SELECT 1 FROM public.user_roles WHERE user_id = auth.uid() AND role = 'operateur')
    AND commande_id IN (SELECT id FROM public.commande)
  );

CREATE POLICY "Client read own ligne_commande"
  ON public.ligne_commande FOR SELECT TO authenticated
  USING (
    EXISTS (SELECT 1 FROM public.user_roles WHERE user_id = auth.uid() AND role = 'client')
    AND commande_id IN (
      SELECT id FROM public.commande
      WHERE (
        client_id IN (
          SELECT client_id FROM public.profiles
          WHERE id = auth.uid() AND client_id IS NOT NULL
        )
        OR (
          client_id IS NULL
          AND NOT EXISTS (
            SELECT 1 FROM public.profiles
            WHERE id = auth.uid() AND client_id IS NOT NULL
          )
        )
      )
    )
  );

CREATE POLICY "Service role full access on ligne_commande"
  ON public.ligne_commande FOR ALL TO service_role
  USING (true)
  WITH CHECK (true);

-- =====================================================
-- Vérification finale
-- =====================================================

DO $$
DECLARE
  policy_count INTEGER;
BEGIN
  SELECT COUNT(*) INTO policy_count
  FROM pg_policies
  WHERE schemaname = 'public'
  AND tablename IN ('commande', 'ligne_commande');

  RAISE NOTICE '======================================';
  RAISE NOTICE '   HOTFIX RLS APPLIQUÉ AVEC SUCCÈS';
  RAISE NOTICE '======================================';
  RAISE NOTICE 'Policies créées: % sur commande et ligne_commande', policy_count;
  RAISE NOTICE 'Indexes créés: 3';
  RAISE NOTICE '======================================';
  RAISE NOTICE 'Les commandes devraient maintenant être accessibles!';
  RAISE NOTICE '======================================';
END $$;
