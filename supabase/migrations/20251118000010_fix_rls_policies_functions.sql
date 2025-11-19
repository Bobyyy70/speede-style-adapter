-- =====================================================
-- HOTFIX: Correction RLS Policies - Fonctions helper
-- Description: Fix migration 20251118000009 qui utilisait des fonctions inexistantes
-- Date: 2025-11-18
-- =====================================================

-- =====================================================
-- Supprimer les policies créées avec les mauvaises fonctions
-- =====================================================

DROP POLICY IF EXISTS "gestionnaire_full_retour_produit" ON public.retour_produit;
DROP POLICY IF EXISTS "operateur_read_retour_produit" ON public.retour_produit;
DROP POLICY IF EXISTS "gestionnaire_full_mouvement_stock" ON public.mouvement_stock;
DROP POLICY IF EXISTS "operateur_mouvement_stock" ON public.mouvement_stock;
DROP POLICY IF EXISTS "gestionnaire_full_session_preparation" ON public.session_preparation;
DROP POLICY IF EXISTS "gestionnaire_full_session_commande" ON public.session_commande;
DROP POLICY IF EXISTS "gestionnaire_full_decision_transporteur" ON public.decision_transporteur;
DROP POLICY IF EXISTS "operateur_read_decision_transporteur" ON public.decision_transporteur;
DROP POLICY IF EXISTS "gestionnaire_full_configuration_expediteur" ON public.configuration_expediteur;
DROP POLICY IF EXISTS "client_read_configuration_expediteur" ON public.configuration_expediteur;
DROP POLICY IF EXISTS "gestionnaire_full_contact_destinataire" ON public.contact_destinataire;
DROP POLICY IF EXISTS "client_contact_destinataire" ON public.contact_destinataire;

-- =====================================================
-- Recréer avec les bonnes fonctions (has_role)
-- =====================================================

-- RETOUR_PRODUIT
CREATE POLICY "gestionnaire_full_retour_produit" ON public.retour_produit
  FOR ALL
  TO authenticated
  USING (has_role(auth.uid(), 'gestionnaire'::app_role))
  WITH CHECK (has_role(auth.uid(), 'gestionnaire'::app_role));

CREATE POLICY "operateur_read_retour_produit" ON public.retour_produit
  FOR SELECT
  TO authenticated
  USING (has_role(auth.uid(), 'operateur'::app_role));

-- MOUVEMENT_STOCK
CREATE POLICY "gestionnaire_full_mouvement_stock" ON public.mouvement_stock
  FOR ALL
  TO authenticated
  USING (has_role(auth.uid(), 'gestionnaire'::app_role))
  WITH CHECK (has_role(auth.uid(), 'gestionnaire'::app_role));

CREATE POLICY "operateur_mouvement_stock" ON public.mouvement_stock
  FOR ALL
  TO authenticated
  USING (has_role(auth.uid(), 'operateur'::app_role))
  WITH CHECK (has_role(auth.uid(), 'operateur'::app_role));

-- SESSION_PREPARATION
CREATE POLICY "gestionnaire_full_session_preparation" ON public.session_preparation
  FOR ALL
  TO authenticated
  USING (has_role(auth.uid(), 'gestionnaire'::app_role))
  WITH CHECK (has_role(auth.uid(), 'gestionnaire'::app_role));

-- SESSION_COMMANDE
CREATE POLICY "gestionnaire_full_session_commande" ON public.session_commande
  FOR ALL
  TO authenticated
  USING (has_role(auth.uid(), 'gestionnaire'::app_role))
  WITH CHECK (has_role(auth.uid(), 'gestionnaire'::app_role));

-- DECISION_TRANSPORTEUR
CREATE POLICY "gestionnaire_full_decision_transporteur" ON public.decision_transporteur
  FOR ALL
  TO authenticated
  USING (has_role(auth.uid(), 'gestionnaire'::app_role))
  WITH CHECK (has_role(auth.uid(), 'gestionnaire'::app_role));

CREATE POLICY "operateur_read_decision_transporteur" ON public.decision_transporteur
  FOR SELECT
  TO authenticated
  USING (has_role(auth.uid(), 'operateur'::app_role));

-- CONFIGURATION_EXPEDITEUR
CREATE POLICY "gestionnaire_full_configuration_expediteur" ON public.configuration_expediteur
  FOR ALL
  TO authenticated
  USING (has_role(auth.uid(), 'gestionnaire'::app_role))
  WITH CHECK (has_role(auth.uid(), 'gestionnaire'::app_role));

CREATE POLICY "client_read_configuration_expediteur" ON public.configuration_expediteur
  FOR SELECT
  TO authenticated
  USING (
    has_role(auth.uid(), 'client'::app_role) AND (
      client_id IN (SELECT client_id FROM public.profiles WHERE id = auth.uid())
      OR client_id IS NULL
    )
  );

-- CONTACT_DESTINATAIRE
CREATE POLICY "gestionnaire_full_contact_destinataire" ON public.contact_destinataire
  FOR ALL
  TO authenticated
  USING (has_role(auth.uid(), 'gestionnaire'::app_role))
  WITH CHECK (has_role(auth.uid(), 'gestionnaire'::app_role));

CREATE POLICY "client_contact_destinataire" ON public.contact_destinataire
  FOR ALL
  TO authenticated
  USING (
    has_role(auth.uid(), 'client'::app_role) AND (
      client_id IN (SELECT client_id FROM public.profiles WHERE id = auth.uid())
      OR client_id IS NULL
    )
  )
  WITH CHECK (
    has_role(auth.uid(), 'client'::app_role) AND (
      client_id IN (SELECT client_id FROM public.profiles WHERE id = auth.uid())
      OR client_id IS NULL
    )
  );

-- =====================================================
-- Vérification
-- =====================================================
DO $$
BEGIN
  RAISE NOTICE '========================================';
  RAISE NOTICE ' ✅ HOTFIX RLS Policies Appliqué';
  RAISE NOTICE '========================================';
  RAISE NOTICE 'Policies corrigées avec has_role()';
  RAISE NOTICE 'Au lieu de: is_gestionnaire(), is_operateur(), is_client()';
  RAISE NOTICE '========================================';
END $$;
