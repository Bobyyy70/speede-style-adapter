-- =====================================================
-- Migration: TMS - Tables Principales
-- Description: Création des tables de base du TMS
-- Date: 2025-11-19
-- =====================================================

-- Table: Modes de transport
CREATE TABLE IF NOT EXISTS mode_transport (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  code TEXT UNIQUE NOT NULL, -- ROAD, SEA, AIR, RAIL
  nom TEXT NOT NULL,
  description TEXT,
  facteur_emission_co2 NUMERIC DEFAULT 0, -- kg CO2 / km / tonne
  icone TEXT, -- nom icone pour UI
  couleur TEXT, -- couleur pour UI
  actif BOOLEAN DEFAULT true,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Index
CREATE INDEX idx_mode_transport_code ON mode_transport(code);
CREATE INDEX idx_mode_transport_actif ON mode_transport(actif);

-- RLS
ALTER TABLE mode_transport ENABLE ROW LEVEL SECURITY;

-- Policies
CREATE POLICY "Tout le monde peut lire les modes de transport"
  ON mode_transport FOR SELECT
  USING (true);

CREATE POLICY "Admin peut gérer les modes de transport"
  ON mode_transport FOR ALL
  USING (
    EXISTS (
      SELECT 1 FROM user_roles
      WHERE user_id = auth.uid()
      AND role IN ('admin', 'gestionnaire')
    )
  );

-- Données initiales
INSERT INTO mode_transport (code, nom, description, facteur_emission_co2, icone, couleur) VALUES
  ('ROAD', 'Routier', 'Transport par camion', 62, 'truck', '#3B82F6'),
  ('SEA', 'Maritime', 'Transport par bateau', 8, 'ship', '#0EA5E9'),
  ('AIR', 'Aérien', 'Transport par avion', 500, 'plane', '#8B5CF6'),
  ('RAIL', 'Ferroviaire', 'Transport par train', 22, 'train', '#10B981')
ON CONFLICT (code) DO NOTHING;

-- =====================================================
-- Table: Plans de transport
-- =====================================================
CREATE TABLE IF NOT EXISTS plan_transport (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  client_id UUID REFERENCES client(id) ON DELETE CASCADE,
  commande_id UUID REFERENCES commande(id) ON DELETE SET NULL,

  -- Identification
  numero_plan TEXT UNIQUE NOT NULL,
  reference_externe TEXT, -- référence client

  -- Dates
  date_creation TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  date_depart_prevue TIMESTAMP WITH TIME ZONE,
  date_arrivee_prevue TIMESTAMP WITH TIME ZONE,
  date_depart_reelle TIMESTAMP WITH TIME ZONE,
  date_arrivee_reelle TIMESTAMP WITH TIME ZONE,

  -- Mode et transporteur principal
  mode_transport_id UUID REFERENCES mode_transport(id),
  transporteur_id UUID REFERENCES transporteur(id),

  -- Origine et destination
  origine_adresse JSONB, -- {nom, rue, ville, cp, pays, lat, lng}
  destination_adresse JSONB,

  -- Chargement
  poids_total_kg NUMERIC,
  volume_total_m3 NUMERIC,
  nombre_colis INTEGER,
  nature_marchandise TEXT,
  valeur_declaree NUMERIC,

  -- Statut
  statut TEXT DEFAULT 'draft' CHECK (statut IN (
    'draft', 'planifie', 'confirme', 'en_attente_pickup',
    'pickup_effectue', 'en_transit', 'en_livraison',
    'livre', 'incident', 'annule'
  )),

  -- Coûts
  cout_estime NUMERIC DEFAULT 0,
  cout_reel NUMERIC,
  devise TEXT DEFAULT 'EUR',

  -- Performance
  distance_km NUMERIC,
  duree_prevue_h NUMERIC,
  duree_reelle_h NUMERIC,

  -- Environnement
  emission_co2_kg NUMERIC,

  -- Optimisation
  optimise_par_ia BOOLEAN DEFAULT false,
  score_optimisation NUMERIC, -- 0-100
  economie_estimee_eur NUMERIC,

  -- Métadonnées
  instructions_speciales TEXT,
  meta_data JSONB,

  -- Audit
  created_by UUID REFERENCES auth.users(id),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),

  CONSTRAINT check_dates CHECK (date_arrivee_prevue > date_depart_prevue)
);

-- Index
CREATE INDEX idx_plan_transport_client ON plan_transport(client_id);
CREATE INDEX idx_plan_transport_commande ON plan_transport(commande_id);
CREATE INDEX idx_plan_transport_statut ON plan_transport(statut);
CREATE INDEX idx_plan_transport_dates ON plan_transport(date_depart_prevue, date_arrivee_prevue);
CREATE INDEX idx_plan_transport_transporteur ON plan_transport(transporteur_id);
CREATE INDEX idx_plan_transport_mode ON plan_transport(mode_transport_id);

-- RLS
ALTER TABLE plan_transport ENABLE ROW LEVEL SECURITY;

-- Policies
CREATE POLICY "Client voit ses plans transport"
  ON plan_transport FOR SELECT
  USING (
    client_id IN (
      SELECT client_id FROM profiles WHERE id = auth.uid()
    )
  );

CREATE POLICY "Admin/Gestionnaire voient tous les plans"
  ON plan_transport FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM user_roles
      WHERE user_id = auth.uid()
      AND role IN ('admin', 'gestionnaire', 'operateur')
    )
  );

CREATE POLICY "Admin/Gestionnaire peuvent gérer les plans"
  ON plan_transport FOR ALL
  USING (
    EXISTS (
      SELECT 1 FROM user_roles
      WHERE user_id = auth.uid()
      AND role IN ('admin', 'gestionnaire')
    )
  );

-- =====================================================
-- Table: Segments de transport (pour multi-modal)
-- =====================================================
CREATE TABLE IF NOT EXISTS segment_transport (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  plan_transport_id UUID REFERENCES plan_transport(id) ON DELETE CASCADE,

  -- Ordre dans le plan
  ordre INTEGER NOT NULL,

  -- Mode et transporteur de ce segment
  mode_transport_id UUID REFERENCES mode_transport(id),
  transporteur_id UUID REFERENCES transporteur(id),

  -- Origine et destination de ce segment
  origine_lieu TEXT NOT NULL,
  origine_adresse JSONB,
  destination_lieu TEXT NOT NULL,
  destination_adresse JSONB,

  -- Dates
  date_depart_prevue TIMESTAMP WITH TIME ZONE,
  date_arrivee_prevue TIMESTAMP WITH TIME ZONE,
  date_depart_reelle TIMESTAMP WITH TIME ZONE,
  date_arrivee_reelle TIMESTAMP WITH TIME ZONE,

  -- Performance
  distance_km NUMERIC,
  duree_prevue_h NUMERIC,

  -- Coûts
  cout NUMERIC,

  -- Statut
  statut TEXT DEFAULT 'planifie' CHECK (statut IN (
    'planifie', 'en_cours', 'termine', 'annule'
  )),

  -- Numéro de suivi
  tracking_number TEXT,

  -- Métadonnées
  meta_data JSONB,

  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),

  UNIQUE(plan_transport_id, ordre)
);

-- Index
CREATE INDEX idx_segment_transport_plan ON segment_transport(plan_transport_id);
CREATE INDEX idx_segment_transport_ordre ON segment_transport(plan_transport_id, ordre);
CREATE INDEX idx_segment_transport_statut ON segment_transport(statut);

-- RLS
ALTER TABLE segment_transport ENABLE ROW LEVEL SECURITY;

-- Policy: Hérite des droits du plan parent
CREATE POLICY "Accès segment via plan transport"
  ON segment_transport FOR ALL
  USING (
    plan_transport_id IN (
      SELECT id FROM plan_transport
    )
  );

-- =====================================================
-- Fonction: Générer numéro plan automatique
-- =====================================================
CREATE OR REPLACE FUNCTION generate_plan_transport_numero()
RETURNS TRIGGER AS $$
BEGIN
  IF NEW.numero_plan IS NULL THEN
    NEW.numero_plan := 'TP-' || TO_CHAR(NOW(), 'YYYYMMDD') || '-' ||
                       LPAD(NEXTVAL('plan_transport_sequence')::TEXT, 5, '0');
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Séquence pour numéros
CREATE SEQUENCE IF NOT EXISTS plan_transport_sequence START 1;

-- Trigger
DROP TRIGGER IF EXISTS trg_generate_plan_numero ON plan_transport;
CREATE TRIGGER trg_generate_plan_numero
  BEFORE INSERT ON plan_transport
  FOR EACH ROW
  EXECUTE FUNCTION generate_plan_transport_numero();

-- =====================================================
-- Fonction: Mettre à jour updated_at
-- =====================================================
CREATE OR REPLACE FUNCTION update_tms_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Triggers updated_at
CREATE TRIGGER trg_plan_transport_updated_at
  BEFORE UPDATE ON plan_transport
  FOR EACH ROW
  EXECUTE FUNCTION update_tms_updated_at();

CREATE TRIGGER trg_segment_transport_updated_at
  BEFORE UPDATE ON segment_transport
  FOR EACH ROW
  EXECUTE FUNCTION update_tms_updated_at();

-- =====================================================
-- Commentaires
-- =====================================================
COMMENT ON TABLE mode_transport IS 'Modes de transport disponibles (routier, maritime, aérien, ferroviaire)';
COMMENT ON TABLE plan_transport IS 'Plans de transport - Document principal du TMS';
COMMENT ON TABLE segment_transport IS 'Segments individuels pour transport multi-modal';
COMMENT ON COLUMN mode_transport.facteur_emission_co2 IS 'Facteur d émission en kg CO2 par km par tonne';
COMMENT ON COLUMN plan_transport.optimise_par_ia IS 'Indique si le plan a été optimisé par IA';
COMMENT ON COLUMN plan_transport.score_optimisation IS 'Score d optimisation 0-100 (coûts, temps, CO2)';
