-- =====================================================
-- RAPPORTS ACTIVITÉ POUR FACTURATION
-- Description: Exports CSV détaillés de toutes les opérations WMS
-- Impact: CRITIQUE - Données brutes pour facturation manuelle
-- Date: 2025-11-18
-- =====================================================

-- =====================================================
-- 1. RAPPORT COMMANDES DÉTAILLÉ
-- =====================================================

CREATE OR REPLACE FUNCTION get_rapport_commandes_detaille(
  p_client_id UUID,
  p_date_debut DATE,
  p_date_fin DATE
)
RETURNS TABLE (
  -- Commande
  commande_id UUID,
  numero_commande TEXT,
  date_commande TIMESTAMPTZ,
  statut_actuel TEXT,

  -- Client
  client_nom TEXT,

  -- Ligne commande
  ligne_id UUID,
  produit_sku TEXT,
  produit_nom TEXT,
  quantite_commandee INTEGER,
  quantite_preparee INTEGER,

  -- Dates traitement
  date_validation TIMESTAMPTZ,
  date_picking_debut TIMESTAMPTZ,
  date_picking_fin TIMESTAMPTZ,
  date_preparation_debut TIMESTAMPTZ,
  date_preparation_fin TIMESTAMPTZ,
  date_expedition TIMESTAMPTZ,
  date_livraison TIMESTAMPTZ,

  -- Adresse livraison
  adresse_complete TEXT,
  code_postal TEXT,
  ville TEXT,
  pays TEXT,

  -- Poids et dimensions
  poids_total_kg DECIMAL,
  volume_total_m3 DECIMAL,

  -- Notes
  notes_commande TEXT
) AS $$
BEGIN
  RETURN QUERY
  SELECT
    c.id AS commande_id,
    c.numero_commande,
    c.date_creation AS date_commande,
    c.statut_wms AS statut_actuel,

    cl.nom_entreprise AS client_nom,

    lc.id AS ligne_id,
    p.sku AS produit_sku,
    p.nom AS produit_nom,
    lc.quantite AS quantite_commandee,
    COALESCE(lc.quantite_preparee, 0) AS quantite_preparee,

    -- Extraire les dates depuis l'historique de statuts
    (SELECT created_at FROM public.historique_statut_commande
     WHERE commande_id = c.id AND nouveau_statut = 'stock_reserve'
     ORDER BY created_at LIMIT 1) AS date_validation,

    (SELECT created_at FROM public.historique_statut_commande
     WHERE commande_id = c.id AND nouveau_statut = 'en_picking'
     ORDER BY created_at LIMIT 1) AS date_picking_debut,

    (SELECT created_at FROM public.historique_statut_commande
     WHERE commande_id = c.id AND nouveau_statut = 'picking_termine'
     ORDER BY created_at LIMIT 1) AS date_picking_fin,

    (SELECT created_at FROM public.historique_statut_commande
     WHERE commande_id = c.id AND nouveau_statut = 'en_preparation'
     ORDER BY created_at LIMIT 1) AS date_preparation_debut,

    (SELECT created_at FROM public.historique_statut_commande
     WHERE commande_id = c.id AND nouveau_statut = 'pret_expedition'
     ORDER BY created_at LIMIT 1) AS date_preparation_fin,

    (SELECT created_at FROM public.historique_statut_commande
     WHERE commande_id = c.id AND nouveau_statut = 'expedie'
     ORDER BY created_at LIMIT 1) AS date_expedition,

    (SELECT created_at FROM public.historique_statut_commande
     WHERE commande_id = c.id AND nouveau_statut = 'livre'
     ORDER BY created_at LIMIT 1) AS date_livraison,

    c.adresse_livraison AS adresse_complete,
    c.code_postal,
    c.ville,
    c.pays,

    c.poids_total AS poids_total_kg,
    c.volume_total AS volume_total_m3,

    c.notes AS notes_commande

  FROM public.commande c
  JOIN public.client cl ON cl.id = c.client_id
  JOIN public.ligne_commande lc ON lc.commande_id = c.id
  JOIN public.produit p ON p.id = lc.produit_id
  WHERE c.client_id = p_client_id
  AND DATE(c.date_creation) BETWEEN p_date_debut AND p_date_fin
  ORDER BY c.date_creation DESC, c.numero_commande, lc.id;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- =====================================================
-- 2. RAPPORT TRANSPORTS & EXPÉDITIONS
-- =====================================================

CREATE OR REPLACE FUNCTION get_rapport_transports(
  p_client_id UUID,
  p_date_debut DATE,
  p_date_fin DATE
)
RETURNS TABLE (
  -- Commande
  numero_commande TEXT,
  date_commande TIMESTAMPTZ,
  date_expedition TIMESTAMPTZ,

  -- Transport
  transporteur TEXT,
  service_transport TEXT,
  numero_tracking TEXT,

  -- Coûts transport
  frais_port_ht DECIMAL,
  frais_port_ttc DECIMAL,
  port_type TEXT, -- 'port_paye', 'port_du', 'franco'

  -- Poids et dimensions
  poids_reel_kg DECIMAL,
  poids_volumetrique_kg DECIMAL,
  longueur_cm DECIMAL,
  largeur_cm DECIMAL,
  hauteur_cm DECIMAL,

  -- Statut livraison
  statut_livraison TEXT,
  date_livraison_estimee DATE,
  date_livraison_reelle TIMESTAMPTZ,

  -- Incidents
  incident BOOLEAN,
  motif_incident TEXT,

  -- Adresse
  destinataire TEXT,
  ville TEXT,
  code_postal TEXT,
  pays TEXT
) AS $$
BEGIN
  RETURN QUERY
  SELECT
    c.numero_commande,
    c.date_creation AS date_commande,
    (SELECT created_at FROM public.historique_statut_commande
     WHERE commande_id = c.id AND nouveau_statut = 'expedie'
     ORDER BY created_at LIMIT 1) AS date_expedition,

    COALESCE(c.transporteur, 'Non spécifié') AS transporteur,
    c.service_livraison AS service_transport,
    c.numero_suivi AS numero_tracking,

    -- Frais de port (à adapter selon votre structure)
    COALESCE(c.frais_port, 0.0)::DECIMAL AS frais_port_ht,
    COALESCE(c.frais_port * 1.20, 0.0)::DECIMAL AS frais_port_ttc,
    COALESCE(c.port_type, 'port_paye') AS port_type,

    c.poids_total AS poids_reel_kg,
    -- Poids volumétrique = (L x l x h) / 5000
    CASE
      WHEN c.volume_total IS NOT NULL AND c.volume_total > 0
      THEN (c.volume_total * 1000000 / 5000)::DECIMAL
      ELSE c.poids_total
    END AS poids_volumetrique_kg,

    -- Dimensions (à extraire si vous les stockez)
    NULL::DECIMAL AS longueur_cm,
    NULL::DECIMAL AS largeur_cm,
    NULL::DECIMAL AS hauteur_cm,

    c.statut_wms AS statut_livraison,
    c.date_livraison_estimee,
    (SELECT created_at FROM public.historique_statut_commande
     WHERE commande_id = c.id AND nouveau_statut = 'livre'
     ORDER BY created_at LIMIT 1) AS date_livraison_reelle,

    (c.statut_wms IN ('incident_livraison', 'retour_expediteur')) AS incident,
    c.notes AS motif_incident,

    c.nom_destinataire AS destinataire,
    c.ville,
    c.code_postal,
    c.pays

  FROM public.commande c
  WHERE c.client_id = p_client_id
  AND DATE(c.date_creation) BETWEEN p_date_debut AND p_date_fin
  AND c.statut_wms IN ('expedie', 'en_transit', 'en_livraison', 'livre', 'incident_livraison', 'retour_expediteur')
  ORDER BY c.date_creation DESC;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- =====================================================
-- 3. RAPPORT MOUVEMENTS STOCK DÉTAILLÉ
-- =====================================================

CREATE OR REPLACE FUNCTION get_rapport_mouvements_stock(
  p_client_id UUID,
  p_date_debut DATE,
  p_date_fin DATE
)
RETURNS TABLE (
  -- Mouvement
  mouvement_id UUID,
  date_mouvement TIMESTAMPTZ,
  type_mouvement TEXT,

  -- Produit
  produit_sku TEXT,
  produit_nom TEXT,

  -- Quantités
  quantite INTEGER,
  stock_avant INTEGER,
  stock_apres INTEGER,

  -- Emplacement
  emplacement_code TEXT,
  zone TEXT,

  -- Référence
  reference_type TEXT, -- 'commande', 'reception', 'inventaire', 'ajustement'
  reference_numero TEXT,

  -- Opérateur
  operateur_nom TEXT,

  -- Notes
  notes TEXT
) AS $$
BEGIN
  RETURN QUERY
  SELECT
    ms.id AS mouvement_id,
    ms.date_mouvement,
    ms.type_mouvement,

    p.sku AS produit_sku,
    p.nom AS produit_nom,

    ms.quantite,
    ms.stock_avant,
    ms.stock_apres,

    e.code AS emplacement_code,
    e.zone,

    ms.reference_type,
    ms.reference_numero,

    COALESCE(u.email, 'Système') AS operateur_nom,

    ms.notes

  FROM public.mouvement_stock ms
  JOIN public.produit p ON p.id = ms.produit_id
  LEFT JOIN public.emplacement e ON e.id = ms.emplacement_id
  LEFT JOIN auth.users u ON u.id = ms.operateur_id
  WHERE p.client_id = p_client_id
  AND DATE(ms.date_mouvement) BETWEEN p_date_debut AND p_date_fin
  ORDER BY ms.date_mouvement DESC;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- =====================================================
-- 4. RAPPORT RÉCEPTIONS & MISE EN STOCK
-- =====================================================

CREATE OR REPLACE FUNCTION get_rapport_receptions_stock(
  p_client_id UUID,
  p_date_debut DATE,
  p_date_fin DATE
)
RETURNS TABLE (
  -- Réception
  reception_id UUID,
  numero_reception TEXT,
  date_reception TIMESTAMPTZ,
  date_mise_en_stock TIMESTAMPTZ,

  -- Fournisseur
  fournisseur_nom TEXT,
  numero_bl TEXT,

  -- Produit
  produit_sku TEXT,
  produit_nom TEXT,
  quantite_attendue INTEGER,
  quantite_recue INTEGER,
  quantite_conforme INTEGER,
  quantite_non_conforme INTEGER,

  -- Emplacement de stockage
  emplacement_code TEXT,
  zone TEXT,

  -- Contrôle qualité
  controle_qualite_ok BOOLEAN,
  motif_non_conformite TEXT,

  -- Opérateur
  operateur_reception TEXT,
  operateur_stockage TEXT,

  -- Notes
  notes TEXT
) AS $$
BEGIN
  -- Note: Cette fonction suppose l'existence d'une table 'reception_stock'
  -- À adapter selon votre structure actuelle
  RETURN QUERY
  SELECT
    ms.id AS reception_id,
    ms.reference_numero AS numero_reception,
    ms.date_mouvement AS date_reception,
    ms.date_mouvement AS date_mise_en_stock, -- Même date si pas de table dédiée

    'N/A'::TEXT AS fournisseur_nom, -- À adapter
    'N/A'::TEXT AS numero_bl,

    p.sku AS produit_sku,
    p.nom AS produit_nom,
    ms.quantite AS quantite_attendue,
    ms.quantite AS quantite_recue,
    ms.quantite AS quantite_conforme,
    0 AS quantite_non_conforme,

    e.code AS emplacement_code,
    e.zone,

    TRUE AS controle_qualite_ok,
    NULL::TEXT AS motif_non_conformite,

    COALESCE(u.email, 'Système') AS operateur_reception,
    COALESCE(u.email, 'Système') AS operateur_stockage,

    ms.notes

  FROM public.mouvement_stock ms
  JOIN public.produit p ON p.id = ms.produit_id
  LEFT JOIN public.emplacement e ON e.id = ms.emplacement_id
  LEFT JOIN auth.users u ON u.id = ms.operateur_id
  WHERE p.client_id = p_client_id
  AND DATE(ms.date_mouvement) BETWEEN p_date_debut AND p_date_fin
  AND ms.type_mouvement IN ('entree', 'reception', 'ajustement_positif')
  ORDER BY ms.date_mouvement DESC;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- =====================================================
-- 5. RAPPORT RETOURS
-- =====================================================

CREATE OR REPLACE FUNCTION get_rapport_retours(
  p_client_id UUID,
  p_date_debut DATE,
  p_date_fin DATE
)
RETURNS TABLE (
  -- Retour
  retour_id UUID,
  date_retour TIMESTAMPTZ,

  -- Commande originale
  numero_commande_origine TEXT,
  date_commande_origine TIMESTAMPTZ,

  -- Produit
  produit_sku TEXT,
  produit_nom TEXT,
  quantite_retournee INTEGER,

  -- Motif retour
  motif_retour TEXT,
  etat_produit TEXT, -- 'conforme', 'endommage', 'defectueux'

  -- Traitement
  action_prise TEXT, -- 'remis_en_stock', 'destruction', 'retour_fournisseur'
  remis_en_stock BOOLEAN,
  emplacement_stockage TEXT,

  -- Remboursement
  montant_rembourse DECIMAL,
  date_remboursement DATE,

  -- Client final
  client_final_nom TEXT,

  -- Notes
  notes TEXT
) AS $$
BEGIN
  RETURN QUERY
  SELECT
    ms.id AS retour_id,
    ms.date_mouvement AS date_retour,

    COALESCE(c.numero_commande, 'N/A') AS numero_commande_origine,
    c.date_creation AS date_commande_origine,

    p.sku AS produit_sku,
    p.nom AS produit_nom,
    ABS(ms.quantite) AS quantite_retournee, -- Valeur absolue

    ms.notes AS motif_retour,
    'conforme'::TEXT AS etat_produit, -- À enrichir

    CASE
      WHEN ms.type_mouvement = 'retour' THEN 'remis_en_stock'
      ELSE 'en_attente'
    END AS action_prise,

    (ms.type_mouvement = 'retour') AS remis_en_stock,
    e.code AS emplacement_stockage,

    NULL::DECIMAL AS montant_rembourse,
    NULL::DATE AS date_remboursement,

    COALESCE(c.nom_destinataire, 'N/A') AS client_final_nom,

    ms.notes

  FROM public.mouvement_stock ms
  JOIN public.produit p ON p.id = ms.produit_id
  LEFT JOIN public.commande c ON c.id = (ms.reference_numero::UUID)
  LEFT JOIN public.emplacement e ON e.id = ms.emplacement_id
  WHERE p.client_id = p_client_id
  AND DATE(ms.date_mouvement) BETWEEN p_date_debut AND p_date_fin
  AND (ms.type_mouvement = 'retour' OR ms.reference_type = 'retour')
  ORDER BY ms.date_mouvement DESC;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- =====================================================
-- 6. RAPPORT OPÉRATIONS PICKING / PRÉPARATION
-- =====================================================

CREATE OR REPLACE FUNCTION get_rapport_operations_picking(
  p_client_id UUID,
  p_date_debut DATE,
  p_date_fin DATE
)
RETURNS TABLE (
  -- Opération
  date_operation TIMESTAMPTZ,
  type_operation TEXT, -- 'picking', 'preparation', 'emballage'

  -- Commande
  numero_commande TEXT,

  -- Produit
  produit_sku TEXT,
  produit_nom TEXT,
  quantite INTEGER,

  -- Emplacement
  emplacement_source TEXT,
  zone_picking TEXT,

  -- Opérateur
  operateur_nom TEXT,

  -- Temps de traitement
  temps_picking_minutes INTEGER,

  -- Wave / Batch (si applicable)
  wave_id TEXT,
  batch_id TEXT,

  -- Performance
  nb_erreurs INTEGER,
  taux_precision DECIMAL
) AS $$
BEGIN
  RETURN QUERY
  SELECT
    hsc.created_at AS date_operation,

    CASE
      WHEN hsc.nouveau_statut = 'en_picking' THEN 'picking'
      WHEN hsc.nouveau_statut = 'en_preparation' THEN 'preparation'
      WHEN hsc.nouveau_statut = 'pret_expedition' THEN 'emballage'
      ELSE 'autre'
    END AS type_operation,

    c.numero_commande,

    p.sku AS produit_sku,
    p.nom AS produit_nom,
    lc.quantite,

    -- Emplacement (via mouvement stock si disponible)
    NULL::TEXT AS emplacement_source,
    NULL::TEXT AS zone_picking,

    COALESCE(u.email, 'Système') AS operateur_nom,

    -- Temps de traitement (différence entre statuts)
    EXTRACT(EPOCH FROM (
      LEAD(hsc.created_at) OVER (PARTITION BY hsc.commande_id ORDER BY hsc.created_at) - hsc.created_at
    ) / 60)::INTEGER AS temps_picking_minutes,

    NULL::TEXT AS wave_id,
    NULL::TEXT AS batch_id,

    0 AS nb_erreurs,
    100.0::DECIMAL AS taux_precision

  FROM public.historique_statut_commande hsc
  JOIN public.commande c ON c.id = hsc.commande_id
  JOIN public.ligne_commande lc ON lc.commande_id = c.id
  JOIN public.produit p ON p.id = lc.produit_id
  LEFT JOIN auth.users u ON u.id = hsc.user_id
  WHERE c.client_id = p_client_id
  AND DATE(hsc.created_at) BETWEEN p_date_debut AND p_date_fin
  AND hsc.nouveau_statut IN ('en_picking', 'picking_termine', 'en_preparation', 'pret_expedition')
  ORDER BY hsc.created_at DESC;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- =====================================================
-- 7. RAPPORT SYNTHÈSE ACTIVITÉ MENSUELLE
-- =====================================================

CREATE OR REPLACE FUNCTION get_rapport_synthese_activite(
  p_client_id UUID,
  p_date_debut DATE,
  p_date_fin DATE
)
RETURNS TABLE (
  -- Commandes
  nb_commandes_total INTEGER,
  nb_commandes_livrees INTEGER,
  nb_commandes_en_cours INTEGER,
  nb_lignes_total INTEGER,

  -- Produits
  nb_produits_expedies INTEGER,
  nb_produits_stockes INTEGER,

  -- Stock
  nb_mouvements_entree INTEGER,
  nb_mouvements_sortie INTEGER,
  nb_receptions INTEGER,
  nb_retours INTEGER,

  -- Transport
  nb_colis_expedies INTEGER,
  poids_total_expedie_kg DECIMAL,

  -- Période
  periode_debut DATE,
  periode_fin DATE
) AS $$
BEGIN
  RETURN QUERY
  SELECT
    -- Commandes
    (SELECT COUNT(*) FROM public.commande
     WHERE client_id = p_client_id
     AND DATE(date_creation) BETWEEN p_date_debut AND p_date_fin)::INTEGER,

    (SELECT COUNT(*) FROM public.commande
     WHERE client_id = p_client_id
     AND DATE(date_creation) BETWEEN p_date_debut AND p_date_fin
     AND statut_wms = 'livre')::INTEGER,

    (SELECT COUNT(*) FROM public.commande
     WHERE client_id = p_client_id
     AND DATE(date_creation) BETWEEN p_date_debut AND p_date_fin
     AND statut_wms NOT IN ('livre', 'annule'))::INTEGER,

    (SELECT COUNT(*) FROM public.ligne_commande lc
     JOIN public.commande c ON c.id = lc.commande_id
     WHERE c.client_id = p_client_id
     AND DATE(c.date_creation) BETWEEN p_date_debut AND p_date_fin)::INTEGER,

    -- Produits
    (SELECT COALESCE(SUM(lc.quantite), 0) FROM public.ligne_commande lc
     JOIN public.commande c ON c.id = lc.commande_id
     WHERE c.client_id = p_client_id
     AND DATE(c.date_creation) BETWEEN p_date_debut AND p_date_fin
     AND c.statut_wms IN ('expedie', 'en_transit', 'en_livraison', 'livre'))::INTEGER,

    (SELECT COUNT(*) FROM public.emplacement_stock es
     JOIN public.produit p ON p.id = es.produit_id
     WHERE p.client_id = p_client_id
     AND es.quantite_disponible > 0)::INTEGER,

    -- Mouvements stock
    (SELECT COUNT(*) FROM public.mouvement_stock ms
     JOIN public.produit p ON p.id = ms.produit_id
     WHERE p.client_id = p_client_id
     AND DATE(ms.date_mouvement) BETWEEN p_date_debut AND p_date_fin
     AND ms.type_mouvement IN ('entree', 'reception', 'ajustement_positif'))::INTEGER,

    (SELECT COUNT(*) FROM public.mouvement_stock ms
     JOIN public.produit p ON p.id = ms.produit_id
     WHERE p.client_id = p_client_id
     AND DATE(ms.date_mouvement) BETWEEN p_date_debut AND p_date_fin
     AND ms.type_mouvement IN ('sortie', 'expedition', 'ajustement_negatif'))::INTEGER,

    (SELECT COUNT(DISTINCT ms.reference_numero) FROM public.mouvement_stock ms
     JOIN public.produit p ON p.id = ms.produit_id
     WHERE p.client_id = p_client_id
     AND DATE(ms.date_mouvement) BETWEEN p_date_debut AND p_date_fin
     AND ms.type_mouvement IN ('entree', 'reception'))::INTEGER,

    (SELECT COUNT(*) FROM public.mouvement_stock ms
     JOIN public.produit p ON p.id = ms.produit_id
     WHERE p.client_id = p_client_id
     AND DATE(ms.date_mouvement) BETWEEN p_date_debut AND p_date_fin
     AND ms.type_mouvement = 'retour')::INTEGER,

    -- Transport
    (SELECT COUNT(*) FROM public.commande
     WHERE client_id = p_client_id
     AND DATE(date_creation) BETWEEN p_date_debut AND p_date_fin
     AND statut_wms IN ('expedie', 'en_transit', 'en_livraison', 'livre'))::INTEGER,

    (SELECT COALESCE(SUM(poids_total), 0) FROM public.commande
     WHERE client_id = p_client_id
     AND DATE(date_creation) BETWEEN p_date_debut AND p_date_fin
     AND statut_wms IN ('expedie', 'en_transit', 'en_livraison', 'livre'))::DECIMAL,

    p_date_debut,
    p_date_fin;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- =====================================================
-- 8. Summary
-- =====================================================

DO $$
BEGIN
  RAISE NOTICE '';
  RAISE NOTICE '========================================';
  RAISE NOTICE '  RAPPORTS ACTIVITÉ FACTURATION';
  RAISE NOTICE '========================================';
  RAISE NOTICE 'Fonctions créées:';
  RAISE NOTICE '  ✅ get_rapport_commandes_detaille()';
  RAISE NOTICE '  ✅ get_rapport_transports()';
  RAISE NOTICE '  ✅ get_rapport_mouvements_stock()';
  RAISE NOTICE '  ✅ get_rapport_receptions_stock()';
  RAISE NOTICE '  ✅ get_rapport_retours()';
  RAISE NOTICE '  ✅ get_rapport_operations_picking()';
  RAISE NOTICE '  ✅ get_rapport_synthese_activite()';
  RAISE NOTICE '';
  RAISE NOTICE 'Exports CSV disponibles:';
  RAISE NOTICE '  📊 Commandes détaillées (lignes, dates, statuts)';
  RAISE NOTICE '  🚚 Transports (transporteur, tracking, coûts)';
  RAISE NOTICE '  📦 Mouvements stock (entrées/sorties)';
  RAISE NOTICE '  📥 Réceptions & mise en stock';
  RAISE NOTICE '  🔄 Retours produits';
  RAISE NOTICE '  👷 Opérations picking/préparation';
  RAISE NOTICE '  📈 Synthèse activité mensuelle';
  RAISE NOTICE '';
  RAISE NOTICE 'Usage:';
  RAISE NOTICE '  SELECT * FROM get_rapport_commandes_detaille(';
  RAISE NOTICE '    ''client-uuid'', ''2025-11-01'', ''2025-11-30''';
  RAISE NOTICE '  );';
  RAISE NOTICE '========================================';
  RAISE NOTICE '';
END $$;
