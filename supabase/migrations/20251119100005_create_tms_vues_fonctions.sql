-- =====================================================
-- Migration: TMS - Vues et Fonctions
-- Description: Vues matérialisées et fonctions RPC
-- Date: 2025-11-19
-- =====================================================

-- =====================================================
-- Vue: Plans de transport avec infos complètes
-- =====================================================
CREATE OR REPLACE VIEW v_plan_transport_complet AS
SELECT
  pt.id,
  pt.numero_plan,
  pt.reference_externe,
  pt.client_id,
  c.nom_entreprise as client_nom,
  pt.commande_id,
  cmd.numero_commande,

  -- Dates
  pt.date_creation,
  pt.date_depart_prevue,
  pt.date_arrivee_prevue,
  pt.date_depart_reelle,
  pt.date_arrivee_reelle,

  -- Mode et transporteur
  pt.mode_transport_id,
  mt.code as mode_code,
  mt.nom as mode_nom,
  mt.icone as mode_icone,
  mt.couleur as mode_couleur,
  pt.transporteur_id,
  t.nom_transporteur,
  t.logo_url as transporteur_logo,

  -- Localisation
  pt.origine_adresse,
  pt.destination_adresse,

  -- Chargement
  pt.poids_total_kg,
  pt.volume_total_m3,
  pt.nombre_colis,
  pt.nature_marchandise,

  -- Statut
  pt.statut,
  CASE pt.statut
    WHEN 'draft' THEN 'Brouillon'
    WHEN 'planifie' THEN 'Planifié'
    WHEN 'confirme' THEN 'Confirmé'
    WHEN 'en_attente_pickup' THEN 'En attente enlèvement'
    WHEN 'pickup_effectue' THEN 'Enlèvement effectué'
    WHEN 'en_transit' THEN 'En transit'
    WHEN 'en_livraison' THEN 'En livraison'
    WHEN 'livre' THEN 'Livré'
    WHEN 'incident' THEN 'Incident'
    WHEN 'annule' THEN 'Annulé'
  END as statut_label,

  -- Coûts
  pt.cout_estime,
  pt.cout_reel,
  pt.devise,

  -- Performance
  pt.distance_km,
  pt.duree_prevue_h,
  pt.duree_reelle_h,
  pt.emission_co2_kg,

  -- Optimisation
  pt.optimise_par_ia,
  pt.score_optimisation,
  pt.economie_estimee_eur,

  -- Alertes actives
  (
    SELECT COUNT(*)
    FROM alerte_transport at
    WHERE at.plan_transport_id = pt.id
      AND at.resolue = false
  ) as nb_alertes_actives,

  -- Dernière position
  dp.latitude as derniere_latitude,
  dp.longitude as derniere_longitude,
  dp.timestamp as derniere_position_timestamp,

  -- Dernière prédiction ETA
  (
    SELECT eta_predit
    FROM prediction_eta pe
    WHERE pe.plan_transport_id = pt.id
    ORDER BY pe.created_at DESC
    LIMIT 1
  ) as eta_predit,

  pt.created_by,
  pt.updated_at

FROM plan_transport pt
LEFT JOIN client c ON c.id = pt.client_id
LEFT JOIN commande cmd ON cmd.id = pt.commande_id
LEFT JOIN mode_transport mt ON mt.id = pt.mode_transport_id
LEFT JOIN transporteur t ON t.id = pt.transporteur_id
LEFT JOIN derniere_position_plan dp ON dp.plan_transport_id = pt.id;

-- =====================================================
-- Vue: Statistiques transporteurs en temps réel
-- =====================================================
CREATE OR REPLACE VIEW v_stats_transporteur_realtime AS
SELECT
  t.id as transporteur_id,
  t.nom_transporteur,
  t.logo_url,

  -- Plans en cours
  COUNT(pt.id) FILTER (WHERE pt.statut IN ('en_transit', 'en_livraison')) as plans_en_cours,
  COUNT(pt.id) FILTER (WHERE pt.statut = 'livre') as plans_livres_total,

  -- Performance 30 derniers jours
  COUNT(pt.id) FILTER (
    WHERE pt.statut = 'livre'
      AND pt.date_arrivee_reelle IS NOT NULL
      AND pt.date_arrivee_reelle <= pt.date_arrivee_prevue
      AND pt.date_creation >= CURRENT_DATE - INTERVAL '30 days'
  ) as livraisons_a_temps_30j,

  COUNT(pt.id) FILTER (
    WHERE pt.statut = 'livre'
      AND pt.date_creation >= CURRENT_DATE - INTERVAL '30 days'
  ) as total_livraisons_30j,

  ROUND(
    CASE
      WHEN COUNT(pt.id) FILTER (WHERE pt.statut = 'livre' AND pt.date_creation >= CURRENT_DATE - INTERVAL '30 days') > 0
      THEN (
        COUNT(pt.id) FILTER (
          WHERE pt.statut = 'livre'
            AND pt.date_arrivee_reelle <= pt.date_arrivee_prevue
            AND pt.date_creation >= CURRENT_DATE - INTERVAL '30 days'
        )::NUMERIC /
        COUNT(pt.id) FILTER (WHERE pt.statut = 'livre' AND pt.date_creation >= CURRENT_DATE - INTERVAL '30 days')
      ) * 100
      ELSE 0
    END, 2
  ) as taux_ponctualite_30j_pct,

  -- Coûts moyens
  AVG(pt.cout_reel) FILTER (WHERE pt.cout_reel IS NOT NULL) as cout_moyen,

  -- Émissions CO2
  SUM(pt.emission_co2_kg) FILTER (WHERE pt.date_creation >= CURRENT_DATE - INTERVAL '30 days') as co2_total_30j_kg,
  AVG(pt.emission_co2_kg) FILTER (WHERE pt.date_creation >= CURRENT_DATE - INTERVAL '30 days') as co2_moyen_30j_kg,

  -- Score global (simplifié - à améliorer avec plus de critères)
  (
    SELECT pf.score_global
    FROM performance_transporteur pf
    WHERE pf.transporteur_id = t.id
    ORDER BY pf.periode_fin DESC
    LIMIT 1
  ) as score_global_actuel

FROM transporteur t
LEFT JOIN plan_transport pt ON pt.transporteur_id = t.id
WHERE t.actif = true
GROUP BY t.id, t.nom_transporteur, t.logo_url;

-- =====================================================
-- Vue: Alertes critiques non résolues
-- =====================================================
CREATE OR REPLACE VIEW v_alertes_critiques AS
SELECT
  at.id,
  at.plan_transport_id,
  pt.numero_plan,
  pt.client_id,
  c.nom_entreprise as client_nom,
  at.type_alerte,
  at.severite,
  at.titre,
  at.description,
  at.date_alerte,
  EXTRACT(EPOCH FROM (NOW() - at.date_alerte)) / 3600 as age_heures,
  at.acquittee,
  at.resolue,
  pt.statut as plan_statut,
  t.nom_transporteur

FROM alerte_transport at
JOIN plan_transport pt ON pt.id = at.plan_transport_id
LEFT JOIN client c ON c.id = pt.client_id
LEFT JOIN transporteur t ON t.id = pt.transporteur_id

WHERE at.resolue = false
  AND at.severite IN ('warning', 'critical')
ORDER BY
  CASE at.severite
    WHEN 'critical' THEN 1
    WHEN 'warning' THEN 2
    ELSE 3
  END,
  at.date_alerte DESC;

-- =====================================================
-- Fonction RPC: Calculer tarif transport
-- =====================================================
CREATE OR REPLACE FUNCTION calculate_transport_price(
  p_origine_pays TEXT,
  p_destination_pays TEXT,
  p_poids_kg NUMERIC,
  p_volume_m3 NUMERIC,
  p_distance_km NUMERIC,
  p_mode_transport_id UUID,
  p_transporteur_id UUID DEFAULT NULL
) RETURNS TABLE (
  transporteur_id UUID,
  nom_transporteur TEXT,
  tarif_base NUMERIC,
  tarif_distance NUMERIC,
  tarif_poids NUMERIC,
  tarif_volume NUMERIC,
  surcharges NUMERIC,
  total_ht NUMERIC,
  delai_jours INTEGER,
  emission_co2_kg NUMERIC
) AS $$
BEGIN
  RETURN QUERY
  SELECT
    t.id,
    t.nom_transporteur,
    gt.tarif_base,
    COALESCE(gt.tarif_par_km * p_distance_km, 0) as tarif_distance,
    COALESCE(gt.tarif_par_kg * p_poids_kg, 0) as tarif_poids,
    COALESCE(gt.tarif_par_m3 * p_volume_m3, 0) as tarif_volume,
    COALESCE(
      (gt.tarif_base * gt.surcharge_carburant_pct / 100) +
      gt.surcharge_peage, 0
    ) as surcharges,
    (
      gt.tarif_base +
      COALESCE(gt.tarif_par_km * p_distance_km, 0) +
      COALESCE(gt.tarif_par_kg * p_poids_kg, 0) +
      COALESCE(gt.tarif_par_m3 * p_volume_m3, 0) +
      COALESCE((gt.tarif_base * gt.surcharge_carburant_pct / 100), 0) +
      COALESCE(gt.surcharge_peage, 0)
    ) as total_ht,
    gt.delai_livraison_jours,
    COALESCE(
      (p_poids_kg / 1000) * p_distance_km * mt.facteur_emission_co2, 0
    ) as emission_co2_kg

  FROM transporteur t
  JOIN contrat_transporteur ct ON ct.transporteur_id = t.id AND ct.actif = true
  JOIN grille_tarifaire gt ON gt.contrat_transporteur_id = ct.id AND gt.actif = true
  JOIN mode_transport mt ON mt.id = gt.mode_transport_id

  WHERE gt.mode_transport_id = p_mode_transport_id
    AND (p_transporteur_id IS NULL OR t.id = p_transporteur_id)
    AND (gt.pays_origine IS NULL OR gt.pays_origine = p_origine_pays)
    AND (gt.pays_destination IS NULL OR gt.pays_destination = p_destination_pays)
    AND (gt.poids_min_kg IS NULL OR p_poids_kg >= gt.poids_min_kg)
    AND (gt.poids_max_kg IS NULL OR p_poids_kg <= gt.poids_max_kg)
    AND (gt.volume_min_m3 IS NULL OR p_volume_m3 >= gt.volume_min_m3)
    AND (gt.volume_max_m3 IS NULL OR p_volume_m3 <= gt.volume_max_m3)
    AND t.actif = true

  ORDER BY total_ht ASC;
END;
$$ LANGUAGE plpgsql;

-- =====================================================
-- Fonction RPC: Auto-sélection transporteur
-- =====================================================
CREATE OR REPLACE FUNCTION auto_select_carrier(
  p_plan_transport_id UUID,
  p_critere_principal TEXT DEFAULT 'cost', -- cost, time, reliability, eco
  p_poids_criteres JSONB DEFAULT '{"cost": 40, "time": 25, "reliability": 20, "eco": 15}'::JSONB
) RETURNS TABLE (
  transporteur_id UUID,
  nom_transporteur TEXT,
  score_final NUMERIC,
  cout_ht NUMERIC,
  delai_jours INTEGER,
  score_fiabilite NUMERIC,
  emission_co2_kg NUMERIC,
  justification TEXT
) AS $$
DECLARE
  v_plan RECORD;
BEGIN
  -- Récupérer les infos du plan
  SELECT * INTO v_plan
  FROM plan_transport
  WHERE id = p_plan_transport_id;

  IF v_plan IS NULL THEN
    RAISE EXCEPTION 'Plan transport non trouvé: %', p_plan_transport_id;
  END IF;

  -- Calculer les scores pour chaque transporteur
  RETURN QUERY
  WITH tarifs AS (
    SELECT *
    FROM calculate_transport_price(
      (v_plan.origine_adresse->>'pays')::TEXT,
      (v_plan.destination_adresse->>'pays')::TEXT,
      v_plan.poids_total_kg,
      v_plan.volume_total_m3,
      COALESCE(v_plan.distance_km, 500), -- Distance par défaut si non calculée
      v_plan.mode_transport_id
    )
  ),
  scores AS (
    SELECT
      t.transporteur_id,
      t.nom_transporteur,
      t.total_ht,
      t.delai_jours,
      t.emission_co2_kg,

      -- Score coût (inverse normalisé)
      100 - (
        (t.total_ht - MIN(t.total_ht) OVER()) /
        NULLIF(MAX(t.total_ht) OVER() - MIN(t.total_ht) OVER(), 0) * 100
      ) as score_cout,

      -- Score délai (inverse normalisé)
      100 - (
        (t.delai_jours - MIN(t.delai_jours) OVER()) /
        NULLIF(MAX(t.delai_jours) OVER() - MIN(t.delai_jours) OVER(), 0) * 100
      ) as score_delai,

      -- Score fiabilité (depuis stats)
      COALESCE(
        (SELECT taux_ponctualite_30j_pct FROM v_stats_transporteur_realtime WHERE transporteur_id = t.transporteur_id),
        50
      ) as score_fiabilite,

      -- Score éco (inverse normalisé)
      100 - (
        (t.emission_co2_kg - MIN(t.emission_co2_kg) OVER()) /
        NULLIF(MAX(t.emission_co2_kg) OVER() - MIN(t.emission_co2_kg) OVER(), 0) * 100
      ) as score_eco

    FROM tarifs t
  )
  SELECT
    s.transporteur_id,
    s.nom_transporteur,
    -- Score final pondéré
    ROUND(
      (s.score_cout * (p_poids_criteres->>'cost')::NUMERIC / 100) +
      (s.score_delai * (p_poids_criteres->>'time')::NUMERIC / 100) +
      (s.score_fiabilite * (p_poids_criteres->>'reliability')::NUMERIC / 100) +
      (s.score_eco * (p_poids_criteres->>'eco')::NUMERIC / 100),
      2
    ) as score_final,
    s.total_ht as cout_ht,
    s.delai_jours,
    s.score_fiabilite,
    s.emission_co2_kg,
    format(
      'Coût: %s€ | Délai: %s jours | Fiabilité: %s%% | CO2: %skg',
      ROUND(s.total_ht, 2),
      s.delai_jours,
      ROUND(s.score_fiabilite, 1),
      ROUND(s.emission_co2_kg, 1)
    ) as justification

  FROM scores s
  ORDER BY score_final DESC
  LIMIT 5;
END;
$$ LANGUAGE plpgsql;

-- =====================================================
-- Fonction RPC: Calculer KPIs période
-- =====================================================
CREATE OR REPLACE FUNCTION calculate_tms_kpis(
  p_client_id UUID,
  p_periode_debut DATE,
  p_periode_fin DATE
) RETURNS TABLE (
  nb_expeditions INTEGER,
  cout_total NUMERIC,
  cout_moyen NUMERIC,
  taux_ponctualite_pct NUMERIC,
  emission_co2_totale_kg NUMERIC,
  economie_ia_eur NUMERIC
) AS $$
BEGIN
  RETURN QUERY
  SELECT
    COUNT(*)::INTEGER as nb_expeditions,
    SUM(COALESCE(pt.cout_reel, pt.cout_estime))::NUMERIC as cout_total,
    AVG(COALESCE(pt.cout_reel, pt.cout_estime))::NUMERIC as cout_moyen,
    ROUND(
      (
        COUNT(*) FILTER (
          WHERE pt.date_arrivee_reelle IS NOT NULL
            AND pt.date_arrivee_reelle <= pt.date_arrivee_prevue
        )::NUMERIC /
        NULLIF(COUNT(*) FILTER (WHERE pt.date_arrivee_reelle IS NOT NULL), 0)
      ) * 100,
      2
    ) as taux_ponctualite_pct,
    SUM(COALESCE(pt.emission_co2_kg, 0))::NUMERIC as emission_co2_totale_kg,
    (
      SELECT SUM(economie_eur)
      FROM economies_optimisation eo
      WHERE eo.client_id = p_client_id
        AND eo.created_at::DATE BETWEEN p_periode_debut AND p_periode_fin
    )::NUMERIC as economie_ia_eur

  FROM plan_transport pt
  WHERE pt.client_id = p_client_id
    AND pt.date_creation::DATE BETWEEN p_periode_debut AND p_periode_fin
    AND pt.statut != 'draft';
END;
$$ LANGUAGE plpgsql;

-- =====================================================
-- Fonction: Transition statut plan transport
-- =====================================================
CREATE OR REPLACE FUNCTION transition_plan_transport_statut(
  p_plan_id UUID,
  p_nouveau_statut TEXT,
  p_user_id UUID DEFAULT NULL
) RETURNS BOOLEAN AS $$
DECLARE
  v_ancien_statut TEXT;
BEGIN
  -- Récupérer statut actuel
  SELECT statut INTO v_ancien_statut
  FROM plan_transport
  WHERE id = p_plan_id;

  IF v_ancien_statut IS NULL THEN
    RAISE EXCEPTION 'Plan transport non trouvé';
  END IF;

  -- Mettre à jour le statut
  UPDATE plan_transport
  SET statut = p_nouveau_statut,
      updated_at = NOW()
  WHERE id = p_plan_id;

  -- Logger la transition
  INSERT INTO tracking_event (
    plan_transport_id,
    type_evenement,
    description,
    source
  ) VALUES (
    p_plan_id,
    CASE p_nouveau_statut
      WHEN 'confirme' THEN 'confirmed'
      WHEN 'en_transit' THEN 'in_transit'
      WHEN 'livre' THEN 'delivered'
      ELSE 'checkpoint'
    END,
    format('Transition: %s → %s', v_ancien_statut, p_nouveau_statut),
    'system'
  );

  RETURN true;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- =====================================================
-- Commentaires
-- =====================================================
COMMENT ON VIEW v_plan_transport_complet IS 'Vue enrichie des plans transport avec toutes les infos (client, mode, transporteur, alertes, position)';
COMMENT ON VIEW v_stats_transporteur_realtime IS 'Statistiques temps réel par transporteur (performance 30j, scores)';
COMMENT ON VIEW v_alertes_critiques IS 'Alertes critiques non résolues avec contexte complet';
COMMENT ON FUNCTION calculate_transport_price IS 'RPC: Calculer prix transport pour différents transporteurs';
COMMENT ON FUNCTION auto_select_carrier IS 'RPC: Sélection automatique du meilleur transporteur selon critères pondérés';
COMMENT ON FUNCTION calculate_tms_kpis IS 'RPC: Calculer KPIs TMS pour une période donnée';
COMMENT ON FUNCTION transition_plan_transport_statut IS 'Changer le statut d un plan transport avec logging automatique';
