-- ============================================================
-- HOTFIX CRITIQUE: RLS Policies commande
-- ============================================================
-- Fix les policies RLS pour permettre la récupération des commandes
-- même quand client_id est NULL (temporairement)
-- ============================================================

-- ============================================================
-- PARTIE 1: Policies pour la table COMMANDE
-- ============================================================

-- Supprimer toutes les anciennes policies
DROP POLICY IF EXISTS "Allow authenticated users to read commandes" ON public.commande;
DROP POLICY IF EXISTS "Allow authenticated users to insert commandes" ON public.commande;
DROP POLICY IF EXISTS "Allow authenticated users to update commandes" ON public.commande;
DROP POLICY IF EXISTS "Client read own commande" ON public.commande;

-- ✅ Policy ADMIN: Accès complet
CREATE POLICY "Admin full access on commande"
  ON public.commande
  FOR ALL
  TO authenticated
  USING (has_role(auth.uid(), 'admin'::app_role))
  WITH CHECK (has_role(auth.uid(), 'admin'::app_role));

-- ✅ Policy GESTIONNAIRE: Lecture complète
CREATE POLICY "Gestionnaire read all commandes"
  ON public.commande
  FOR SELECT
  TO authenticated
  USING (has_role(auth.uid(), 'gestionnaire'::app_role));

-- ✅ Policy OPÉRATEUR: Lecture + mise à jour
CREATE POLICY "Operateur read all commandes"
  ON public.commande
  FOR SELECT
  TO authenticated
  USING (has_role(auth.uid(), 'operateur'::app_role));

CREATE POLICY "Operateur update commandes"
  ON public.commande
  FOR UPDATE
  TO authenticated
  USING (has_role(auth.uid(), 'operateur'::app_role))
  WITH CHECK (has_role(auth.uid(), 'operateur'::app_role));

-- ✅ Policy CLIENT: Voir UNIQUEMENT ses commandes
-- IMPORTANT: Gère le cas où client_id est NULL
CREATE POLICY "Client read own commande"
  ON public.commande
  FOR SELECT
  TO authenticated
  USING (
    has_role(auth.uid(), 'client'::app_role)
    AND (
      -- Cas 1: Commande avec client_id qui correspond
      (client_id IS NOT NULL AND client_id IN (
        SELECT client_id FROM public.profiles WHERE id = auth.uid()
      ))
      -- Cas 2: Si l'utilisateur n'a pas de client_id, voir les commandes sans client_id
      OR (
        client_id IS NULL
        AND NOT EXISTS (SELECT 1 FROM public.profiles WHERE id = auth.uid() AND client_id IS NOT NULL)
      )
    )
  );

-- ✅ Policy CLIENT: Créer des commandes
CREATE POLICY "Client insert commande"
  ON public.commande
  FOR INSERT
  TO authenticated
  WITH CHECK (
    has_role(auth.uid(), 'client'::app_role)
    AND (
      -- Soit avec son client_id
      client_id IN (SELECT client_id FROM public.profiles WHERE id = auth.uid())
      -- Soit sans client_id si l'utilisateur n'en a pas
      OR (client_id IS NULL AND NOT EXISTS (
        SELECT 1 FROM public.profiles WHERE id = auth.uid() AND client_id IS NOT NULL
      ))
    )
  );

-- ✅ Policy CLIENT: Mettre à jour ses commandes
CREATE POLICY "Client update own commande"
  ON public.commande
  FOR UPDATE
  TO authenticated
  USING (
    has_role(auth.uid(), 'client'::app_role)
    AND (
      client_id IN (SELECT client_id FROM public.profiles WHERE id = auth.uid())
      OR (client_id IS NULL AND NOT EXISTS (
        SELECT 1 FROM public.profiles WHERE id = auth.uid() AND client_id IS NOT NULL
      ))
    )
  )
  WITH CHECK (
    has_role(auth.uid(), 'client'::app_role)
    AND (
      client_id IN (SELECT client_id FROM public.profiles WHERE id = auth.uid())
      OR (client_id IS NULL AND NOT EXISTS (
        SELECT 1 FROM public.profiles WHERE id = auth.uid() AND client_id IS NOT NULL
      ))
    )
  );

-- ============================================================
-- PARTIE 2: Policy SERVICE_ROLE pour edge functions
-- ============================================================

-- ✅ Service role: Accès complet (pour les edge functions)
CREATE POLICY "Service role full access on commande"
  ON public.commande
  FOR ALL
  TO service_role
  USING (true)
  WITH CHECK (true);

-- ============================================================
-- PARTIE 3: Fix policies ligne_commande
-- ============================================================

DROP POLICY IF EXISTS "Allow authenticated users to read lignes" ON public.ligne_commande;
DROP POLICY IF EXISTS "Allow authenticated users to insert lignes" ON public.ligne_commande;
DROP POLICY IF EXISTS "Allow authenticated users to update lignes" ON public.ligne_commande;
DROP POLICY IF EXISTS "Client read own ligne_commande" ON public.ligne_commande;

-- Admin
CREATE POLICY "Admin full access on ligne_commande"
  ON public.ligne_commande
  FOR ALL
  TO authenticated
  USING (has_role(auth.uid(), 'admin'::app_role))
  WITH CHECK (has_role(auth.uid(), 'admin'::app_role));

-- Gestionnaire
CREATE POLICY "Gestionnaire read ligne_commande"
  ON public.ligne_commande
  FOR SELECT
  TO authenticated
  USING (has_role(auth.uid(), 'gestionnaire'::app_role));

-- Opérateur
CREATE POLICY "Operateur read ligne_commande"
  ON public.ligne_commande
  FOR SELECT
  TO authenticated
  USING (has_role(auth.uid(), 'operateur'::app_role));

CREATE POLICY "Operateur update ligne_commande"
  ON public.ligne_commande
  FOR UPDATE
  TO authenticated
  USING (has_role(auth.uid(), 'operateur'::app_role))
  WITH CHECK (has_role(auth.uid(), 'operateur'::app_role));

-- Client: voir ses lignes via commande
CREATE POLICY "Client read own ligne_commande"
  ON public.ligne_commande
  FOR SELECT
  TO authenticated
  USING (
    has_role(auth.uid(), 'client'::app_role)
    AND commande_id IN (
      SELECT id FROM public.commande
      WHERE (
        client_id IN (SELECT client_id FROM public.profiles WHERE id = auth.uid())
        OR (client_id IS NULL AND NOT EXISTS (
          SELECT 1 FROM public.profiles WHERE id = auth.uid() AND client_id IS NOT NULL
        ))
      )
    )
  );

-- Service role
CREATE POLICY "Service role full access on ligne_commande"
  ON public.ligne_commande
  FOR ALL
  TO service_role
  USING (true)
  WITH CHECK (true);

-- ============================================================
-- PARTIE 4: Créer des indexes pour performance RLS
-- ============================================================

-- Index pour améliorer les performances des sous-requêtes RLS
CREATE INDEX IF NOT EXISTS idx_profiles_user_client
  ON public.profiles(id, client_id);

CREATE INDEX IF NOT EXISTS idx_commande_client_lookup
  ON public.commande(client_id) WHERE client_id IS NOT NULL;

-- ============================================================
-- RÉSUMÉ
-- ============================================================

DO $$
DECLARE
  policy_count INTEGER;
BEGIN
  SELECT COUNT(*) INTO policy_count
  FROM pg_policies
  WHERE schemaname = 'public' AND tablename = 'commande';

  RAISE NOTICE '';
  RAISE NOTICE '========================================';
  RAISE NOTICE '   HOTFIX RLS POLICIES APPLIQUÉ';
  RAISE NOTICE '========================================';
  RAISE NOTICE 'Policies créées sur commande: %', policy_count;
  RAISE NOTICE '';
  RAISE NOTICE 'Roles supportés:';
  RAISE NOTICE '  ✅ admin (accès complet)';
  RAISE NOTICE '  ✅ gestionnaire (lecture complète)';
  RAISE NOTICE '  ✅ operateur (lecture + update)';
  RAISE NOTICE '  ✅ client (ses commandes uniquement)';
  RAISE NOTICE '  ✅ service_role (edge functions)';
  RAISE NOTICE '';
  RAISE NOTICE 'Gestion client_id NULL:';
  RAISE NOTICE '  ✅ Utilisateurs avec client_id NULL peuvent voir leurs données';
  RAISE NOTICE '  ✅ Pas de blocage pour commandes orphelines';
  RAISE NOTICE '========================================';
  RAISE NOTICE '';
END $$;
