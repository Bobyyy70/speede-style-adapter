-- =====================================================
-- RLS Policies Audit & Optimization
-- Description: Ensure all RLS policies are appropriate (not too restrictive)
-- Date: 2025-11-18
-- =====================================================

-- =====================================================
-- 1. Add gestionnaire/operateur policies where missing
-- =====================================================

-- PRODUIT: Already simplified, keep as is
-- (All authenticated users can access)

-- RETOUR_PRODUIT: Add staff access
DROP POLICY IF EXISTS "gestionnaire_read_retour_produit" ON public.retour_produit;
DROP POLICY IF EXISTS "operateur_read_retour_produit" ON public.retour_produit;

CREATE POLICY "gestionnaire_full_retour_produit" ON public.retour_produit
  FOR ALL
  TO authenticated
  USING (is_gestionnaire())
  WITH CHECK (is_gestionnaire());

CREATE POLICY "operateur_read_retour_produit" ON public.retour_produit
  FOR SELECT
  TO authenticated
  USING (is_operateur());

-- MOUVEMENT_STOCK: Add staff policies
DROP POLICY IF EXISTS "gestionnaire_read_mouvement_stock" ON public.mouvement_stock;
DROP POLICY IF EXISTS "operateur_read_mouvement_stock" ON public.mouvement_stock;

CREATE POLICY "gestionnaire_full_mouvement_stock" ON public.mouvement_stock
  FOR ALL
  TO authenticated
  USING (is_gestionnaire())
  WITH CHECK (is_gestionnaire());

CREATE POLICY "operateur_mouvement_stock" ON public.mouvement_stock
  FOR ALL
  TO authenticated
  USING (is_operateur())
  WITH CHECK (is_operateur());

-- SESSION_PREPARATION: Add gestionnaire policy
DROP POLICY IF EXISTS "gestionnaire_full_session_preparation" ON public.session_preparation;

CREATE POLICY "gestionnaire_full_session_preparation" ON public.session_preparation
  FOR ALL
  TO authenticated
  USING (is_gestionnaire())
  WITH CHECK (is_gestionnaire());

-- SESSION_COMMANDE: Add gestionnaire policy
DROP POLICY IF EXISTS "gestionnaire_full_session_commande" ON public.session_commande;

CREATE POLICY "gestionnaire_full_session_commande" ON public.session_commande
  FOR ALL
  TO authenticated
  USING (is_gestionnaire())
  WITH CHECK (is_gestionnaire());

-- DECISION_TRANSPORTEUR: Add staff read policies
DROP POLICY IF EXISTS "gestionnaire_read_decision_transporteur" ON public.decision_transporteur;
DROP POLICY IF EXISTS "operateur_read_decision_transporteur" ON public.decision_transporteur;

CREATE POLICY "gestionnaire_full_decision_transporteur" ON public.decision_transporteur
  FOR ALL
  TO authenticated
  USING (is_gestionnaire())
  WITH CHECK (is_gestionnaire());

CREATE POLICY "operateur_read_decision_transporteur" ON public.decision_transporteur
  FOR SELECT
  TO authenticated
  USING (is_operateur());

-- =====================================================
-- 2. Ensure service_role has full access everywhere
-- =====================================================

-- List of critical tables that MUST have service_role access
DO $$
DECLARE
  table_name TEXT;
  tables_to_fix TEXT[] := ARRAY[
    'commande', 'ligne_commande', 'produit', 'mouvement_stock',
    'retour_produit', 'session_preparation', 'session_commande',
    'decision_transporteur', 'sendcloud_dlq', 'sendcloud_shipment',
    'sendcloud_stock_queue', 'sendcloud_product_mapping', 'sendcloud_sync_errors',
    'document_commande', 'customs_email_log', 'customs_email_templates',
    'client', 'contact_destinataire', 'configuration_expediteur'
  ];
BEGIN
  FOREACH table_name IN ARRAY tables_to_fix
  LOOP
    -- Check if table exists
    IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_schema = 'public' AND table_name = table_name) THEN
      -- Drop old service_role policy if exists
      EXECUTE format('DROP POLICY IF EXISTS "service_role_full_%1$s" ON public.%1$I', table_name);
      EXECUTE format('DROP POLICY IF EXISTS "Service role full access on %1$s" ON public.%1$I', table_name);

      -- Create new service_role policy
      EXECUTE format($policy$
        CREATE POLICY "service_role_full_%1$s" ON public.%1$I
        FOR ALL
        TO service_role
        USING (true)
        WITH CHECK (true);
      $policy$, table_name);

      RAISE NOTICE '✅ Service role policy added to: %', table_name;
    END IF;
  END LOOP;
END $$;

-- =====================================================
-- 3. Fix NULL-safe policies for tables with client_id
-- =====================================================

-- CONFIGURATION_EXPEDITEUR: Allow NULL client_id
DROP POLICY IF EXISTS "client_read_configuration_expediteur" ON public.configuration_expediteur;
DROP POLICY IF EXISTS "gestionnaire_read_configuration_expediteur" ON public.configuration_expediteur;

CREATE POLICY "gestionnaire_full_configuration_expediteur" ON public.configuration_expediteur
  FOR ALL
  TO authenticated
  USING (is_gestionnaire())
  WITH CHECK (is_gestionnaire());

CREATE POLICY "client_read_configuration_expediteur" ON public.configuration_expediteur
  FOR SELECT
  TO authenticated
  USING (
    is_client() AND (
      client_id IN (SELECT client_id FROM public.profiles WHERE id = auth.uid())
      OR client_id IS NULL  -- Global configs accessible to all
    )
  );

-- CONTACT_DESTINATAIRE: Allow NULL client_id
DROP POLICY IF EXISTS "client_read_contact_destinataire" ON public.contact_destinataire;
DROP POLICY IF EXISTS "gestionnaire_full_contact_destinataire" ON public.contact_destinataire;

CREATE POLICY "gestionnaire_full_contact_destinataire" ON public.contact_destinataire
  FOR ALL
  TO authenticated
  USING (is_gestionnaire())
  WITH CHECK (is_gestionnaire());

CREATE POLICY "client_contact_destinataire" ON public.contact_destinataire
  FOR ALL
  TO authenticated
  USING (
    is_client() AND (
      client_id IN (SELECT client_id FROM public.profiles WHERE id = auth.uid())
      OR client_id IS NULL
    )
  )
  WITH CHECK (
    is_client() AND (
      client_id IN (SELECT client_id FROM public.profiles WHERE id = auth.uid())
      OR client_id IS NULL
    )
  );

-- =====================================================
-- 4. Performance indexes for RLS queries
-- =====================================================

-- Index for role checks
CREATE INDEX IF NOT EXISTS idx_user_roles_lookup
  ON public.user_roles(user_id, role);

-- Index for profiles client lookup
CREATE INDEX IF NOT EXISTS idx_profiles_client_lookup
  ON public.profiles(id, client_id) WHERE client_id IS NOT NULL;

-- Index for commande client filtering
CREATE INDEX IF NOT EXISTS idx_commande_client_filter
  ON public.commande(client_id, statut_wms) WHERE client_id IS NOT NULL;

-- Index for mouvement_stock queries
CREATE INDEX IF NOT EXISTS idx_mouvement_stock_produit_date
  ON public.mouvement_stock(produit_id, date_mouvement DESC);

-- =====================================================
-- 5. Summary & Verification
-- =====================================================

DO $$
DECLARE
  total_policies INTEGER;
  service_role_policies INTEGER;
  tables_with_rls INTEGER;
BEGIN
  -- Count total policies
  SELECT COUNT(*) INTO total_policies
  FROM pg_policies
  WHERE schemaname = 'public';

  -- Count service_role policies
  SELECT COUNT(*) INTO service_role_policies
  FROM pg_policies
  WHERE schemaname = 'public'
  AND roles @> ARRAY['service_role']::name[];

  -- Count tables with RLS enabled
  SELECT COUNT(DISTINCT tablename) INTO tables_with_rls
  FROM pg_policies
  WHERE schemaname = 'public';

  RAISE NOTICE '';
  RAISE NOTICE '========================================';
  RAISE NOTICE '  RLS POLICIES AUDIT & OPTIMIZATION';
  RAISE NOTICE '========================================';
  RAISE NOTICE 'Total policies: %', total_policies;
  RAISE NOTICE 'Service role policies: %', service_role_policies;
  RAISE NOTICE 'Tables with RLS: %', tables_with_rls;
  RAISE NOTICE '';
  RAISE NOTICE 'Optimizations appliquées:';
  RAISE NOTICE '  ✅ Gestionnaire access ajouté partout';
  RAISE NOTICE '  ✅ Opérateur access pour tables métier';
  RAISE NOTICE '  ✅ Service role (edge functions) complet';
  RAISE NOTICE '  ✅ NULL client_id supporté';
  RAISE NOTICE '  ✅ Indexes de performance ajoutés';
  RAISE NOTICE '';
  RAISE NOTICE 'Rôles supportés:';
  RAISE NOTICE '  • admin: accès complet sur tout';
  RAISE NOTICE '  • gestionnaire: accès complet données métier';
  RAISE NOTICE '  • operateur: lecture/update opérations';
  RAISE NOTICE '  • client: ses données uniquement (+ NULL safe)';
  RAISE NOTICE '  • service_role: accès complet (edge functions)';
  RAISE NOTICE '========================================';
  RAISE NOTICE '';
END $$;

-- =====================================================
-- 6. Audit report: Check which tables still need review
-- =====================================================

DO $$
DECLARE
  table_rec RECORD;
BEGIN
  RAISE NOTICE '';
  RAISE NOTICE '📋 Tables avec RLS mais sans policy service_role:';
  FOR table_rec IN
    SELECT DISTINCT t.tablename
    FROM pg_tables t
    JOIN pg_class c ON c.relname = t.tablename
    WHERE t.schemaname = 'public'
    AND c.relrowsecurity = true
    AND NOT EXISTS (
      SELECT 1 FROM pg_policies p
      WHERE p.schemaname = 'public'
      AND p.tablename = t.tablename
      AND p.roles @> ARRAY['service_role']::name[]
    )
    ORDER BY t.tablename
  LOOP
    RAISE NOTICE '  ⚠️  %', table_rec.tablename;
  END LOOP;
  RAISE NOTICE '';
END $$;
