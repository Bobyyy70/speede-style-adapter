-- ============================================================
-- HOTFIX: Correction des statuts de commande
-- ============================================================
-- Cette migration corrige les statuts de commande pour supporter
-- tous les statuts utilisés par les triggers et webhooks
-- ============================================================

-- Supprimer l'ancienne contrainte
ALTER TABLE public.commande DROP CONSTRAINT IF EXISTS commande_statut_wms_check;

-- Créer la nouvelle contrainte avec TOUS les statuts nécessaires
ALTER TABLE public.commande ADD CONSTRAINT commande_statut_wms_check
  CHECK (statut_wms IN (
    -- Statuts initiaux
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

    -- ✅ NOUVEAUX STATUTS pour automatisation
    'stock_reserve',        -- Stock réservé automatiquement
    'en_picking',           -- Picking en cours
    'pret_expedition',      -- Prêt pour expédition
    'etiquette_generee',    -- Étiquette SendCloud générée
    'expedie',              -- Expédié (minuscule)
    'livre',                -- Livré (minuscule)
    'retour',               -- Retour produit
    'erreur',               -- Erreur de livraison
    'annule'                -- Annulé (minuscule)
  ));

COMMENT ON CONSTRAINT commande_statut_wms_check ON public.commande IS
  'Contrainte CHECK pour les statuts WMS - Comprend les statuts legacy et nouveaux statuts automatisés';

-- ============================================================
-- Vue pour mapper les statuts anciens vers nouveaux
-- ============================================================
CREATE OR REPLACE VIEW public.v_commande_with_normalized_status AS
SELECT
  c.*,
  CASE
    WHEN c.statut_wms = 'Réservé' THEN 'stock_reserve'
    WHEN c.statut_wms = 'En préparation' THEN 'en_preparation'
    WHEN c.statut_wms IN ('En attente d''expédition', 'prete') THEN 'pret_expedition'
    WHEN c.statut_wms IN ('Expédié', 'expediee') THEN 'expedie'
    WHEN c.statut_wms = 'Livré' THEN 'livre'
    WHEN c.statut_wms = 'Annulée' THEN 'annule'
    ELSE c.statut_wms
  END as statut_normalise
FROM public.commande c;

COMMENT ON VIEW public.v_commande_with_normalized_status IS
  'Vue des commandes avec statut normalisé pour compatibilité avec le code';

-- ============================================================
-- RÉSUMÉ
-- ============================================================
DO $$
BEGIN
  RAISE NOTICE '';
  RAISE NOTICE '========================================';
  RAISE NOTICE '   HOTFIX STATUTS COMMANDE APPLIQUÉ';
  RAISE NOTICE '========================================';
  RAISE NOTICE 'Statuts ajoutés:';
  RAISE NOTICE '  ✅ stock_reserve';
  RAISE NOTICE '  ✅ en_picking';
  RAISE NOTICE '  ✅ pret_expedition';
  RAISE NOTICE '  ✅ etiquette_generee';
  RAISE NOTICE '  ✅ expedie (minuscule)';
  RAISE NOTICE '  ✅ livre (minuscule)';
  RAISE NOTICE '  ✅ retour';
  RAISE NOTICE '  ✅ erreur';
  RAISE NOTICE '  ✅ annule (minuscule)';
  RAISE NOTICE '';
  RAISE NOTICE 'Vue créée:';
  RAISE NOTICE '  ✅ v_commande_with_normalized_status';
  RAISE NOTICE '========================================';
  RAISE NOTICE '';
END $$;
