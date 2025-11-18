-- =====================================================
-- PUTAWAY MANAGEMENT - RPC Functions & CRON Job
-- Description: Calcul vélocité, ABC analysis, suggestions
-- Date: 2025-11-18
-- =====================================================

-- =====================================================
-- 1. calculer_velocity_produits - Calcul des vélocités
-- =====================================================

CREATE OR REPLACE FUNCTION calculer_velocity_produits(p_nb_jours INTEGER DEFAULT 30)
RETURNS INTEGER AS $$
DECLARE
  v_nb_produits INTEGER := 0;
  v_date_debut DATE := CURRENT_DATE - p_nb_jours;
BEGIN
  -- Supprimer les anciennes données
  TRUNCATE TABLE public.produit_velocity_score;

  -- Calculer les vélocités pour tous les produits
  INSERT INTO public.produit_velocity_score (
    produit_id,
    velocity_score,
    total_commandes,
    total_lignes,
    quantite_totale_vendue,
    nb_jours_analyse,
    picks_per_day,
    jours_avec_picking,
    date_calcul
  )
  SELECT
    p.id AS produit_id,
    ROUND(
      COALESCE(SUM(lc.quantite), 0)::DECIMAL / NULLIF(p_nb_jours, 0),
      2
    ) AS velocity_score,
    COUNT(DISTINCT c.id) AS total_commandes,
    COUNT(lc.id) AS total_lignes,
    COALESCE(SUM(lc.quantite), 0) AS quantite_totale_vendue,
    p_nb_jours,
    ROUND(
      COUNT(lc.id)::DECIMAL / NULLIF(p_nb_jours, 0),
      2
    ) AS picks_per_day,
    COUNT(DISTINCT DATE(c.date_creation)) AS jours_avec_picking,
    now()
  FROM public.produit p
  LEFT JOIN public.ligne_commande lc ON lc.produit_id = p.id
  LEFT JOIN public.commande c ON c.id = lc.commande_id
    AND c.date_creation >= v_date_debut
    AND c.statut_wms IN ('en_preparation', 'prepare', 'pret_expedition', 'expedie', 'livre')
  GROUP BY p.id;

  GET DIAGNOSTICS v_nb_produits = ROW_COUNT;

  -- Calculer le ranking
  WITH ranked_products AS (
    SELECT
      produit_id,
      ROW_NUMBER() OVER (ORDER BY velocity_score DESC) AS rank
    FROM public.produit_velocity_score
  )
  UPDATE public.produit_velocity_score pvs
  SET velocity_rank = rp.rank
  FROM ranked_products rp
  WHERE pvs.produit_id = rp.produit_id;

  -- Appliquer ABC Analysis
  PERFORM appliquer_abc_analysis();

  -- Suggérer zones optimales
  PERFORM suggerer_zones_optimales();

  -- Rafraîchir stats
  PERFORM refresh_putaway_stats();

  RETURN v_nb_produits;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- =====================================================
-- 2. appliquer_abc_analysis - Catégorisation ABC
-- =====================================================

CREATE OR REPLACE FUNCTION appliquer_abc_analysis()
RETURNS void AS $$
DECLARE
  v_total_produits INTEGER;
  v_seuil_a INTEGER; -- Top 20%
  v_seuil_b INTEGER; -- Top 50% (20% + 30%)
BEGIN
  SELECT COUNT(*) INTO v_total_produits
  FROM public.produit_velocity_score;

  v_seuil_a := CEIL(v_total_produits * 0.20); -- 20%
  v_seuil_b := CEIL(v_total_produits * 0.50); -- 50%

  -- Catégorie A: Top 20% (fast-moving)
  UPDATE public.produit_velocity_score
  SET abc_category = 'A'
  WHERE velocity_rank <= v_seuil_a;

  -- Catégorie B: 30% suivants (medium-moving)
  UPDATE public.produit_velocity_score
  SET abc_category = 'B'
  WHERE velocity_rank > v_seuil_a
  AND velocity_rank <= v_seuil_b;

  -- Catégorie C: 50% restants (slow-moving)
  UPDATE public.produit_velocity_score
  SET abc_category = 'C'
  WHERE velocity_rank > v_seuil_b;

  RAISE NOTICE 'ABC Analysis appliquée: A=%, B=%, C=%',
    v_seuil_a,
    v_seuil_b - v_seuil_a,
    v_total_produits - v_seuil_b;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- =====================================================
-- 3. suggerer_zones_optimales - Recommandations zones
-- =====================================================

CREATE OR REPLACE FUNCTION suggerer_zones_optimales()
RETURNS void AS $$
BEGIN
  -- Suggérer zones optimales basées sur ABC
  UPDATE public.produit_velocity_score
  SET zone_optimale = CASE abc_category
    WHEN 'A' THEN 'Zone Chaude' -- Proche expédition
    WHEN 'B' THEN 'Zone Moyenne'
    WHEN 'C' THEN 'Zone Froide'  -- Éloignée
    ELSE 'Zone Moyenne'
  END;

  RAISE NOTICE 'Zones optimales suggérées';
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- =====================================================
-- 4. generer_suggestions_putaway - Générer suggestions réorg
-- =====================================================

CREATE OR REPLACE FUNCTION generer_suggestions_putaway()
RETURNS INTEGER AS $$
DECLARE
  v_nb_suggestions INTEGER := 0;
BEGIN
  -- Supprimer les anciennes suggestions en attente
  DELETE FROM public.suggestion_emplacement
  WHERE statut = 'en_attente';

  -- Générer des suggestions pour les produits mal placés
  INSERT INTO public.suggestion_emplacement (
    produit_id,
    emplacement_actuel_id,
    emplacement_suggere_id,
    raison_suggestion,
    priorite,
    gain_estime_pct,
    statut
  )
  SELECT
    pvs.produit_id,
    emp_actuel.id AS emplacement_actuel_id,
    emp_suggere.id AS emplacement_suggere_id,
    CASE
      WHEN pvs.abc_category = 'A' AND emp_actuel.zone NOT IN ('A', 'Zone Chaude')
        THEN 'Produit A en zone froide - Déplacer en zone chaude'
      WHEN pvs.abc_category = 'C' AND emp_actuel.zone IN ('A', 'Zone Chaude')
        THEN 'Produit C en zone chaude - Déplacer en zone froide'
      WHEN pvs.abc_category = 'B' AND emp_actuel.zone IN ('C', 'Zone Froide')
        THEN 'Produit B en zone froide - Déplacer en zone moyenne'
      ELSE 'Réorganisation recommandée'
    END AS raison_suggestion,
    CASE
      WHEN pvs.abc_category = 'A' THEN 3 -- Haute priorité
      WHEN pvs.abc_category = 'B' THEN 2 -- Moyenne
      ELSE 1 -- Basse
    END AS priorite,
    CASE
      WHEN pvs.abc_category = 'A' AND emp_actuel.zone NOT IN ('A', 'Zone Chaude')
        THEN 15.0 -- 15% gain estimé
      WHEN pvs.abc_category = 'C' AND emp_actuel.zone IN ('A', 'Zone Chaude')
        THEN 10.0
      ELSE 5.0
    END AS gain_estime_pct,
    'en_attente' AS statut
  FROM public.produit_velocity_score pvs
  JOIN public.emplacement_stock es ON es.produit_id = pvs.produit_id
  JOIN public.emplacement emp_actuel ON emp_actuel.id = es.emplacement_id
  LEFT JOIN LATERAL (
    -- Trouver un emplacement disponible dans la zone optimale
    SELECT e.id
    FROM public.emplacement e
    WHERE
      -- Zone appropriée selon ABC
      (
        (pvs.abc_category = 'A' AND e.zone IN ('A', 'Zone Chaude'))
        OR (pvs.abc_category = 'B' AND e.zone IN ('B', 'Zone Moyenne'))
        OR (pvs.abc_category = 'C' AND e.zone IN ('C', 'Zone Froide'))
      )
      -- Emplacement différent de l'actuel
      AND e.id != emp_actuel.id
      -- Capacité disponible (check simple)
      AND NOT EXISTS (
        SELECT 1 FROM public.emplacement_stock es2
        WHERE es2.emplacement_id = e.id
        AND es2.produit_id = pvs.produit_id
      )
    ORDER BY e.allee, e.travee, e.niveau
    LIMIT 1
  ) emp_suggere ON true
  WHERE
    -- Seulement si le produit est mal placé
    (
      (pvs.abc_category = 'A' AND emp_actuel.zone NOT IN ('A', 'Zone Chaude'))
      OR (pvs.abc_category = 'C' AND emp_actuel.zone IN ('A', 'Zone Chaude'))
      OR (pvs.abc_category = 'B' AND emp_actuel.zone IN ('C', 'Zone Froide'))
    )
    AND emp_suggere.id IS NOT NULL;

  GET DIAGNOSTICS v_nb_suggestions = ROW_COUNT;

  RAISE NOTICE 'Généré % suggestions de putaway', v_nb_suggestions;

  RETURN v_nb_suggestions;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- =====================================================
-- 5. appliquer_suggestion_putaway - Appliquer une suggestion
-- =====================================================

CREATE OR REPLACE FUNCTION appliquer_suggestion_putaway(
  p_suggestion_id UUID,
  p_quantite INTEGER DEFAULT NULL
)
RETURNS BOOLEAN AS $$
DECLARE
  v_suggestion RECORD;
  v_quantite_a_deplacer INTEGER;
BEGIN
  -- Récupérer la suggestion
  SELECT * INTO v_suggestion
  FROM public.suggestion_emplacement
  WHERE id = p_suggestion_id;

  IF v_suggestion IS NULL THEN
    RAISE EXCEPTION 'Suggestion inexistante';
  END IF;

  IF v_suggestion.statut != 'en_attente' THEN
    RAISE EXCEPTION 'Suggestion déjà traitée';
  END IF;

  -- Déterminer la quantité à déplacer
  IF p_quantite IS NULL THEN
    SELECT quantite_disponible INTO v_quantite_a_deplacer
    FROM public.emplacement_stock
    WHERE emplacement_id = v_suggestion.emplacement_actuel_id
    AND produit_id = v_suggestion.produit_id;
  ELSE
    v_quantite_a_deplacer := p_quantite;
  END IF;

  -- Enregistrer dans l'historique
  INSERT INTO public.historique_putaway (
    produit_id,
    emplacement_origine_id,
    emplacement_destination_id,
    quantite,
    type_putaway,
    raison,
    operateur_id
  ) VALUES (
    v_suggestion.produit_id,
    v_suggestion.emplacement_actuel_id,
    v_suggestion.emplacement_suggere_id,
    v_quantite_a_deplacer,
    'suggestion',
    v_suggestion.raison_suggestion,
    auth.uid()
  );

  -- Marquer la suggestion comme appliquée
  UPDATE public.suggestion_emplacement
  SET
    statut = 'applique',
    date_action = now(),
    actioned_by = auth.uid()
  WHERE id = p_suggestion_id;

  RAISE NOTICE 'Suggestion appliquée: % unités déplacées', v_quantite_a_deplacer;

  RETURN TRUE;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- =====================================================
-- 6. get_suggestions_putaway - Récupérer les suggestions
-- =====================================================

CREATE OR REPLACE FUNCTION get_suggestions_putaway(p_limit INTEGER DEFAULT 50)
RETURNS TABLE (
  suggestion_id UUID,
  produit_id UUID,
  produit_nom TEXT,
  produit_sku TEXT,
  abc_category CHAR(1),
  velocity_score DECIMAL,
  emplacement_actuel_zone TEXT,
  emplacement_suggere_zone TEXT,
  raison TEXT,
  priorite INTEGER,
  gain_estime_pct DECIMAL,
  statut TEXT,
  date_suggestion TIMESTAMPTZ
) AS $$
BEGIN
  RETURN QUERY
  SELECT
    se.id,
    se.produit_id,
    p.nom_produit,
    p.sku,
    pvs.abc_category,
    pvs.velocity_score,
    e_actuel.zone,
    e_suggere.zone,
    se.raison_suggestion,
    se.priorite,
    se.gain_estime_pct,
    se.statut,
    se.date_suggestion
  FROM public.suggestion_emplacement se
  JOIN public.produit p ON p.id = se.produit_id
  LEFT JOIN public.produit_velocity_score pvs ON pvs.produit_id = se.produit_id
  LEFT JOIN public.emplacement e_actuel ON e_actuel.id = se.emplacement_actuel_id
  LEFT JOIN public.emplacement e_suggere ON e_suggere.id = se.emplacement_suggere_id
  WHERE se.statut = 'en_attente'
  ORDER BY se.priorite DESC, pvs.velocity_score DESC
  LIMIT p_limit;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- =====================================================
-- 7. CRON Job - Calcul quotidien des vélocités
-- =====================================================

-- Désactiver le job existant si présent
SELECT cron.unschedule('putaway-velocity-daily') WHERE TRUE;

-- Créer le CRON job (chaque jour à 03:00 AM)
SELECT cron.schedule(
  'putaway-velocity-daily',
  '0 3 * * *', -- Cron expression: At 03:00 every day
  $$
  SELECT calculer_velocity_produits(30);
  SELECT generer_suggestions_putaway();
  $$
);

-- =====================================================
-- 8. RPC manuel pour forcer le calcul immédiat
-- =====================================================

CREATE OR REPLACE FUNCTION calculer_velocity_maintenant()
RETURNS JSONB AS $$
DECLARE
  v_nb_produits INTEGER;
  v_nb_suggestions INTEGER;
BEGIN
  -- Calculer les vélocités
  SELECT calculer_velocity_produits(30) INTO v_nb_produits;

  -- Générer les suggestions
  SELECT generer_suggestions_putaway() INTO v_nb_suggestions;

  RETURN jsonb_build_object(
    'success', true,
    'nb_produits_analyses', v_nb_produits,
    'nb_suggestions_generees', v_nb_suggestions,
    'message', 'Calcul de vélocité terminé avec succès'
  );
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- =====================================================
-- 9. Summary
-- =====================================================

DO $$
DECLARE
  job_count INTEGER;
BEGIN
  SELECT COUNT(*) INTO job_count
  FROM cron.job
  WHERE jobname = 'putaway-velocity-daily';

  RAISE NOTICE '';
  RAISE NOTICE '========================================';
  RAISE NOTICE '  PUTAWAY MANAGEMENT - RPC & CRON';
  RAISE NOTICE '========================================';
  RAISE NOTICE 'RPC Functions créées:';
  RAISE NOTICE '  ✅ calculer_velocity_produits()';
  RAISE NOTICE '  ✅ appliquer_abc_analysis()';
  RAISE NOTICE '  ✅ suggerer_zones_optimales()';
  RAISE NOTICE '  ✅ generer_suggestions_putaway()';
  RAISE NOTICE '  ✅ appliquer_suggestion_putaway()';
  RAISE NOTICE '  ✅ get_suggestions_putaway()';
  RAISE NOTICE '  ✅ calculer_velocity_maintenant()';
  RAISE NOTICE '';
  RAISE NOTICE 'CRON Job:';
  IF job_count > 0 THEN
    RAISE NOTICE '  ✅ putaway-velocity-daily (03:00 AM)';
  ELSE
    RAISE WARNING '  ⚠️  CRON job non créé - Vérifier pg_cron';
  END IF;
  RAISE NOTICE '';
  RAISE NOTICE 'Workflow:';
  RAISE NOTICE '  1. CRON calcule vélocités quotidiennement';
  RAISE NOTICE '  2. ABC Analysis automatique (A/B/C)';
  RAISE NOTICE '  3. Suggestions de réorganisation';
  RAISE NOTICE '  4. Gestionnaire applique suggestions';
  RAISE NOTICE '  5. Historique traçable';
  RAISE NOTICE '';
  RAISE NOTICE 'Calcul manuel:';
  RAISE NOTICE '  SELECT calculer_velocity_maintenant();';
  RAISE NOTICE '========================================';
  RAISE NOTICE '';
END $$;
