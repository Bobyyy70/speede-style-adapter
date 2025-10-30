-- ============================================================================
-- ÉTAPE 1: Enrichir la table commande avec tous les champs professionnels
-- ============================================================================

-- Informations Commerciales
ALTER TABLE commande ADD COLUMN IF NOT EXISTS incoterm VARCHAR(10);
ALTER TABLE commande ADD COLUMN IF NOT EXISTS conditions_paiement VARCHAR(50);
ALTER TABLE commande ADD COLUMN IF NOT EXISTS date_expiration_commande DATE;
ALTER TABLE commande ADD COLUMN IF NOT EXISTS priorite_expedition VARCHAR(20) DEFAULT 'standard';

-- Informations Douanières (pour international)
ALTER TABLE commande ADD COLUMN IF NOT EXISTS nature_marchandise TEXT;
ALTER TABLE commande ADD COLUMN IF NOT EXISTS code_hs VARCHAR(20);
ALTER TABLE commande ADD COLUMN IF NOT EXISTS pays_origine_marchandise VARCHAR(2);
ALTER TABLE commande ADD COLUMN IF NOT EXISTS valeur_declaree_douane NUMERIC(12,2);
ALTER TABLE commande ADD COLUMN IF NOT EXISTS documents_douane_requis TEXT[];

-- Informations Service Client
ALTER TABLE commande ADD COLUMN IF NOT EXISTS reference_client VARCHAR(100);
ALTER TABLE commande ADD COLUMN IF NOT EXISTS reference_interne VARCHAR(100);
ALTER TABLE commande ADD COLUMN IF NOT EXISTS date_expedition_demandee DATE;
ALTER TABLE commande ADD COLUMN IF NOT EXISTS instructions_livraison TEXT;
ALTER TABLE commande ADD COLUMN IF NOT EXISTS point_relais_id VARCHAR(100);

-- Informations de Facturation détaillée
ALTER TABLE commande ADD COLUMN IF NOT EXISTS facturation_tva_numero VARCHAR(50);
ALTER TABLE commande ADD COLUMN IF NOT EXISTS facturation_siret VARCHAR(14);

-- Statuts détaillés de l'expédition
ALTER TABLE commande ADD COLUMN IF NOT EXISTS date_picking TIMESTAMP;
ALTER TABLE commande ADD COLUMN IF NOT EXISTS date_packing TIMESTAMP;
ALTER TABLE commande ADD COLUMN IF NOT EXISTS date_expedition TIMESTAMP;
ALTER TABLE commande ADD COLUMN IF NOT EXISTS date_livraison_estimee DATE;
ALTER TABLE commande ADD COLUMN IF NOT EXISTS date_livraison_reelle TIMESTAMP;

-- Informations assurance
ALTER TABLE commande ADD COLUMN IF NOT EXISTS assurance_demandee BOOLEAN DEFAULT false;
ALTER TABLE commande ADD COLUMN IF NOT EXISTS valeur_assuree NUMERIC(12,2);

-- ============================================================================
-- ÉTAPE 2: Créer la table configuration_expediteur
-- ============================================================================

CREATE TABLE IF NOT EXISTS configuration_expediteur (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  client_id UUID REFERENCES client(id) ON DELETE CASCADE,
  nom VARCHAR(255) NOT NULL,
  entreprise VARCHAR(255) NOT NULL,
  email VARCHAR(255) NOT NULL,
  telephone VARCHAR(50) NOT NULL,
  adresse_ligne_1 TEXT NOT NULL,
  adresse_ligne_2 TEXT,
  code_postal VARCHAR(20) NOT NULL,
  ville VARCHAR(100) NOT NULL,
  pays_code VARCHAR(2) NOT NULL DEFAULT 'FR',
  eori_number VARCHAR(50),
  vat_number VARCHAR(50),
  est_defaut BOOLEAN DEFAULT false,
  actif BOOLEAN DEFAULT true,
  date_creation TIMESTAMP DEFAULT NOW(),
  date_modification TIMESTAMP DEFAULT NOW()
);

-- Index pour performances
CREATE INDEX IF NOT EXISTS idx_config_expediteur_client ON configuration_expediteur(client_id);
CREATE INDEX IF NOT EXISTS idx_config_expediteur_defaut ON configuration_expediteur(client_id, est_defaut) WHERE est_defaut = true;

-- ============================================================================
-- ÉTAPE 3: Créer les tables transporteur_configuration et transporteur_service
-- ============================================================================

CREATE TABLE IF NOT EXISTS transporteur_configuration (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  code_transporteur VARCHAR(50) UNIQUE NOT NULL,
  nom_complet VARCHAR(255) NOT NULL,
  logo_url TEXT,
  actif BOOLEAN DEFAULT true,
  api_endpoint TEXT,
  api_credentials_encrypted TEXT,
  services_disponibles JSONB DEFAULT '[]'::jsonb,
  zones_couverture JSONB DEFAULT '[]'::jsonb,
  delais_moyens JSONB DEFAULT '{}'::jsonb,
  date_creation TIMESTAMP DEFAULT NOW(),
  date_modification TIMESTAMP DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS transporteur_service (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  transporteur_id UUID REFERENCES transporteur_configuration(id) ON DELETE CASCADE,
  code_service VARCHAR(50) NOT NULL,
  nom_affichage VARCHAR(255) NOT NULL,
  description TEXT,
  delai_min_jours INTEGER,
  delai_max_jours INTEGER,
  poids_min_kg NUMERIC(10,2),
  poids_max_kg NUMERIC(10,2),
  dimensions_max_cm JSONB,
  suivi_disponible BOOLEAN DEFAULT true,
  assurance_incluse BOOLEAN DEFAULT false,
  actif BOOLEAN DEFAULT true,
  date_creation TIMESTAMP DEFAULT NOW()
);

-- Index pour performances
CREATE INDEX IF NOT EXISTS idx_transporteur_service_transporteur ON transporteur_service(transporteur_id);
CREATE INDEX IF NOT EXISTS idx_transporteur_service_actif ON transporteur_service(actif) WHERE actif = true;

-- ============================================================================
-- ÉTAPE 4: Fonction d'auto-complétion des champs de commande
-- ============================================================================

CREATE OR REPLACE FUNCTION auto_complete_commande_fields()
RETURNS TRIGGER AS $$
DECLARE
  v_expediteur RECORD;
  v_client RECORD;
BEGIN
  -- Si pas d'expéditeur renseigné et que client_id existe
  IF NEW.expediteur_entreprise IS NULL AND NEW.client_id IS NOT NULL THEN
    -- Chercher la config expéditeur par défaut du client
    SELECT * INTO v_expediteur
    FROM configuration_expediteur
    WHERE client_id = NEW.client_id 
      AND est_defaut = true 
      AND actif = true
    LIMIT 1;
    
    -- Si trouvé, remplir les champs expéditeur
    IF FOUND THEN
      NEW.expediteur_nom := v_expediteur.nom;
      NEW.expediteur_entreprise := v_expediteur.entreprise;
      NEW.expediteur_email := v_expediteur.email;
      NEW.expediteur_telephone := v_expediteur.telephone;
      NEW.expediteur_adresse_ligne_1 := v_expediteur.adresse_ligne_1;
      NEW.expediteur_adresse_ligne_2 := v_expediteur.adresse_ligne_2;
      NEW.expediteur_code_postal := v_expediteur.code_postal;
      NEW.expediteur_ville := v_expediteur.ville;
      NEW.expediteur_pays_code := v_expediteur.pays_code;
    ELSE
      -- Sinon, essayer de remplir depuis la table client
      SELECT * INTO v_client
      FROM client
      WHERE id = NEW.client_id;
      
      IF FOUND THEN
        NEW.expediteur_entreprise := v_client.nom_client;
        NEW.expediteur_email := v_client.email;
        NEW.expediteur_telephone := v_client.telephone;
        NEW.expediteur_adresse_ligne_1 := v_client.adresse;
        NEW.expediteur_pays_code := COALESCE(v_client.pays, 'FR');
      END IF;
    END IF;
  END IF;
  
  -- Valeurs par défaut intelligentes
  IF NEW.incoterm IS NULL THEN
    NEW.incoterm := 'DDP'; -- Delivered Duty Paid par défaut
  END IF;
  
  IF NEW.priorite_expedition IS NULL THEN
    NEW.priorite_expedition := 'standard';
  END IF;
  
  IF NEW.date_expedition_demandee IS NULL THEN
    NEW.date_expedition_demandee := CURRENT_DATE + INTERVAL '1 day';
  END IF;
  
  IF NEW.pays_origine_marchandise IS NULL THEN
    NEW.pays_origine_marchandise := COALESCE(NEW.expediteur_pays_code, 'FR');
  END IF;
  
  IF NEW.reference_interne IS NULL THEN
    NEW.reference_interne := NEW.numero_commande;
  END IF;
  
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public;

-- Créer le trigger
DROP TRIGGER IF EXISTS before_insert_commande_autocomplete ON commande;
CREATE TRIGGER before_insert_commande_autocomplete
BEFORE INSERT ON commande
FOR EACH ROW EXECUTE FUNCTION auto_complete_commande_fields();

-- ============================================================================
-- ÉTAPE 5: RLS Policies pour les nouvelles tables
-- ============================================================================

-- Activer RLS sur configuration_expediteur
ALTER TABLE configuration_expediteur ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Admin full access on configuration_expediteur"
ON configuration_expediteur FOR ALL
TO authenticated
USING (has_role(auth.uid(), 'admin'::app_role))
WITH CHECK (has_role(auth.uid(), 'admin'::app_role));

CREATE POLICY "Client read own configuration_expediteur"
ON configuration_expediteur FOR SELECT
TO authenticated
USING (
  has_role(auth.uid(), 'client'::app_role) 
  AND client_id IN (
    SELECT client_id FROM profiles WHERE id = auth.uid()
  )
);

CREATE POLICY "Gestionnaire read configuration_expediteur"
ON configuration_expediteur FOR SELECT
TO authenticated
USING (has_role(auth.uid(), 'gestionnaire'::app_role));

-- Activer RLS sur transporteur_configuration
ALTER TABLE transporteur_configuration ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Admin full access on transporteur_configuration"
ON transporteur_configuration FOR ALL
TO authenticated
USING (has_role(auth.uid(), 'admin'::app_role))
WITH CHECK (has_role(auth.uid(), 'admin'::app_role));

CREATE POLICY "All authenticated read transporteur_configuration"
ON transporteur_configuration FOR SELECT
TO authenticated
USING (actif = true);

-- Activer RLS sur transporteur_service
ALTER TABLE transporteur_service ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Admin full access on transporteur_service"
ON transporteur_service FOR ALL
TO authenticated
USING (has_role(auth.uid(), 'admin'::app_role))
WITH CHECK (has_role(auth.uid(), 'admin'::app_role));

CREATE POLICY "All authenticated read transporteur_service"
ON transporteur_service FOR SELECT
TO authenticated
USING (actif = true);

-- ============================================================================
-- ÉTAPE 6: Insérer des données de base pour les transporteurs
-- ============================================================================

INSERT INTO transporteur_configuration (code_transporteur, nom_complet, actif, zones_couverture)
VALUES 
  ('DHL', 'DHL Express', true, '["FR", "EU", "WORLD"]'::jsonb),
  ('FEDEX', 'FedEx International', true, '["FR", "EU", "US", "WORLD"]'::jsonb),
  ('CHRONOPOST', 'Chronopost', true, '["FR", "EU"]'::jsonb),
  ('COLISSIMO', 'La Poste Colissimo', true, '["FR", "EU"]'::jsonb),
  ('UPS', 'UPS', true, '["FR", "EU", "US", "WORLD"]'::jsonb),
  ('SENDCLOUD', 'SendCloud Multi-Carrier', true, '["FR", "EU", "WORLD"]'::jsonb)
ON CONFLICT (code_transporteur) DO NOTHING;