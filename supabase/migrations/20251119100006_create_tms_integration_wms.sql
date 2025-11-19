-- =====================================================
-- Migration: TMS - Intégration WMS
-- Description: Synchronisation bidirectionnelle TMS/WMS
-- Date: 2025-11-19
-- =====================================================

-- =====================================================
-- Fonction: Auto-création plan transport depuis commande
-- =====================================================
CREATE OR REPLACE FUNCTION auto_create_plan_from_commande()
RETURNS TRIGGER AS $$
DECLARE
  v_plan_id UUID;
  v_mode_id UUID;
BEGIN
  -- Vérifier si changement vers "pret_expedition" ou "etiquette_generee"
  IF NEW.statut_wms IN ('pret_expedition', 'etiquette_generee')
     AND (OLD.statut_wms IS NULL OR OLD.statut_wms NOT IN ('pret_expedition', 'etiquette_generee'))
  THEN
    -- Vérifier qu'un plan n'existe pas déjà
    IF NOT EXISTS (
      SELECT 1 FROM plan_transport WHERE commande_id = NEW.id
    ) THEN
      -- Déterminer le mode transport par défaut (routier)
      SELECT id INTO v_mode_id
      FROM mode_transport
      WHERE code = 'ROAD'
      LIMIT 1;

      -- Créer le plan transport
      INSERT INTO plan_transport (
        commande_id,
        client_id,
        numero_plan,
        origine_adresse,
        destination_adresse,
        poids_total_kg,
        volume_total_m3,
        nombre_colis,
        mode_transport_id,
        transporteur_id,
        date_depart_prevue,
        statut
      ) VALUES (
        NEW.id,
        NEW.client_id,
        NULL, -- Sera généré par trigger
        -- Origine: utiliser adresse expéditeur par défaut
        jsonb_build_object(
          'nom', 'Entrepôt',
          'ville', 'À configurer'
        ),
        -- Destination: adresse livraison de la commande
        jsonb_build_object(
          'nom', NEW.nom_destinataire,
          'entreprise', NEW.entreprise_destinataire,
          'adresse_ligne_1', NEW.adresse_livraison_ligne1,
          'adresse_ligne_2', NEW.adresse_livraison_ligne2,
          'code_postal', NEW.code_postal_livraison,
          'ville', NEW.ville_livraison,
          'pays', NEW.pays_livraison,
          'telephone', NEW.telephone_destinataire,
          'email', NEW.email_destinataire
        ),
        COALESCE(NEW.poids_total_kg, 0),
        COALESCE(NEW.volume_total_m3, 0),
        (
          SELECT COUNT(*)
          FROM ligne_commande
          WHERE commande_id = NEW.id
        ),
        v_mode_id,
        NEW.transporteur_id, -- Si déjà sélectionné dans la commande
        NOW() + INTERVAL '1 day', -- Départ prévu demain
        'draft'
      ) RETURNING id INTO v_plan_id;

      -- Logger la création
      RAISE NOTICE 'Plan transport % créé automatiquement pour commande %', v_plan_id, NEW.numero_commande;
    END IF;
  END IF;

  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Trigger sur commande
DROP TRIGGER IF EXISTS trg_auto_create_plan_from_commande ON commande;
CREATE TRIGGER trg_auto_create_plan_from_commande
  AFTER INSERT OR UPDATE OF statut_wms ON commande
  FOR EACH ROW
  EXECUTE FUNCTION auto_create_plan_from_commande();

-- =====================================================
-- Fonction: Sync statut plan → commande
-- =====================================================
CREATE OR REPLACE FUNCTION sync_plan_statut_to_commande()
RETURNS TRIGGER AS $$
DECLARE
  v_nouveau_statut_wms TEXT;
BEGIN
  -- Mapping statut plan → statut WMS
  v_nouveau_statut_wms := CASE NEW.statut
    WHEN 'confirme' THEN 'pret_expedition'
    WHEN 'en_attente_pickup' THEN 'pret_expedition'
    WHEN 'pickup_effectue' THEN 'expedie'
    WHEN 'en_transit' THEN 'en_transit'
    WHEN 'en_livraison' THEN 'en_livraison'
    WHEN 'livre' THEN 'livre'
    WHEN 'incident' THEN 'incident_livraison'
    WHEN 'annule' THEN 'annule'
    ELSE NULL
  END;

  -- Si mapping existe et commande liée
  IF v_nouveau_statut_wms IS NOT NULL AND NEW.commande_id IS NOT NULL THEN
    -- Mettre à jour la commande
    UPDATE commande
    SET
      statut_wms = v_nouveau_statut_wms,
      updated_at = NOW()
    WHERE id = NEW.commande_id
      AND statut_wms != v_nouveau_statut_wms; -- Éviter mise à jour inutile
  END IF;

  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Trigger sur plan_transport
DROP TRIGGER IF EXISTS trg_sync_plan_to_commande ON plan_transport;
CREATE TRIGGER trg_sync_plan_to_commande
  AFTER UPDATE OF statut ON plan_transport
  FOR EACH ROW
  WHEN (NEW.statut IS DISTINCT FROM OLD.statut)
  EXECUTE FUNCTION sync_plan_statut_to_commande();

-- =====================================================
-- Fonction: Calculer distance entre deux points (Haversine)
-- =====================================================
CREATE OR REPLACE FUNCTION calculate_distance_km(
  lat1 NUMERIC,
  lon1 NUMERIC,
  lat2 NUMERIC,
  lon2 NUMERIC
) RETURNS NUMERIC AS $$
DECLARE
  r NUMERIC := 6371; -- Rayon de la Terre en km
  dlat NUMERIC;
  dlon NUMERIC;
  a NUMERIC;
  c NUMERIC;
BEGIN
  IF lat1 IS NULL OR lon1 IS NULL OR lat2 IS NULL OR lon2 IS NULL THEN
    RETURN NULL;
  END IF;

  dlat := RADIANS(lat2 - lat1);
  dlon := RADIANS(lon2 - lon1);

  a := SIN(dlat/2) * SIN(dlat/2) +
       COS(RADIANS(lat1)) * COS(RADIANS(lat2)) *
       SIN(dlon/2) * SIN(dlon/2);

  c := 2 * ATAN2(SQRT(a), SQRT(1-a));

  RETURN ROUND(r * c, 2);
END;
$$ LANGUAGE plpgsql IMMUTABLE;

-- =====================================================
-- Fonction: Calculer émission CO2 automatiquement
-- =====================================================
CREATE OR REPLACE FUNCTION calculate_plan_co2_emission()
RETURNS TRIGGER AS $$
DECLARE
  v_facteur_emission NUMERIC;
  v_distance NUMERIC;
  v_poids_tonnes NUMERIC;
BEGIN
  -- Récupérer le facteur d'émission du mode de transport
  SELECT facteur_emission_co2 INTO v_facteur_emission
  FROM mode_transport
  WHERE id = NEW.mode_transport_id;

  -- Si on a une distance et un poids
  IF NEW.distance_km IS NOT NULL AND NEW.poids_total_kg IS NOT NULL AND v_facteur_emission IS NOT NULL THEN
    v_distance := NEW.distance_km;
    v_poids_tonnes := NEW.poids_total_kg / 1000.0;

    -- Formule: émission (kg CO2) = distance (km) × poids (tonnes) × facteur
    NEW.emission_co2_kg := ROUND(v_distance * v_poids_tonnes * v_facteur_emission, 2);

  -- Si on a des coordonnées origine/destination, calculer la distance
  ELSIF (NEW.origine_adresse->>'latitude') IS NOT NULL
    AND (NEW.destination_adresse->>'latitude') IS NOT NULL
    AND NEW.poids_total_kg IS NOT NULL
    AND v_facteur_emission IS NOT NULL
  THEN
    v_distance := calculate_distance_km(
      (NEW.origine_adresse->>'latitude')::NUMERIC,
      (NEW.origine_adresse->>'longitude')::NUMERIC,
      (NEW.destination_adresse->>'latitude')::NUMERIC,
      (NEW.destination_adresse->>'longitude')::NUMERIC
    );

    IF v_distance IS NOT NULL THEN
      NEW.distance_km := v_distance;
      v_poids_tonnes := NEW.poids_total_kg / 1000.0;
      NEW.emission_co2_kg := ROUND(v_distance * v_poids_tonnes * v_facteur_emission, 2);
    END IF;
  END IF;

  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Trigger calcul CO2
DROP TRIGGER IF EXISTS trg_calculate_plan_co2 ON plan_transport;
CREATE TRIGGER trg_calculate_plan_co2
  BEFORE INSERT OR UPDATE OF distance_km, poids_total_kg, mode_transport_id ON plan_transport
  FOR EACH ROW
  EXECUTE FUNCTION calculate_plan_co2_emission();

-- =====================================================
-- Vue: Commandes prêtes pour transport
-- =====================================================
CREATE OR REPLACE VIEW v_commandes_prete_transport AS
SELECT
  c.id as commande_id,
  c.numero_commande,
  c.client_id,
  cl.nom_entreprise as client_nom,
  c.statut_wms,
  c.date_creation,

  -- Destination
  c.nom_destinataire,
  c.ville_livraison,
  c.pays_livraison,

  -- Poids/Volume
  c.poids_total_kg,
  c.volume_total_m3,

  -- Transporteur déjà sélectionné?
  c.transporteur_id,
  t.nom_transporteur,

  -- Plan transport existe?
  pt.id as plan_transport_id,
  pt.numero_plan,
  pt.statut as plan_statut,

  -- Indicateurs
  CASE
    WHEN pt.id IS NULL THEN 'À créer'
    WHEN pt.statut = 'draft' THEN 'Brouillon'
    WHEN pt.statut IN ('planifie', 'confirme') THEN 'Planifié'
    ELSE 'En cours'
  END as etat_transport

FROM commande c
LEFT JOIN client cl ON cl.id = c.client_id
LEFT JOIN transporteur t ON t.id = c.transporteur_id
LEFT JOIN plan_transport pt ON pt.commande_id = c.id

WHERE c.statut_wms IN ('pret_expedition', 'etiquette_generee', 'expedie')
ORDER BY c.date_creation DESC;

-- =====================================================
-- Fonction RPC: Créer plan transport pour commande
-- =====================================================
CREATE OR REPLACE FUNCTION create_plan_for_commande(
  p_commande_id UUID,
  p_mode_transport_code TEXT DEFAULT 'ROAD',
  p_auto_select_carrier BOOLEAN DEFAULT true
) RETURNS UUID AS $$
DECLARE
  v_plan_id UUID;
  v_commande RECORD;
  v_mode_id UUID;
  v_transporteur_id UUID;
BEGIN
  -- Récupérer infos commande
  SELECT * INTO v_commande
  FROM commande
  WHERE id = p_commande_id;

  IF v_commande IS NULL THEN
    RAISE EXCEPTION 'Commande non trouvée: %', p_commande_id;
  END IF;

  -- Vérifier qu'un plan n'existe pas déjà
  IF EXISTS (SELECT 1 FROM plan_transport WHERE commande_id = p_commande_id) THEN
    RAISE EXCEPTION 'Un plan transport existe déjà pour cette commande';
  END IF;

  -- Récupérer mode transport
  SELECT id INTO v_mode_id
  FROM mode_transport
  WHERE code = p_mode_transport_code
  LIMIT 1;

  -- Auto-sélectionner transporteur si demandé
  IF p_auto_select_carrier THEN
    -- TODO: Implémenter sélection intelligente
    -- Pour l'instant, prendre transporteur de la commande ou premier actif
    v_transporteur_id := v_commande.transporteur_id;

    IF v_transporteur_id IS NULL THEN
      SELECT id INTO v_transporteur_id
      FROM transporteur
      WHERE actif = true
      ORDER BY id
      LIMIT 1;
    END IF;
  ELSE
    v_transporteur_id := v_commande.transporteur_id;
  END IF;

  -- Créer le plan
  INSERT INTO plan_transport (
    commande_id,
    client_id,
    origine_adresse,
    destination_adresse,
    poids_total_kg,
    volume_total_m3,
    nombre_colis,
    mode_transport_id,
    transporteur_id,
    date_depart_prevue,
    statut
  ) VALUES (
    v_commande.id,
    v_commande.client_id,
    jsonb_build_object('ville', 'Entrepôt'),
    jsonb_build_object(
      'nom', v_commande.nom_destinataire,
      'adresse_ligne_1', v_commande.adresse_livraison_ligne1,
      'ville', v_commande.ville_livraison,
      'code_postal', v_commande.code_postal_livraison,
      'pays', v_commande.pays_livraison
    ),
    COALESCE(v_commande.poids_total_kg, 0),
    COALESCE(v_commande.volume_total_m3, 0),
    (SELECT COUNT(*) FROM ligne_commande WHERE commande_id = v_commande.id),
    v_mode_id,
    v_transporteur_id,
    NOW() + INTERVAL '1 day',
    'draft'
  ) RETURNING id INTO v_plan_id;

  RETURN v_plan_id;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- =====================================================
-- Fonction RPC: Batch création plans pour commandes
-- =====================================================
CREATE OR REPLACE FUNCTION batch_create_plans_for_commandes(
  p_client_id UUID DEFAULT NULL,
  p_statut_wms TEXT DEFAULT 'pret_expedition'
) RETURNS TABLE (
  commande_id UUID,
  plan_id UUID,
  success BOOLEAN,
  message TEXT
) AS $$
DECLARE
  v_commande RECORD;
  v_plan_id UUID;
BEGIN
  FOR v_commande IN
    SELECT c.id, c.numero_commande
    FROM commande c
    WHERE (p_client_id IS NULL OR c.client_id = p_client_id)
      AND c.statut_wms = p_statut_wms
      AND NOT EXISTS (
        SELECT 1 FROM plan_transport WHERE commande_id = c.id
      )
    LIMIT 100 -- Sécurité: max 100 à la fois
  LOOP
    BEGIN
      v_plan_id := create_plan_for_commande(v_commande.id);

      RETURN QUERY SELECT
        v_commande.id,
        v_plan_id,
        true,
        'Plan créé: ' || v_plan_id::TEXT;
    EXCEPTION WHEN OTHERS THEN
      RETURN QUERY SELECT
        v_commande.id,
        NULL::UUID,
        false,
        'Erreur: ' || SQLERRM;
    END;
  END LOOP;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- =====================================================
-- Commentaires
-- =====================================================
COMMENT ON FUNCTION auto_create_plan_from_commande IS 'Trigger: Création automatique plan transport quand commande passe en pret_expedition';
COMMENT ON FUNCTION sync_plan_statut_to_commande IS 'Trigger: Synchronisation statut plan → statut commande WMS';
COMMENT ON FUNCTION calculate_distance_km IS 'Calcul distance entre 2 points GPS (formule Haversine)';
COMMENT ON FUNCTION calculate_plan_co2_emission IS 'Trigger: Calcul automatique émission CO2 d un plan transport';
COMMENT ON VIEW v_commandes_prete_transport IS 'Commandes prêtes pour création plan transport';
COMMENT ON FUNCTION create_plan_for_commande IS 'RPC: Créer manuellement un plan transport pour une commande';
COMMENT ON FUNCTION batch_create_plans_for_commandes IS 'RPC: Créer en masse des plans pour commandes prêtes';
