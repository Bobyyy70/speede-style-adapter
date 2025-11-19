-- =====================================================
-- WAVE PICKING - RPC Functions
-- Description: Fonctions de gestion des waves de picking
-- Date: 2025-11-18
-- =====================================================

-- =====================================================
-- 1. creer_wave_picking - Créer une nouvelle wave
-- =====================================================

CREATE OR REPLACE FUNCTION creer_wave_picking(
  p_nom_wave TEXT,
  p_zone_picking TEXT DEFAULT NULL,
  p_priorite INTEGER DEFAULT 1,
  p_type_wave TEXT DEFAULT 'standard',
  p_commande_ids UUID[] DEFAULT NULL
)
RETURNS UUID AS $$
DECLARE
  v_wave_id UUID;
  v_commande_id UUID;
  v_ordre INTEGER := 1;
  v_nb_commandes INTEGER := 0;
  v_nb_lignes INTEGER := 0;
BEGIN
  -- Créer la wave
  INSERT INTO public.wave_picking (
    nom_wave,
    zone_picking,
    priorite,
    type_wave,
    statut,
    created_by
  ) VALUES (
    p_nom_wave,
    p_zone_picking,
    p_priorite,
    p_type_wave,
    'planifie',
    auth.uid()
  ) RETURNING id INTO v_wave_id;

  -- Ajouter les commandes si fournies
  IF p_commande_ids IS NOT NULL AND array_length(p_commande_ids, 1) > 0 THEN
    FOREACH v_commande_id IN ARRAY p_commande_ids
    LOOP
      -- Vérifier que la commande existe et est prête pour picking
      IF EXISTS (
        SELECT 1 FROM public.commande
        WHERE id = v_commande_id
        AND statut_wms IN ('en_attente_preparation', 'planifie')
      ) THEN
        -- Ajouter la commande à la wave
        INSERT INTO public.wave_commande (
          wave_id,
          commande_id,
          ordre_picking,
          statut_picking
        ) VALUES (
          v_wave_id,
          v_commande_id,
          v_ordre,
          'en_attente'
        );

        -- Compter les lignes de la commande
        SELECT COUNT(*)
        INTO v_nb_lignes
        FROM public.ligne_commande
        WHERE commande_id = v_commande_id;

        v_nb_commandes := v_nb_commandes + 1;
        v_ordre := v_ordre + 1;
      END IF;
    END LOOP;

    -- Mettre à jour les métriques de la wave
    UPDATE public.wave_picking
    SET
      nombre_commandes = v_nb_commandes,
      nombre_lignes_total = (
        SELECT COUNT(*)
        FROM public.wave_commande wc
        JOIN public.ligne_commande lc ON lc.commande_id = wc.commande_id
        WHERE wc.wave_id = v_wave_id
      ),
      nombre_articles_total = (
        SELECT COALESCE(SUM(lc.quantite), 0)
        FROM public.wave_commande wc
        JOIN public.ligne_commande lc ON lc.commande_id = wc.commande_id
        WHERE wc.wave_id = v_wave_id
      )
    WHERE id = v_wave_id;
  END IF;

  RETURN v_wave_id;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- =====================================================
-- 2. ajouter_commandes_wave - Ajouter des commandes à une wave existante
-- =====================================================

CREATE OR REPLACE FUNCTION ajouter_commandes_wave(
  p_wave_id UUID,
  p_commande_ids UUID[]
)
RETURNS TABLE (
  commande_id UUID,
  success BOOLEAN,
  message TEXT
) AS $$
DECLARE
  v_commande_id UUID;
  v_ordre INTEGER;
  v_statut_wave TEXT;
BEGIN
  -- Vérifier que la wave existe et est modifiable
  SELECT statut INTO v_statut_wave
  FROM public.wave_picking
  WHERE id = p_wave_id;

  IF v_statut_wave IS NULL THEN
    RETURN QUERY SELECT NULL::UUID, FALSE, 'Wave inexistante';
    RETURN;
  END IF;

  IF v_statut_wave NOT IN ('planifie', 'en_cours') THEN
    RETURN QUERY SELECT NULL::UUID, FALSE, 'Wave non modifiable (statut: ' || v_statut_wave || ')';
    RETURN;
  END IF;

  -- Obtenir le prochain ordre
  SELECT COALESCE(MAX(ordre_picking), 0) + 1
  INTO v_ordre
  FROM public.wave_commande
  WHERE wave_id = p_wave_id;

  -- Ajouter chaque commande
  FOREACH v_commande_id IN ARRAY p_commande_ids
  LOOP
    -- Vérifier que la commande n'est pas déjà dans la wave
    IF EXISTS (
      SELECT 1 FROM public.wave_commande
      WHERE wave_id = p_wave_id AND commande_id = v_commande_id
    ) THEN
      RETURN QUERY SELECT v_commande_id, FALSE, 'Commande déjà dans la wave'::TEXT;
      CONTINUE;
    END IF;

    -- Vérifier le statut de la commande
    IF NOT EXISTS (
      SELECT 1 FROM public.commande
      WHERE id = v_commande_id
      AND statut_wms IN ('en_attente_preparation', 'planifie')
    ) THEN
      RETURN QUERY SELECT v_commande_id, FALSE, 'Statut commande incompatible'::TEXT;
      CONTINUE;
    END IF;

    -- Ajouter la commande
    INSERT INTO public.wave_commande (
      wave_id,
      commande_id,
      ordre_picking,
      statut_picking
    ) VALUES (
      p_wave_id,
      v_commande_id,
      v_ordre,
      'en_attente'
    );

    v_ordre := v_ordre + 1;

    RETURN QUERY SELECT v_commande_id, TRUE, 'Commande ajoutée avec succès'::TEXT;
  END LOOP;

  -- Mettre à jour les métriques de la wave
  PERFORM mettre_a_jour_metriques_wave(p_wave_id);
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- =====================================================
-- 3. mettre_a_jour_metriques_wave - Helper pour recalculer les métriques
-- =====================================================

CREATE OR REPLACE FUNCTION mettre_a_jour_metriques_wave(p_wave_id UUID)
RETURNS void AS $$
BEGIN
  UPDATE public.wave_picking
  SET
    nombre_commandes = (
      SELECT COUNT(*) FROM public.wave_commande WHERE wave_id = p_wave_id
    ),
    nombre_lignes_total = (
      SELECT COUNT(*)
      FROM public.wave_commande wc
      JOIN public.ligne_commande lc ON lc.commande_id = wc.commande_id
      WHERE wc.wave_id = p_wave_id
    ),
    nombre_articles_total = (
      SELECT COALESCE(SUM(lc.quantite), 0)
      FROM public.wave_commande wc
      JOIN public.ligne_commande lc ON lc.commande_id = wc.commande_id
      WHERE wc.wave_id = p_wave_id
    ),
    taux_completion = (
      SELECT
        CASE
          WHEN COUNT(*) > 0
          THEN ROUND(100.0 * COUNT(CASE WHEN statut_picking = 'termine' THEN 1 END) / COUNT(*), 2)
          ELSE 0
        END
      FROM public.wave_commande
      WHERE wave_id = p_wave_id
    )
  WHERE id = p_wave_id;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- =====================================================
-- 4. assigner_operateur_wave - Assigner un opérateur
-- =====================================================

CREATE OR REPLACE FUNCTION assigner_operateur_wave(
  p_wave_id UUID,
  p_operateur_id UUID
)
RETURNS BOOLEAN AS $$
DECLARE
  v_statut_wave TEXT;
BEGIN
  -- Vérifier que la wave existe
  SELECT statut INTO v_statut_wave
  FROM public.wave_picking
  WHERE id = p_wave_id;

  IF v_statut_wave IS NULL THEN
    RAISE EXCEPTION 'Wave inexistante';
  END IF;

  -- Vérifier que l'opérateur existe et a le bon rôle
  IF NOT EXISTS (
    SELECT 1 FROM public.user_roles
    WHERE user_id = p_operateur_id
    AND role IN ('operateur', 'gestionnaire', 'admin')
  ) THEN
    RAISE EXCEPTION 'Utilisateur inexistant ou rôle incompatible';
  END IF;

  -- Assigner l'opérateur
  UPDATE public.wave_picking
  SET
    operateur_assigne = p_operateur_id,
    date_assignation = now()
  WHERE id = p_wave_id;

  RETURN TRUE;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- =====================================================
-- 5. demarrer_wave_picking - Démarrer le picking d'une wave
-- =====================================================

CREATE OR REPLACE FUNCTION demarrer_wave_picking(p_wave_id UUID)
RETURNS BOOLEAN AS $$
DECLARE
  v_statut_wave TEXT;
BEGIN
  -- Vérifier que la wave existe et est planifiée
  SELECT statut INTO v_statut_wave
  FROM public.wave_picking
  WHERE id = p_wave_id;

  IF v_statut_wave IS NULL THEN
    RAISE EXCEPTION 'Wave inexistante';
  END IF;

  IF v_statut_wave != 'planifie' THEN
    RAISE EXCEPTION 'Wave déjà démarrée ou terminée (statut: %)', v_statut_wave;
  END IF;

  -- Vérifier qu'un opérateur est assigné
  IF NOT EXISTS (
    SELECT 1 FROM public.wave_picking
    WHERE id = p_wave_id AND operateur_assigne IS NOT NULL
  ) THEN
    RAISE EXCEPTION 'Aucun opérateur assigné à cette wave';
  END IF;

  -- Démarrer la wave
  UPDATE public.wave_picking
  SET
    statut = 'en_cours',
    date_debut_picking = now()
  WHERE id = p_wave_id;

  -- Créer les lignes de picking détaillées
  INSERT INTO public.wave_ligne_picking (
    wave_commande_id,
    ligne_commande_id,
    produit_id,
    emplacement_id,
    zone_picking,
    quantite_a_picker,
    statut,
    ordre_dans_route
  )
  SELECT
    wc.id,
    lc.id,
    lc.produit_id,
    e.id AS emplacement_id,
    e.zone,
    lc.quantite,
    'en_attente',
    ROW_NUMBER() OVER (ORDER BY e.zone, e.allee, e.travee, e.niveau)
  FROM public.wave_commande wc
  JOIN public.ligne_commande lc ON lc.commande_id = wc.commande_id
  LEFT JOIN LATERAL (
    -- Trouver le meilleur emplacement pour ce produit
    SELECT em.id, em.zone, em.allee, em.travee, em.niveau
    FROM public.emplacement em
    JOIN public.emplacement_stock es ON es.emplacement_id = em.id
    WHERE es.produit_id = lc.produit_id
    AND es.quantite_disponible >= lc.quantite
    ORDER BY em.zone, em.allee, em.travee, em.niveau
    LIMIT 1
  ) e ON true
  WHERE wc.wave_id = p_wave_id
  ON CONFLICT (wave_commande_id, ligne_commande_id) DO NOTHING;

  RETURN TRUE;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- =====================================================
-- 6. finaliser_wave_picking - Finaliser une wave
-- =====================================================

CREATE OR REPLACE FUNCTION finaliser_wave_picking(p_wave_id UUID)
RETURNS BOOLEAN AS $$
DECLARE
  v_statut_wave TEXT;
  v_nb_lignes_total INTEGER;
  v_nb_lignes_terminees INTEGER;
BEGIN
  -- Vérifier que la wave existe et est en cours
  SELECT statut INTO v_statut_wave
  FROM public.wave_picking
  WHERE id = p_wave_id;

  IF v_statut_wave IS NULL THEN
    RAISE EXCEPTION 'Wave inexistante';
  END IF;

  IF v_statut_wave != 'en_cours' THEN
    RAISE EXCEPTION 'Wave non en cours (statut: %)', v_statut_wave;
  END IF;

  -- Compter les lignes
  SELECT
    COUNT(*),
    COUNT(CASE WHEN statut = 'termine' THEN 1 END)
  INTO v_nb_lignes_total, v_nb_lignes_terminees
  FROM public.wave_ligne_picking wlp
  JOIN public.wave_commande wc ON wc.id = wlp.wave_commande_id
  WHERE wc.wave_id = p_wave_id;

  -- Vérifier que toutes les lignes sont terminées
  IF v_nb_lignes_terminees < v_nb_lignes_total THEN
    RAISE EXCEPTION 'Toutes les lignes ne sont pas terminées (% / %)', v_nb_lignes_terminees, v_nb_lignes_total;
  END IF;

  -- Finaliser la wave
  UPDATE public.wave_picking
  SET
    statut = 'termine',
    date_fin_picking = now(),
    taux_completion = 100.0
  WHERE id = p_wave_id;

  -- Mettre à jour le statut des commandes
  UPDATE public.wave_commande
  SET statut_picking = 'termine'
  WHERE wave_id = p_wave_id;

  -- Rafraîchir les stats
  PERFORM refresh_wave_picking_stats();

  RETURN TRUE;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- =====================================================
-- 7. optimiser_route_wave - Optimiser l'ordre de picking
-- =====================================================

CREATE OR REPLACE FUNCTION optimiser_route_wave(p_wave_id UUID)
RETURNS INTEGER AS $$
DECLARE
  v_nb_lignes_optimisees INTEGER := 0;
BEGIN
  -- Réorganiser les lignes par zone optimale
  WITH ranked_lines AS (
    SELECT
      wlp.id,
      ROW_NUMBER() OVER (
        ORDER BY
          COALESCE(e.zone, 'ZZZ'),
          COALESCE(e.allee, 'ZZZ'),
          COALESCE(e.travee, 'ZZZ'),
          COALESCE(e.niveau, 999)
      ) AS new_order
    FROM public.wave_ligne_picking wlp
    JOIN public.wave_commande wc ON wc.id = wlp.wave_commande_id
    LEFT JOIN public.emplacement e ON e.id = wlp.emplacement_id
    WHERE wc.wave_id = p_wave_id
    AND wlp.statut = 'en_attente'
  )
  UPDATE public.wave_ligne_picking wlp
  SET ordre_dans_route = rl.new_order
  FROM ranked_lines rl
  WHERE wlp.id = rl.id;

  GET DIAGNOSTICS v_nb_lignes_optimisees = ROW_COUNT;

  RETURN v_nb_lignes_optimisees;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- =====================================================
-- 8. annuler_wave_picking - Annuler une wave
-- =====================================================

CREATE OR REPLACE FUNCTION annuler_wave_picking(
  p_wave_id UUID,
  p_raison TEXT DEFAULT NULL
)
RETURNS BOOLEAN AS $$
DECLARE
  v_statut_wave TEXT;
BEGIN
  -- Vérifier que la wave existe
  SELECT statut INTO v_statut_wave
  FROM public.wave_picking
  WHERE id = p_wave_id;

  IF v_statut_wave IS NULL THEN
    RAISE EXCEPTION 'Wave inexistante';
  END IF;

  IF v_statut_wave = 'termine' THEN
    RAISE EXCEPTION 'Impossible d''annuler une wave terminée';
  END IF;

  -- Annuler la wave
  UPDATE public.wave_picking
  SET statut = 'annule'
  WHERE id = p_wave_id;

  -- Mettre à jour le statut des commandes
  UPDATE public.wave_commande
  SET statut_picking = 'annule'
  WHERE wave_id = p_wave_id;

  RETURN TRUE;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- =====================================================
-- 9. get_wave_picking_details - Récupérer les détails d'une wave
-- =====================================================

CREATE OR REPLACE FUNCTION get_wave_picking_details(p_wave_id UUID)
RETURNS TABLE (
  wave_info JSONB,
  commandes JSONB,
  lignes_picking JSONB,
  statistiques JSONB
) AS $$
BEGIN
  RETURN QUERY
  SELECT
    -- Info wave
    to_jsonb(w.*) AS wave_info,

    -- Commandes
    (
      SELECT jsonb_agg(to_jsonb(wc.*))
      FROM public.wave_commande wc
      WHERE wc.wave_id = p_wave_id
    ) AS commandes,

    -- Lignes picking
    (
      SELECT jsonb_agg(
        jsonb_build_object(
          'id', wlp.id,
          'produit_id', wlp.produit_id,
          'emplacement_id', wlp.emplacement_id,
          'zone_picking', wlp.zone_picking,
          'quantite_a_picker', wlp.quantite_a_picker,
          'quantite_pickee', wlp.quantite_pickee,
          'statut', wlp.statut,
          'ordre_dans_route', wlp.ordre_dans_route
        )
      )
      FROM public.wave_ligne_picking wlp
      JOIN public.wave_commande wc ON wc.id = wlp.wave_commande_id
      WHERE wc.wave_id = p_wave_id
      ORDER BY wlp.ordre_dans_route
    ) AS lignes_picking,

    -- Statistiques
    (
      SELECT to_jsonb(wps.*)
      FROM public.wave_picking_stats wps
      WHERE wps.wave_id = p_wave_id
    ) AS statistiques

  FROM public.wave_picking w
  WHERE w.id = p_wave_id;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- =====================================================
-- 10. Summary
-- =====================================================

DO $$
BEGIN
  RAISE NOTICE '';
  RAISE NOTICE '========================================';
  RAISE NOTICE '  WAVE PICKING - RPC FUNCTIONS';
  RAISE NOTICE '========================================';
  RAISE NOTICE 'Fonctions créées:';
  RAISE NOTICE '  ✅ creer_wave_picking()';
  RAISE NOTICE '  ✅ ajouter_commandes_wave()';
  RAISE NOTICE '  ✅ mettre_a_jour_metriques_wave()';
  RAISE NOTICE '  ✅ assigner_operateur_wave()';
  RAISE NOTICE '  ✅ demarrer_wave_picking()';
  RAISE NOTICE '  ✅ finaliser_wave_picking()';
  RAISE NOTICE '  ✅ optimiser_route_wave()';
  RAISE NOTICE '  ✅ annuler_wave_picking()';
  RAISE NOTICE '  ✅ get_wave_picking_details()';
  RAISE NOTICE '';
  RAISE NOTICE 'Workflow complet:';
  RAISE NOTICE '  1. Créer wave + ajouter commandes';
  RAISE NOTICE '  2. Optimiser route automatique';
  RAISE NOTICE '  3. Assigner opérateur';
  RAISE NOTICE '  4. Démarrer picking';
  RAISE NOTICE '  5. Finaliser wave';
  RAISE NOTICE '========================================';
  RAISE NOTICE '';
END $$;
