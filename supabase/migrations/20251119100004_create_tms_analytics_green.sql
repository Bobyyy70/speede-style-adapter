-- =====================================================
-- Migration: TMS - Analytics et Green Logistics
-- Description: Tables pour analytics et environnement
-- Date: 2025-11-19
-- =====================================================

-- =====================================================
-- Table: KPIs TMS consolidés
-- =====================================================
CREATE TABLE IF NOT EXISTS tms_kpi_snapshot (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  client_id UUID REFERENCES client(id) ON DELETE CASCADE,

  -- Période
  periode_debut DATE NOT NULL,
  periode_fin DATE NOT NULL,
  type_periode TEXT CHECK (type_periode IN ('daily', 'weekly', 'monthly', 'quarterly', 'yearly')),

  -- Volumes
  nb_expeditions INTEGER DEFAULT 0,
  nb_tonnes_transportees NUMERIC DEFAULT 0,
  nb_km_parcourus NUMERIC DEFAULT 0,
  nb_colis_total INTEGER DEFAULT 0,

  -- Coûts
  cout_total NUMERIC DEFAULT 0,
  cout_moyen_expedition NUMERIC,
  cout_au_km NUMERIC,
  cout_a_la_tonne NUMERIC,

  -- Performance
  taux_ponctualite_pct NUMERIC,
  taux_incident_pct NUMERIC,
  delai_moyen_livraison_jours NUMERIC,

  -- Green metrics
  emission_co2_totale_kg NUMERIC DEFAULT 0,
  emission_co2_par_tonne_km NUMERIC,
  emission_co2_par_expedition_kg NUMERIC,

  -- Optimisation
  nb_optimisations_ia INTEGER DEFAULT 0,
  economie_ia_eur NUMERIC DEFAULT 0,
  taux_remplissage_moyen_pct NUMERIC,

  -- Répartition modes
  repartition_modes JSONB, -- {ROAD: 60, SEA: 30, AIR: 10}

  -- Métadonnées
  meta_data JSONB,

  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),

  UNIQUE(client_id, periode_debut, periode_fin, type_periode)
);

-- Index
CREATE INDEX idx_kpi_client ON tms_kpi_snapshot(client_id);
CREATE INDEX idx_kpi_periode ON tms_kpi_snapshot(periode_debut, periode_fin);
CREATE INDEX idx_kpi_type ON tms_kpi_snapshot(type_periode);

-- RLS
ALTER TABLE tms_kpi_snapshot ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Client voit ses KPIs"
  ON tms_kpi_snapshot FOR SELECT
  USING (
    client_id IN (
      SELECT client_id FROM profiles WHERE id = auth.uid()
    )
  );

CREATE POLICY "Admin gère tous les KPIs"
  ON tms_kpi_snapshot FOR ALL
  USING (
    EXISTS (
      SELECT 1 FROM user_roles
      WHERE user_id = auth.uid()
      AND role IN ('admin', 'gestionnaire')
    )
  );

-- =====================================================
-- Table: Économies réalisées
-- =====================================================
CREATE TABLE IF NOT EXISTS economies_optimisation (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  plan_transport_id UUID REFERENCES plan_transport(id) ON DELETE CASCADE,
  client_id UUID REFERENCES client(id),

  -- Type d'optimisation
  type_optimisation TEXT CHECK (type_optimisation IN (
    'route',         -- Optimisation itinéraire
    'carrier',       -- Meilleur transporteur
    'consolidation', -- Consolidation chargements
    'mode',          -- Changement mode transport
    'timing'         -- Optimisation timing
  )),

  -- Avant optimisation
  cout_initial NUMERIC NOT NULL,
  temps_initial_h NUMERIC,
  distance_initiale_km NUMERIC,
  co2_initial_kg NUMERIC,

  -- Après optimisation
  cout_optimise NUMERIC NOT NULL,
  temps_optimise_h NUMERIC,
  distance_optimisee_km NUMERIC,
  co2_optimise_kg NUMERIC,

  -- Gains
  economie_eur NUMERIC GENERATED ALWAYS AS (cout_initial - cout_optimise) STORED,
  economie_pct NUMERIC GENERATED ALWAYS AS (
    CASE
      WHEN cout_initial > 0
      THEN ROUND(((cout_initial - cout_optimise) / cout_initial) * 100, 2)
      ELSE 0
    END
  ) STORED,

  gain_temps_h NUMERIC GENERATED ALWAYS AS (temps_initial_h - temps_optimise_h) STORED,
  reduction_co2_kg NUMERIC GENERATED ALWAYS AS (co2_initial_kg - co2_optimise_kg) STORED,

  -- Justification
  justification TEXT,
  algorithme_utilise TEXT,

  -- Validation
  validee BOOLEAN DEFAULT true,
  validee_par UUID REFERENCES auth.users(id),

  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Index
CREATE INDEX idx_economies_plan ON economies_optimisation(plan_transport_id);
CREATE INDEX idx_economies_client ON economies_optimisation(client_id);
CREATE INDEX idx_economies_type ON economies_optimisation(type_optimisation);
CREATE INDEX idx_economies_montant ON economies_optimisation(economie_eur DESC);

-- RLS
ALTER TABLE economies_optimisation ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Accès économies via plan ou client"
  ON economies_optimisation FOR SELECT
  USING (
    client_id IN (
      SELECT client_id FROM profiles WHERE id = auth.uid()
    ) OR
    EXISTS (
      SELECT 1 FROM user_roles
      WHERE user_id = auth.uid()
      AND role IN ('admin', 'gestionnaire')
    )
  );

-- =====================================================
-- Table: Rapports environnementaux
-- =====================================================
CREATE TABLE IF NOT EXISTS rapport_environnemental (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  client_id UUID REFERENCES client(id) ON DELETE CASCADE,

  -- Période
  periode_debut DATE NOT NULL,
  periode_fin DATE NOT NULL,

  -- Émissions totales
  emission_co2_totale_kg NUMERIC DEFAULT 0,
  emission_co2_par_expedition_kg NUMERIC,
  emission_co2_par_tonne_km NUMERIC,

  -- Répartition par mode
  emission_road_kg NUMERIC DEFAULT 0,
  emission_sea_kg NUMERIC DEFAULT 0,
  emission_air_kg NUMERIC DEFAULT 0,
  emission_rail_kg NUMERIC DEFAULT 0,

  -- Économies via optimisation
  emission_co2_economisee_kg NUMERIC DEFAULT 0,
  taux_reduction_pct NUMERIC,

  -- Objectifs
  objectif_reduction_pct NUMERIC,
  statut_objectif TEXT CHECK (statut_objectif IN (
    'on_track',   -- En bonne voie
    'at_risk',    -- À risque
    'achieved',   -- Atteint
    'missed'      -- Manqué
  )),

  -- Équivalents (pour communication)
  equivalent_arbres INTEGER, -- Arbres à planter pour compenser
  equivalent_voitures_km NUMERIC, -- km parcourus en voiture

  -- Certifications
  norme_calcul TEXT DEFAULT 'EN 16258', -- Norme européenne
  certifie BOOLEAN DEFAULT false,
  certificat_url TEXT,

  -- Métadonnées
  meta_data JSONB,

  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),

  UNIQUE(client_id, periode_debut, periode_fin)
);

-- Index
CREATE INDEX idx_rapport_env_client ON rapport_environnemental(client_id);
CREATE INDEX idx_rapport_env_periode ON rapport_environnemental(periode_debut, periode_fin);

-- RLS
ALTER TABLE rapport_environnemental ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Client voit ses rapports environnementaux"
  ON rapport_environnemental FOR SELECT
  USING (
    client_id IN (
      SELECT client_id FROM profiles WHERE id = auth.uid()
    )
  );

CREATE POLICY "Admin gère rapports environnementaux"
  ON rapport_environnemental FOR ALL
  USING (
    EXISTS (
      SELECT 1 FROM user_roles
      WHERE user_id = auth.uid()
      AND role IN ('admin', 'gestionnaire')
    )
  );

-- =====================================================
-- Table: Devis transport
-- =====================================================
CREATE TABLE IF NOT EXISTS devis_transport (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  client_id UUID REFERENCES client(id) ON DELETE CASCADE,

  -- Identification
  numero_devis TEXT UNIQUE NOT NULL,
  reference_client TEXT,

  -- Dates
  date_creation TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  date_validite DATE,

  -- Origine / Destination
  origine JSONB NOT NULL, -- {nom, adresse, ville, cp, pays, lat, lng}
  destination JSONB NOT NULL,

  -- Marchandise
  marchandise JSONB, -- {poids_kg, volume_m3, nature, valeur, dangereux}

  -- Transport
  mode_transport_id UUID REFERENCES mode_transport(id),
  transporteur_id UUID REFERENCES transporteur(id),

  -- Tarification
  prix_ht NUMERIC NOT NULL,
  prix_ttc NUMERIC,
  devise TEXT DEFAULT 'EUR',
  details_tarification JSONB, -- {base, km, poids, supplements}

  -- Délais
  delai_pickup_heures INTEGER,
  delai_livraison_jours INTEGER,

  -- Statut
  statut TEXT DEFAULT 'draft' CHECK (statut IN (
    'draft',    -- Brouillon
    'sent',     -- Envoyé
    'accepted', -- Accepté
    'rejected', -- Rejeté
    'expired'   -- Expiré
  )),

  -- Conversion
  plan_transport_id UUID REFERENCES plan_transport(id), -- Si converti en plan

  -- Commercial
  remise_pct NUMERIC DEFAULT 0,
  conditions_commerciales TEXT,
  notes TEXT,

  -- Documents
  document_url TEXT,

  -- Métadonnées
  meta_data JSONB,

  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Index
CREATE INDEX idx_devis_client ON devis_transport(client_id);
CREATE INDEX idx_devis_statut ON devis_transport(statut);
CREATE INDEX idx_devis_date ON devis_transport(date_creation DESC);
CREATE INDEX idx_devis_transporteur ON devis_transport(transporteur_id);

-- RLS
ALTER TABLE devis_transport ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Client voit ses devis"
  ON devis_transport FOR SELECT
  USING (
    client_id IN (
      SELECT client_id FROM profiles WHERE id = auth.uid()
    )
  );

CREATE POLICY "Admin gère tous les devis"
  ON devis_transport FOR ALL
  USING (
    EXISTS (
      SELECT 1 FROM user_roles
      WHERE user_id = auth.uid()
      AND role IN ('admin', 'gestionnaire')
    )
  );

-- =====================================================
-- Table: Documents de transport
-- =====================================================
CREATE TABLE IF NOT EXISTS document_transport (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  plan_transport_id UUID REFERENCES plan_transport(id) ON DELETE CASCADE,

  -- Type de document
  type_document TEXT NOT NULL CHECK (type_document IN (
    'CMR',              -- Lettre de voiture (routier)
    'BOL',              -- Bill of Lading (maritime)
    'AWB',              -- Air Waybill (aérien)
    'POD',              -- Proof of Delivery
    'invoice',          -- Facture
    'packing_list',     -- Liste de colisage
    'customs_declaration', -- Déclaration douanière
    'insurance',        -- Assurance
    'certificate'       -- Certificat
  )),

  -- Identification
  numero_document TEXT NOT NULL,
  date_emission DATE DEFAULT CURRENT_DATE,

  -- Fichier
  fichier_url TEXT,
  fichier_storage_path TEXT,

  -- Signature électronique
  signature_electronique TEXT,
  signe_par TEXT,
  signe_at TIMESTAMP WITH TIME ZONE,

  -- Métadonnées
  meta_data JSONB,

  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),

  UNIQUE(type_document, numero_document)
);

-- Index
CREATE INDEX idx_document_plan ON document_transport(plan_transport_id);
CREATE INDEX idx_document_type ON document_transport(type_document);
CREATE INDEX idx_document_numero ON document_transport(numero_document);

-- RLS
ALTER TABLE document_transport ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Accès document via plan transport"
  ON document_transport FOR ALL
  USING (
    plan_transport_id IN (
      SELECT id FROM plan_transport
    )
  );

-- =====================================================
-- Table: Facturation transport
-- =====================================================
CREATE TABLE IF NOT EXISTS facture_transport (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  plan_transport_id UUID REFERENCES plan_transport(id) ON DELETE SET NULL,
  client_id UUID REFERENCES client(id) ON DELETE CASCADE,
  transporteur_id UUID REFERENCES transporteur(id),

  -- Identification
  numero_facture TEXT UNIQUE NOT NULL,
  reference_externe TEXT,

  -- Dates
  date_facture DATE DEFAULT CURRENT_DATE,
  date_echeance DATE,
  date_paiement DATE,

  -- Montants
  montant_ht NUMERIC NOT NULL,
  montant_tva NUMERIC,
  montant_ttc NUMERIC,
  devise TEXT DEFAULT 'EUR',

  -- Détail
  lignes_facture JSONB, -- [{description, qte, pu, total}]

  -- Statut
  statut TEXT DEFAULT 'draft' CHECK (statut IN (
    'draft',    -- Brouillon
    'sent',     -- Envoyée
    'paid',     -- Payée
    'overdue',  -- En retard
    'cancelled' -- Annulée
  )),

  -- Paiement
  mode_paiement TEXT,
  reference_paiement TEXT,

  -- Documents
  document_url TEXT,

  -- Métadonnées
  meta_data JSONB,

  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Index
CREATE INDEX idx_facture_plan ON facture_transport(plan_transport_id);
CREATE INDEX idx_facture_client ON facture_transport(client_id);
CREATE INDEX idx_facture_transporteur ON facture_transport(transporteur_id);
CREATE INDEX idx_facture_statut ON facture_transport(statut);
CREATE INDEX idx_facture_echeance ON facture_transport(date_echeance);

-- RLS
ALTER TABLE facture_transport ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Client voit ses factures transport"
  ON facture_transport FOR SELECT
  USING (
    client_id IN (
      SELECT client_id FROM profiles WHERE id = auth.uid()
    )
  );

CREATE POLICY "Admin gère factures transport"
  ON facture_transport FOR ALL
  USING (
    EXISTS (
      SELECT 1 FROM user_roles
      WHERE user_id = auth.uid()
      AND role IN ('admin', 'gestionnaire')
    )
  );

-- =====================================================
-- Fonction: Générer numéro devis automatique
-- =====================================================
CREATE OR REPLACE FUNCTION generate_devis_numero()
RETURNS TRIGGER AS $$
BEGIN
  IF NEW.numero_devis IS NULL THEN
    NEW.numero_devis := 'DV-' || TO_CHAR(NOW(), 'YYYYMMDD') || '-' ||
                        LPAD(NEXTVAL('devis_transport_sequence')::TEXT, 5, '0');
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE SEQUENCE IF NOT EXISTS devis_transport_sequence START 1;

DROP TRIGGER IF EXISTS trg_generate_devis_numero ON devis_transport;
CREATE TRIGGER trg_generate_devis_numero
  BEFORE INSERT ON devis_transport
  FOR EACH ROW
  EXECUTE FUNCTION generate_devis_numero();

-- =====================================================
-- Fonction: Générer numéro facture automatique
-- =====================================================
CREATE OR REPLACE FUNCTION generate_facture_numero()
RETURNS TRIGGER AS $$
BEGIN
  IF NEW.numero_facture IS NULL THEN
    NEW.numero_facture := 'FT-' || TO_CHAR(NOW(), 'YYYYMMDD') || '-' ||
                          LPAD(NEXTVAL('facture_transport_sequence')::TEXT, 5, '0');
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE SEQUENCE IF NOT EXISTS facture_transport_sequence START 1;

DROP TRIGGER IF EXISTS trg_generate_facture_numero ON facture_transport;
CREATE TRIGGER trg_generate_facture_numero
  BEFORE INSERT ON facture_transport
  FOR EACH ROW
  EXECUTE FUNCTION generate_facture_numero();

-- =====================================================
-- Triggers updated_at
-- =====================================================
CREATE TRIGGER trg_tms_kpi_updated_at
  BEFORE UPDATE ON tms_kpi_snapshot
  FOR EACH ROW
  EXECUTE FUNCTION update_tms_updated_at();

CREATE TRIGGER trg_rapport_env_updated_at
  BEFORE UPDATE ON rapport_environnemental
  FOR EACH ROW
  EXECUTE FUNCTION update_tms_updated_at();

CREATE TRIGGER trg_devis_updated_at
  BEFORE UPDATE ON devis_transport
  FOR EACH ROW
  EXECUTE FUNCTION update_tms_updated_at();

CREATE TRIGGER trg_facture_updated_at
  BEFORE UPDATE ON facture_transport
  FOR EACH ROW
  EXECUTE FUNCTION update_tms_updated_at();

-- =====================================================
-- Commentaires
-- =====================================================
COMMENT ON TABLE tms_kpi_snapshot IS 'KPIs TMS consolidés par période (dashboard analytics)';
COMMENT ON TABLE economies_optimisation IS 'Tracking des économies réalisées par optimisation IA';
COMMENT ON TABLE rapport_environnemental IS 'Rapports ESG - Émissions CO2 et objectifs environnementaux';
COMMENT ON TABLE devis_transport IS 'Devis de transport pour les clients';
COMMENT ON TABLE document_transport IS 'Documents de transport (CMR, BOL, AWB, POD, etc.)';
COMMENT ON TABLE facture_transport IS 'Facturation des transports';
