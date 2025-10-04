-- ============================================================================
-- PHASE 1: CORRECTIFS DE SÉCURITÉ CRITIQUES
-- ============================================================================

-- 1. BLOQUER TOUS LES ACCÈS ANONYMOUS (RESTRICTIVE POLICIES)
-- ============================================================================

-- 1.1 Bloquer anon sur profiles (empêcher énumération emails)
CREATE POLICY "block_anon_profiles_restrictive"
ON public.profiles
AS RESTRICTIVE
FOR ALL
TO anon
USING (false);

-- 1.2 Bloquer anon sur mouvement_stock (empêcher lecture stock)
CREATE POLICY "block_anon_mouvement_stock_restrictive"
ON public.mouvement_stock
AS RESTRICTIVE
FOR ALL
TO anon
USING (false);

-- 1.3 Renforcer le blocage sur commande (déjà existant mais on le rend RESTRICTIVE)
DROP POLICY IF EXISTS "Block anonymous access to commande" ON public.commande;
CREATE POLICY "block_anon_commande_restrictive"
ON public.commande
AS RESTRICTIVE
FOR ALL
TO anon
USING (false);

-- 1.4 Bloquer anon sur ligne_commande
CREATE POLICY "block_anon_ligne_commande_restrictive"
ON public.ligne_commande
AS RESTRICTIVE
FOR ALL
TO anon
USING (false);

-- 1.5 Bloquer anon sur produit (empêcher lecture catalogue)
CREATE POLICY "block_anon_produit_restrictive"
ON public.produit
AS RESTRICTIVE
FOR ALL
TO anon
USING (false);

-- 2. CRÉER VUE MASQUÉE POUR GESTIONNAIRES (Protection PII)
-- ============================================================================

-- Vue qui masque les données personnelles sensibles pour les gestionnaires
CREATE OR REPLACE VIEW public.commande_gestionnaire_secure
WITH (security_invoker = true, security_barrier = true)
AS
SELECT 
  c.id,
  c.numero_commande,
  c.statut_wms,
  c.date_creation,
  c.date_modification,
  c.client_id,
  
  -- Masquer les données personnelles identifiables
  CASE 
    WHEN has_role(auth.uid(), 'admin'::app_role) THEN c.nom_client
    ELSE LEFT(c.nom_client, 1) || '***'
  END as nom_client,
  
  CASE 
    WHEN has_role(auth.uid(), 'admin'::app_role) THEN c.email_client
    WHEN c.email_client IS NOT NULL THEN 
      LEFT(c.email_client, 3) || '***@' || SPLIT_PART(c.email_client, '@', 2)
    ELSE NULL
  END as email_client,
  
  CASE 
    WHEN has_role(auth.uid(), 'admin'::app_role) THEN c.telephone_client
    WHEN c.telephone_client IS NOT NULL THEN '***' || RIGHT(c.telephone_client, 2)
    ELSE NULL
  END as telephone_client,
  
  -- Garder données logistiques nécessaires
  c.adresse_nom,
  c.adresse_ligne_1,
  c.adresse_ligne_2,
  c.code_postal,
  c.ville,
  c.pays_code,
  
  -- Masquer adresse facturation aussi
  CASE 
    WHEN has_role(auth.uid(), 'admin'::app_role) THEN c.facturation_nom
    ELSE LEFT(c.facturation_nom, 1) || '***'
  END as facturation_nom,
  
  c.facturation_ligne_1,
  c.facturation_ligne_2,
  c.facturation_code_postal,
  c.facturation_ville,
  c.facturation_pays_code,
  
  -- Données opérationnelles (non-PII)
  c.valeur_totale,
  c.devise,
  c.poids_total,
  c.transporteur,
  c.methode_expedition,
  c.numero_facture_commerciale,
  c.remarques,
  c.source,
  c.sendcloud_id
FROM public.commande c;

-- Grant SELECT sur la vue sécurisée
GRANT SELECT ON public.commande_gestionnaire_secure TO authenticated;
REVOKE ALL ON public.commande_gestionnaire_secure FROM anon;

-- 3. RENFORCER RLS SUR CLIENT_ID POUR COMMANDE
-- ============================================================================

-- S'assurer que la colonne client_id est bien utilisée et pas nullable
-- Note: On ne peut pas ajouter NOT NULL directement sur une colonne existante avec des valeurs NULL
-- Mais on peut ajouter une validation via CHECK constraint pour les nouvelles insertions

-- Ajouter un commentaire sur la colonne pour documenter l'importance de client_id
COMMENT ON COLUMN public.commande.client_id IS 
'CRITICAL SECURITY: Must always be set for data isolation. Links order to client for RLS enforcement.';

-- 4. AJOUTER VISIBILITÉ CLIENT SUR SERVICES ET CALCULS (Correctif Optimisation)
-- ============================================================================

-- 4.1 Permettre aux clients de voir leurs lignes de service
CREATE POLICY "client_read_own_ligne_service"
ON public.ligne_service_commande
FOR SELECT
TO authenticated
USING (
  has_role(auth.uid(), 'client'::app_role) 
  AND commande_id IN (
    SELECT id FROM public.commande 
    WHERE client_id IN (
      SELECT client_id FROM public.profiles 
      WHERE id = auth.uid()
    )
  )
);

-- 4.2 Permettre aux clients de voir leurs calculs volumétriques
CREATE POLICY "client_read_own_calculateur"
ON public.calculateur_volumetrique
FOR SELECT
TO authenticated
USING (
  has_role(auth.uid(), 'client'::app_role) 
  AND commande_id IN (
    SELECT id FROM public.commande 
    WHERE client_id IN (
      SELECT client_id FROM public.profiles 
      WHERE id = auth.uid()
    )
  )
);

-- 5. AUDIT: Ajouter des commentaires de sécurité sur tables sensibles
-- ============================================================================

COMMENT ON TABLE public.profiles IS 
'SECURITY: Contains user PII. RESTRICTIVE policy blocks anonymous access. Admin/self access only.';

COMMENT ON TABLE public.commande IS 
'SECURITY: Contains customer PII (email, phone, addresses). Use commande_gestionnaire_secure view for non-admin access. Client isolation via client_id.';

COMMENT ON TABLE public.mouvement_stock IS 
'SECURITY: Stock movements. RESTRICTIVE policy blocks anonymous. Client can only see movements for their products.';

COMMENT ON VIEW public.stock_disponible IS 
'SECURITY: Real-time inventory view. Uses security_invoker=true to respect underlying RLS. Anonymous access revoked.';

COMMENT ON VIEW public.commande_gestionnaire_secure IS 
'SECURITY: PII-masked view of orders for managers. Shows full details to admins only. Use this view in manager dashboards instead of direct commande table access.';