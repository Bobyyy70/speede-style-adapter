-- =====================================================
-- Migration: TMS - Transporteurs et Tarification
-- Description: Tables pour gestion transporteurs et tarifs
-- Date: 2025-11-19
-- =====================================================

-- =====================================================
-- Table: Contrats transporteurs
-- =====================================================
CREATE TABLE IF NOT EXISTS contrat_transporteur (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  transporteur_id UUID REFERENCES transporteur(id) ON DELETE CASCADE,
  client_id UUID REFERENCES client(id) ON DELETE CASCADE,

  -- Identification
  numero_contrat TEXT UNIQUE NOT NULL,
  nom_contrat TEXT NOT NULL,
  description TEXT,

  -- Dates
  date_debut DATE NOT NULL,
  date_fin DATE,
  date_signature DATE,

  -- Type de tarification
  type_tarification TEXT DEFAULT 'distance_based' CHECK (type_tarification IN (
    'fixed',          -- Prix fixe
    'distance_based', -- Basé sur distance
    'weight_based',   -- Basé sur poids
    'volume_based',   -- Basé sur volume
    'zone_based',     -- Par zones
    'custom'          -- Personnalisé
  )),

  -- Conditions commerciales
  conditions JSONB, -- {min_volume, max_volume, engagement, etc.}
  remise_volume_pct NUMERIC DEFAULT 0,
  franchise_carburant BOOLEAN DEFAULT false,

  -- Statut
  actif BOOLEAN DEFAULT true,
  auto_renew BOOLEAN DEFAULT false,

  -- Documents
  document_url TEXT,

  -- Métadonnées
  meta_data JSONB,

  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),

  CONSTRAINT check_dates_contrat CHECK (date_fin IS NULL OR date_fin > date_debut)
);

-- Index
CREATE INDEX idx_contrat_transporteur ON contrat_transporteur(transporteur_id);
CREATE INDEX idx_contrat_client ON contrat_transporteur(client_id);
CREATE INDEX idx_contrat_actif ON contrat_transporteur(actif);
CREATE INDEX idx_contrat_dates ON contrat_transporteur(date_debut, date_fin);

-- RLS
ALTER TABLE contrat_transporteur ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Client voit ses contrats"
  ON contrat_transporteur FOR SELECT
  USING (
    client_id IN (
      SELECT client_id FROM profiles WHERE id = auth.uid()
    )
  );

CREATE POLICY "Admin gère tous les contrats"
  ON contrat_transporteur FOR ALL
  USING (
    EXISTS (
      SELECT 1 FROM user_roles
      WHERE user_id = auth.uid()
      AND role IN ('admin', 'gestionnaire')
    )
  );

-- =====================================================
-- Table: Grilles tarifaires
-- =====================================================
CREATE TABLE IF NOT EXISTS grille_tarifaire (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  contrat_transporteur_id UUID REFERENCES contrat_transporteur(id) ON DELETE CASCADE,
  mode_transport_id UUID REFERENCES mode_transport(id),

  -- Zones
  zone_origine TEXT,
  zone_destination TEXT,
  pays_origine TEXT,
  pays_destination TEXT,

  -- Fourchettes poids
  poids_min_kg NUMERIC DEFAULT 0,
  poids_max_kg NUMERIC,

  -- Fourchettes volume
  volume_min_m3 NUMERIC DEFAULT 0,
  volume_max_m3 NUMERIC,

  -- Tarifs
  tarif_base NUMERIC NOT NULL,
  tarif_par_km NUMERIC DEFAULT 0,
  tarif_par_kg NUMERIC DEFAULT 0,
  tarif_par_m3 NUMERIC DEFAULT 0,

  -- Suppléments
  surcharge_carburant_pct NUMERIC DEFAULT 0,
  surcharge_peage NUMERIC DEFAULT 0,
  surcharge_urgence_pct NUMERIC DEFAULT 0,

  -- Performance
  delai_livraison_jours INTEGER,
  delai_pickup_heures INTEGER DEFAULT 24,

  -- Validité
  date_debut_validite DATE DEFAULT CURRENT_DATE,
  date_fin_validite DATE,

  actif BOOLEAN DEFAULT true,

  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Index
CREATE INDEX idx_grille_contrat ON grille_tarifaire(contrat_transporteur_id);
CREATE INDEX idx_grille_zones ON grille_tarifaire(zone_origine, zone_destination);
CREATE INDEX idx_grille_poids ON grille_tarifaire(poids_min_kg, poids_max_kg);
CREATE INDEX idx_grille_mode ON grille_tarifaire(mode_transport_id);
CREATE INDEX idx_grille_actif ON grille_tarifaire(actif);

-- RLS
ALTER TABLE grille_tarifaire ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Accès grille via contrat"
  ON grille_tarifaire FOR ALL
  USING (
    contrat_transporteur_id IN (
      SELECT id FROM contrat_transporteur
    )
  );

-- =====================================================
-- Table: Performance transporteurs (enrichie)
-- =====================================================
CREATE TABLE IF NOT EXISTS performance_transporteur (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  transporteur_id UUID REFERENCES transporteur(id) ON DELETE CASCADE,

  -- Période
  periode_debut DATE NOT NULL,
  periode_fin DATE NOT NULL,

  -- Volumes
  nb_expeditions_total INTEGER DEFAULT 0,
  nb_expeditions_a_temps INTEGER DEFAULT 0,
  nb_expeditions_retard INTEGER DEFAULT 0,
  nb_expeditions_incident INTEGER DEFAULT 0,
  nb_expeditions_annulees INTEGER DEFAULT 0,

  -- KPIs calculés
  taux_ponctualite_pct NUMERIC GENERATED ALWAYS AS (
    CASE
      WHEN nb_expeditions_total > 0
      THEN ROUND((nb_expeditions_a_temps::NUMERIC / nb_expeditions_total) * 100, 2)
      ELSE 0
    END
  ) STORED,

  taux_incident_pct NUMERIC GENERATED ALWAYS AS (
    CASE
      WHEN nb_expeditions_total > 0
      THEN ROUND((nb_expeditions_incident::NUMERIC / nb_expeditions_total) * 100, 2)
      ELSE 0
    END
  ) STORED,

  -- Délais
  delai_moyen_livraison_jours NUMERIC,
  delai_min_livraison_jours NUMERIC,
  delai_max_livraison_jours NUMERIC,

  -- Coûts
  cout_total NUMERIC DEFAULT 0,
  cout_moyen_expedition NUMERIC,

  -- Green metrics
  emission_co2_totale_kg NUMERIC DEFAULT 0,
  emission_co2_moyenne_kg NUMERIC,

  -- Scores
  score_ponctualite NUMERIC, -- 0-100
  score_fiabilite NUMERIC,   -- 0-100
  score_cout NUMERIC,        -- 0-100
  score_environnemental NUMERIC, -- 0-100
  score_global NUMERIC,      -- 0-100 (moyenne pondérée)

  -- Métadonnées
  meta_data JSONB,

  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),

  CONSTRAINT check_periode CHECK (periode_fin >= periode_debut),
  CONSTRAINT check_scores CHECK (
    score_global >= 0 AND score_global <= 100
  )
);

-- Index
CREATE INDEX idx_perf_transporteur ON performance_transporteur(transporteur_id);
CREATE INDEX idx_perf_periode ON performance_transporteur(periode_debut, periode_fin);
CREATE INDEX idx_perf_score ON performance_transporteur(score_global DESC);

-- RLS
ALTER TABLE performance_transporteur ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Tout le monde peut voir performances transporteurs"
  ON performance_transporteur FOR SELECT
  USING (true);

CREATE POLICY "Admin peut gérer performances"
  ON performance_transporteur FOR ALL
  USING (
    EXISTS (
      SELECT 1 FROM user_roles
      WHERE user_id = auth.uid()
      AND role IN ('admin', 'gestionnaire')
    )
  );

-- =====================================================
-- Table: Décisions transporteur (IA tracking)
-- =====================================================
CREATE TABLE IF NOT EXISTS decision_transporteur_tms (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  plan_transport_id UUID REFERENCES plan_transport(id) ON DELETE CASCADE,

  -- Transporteurs comparés
  transporteurs_compares JSONB, -- [{id, nom, score, cout, delai}]

  -- Décision
  transporteur_selectionne_id UUID REFERENCES transporteur(id),
  mode_selection TEXT CHECK (mode_selection IN ('auto', 'manual', 'rule_based')),

  -- Critères de sélection
  critere_principal TEXT, -- cost, time, reliability, eco
  poids_criteres JSONB, -- {cost: 30, time: 25, reliability: 20, eco: 15, capacity: 10}

  -- Scores
  score_selection NUMERIC, -- 0-100
  economie_vs_standard_eur NUMERIC,

  -- Justification
  justification TEXT,

  -- Override
  overridden BOOLEAN DEFAULT false,
  override_reason TEXT,
  override_by UUID REFERENCES auth.users(id),
  override_at TIMESTAMP WITH TIME ZONE,

  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Index
CREATE INDEX idx_decision_plan ON decision_transporteur_tms(plan_transport_id);
CREATE INDEX idx_decision_transporteur ON decision_transporteur_tms(transporteur_selectionne_id);
CREATE INDEX idx_decision_mode ON decision_transporteur_tms(mode_selection);

-- RLS
ALTER TABLE decision_transporteur_tms ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Accès décision via plan transport"
  ON decision_transporteur_tms FOR ALL
  USING (
    plan_transport_id IN (
      SELECT id FROM plan_transport
    )
  );

-- =====================================================
-- Fonction: Calculer score global transporteur
-- =====================================================
CREATE OR REPLACE FUNCTION calculate_carrier_global_score(
  p_transporteur_id UUID,
  p_periode_debut DATE,
  p_periode_fin DATE
) RETURNS NUMERIC AS $$
DECLARE
  v_score_ponctualite NUMERIC;
  v_score_fiabilite NUMERIC;
  v_score_global NUMERIC;
BEGIN
  -- Calculer score ponctualité (0-100)
  SELECT
    CASE
      WHEN SUM(nb_expeditions_total) > 0
      THEN (SUM(nb_expeditions_a_temps)::NUMERIC / SUM(nb_expeditions_total)) * 100
      ELSE 0
    END INTO v_score_ponctualite
  FROM performance_transporteur
  WHERE transporteur_id = p_transporteur_id
    AND periode_debut >= p_periode_debut
    AND periode_fin <= p_periode_fin;

  -- Calculer score fiabilité (inverse du taux d'incident)
  SELECT
    CASE
      WHEN SUM(nb_expeditions_total) > 0
      THEN 100 - ((SUM(nb_expeditions_incident)::NUMERIC / SUM(nb_expeditions_total)) * 100)
      ELSE 0
    END INTO v_score_fiabilite
  FROM performance_transporteur
  WHERE transporteur_id = p_transporteur_id
    AND periode_debut >= p_periode_debut
    AND periode_fin <= p_periode_fin;

  -- Score global (moyenne pondérée)
  v_score_global := (v_score_ponctualite * 0.6) + (v_score_fiabilite * 0.4);

  RETURN ROUND(v_score_global, 2);
END;
$$ LANGUAGE plpgsql;

-- =====================================================
-- Triggers updated_at
-- =====================================================
CREATE TRIGGER trg_contrat_transporteur_updated_at
  BEFORE UPDATE ON contrat_transporteur
  FOR EACH ROW
  EXECUTE FUNCTION update_tms_updated_at();

CREATE TRIGGER trg_grille_tarifaire_updated_at
  BEFORE UPDATE ON grille_tarifaire
  FOR EACH ROW
  EXECUTE FUNCTION update_tms_updated_at();

CREATE TRIGGER trg_performance_transporteur_updated_at
  BEFORE UPDATE ON performance_transporteur
  FOR EACH ROW
  EXECUTE FUNCTION update_tms_updated_at();

-- =====================================================
-- Commentaires
-- =====================================================
COMMENT ON TABLE contrat_transporteur IS 'Contrats négociés avec les transporteurs';
COMMENT ON TABLE grille_tarifaire IS 'Grilles de tarification par contrat et zone';
COMMENT ON TABLE performance_transporteur IS 'Historique des performances transporteurs (KPIs)';
COMMENT ON TABLE decision_transporteur_tms IS 'Tracking des décisions de sélection transporteur (IA)';
COMMENT ON COLUMN performance_transporteur.score_global IS 'Score global calculé: ponctualité (60%) + fiabilité (40%)';
