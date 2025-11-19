-- =====================================================
-- BATCH PICKING - RPC Functions & Route Optimization
-- Description: Algorithmes d'optimisation de routes de picking
-- Date: 2025-11-18
-- =====================================================

-- =====================================================
-- 1. creer_batch_picking - Créer un nouveau batch
-- =====================================================

CREATE OR REPLACE FUNCTION creer_batch_picking(
  p_nom_batch TEXT,
  p_mode_batch TEXT DEFAULT 'multi_commande',
  p_max_commandes INTEGER DEFAULT 10,
  p_zone_cible TEXT DEFAULT NULL,
  p_commande_ids UUID[] DEFAULT NULL
)
RETURNS UUID AS $$
DECLARE
  v_batch_id UUID;
  v_commande_id UUID;
  v_ordre INTEGER := 1;
BEGIN
  -- Créer le batch
  INSERT INTO public.batch_picking (
    nom_batch,
    mode_batch,
    max_commandes,
    zone_cible,
    statut,
    created_by
  ) VALUES (
    p_nom_batch,
    p_mode_batch,
    p_max_commandes,
    p_zone_cible,
    'planifie',
    auth.uid()
  ) RETURNING id INTO v_batch_id;

  -- Ajouter les commandes si fournies
  IF p_commande_ids IS NOT NULL AND array_length(p_commande_ids, 1) > 0 THEN
    FOREACH v_commande_id IN ARRAY p_commande_ids
    LOOP
      IF EXISTS (
        SELECT 1 FROM public.commande
        WHERE id = v_commande_id
        AND statut_wms IN ('en_attente_preparation', 'planifie')
      ) THEN
        INSERT INTO public.batch_commande (
          batch_id,
          commande_id,
          ordre_traitement,
          statut
        ) VALUES (
          v_batch_id,
          v_commande_id,
          v_ordre,
          'en_attente'
        );

        v_ordre := v_ordre + 1;
      END IF;
    END LOOP;

    -- Consolider les items (regrouper les mêmes produits)
    PERFORM consolider_batch_items(v_batch_id);

    -- Optimiser la route
    PERFORM optimiser_route_batch(v_batch_id);

    -- Mettre à jour les métriques
    PERFORM mettre_a_jour_metriques_batch(v_batch_id);
  END IF;

  RETURN v_batch_id;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- =====================================================
-- 2. consolider_batch_items - Consolider les produits
-- =====================================================

CREATE OR REPLACE FUNCTION consolider_batch_items(p_batch_id UUID)
RETURNS INTEGER AS $$
DECLARE
  v_nb_items INTEGER := 0;
BEGIN
  -- Supprimer les anciens items
  DELETE FROM public.batch_item WHERE batch_id = p_batch_id;

  -- Créer les items consolidés
  INSERT INTO public.batch_item (
    batch_id,
    produit_id,
    emplacement_id,
    zone,
    allee,
    travee,
    niveau,
    quantite_totale_a_picker,
    affectations,
    statut,
    ordre_route
  )
  SELECT
    p_batch_id,
    lc.produit_id,
    e.id AS emplacement_id,
    e.zone,
    e.allee,
    e.travee,
    e.niveau,
    SUM(lc.quantite) AS quantite_totale,
    jsonb_agg(
      jsonb_build_object(
        'commande_id', bc.commande_id,
        'quantite', lc.quantite
      )
    ) AS affectations,
    'en_attente'::TEXT,
    0 -- Sera défini par optimiser_route_batch
  FROM public.batch_commande bc
  JOIN public.ligne_commande lc ON lc.commande_id = bc.commande_id
  LEFT JOIN LATERAL (
    -- Trouver le meilleur emplacement pour ce produit
    SELECT em.id, em.zone, em.allee, em.travee, em.niveau
    FROM public.emplacement em
    JOIN public.emplacement_stock es ON es.emplacement_id = em.id
    WHERE es.produit_id = lc.produit_id
    AND es.quantite_disponible >= SUM(lc.quantite) OVER (PARTITION BY lc.produit_id)
    ORDER BY em.zone, em.allee, em.travee, em.niveau
    LIMIT 1
  ) e ON true
  WHERE bc.batch_id = p_batch_id
  GROUP BY
    lc.produit_id,
    e.id,
    e.zone,
    e.allee,
    e.travee,
    e.niveau;

  GET DIAGNOSTICS v_nb_items = ROW_COUNT;

  RETURN v_nb_items;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- =====================================================
-- 3. optimiser_route_batch - Algorithme Nearest Neighbor
-- =====================================================

CREATE OR REPLACE FUNCTION optimiser_route_batch(p_batch_id UUID)
RETURNS JSONB AS $$
DECLARE
  v_route JSONB := '[]'::JSONB;
  v_current_location RECORD;
  v_next_location RECORD;
  v_visited UUID[] := ARRAY[]::UUID[];
  v_ordre INTEGER := 1;
  v_distance_totale DECIMAL := 0;
  v_nb_items INTEGER;
BEGIN
  -- Compter les items
  SELECT COUNT(*) INTO v_nb_items
  FROM public.batch_item
  WHERE batch_id = p_batch_id
  AND emplacement_id IS NOT NULL;

  IF v_nb_items = 0 THEN
    RETURN '[]'::JSONB;
  END IF;

  -- Point de départ: premier emplacement (zone A, allée 1)
  SELECT * INTO v_current_location
  FROM public.batch_item
  WHERE batch_id = p_batch_id
  AND emplacement_id IS NOT NULL
  ORDER BY
    COALESCE(zone, 'ZZZ'),
    COALESCE(allee, 'ZZZ'),
    COALESCE(travee, 'ZZZ'),
    COALESCE(niveau, 999)
  LIMIT 1;

  -- Marquer comme visité et ajouter à la route
  v_visited := array_append(v_visited, v_current_location.emplacement_id);

  UPDATE public.batch_item
  SET ordre_route = v_ordre
  WHERE id = v_current_location.id;

  v_route := v_route || jsonb_build_object(
    'emplacement_id', v_current_location.emplacement_id,
    'zone', v_current_location.zone,
    'allee', v_current_location.allee,
    'travee', v_current_location.travee,
    'niveau', v_current_location.niveau,
    'ordre', v_ordre,
    'produit_id', v_current_location.produit_id,
    'quantite', v_current_location.quantite_totale_a_picker
  );

  v_ordre := v_ordre + 1;

  -- Algorithme Nearest Neighbor
  WHILE array_length(v_visited, 1) < v_nb_items LOOP
    -- Trouver le prochain emplacement le plus proche
    SELECT bi.* INTO v_next_location
    FROM public.batch_item bi
    WHERE bi.batch_id = p_batch_id
    AND bi.emplacement_id IS NOT NULL
    AND bi.emplacement_id <> ALL(v_visited)
    ORDER BY
      -- Distance simplifiée (lexicographique: zone -> allee -> travee -> niveau)
      ABS((COALESCE(bi.zone, 'ZZZ'))::TEXT <> (v_current_location.zone)::TEXT)::INT,
      ABS(COALESCE(bi.allee, '999') <> v_current_location.allee)::INT,
      ABS(COALESCE(bi.travee, '999') <> v_current_location.travee)::INT,
      ABS(COALESCE(bi.niveau, 999) - v_current_location.niveau)
    LIMIT 1;

    EXIT WHEN v_next_location.id IS NULL;

    -- Marquer comme visité
    v_visited := array_append(v_visited, v_next_location.emplacement_id);

    -- Mettre à jour l'ordre
    UPDATE public.batch_item
    SET ordre_route = v_ordre
    WHERE id = v_next_location.id;

    -- Ajouter à la route
    v_route := v_route || jsonb_build_object(
      'emplacement_id', v_next_location.emplacement_id,
      'zone', v_next_location.zone,
      'allee', v_next_location.allee,
      'travee', v_next_location.travee,
      'niveau', v_next_location.niveau,
      'ordre', v_ordre,
      'produit_id', v_next_location.produit_id,
      'quantite', v_next_location.quantite_totale_a_picker
    );

    -- Calculer distance (simplifiée)
    v_distance_totale := v_distance_totale +
      ABS(COALESCE(v_next_location.niveau, 0) - COALESCE(v_current_location.niveau, 0)) * 0.5;

    v_current_location := v_next_location;
    v_ordre := v_ordre + 1;
  END LOOP;

  -- Sauvegarder la route optimisée
  UPDATE public.batch_picking
  SET
    route_optimisee = v_route,
    distance_estimee = v_distance_totale
  WHERE id = p_batch_id;

  RETURN v_route;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- =====================================================
-- 4. mettre_a_jour_metriques_batch - Helper métriques
-- =====================================================

CREATE OR REPLACE FUNCTION mettre_a_jour_metriques_batch(p_batch_id UUID)
RETURNS void AS $$
BEGIN
  UPDATE public.batch_picking
  SET
    nb_commandes = (
      SELECT COUNT(*) FROM public.batch_commande WHERE batch_id = p_batch_id
    ),
    nb_produits_distincts = (
      SELECT COUNT(*) FROM public.batch_item WHERE batch_id = p_batch_id
    ),
    quantite_totale = (
      SELECT COALESCE(SUM(quantite_totale_a_picker), 0)
      FROM public.batch_item WHERE batch_id = p_batch_id
    ),
    taux_completion = (
      SELECT
        CASE
          WHEN COUNT(*) > 0
          THEN ROUND(100.0 * COUNT(CASE WHEN statut = 'termine' THEN 1 END) / COUNT(*), 2)
          ELSE 0
        END
      FROM public.batch_item
      WHERE batch_id = p_batch_id
    )
  WHERE id = p_batch_id;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- =====================================================
-- 5. demarrer_batch_picking - Démarrer le picking
-- =====================================================

CREATE OR REPLACE FUNCTION demarrer_batch_picking(
  p_batch_id UUID,
  p_operateur_id UUID DEFAULT NULL
)
RETURNS BOOLEAN AS $$
DECLARE
  v_statut_batch TEXT;
  v_nb_items INTEGER;
BEGIN
  -- Vérifier que le batch existe
  SELECT statut INTO v_statut_batch
  FROM public.batch_picking
  WHERE id = p_batch_id;

  IF v_statut_batch IS NULL THEN
    RAISE EXCEPTION 'Batch inexistant';
  END IF;

  IF v_statut_batch != 'planifie' THEN
    RAISE EXCEPTION 'Batch déjà démarré ou terminé (statut: %)', v_statut_batch;
  END IF;

  -- Vérifier qu'il y a des items
  SELECT COUNT(*) INTO v_nb_items
  FROM public.batch_item
  WHERE batch_id = p_batch_id;

  IF v_nb_items = 0 THEN
    RAISE EXCEPTION 'Aucun item à picker dans ce batch';
  END IF;

  -- Générer les contenants pour chaque commande
  INSERT INTO public.batch_container (
    batch_id,
    commande_id,
    code_container,
    type_container,
    position_tri,
    statut
  )
  SELECT
    p_batch_id,
    bc.commande_id,
    'CONT-' || LEFT(bc.commande_id::TEXT, 8),
    'bac',
    bc.ordre_traitement,
    'actif'
  FROM public.batch_commande bc
  WHERE bc.batch_id = p_batch_id
  ON CONFLICT (batch_id, commande_id) DO NOTHING;

  -- Démarrer le batch
  UPDATE public.batch_picking
  SET
    statut = 'en_cours',
    date_debut = now(),
    operateur_id = COALESCE(p_operateur_id, operateur_id, auth.uid())
  WHERE id = p_batch_id;

  RETURN TRUE;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- =====================================================
-- 6. finaliser_batch_picking - Finaliser le picking
-- =====================================================

CREATE OR REPLACE FUNCTION finaliser_batch_picking(p_batch_id UUID)
RETURNS BOOLEAN AS $$
DECLARE
  v_statut_batch TEXT;
  v_nb_items_total INTEGER;
  v_nb_items_termines INTEGER;
BEGIN
  -- Vérifier que le batch existe et est en cours
  SELECT statut INTO v_statut_batch
  FROM public.batch_picking
  WHERE id = p_batch_id;

  IF v_statut_batch IS NULL THEN
    RAISE EXCEPTION 'Batch inexistant';
  END IF;

  IF v_statut_batch != 'en_cours' THEN
    RAISE EXCEPTION 'Batch non en cours (statut: %)', v_statut_batch;
  END IF;

  -- Compter les items
  SELECT
    COUNT(*),
    COUNT(CASE WHEN statut = 'termine' THEN 1 END)
  INTO v_nb_items_total, v_nb_items_termines
  FROM public.batch_item
  WHERE batch_id = p_batch_id;

  -- Vérifier que tous les items sont terminés
  IF v_nb_items_termines < v_nb_items_total THEN
    RAISE EXCEPTION 'Tous les items ne sont pas terminés (% / %)', v_nb_items_termines, v_nb_items_total;
  END IF;

  -- Calculer l'efficacité
  UPDATE public.batch_picking bp
  SET
    statut = 'termine',
    date_fin = now(),
    taux_completion = 100.0,
    efficacite_picking = (
      CASE
        WHEN EXTRACT(EPOCH FROM (now() - bp.date_debut)) / 60 > 0
        THEN ROUND(
          bp.quantite_totale::DECIMAL /
          (EXTRACT(EPOCH FROM (now() - bp.date_debut)) / 60),
          2
        )
        ELSE NULL
      END
    )
  WHERE id = p_batch_id;

  -- Mettre à jour le statut des commandes
  UPDATE public.batch_commande
  SET statut = 'termine'
  WHERE batch_id = p_batch_id;

  -- Rafraîchir les stats
  PERFORM refresh_batch_picking_stats();

  RETURN TRUE;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- =====================================================
-- 7. get_batch_picking_route - Obtenir la route optimisée
-- =====================================================

CREATE OR REPLACE FUNCTION get_batch_picking_route(p_batch_id UUID)
RETURNS TABLE (
  ordre INTEGER,
  emplacement_id UUID,
  zone TEXT,
  allee TEXT,
  travee TEXT,
  niveau TEXT,
  produit_id UUID,
  produit_nom TEXT,
  produit_sku TEXT,
  quantite_a_picker INTEGER,
  affectations JSONB,
  statut TEXT
) AS $$
BEGIN
  RETURN QUERY
  SELECT
    bi.ordre_route,
    bi.emplacement_id,
    bi.zone,
    bi.allee,
    bi.travee,
    bi.niveau,
    bi.produit_id,
    p.nom_produit,
    p.sku,
    bi.quantite_totale_a_picker,
    bi.affectations,
    bi.statut
  FROM public.batch_item bi
  JOIN public.produit p ON p.id = bi.produit_id
  WHERE bi.batch_id = p_batch_id
  ORDER BY bi.ordre_route;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- =====================================================
-- 8. update_batch_item_picked - Marquer un item comme pické
-- =====================================================

CREATE OR REPLACE FUNCTION update_batch_item_picked(
  p_batch_id UUID,
  p_produit_id UUID,
  p_quantite_pickee INTEGER
)
RETURNS BOOLEAN AS $$
BEGIN
  UPDATE public.batch_item
  SET
    quantite_pickee = p_quantite_pickee,
    statut = CASE
      WHEN p_quantite_pickee >= quantite_totale_a_picker THEN 'termine'
      WHEN p_quantite_pickee > 0 THEN 'en_cours'
      ELSE statut
    END,
    date_picking = now()
  WHERE batch_id = p_batch_id
  AND produit_id = p_produit_id;

  -- Mettre à jour les métriques
  PERFORM mettre_a_jour_metriques_batch(p_batch_id);

  RETURN TRUE;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- =====================================================
-- 9. Summary
-- =====================================================

DO $$
BEGIN
  RAISE NOTICE '';
  RAISE NOTICE '========================================';
  RAISE NOTICE '  BATCH PICKING - RPC FUNCTIONS';
  RAISE NOTICE '========================================';
  RAISE NOTICE 'Fonctions créées:';
  RAISE NOTICE '  ✅ creer_batch_picking()';
  RAISE NOTICE '  ✅ consolider_batch_items()';
  RAISE NOTICE '  ✅ optimiser_route_batch() (Nearest Neighbor)';
  RAISE NOTICE '  ✅ mettre_a_jour_metriques_batch()';
  RAISE NOTICE '  ✅ demarrer_batch_picking()';
  RAISE NOTICE '  ✅ finaliser_batch_picking()';
  RAISE NOTICE '  ✅ get_batch_picking_route()';
  RAISE NOTICE '  ✅ update_batch_item_picked()';
  RAISE NOTICE '';
  RAISE NOTICE 'Optimisations:';
  RAISE NOTICE '  • Consolidation automatique produits';
  RAISE NOTICE '  • Route optimisée (Nearest Neighbor)';
  RAISE NOTICE '  • Distance estimée calculée';
  RAISE NOTICE '  • Contenants automatiques';
  RAISE NOTICE '  • Tracking performance temps réel';
  RAISE NOTICE '';
  RAISE NOTICE 'Workflow:';
  RAISE NOTICE '  1. Créer batch + ajouter commandes';
  RAISE NOTICE '  2. Consolider items automatique';
  RAISE NOTICE '  3. Optimiser route automatique';
  RAISE NOTICE '  4. Démarrer picking';
  RAISE NOTICE '  5. Picker selon route optimisée';
  RAISE NOTICE '  6. Trier dans contenants';
  RAISE NOTICE '  7. Finaliser batch';
  RAISE NOTICE '========================================';
  RAISE NOTICE '';
END $$;
