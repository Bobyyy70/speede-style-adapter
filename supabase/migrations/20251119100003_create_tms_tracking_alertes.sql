-- =====================================================
-- Migration: TMS - Tracking et Alertes
-- Description: Tables pour suivi temps réel et alertes
-- Date: 2025-11-19
-- =====================================================

-- =====================================================
-- Table: Événements de tracking
-- =====================================================
CREATE TABLE IF NOT EXISTS tracking_event (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  plan_transport_id UUID REFERENCES plan_transport(id) ON DELETE CASCADE,
  segment_transport_id UUID REFERENCES segment_transport(id) ON DELETE SET NULL,

  -- Timestamp
  timestamp TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  timestamp_source TIMESTAMP WITH TIME ZONE, -- timestamp du système source

  -- Type d'événement
  type_evenement TEXT NOT NULL CHECK (type_evenement IN (
    'created',           -- Plan créé
    'confirmed',         -- Plan confirmé
    'pickup_scheduled',  -- Enlèvement planifié
    'pickup_completed',  -- Enlèvement effectué
    'in_transit',        -- En transit
    'checkpoint',        -- Point de passage
    'customs_clearance', -- Dédouanement
    'out_for_delivery',  -- En cours de livraison
    'delivered',         -- Livré
    'failed_delivery',   -- Échec livraison
    'returned',          -- Retourné
    'incident',          -- Incident
    'delayed',           -- Retard
    'cancelled'          -- Annulé
  )),

  -- Localisation
  lieu TEXT,
  ville TEXT,
  pays TEXT,
  code_postal TEXT,
  latitude NUMERIC,
  longitude NUMERIC,

  -- Description
  description TEXT,
  details JSONB,

  -- Source
  source TEXT DEFAULT 'manual' CHECK (source IN (
    'manual',      -- Saisie manuelle
    'api_carrier', -- API transporteur
    'gps',         -- GPS
    'webhook',     -- Webhook
    'system'       -- Système automatique
  )),

  -- Métadonnées
  transporteur_reference TEXT,
  eta_updated TIMESTAMP WITH TIME ZONE, -- Si l'événement met à jour l'ETA
  meta_data JSONB,

  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Index
CREATE INDEX idx_tracking_plan ON tracking_event(plan_transport_id);
CREATE INDEX idx_tracking_segment ON tracking_event(segment_transport_id);
CREATE INDEX idx_tracking_timestamp ON tracking_event(timestamp DESC);
CREATE INDEX idx_tracking_type ON tracking_event(type_evenement);
CREATE INDEX idx_tracking_location ON tracking_event(latitude, longitude) WHERE latitude IS NOT NULL;

-- RLS
ALTER TABLE tracking_event ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Accès tracking via plan transport"
  ON tracking_event FOR ALL
  USING (
    plan_transport_id IN (
      SELECT id FROM plan_transport
    )
  );

-- =====================================================
-- Table: Alertes transport
-- =====================================================
CREATE TABLE IF NOT EXISTS alerte_transport (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  plan_transport_id UUID REFERENCES plan_transport(id) ON DELETE CASCADE,

  -- Type d'alerte
  type_alerte TEXT NOT NULL CHECK (type_alerte IN (
    'delay',             -- Retard
    'incident',          -- Incident
    'weather',           -- Météo
    'traffic',           -- Trafic
    'customs',           -- Douane
    'damage',            -- Dommage
    'missed_delivery',   -- Livraison manquée
    'route_change',      -- Changement itinéraire
    'cost_overrun',      -- Dépassement coût
    'eco_threshold'      -- Seuil CO2 dépassé
  )),

  -- Sévérité
  severite TEXT DEFAULT 'warning' CHECK (severite IN (
    'info',     -- Information
    'warning',  -- Avertissement
    'critical'  -- Critique
  )),

  -- Contenu
  titre TEXT NOT NULL,
  description TEXT,
  details JSONB,

  -- Dates
  date_alerte TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  date_resolution TIMESTAMP WITH TIME ZONE,

  -- Statut
  resolue BOOLEAN DEFAULT false,
  acquittee BOOLEAN DEFAULT false,
  acquittee_par UUID REFERENCES auth.users(id),
  acquittee_at TIMESTAMP WITH TIME ZONE,

  -- Actions
  actions_prises TEXT,
  impact_estime TEXT,

  -- Notifications
  notification_envoyee BOOLEAN DEFAULT false,
  destinataires JSONB, -- [{user_id, email, notified_at}]

  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Index
CREATE INDEX idx_alerte_plan ON alerte_transport(plan_transport_id);
CREATE INDEX idx_alerte_type ON alerte_transport(type_alerte);
CREATE INDEX idx_alerte_severite ON alerte_transport(severite);
CREATE INDEX idx_alerte_resolue ON alerte_transport(resolue);
CREATE INDEX idx_alerte_date ON alerte_transport(date_alerte DESC);

-- RLS
ALTER TABLE alerte_transport ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Accès alerte via plan transport"
  ON alerte_transport FOR ALL
  USING (
    plan_transport_id IN (
      SELECT id FROM plan_transport
    )
  );

-- =====================================================
-- Table: Prédictions ETA (IA)
-- =====================================================
CREATE TABLE IF NOT EXISTS prediction_eta (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  plan_transport_id UUID REFERENCES plan_transport(id) ON DELETE CASCADE,

  -- Prédiction
  eta_predit TIMESTAMP WITH TIME ZONE NOT NULL,
  eta_original TIMESTAMP WITH TIME ZONE NOT NULL,
  difference_minutes INTEGER,

  -- Confiance
  niveau_confiance NUMERIC CHECK (niveau_confiance >= 0 AND niveau_confiance <= 100),
  intervalle_min TIMESTAMP WITH TIME ZONE, -- ETA au plus tôt
  intervalle_max TIMESTAMP WITH TIME ZONE, -- ETA au plus tard

  -- Facteurs analysés
  facteurs_analyse JSONB, -- {traffic: 'heavy', weather: 'rain', historical: 'good'}

  -- Sources de données
  trafic_temps_reel BOOLEAN DEFAULT false,
  meteo_previsions BOOLEAN DEFAULT false,
  historique_transporteur BOOLEAN DEFAULT false,
  douane_previsions BOOLEAN DEFAULT false,

  -- Justification
  justification TEXT,

  -- Validation (après coup)
  eta_reel TIMESTAMP WITH TIME ZONE,
  precision_minutes INTEGER, -- Différence entre prédit et réel

  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Index
CREATE INDEX idx_prediction_plan ON prediction_eta(plan_transport_id);
CREATE INDEX idx_prediction_created ON prediction_eta(created_at DESC);
CREATE INDEX idx_prediction_confiance ON prediction_eta(niveau_confiance DESC);

-- RLS
ALTER TABLE prediction_eta ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Accès prédiction via plan transport"
  ON prediction_eta FOR ALL
  USING (
    plan_transport_id IN (
      SELECT id FROM plan_transport
    )
  );

-- =====================================================
-- Table: Positions GPS (tracking temps réel)
-- =====================================================
CREATE TABLE IF NOT EXISTS position_gps (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  plan_transport_id UUID REFERENCES plan_transport(id) ON DELETE CASCADE,

  -- Position
  latitude NUMERIC NOT NULL,
  longitude NUMERIC NOT NULL,
  altitude NUMERIC,
  precision_metres NUMERIC,

  -- Timestamp
  timestamp TIMESTAMP WITH TIME ZONE DEFAULT NOW(),

  -- Vitesse et direction
  vitesse_kmh NUMERIC,
  direction_degres NUMERIC, -- 0-360

  -- Adresse
  adresse_approximative TEXT,
  ville TEXT,
  pays TEXT,

  -- Source
  source TEXT DEFAULT 'gps' CHECK (source IN ('gps', 'api', 'manual')),
  device_id TEXT,

  -- Métadonnées
  meta_data JSONB,

  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Index
CREATE INDEX idx_position_plan ON position_gps(plan_transport_id);
CREATE INDEX idx_position_timestamp ON position_gps(timestamp DESC);
CREATE INDEX idx_position_coords ON position_gps(latitude, longitude);

-- RLS
ALTER TABLE position_gps ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Accès position via plan transport"
  ON position_gps FOR ALL
  USING (
    plan_transport_id IN (
      SELECT id FROM plan_transport
    )
  );

-- =====================================================
-- Fonction: Créer alerte automatique
-- =====================================================
CREATE OR REPLACE FUNCTION create_transport_alert(
  p_plan_id UUID,
  p_type TEXT,
  p_severite TEXT,
  p_titre TEXT,
  p_description TEXT
) RETURNS UUID AS $$
DECLARE
  v_alert_id UUID;
BEGIN
  INSERT INTO alerte_transport (
    plan_transport_id,
    type_alerte,
    severite,
    titre,
    description
  ) VALUES (
    p_plan_id,
    p_type,
    p_severite,
    p_titre,
    p_description
  ) RETURNING id INTO v_alert_id;

  RETURN v_alert_id;
END;
$$ LANGUAGE plpgsql;

-- =====================================================
-- Fonction: Détecter retards automatiquement
-- =====================================================
CREATE OR REPLACE FUNCTION detect_transport_delays()
RETURNS void AS $$
DECLARE
  v_plan RECORD;
  v_delay_minutes INTEGER;
BEGIN
  -- Parcourir les plans en transit
  FOR v_plan IN
    SELECT
      pt.id,
      pt.numero_plan,
      pt.date_arrivee_prevue,
      (
        SELECT eta_predit
        FROM prediction_eta
        WHERE plan_transport_id = pt.id
        ORDER BY created_at DESC
        LIMIT 1
      ) as latest_eta
    FROM plan_transport pt
    WHERE pt.statut IN ('en_transit', 'en_livraison')
      AND pt.date_arrivee_prevue IS NOT NULL
  LOOP
    -- Calculer le retard
    IF v_plan.latest_eta IS NOT NULL THEN
      v_delay_minutes := EXTRACT(EPOCH FROM (v_plan.latest_eta - v_plan.date_arrivee_prevue)) / 60;

      -- Si retard > 30 minutes, créer alerte
      IF v_delay_minutes > 30 THEN
        -- Vérifier si alerte existe déjà
        IF NOT EXISTS (
          SELECT 1 FROM alerte_transport
          WHERE plan_transport_id = v_plan.id
            AND type_alerte = 'delay'
            AND resolue = false
        ) THEN
          PERFORM create_transport_alert(
            v_plan.id,
            'delay',
            CASE
              WHEN v_delay_minutes > 120 THEN 'critical'
              WHEN v_delay_minutes > 60 THEN 'warning'
              ELSE 'info'
            END,
            'Retard détecté: ' || v_plan.numero_plan,
            'Retard estimé: ' || v_delay_minutes || ' minutes'
          );
        END IF;
      END IF;
    END IF;
  END LOOP;
END;
$$ LANGUAGE plpgsql;

-- =====================================================
-- Vue: Dernière position par plan
-- =====================================================
CREATE OR REPLACE VIEW derniere_position_plan AS
SELECT DISTINCT ON (plan_transport_id)
  plan_transport_id,
  latitude,
  longitude,
  timestamp,
  vitesse_kmh,
  adresse_approximative,
  ville,
  pays
FROM position_gps
ORDER BY plan_transport_id, timestamp DESC;

-- =====================================================
-- Triggers
-- =====================================================
CREATE TRIGGER trg_alerte_transport_updated_at
  BEFORE UPDATE ON alerte_transport
  FOR EACH ROW
  EXECUTE FUNCTION update_tms_updated_at();

-- =====================================================
-- Commentaires
-- =====================================================
COMMENT ON TABLE tracking_event IS 'Événements de tracking pour suivi des transports';
COMMENT ON TABLE alerte_transport IS 'Alertes automatiques et manuelles sur les transports';
COMMENT ON TABLE prediction_eta IS 'Prédictions ETA basées sur IA et données temps réel';
COMMENT ON TABLE position_gps IS 'Positions GPS pour tracking temps réel';
COMMENT ON VIEW derniere_position_plan IS 'Dernière position GPS connue par plan transport';
