-- Table pour les règles de tags automatiques
CREATE TABLE public.regle_tag_automatique (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  nom_regle VARCHAR(255) NOT NULL,
  tag VARCHAR(100) NOT NULL,
  couleur_tag VARCHAR(50) NOT NULL,
  priorite INTEGER NOT NULL DEFAULT 0,
  actif BOOLEAN DEFAULT true,
  conditions JSONB NOT NULL DEFAULT '[]'::jsonb,
  date_creation TIMESTAMP WITH TIME ZONE DEFAULT now(),
  date_modification TIMESTAMP WITH TIME ZONE DEFAULT now(),
  created_by UUID REFERENCES auth.users(id)
);

-- Table pour les règles de transport automatiques
CREATE TABLE public.regle_transport_automatique (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  nom_regle VARCHAR(255) NOT NULL,
  transporteur VARCHAR(100) NOT NULL,
  priorite INTEGER NOT NULL DEFAULT 0,
  actif BOOLEAN DEFAULT true,
  conditions JSONB NOT NULL DEFAULT '[]'::jsonb,
  config_poids_volumetrique JSONB,
  date_creation TIMESTAMP WITH TIME ZONE DEFAULT now(),
  date_modification TIMESTAMP WITH TIME ZONE DEFAULT now(),
  created_by UUID REFERENCES auth.users(id)
);

-- Table pour les types de cartons
CREATE TABLE public.type_carton (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  nom VARCHAR(255) NOT NULL,
  longueur_cm NUMERIC NOT NULL,
  largeur_cm NUMERIC NOT NULL,
  hauteur_cm NUMERIC NOT NULL,
  poids_carton_kg NUMERIC NOT NULL DEFAULT 0,
  volume_m3 NUMERIC GENERATED ALWAYS AS ((longueur_cm * largeur_cm * hauteur_cm) / 1000000) STORED,
  actif BOOLEAN DEFAULT true,
  date_creation TIMESTAMP WITH TIME ZONE DEFAULT now()
);

-- Table pour historique de scan picking
CREATE TABLE public.scan_picking (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  session_id UUID NOT NULL REFERENCES session_preparation(id),
  commande_id UUID NOT NULL REFERENCES commande(id),
  ligne_commande_id UUID REFERENCES ligne_commande(id),
  produit_id UUID NOT NULL REFERENCES produit(id),
  code_barre VARCHAR(255) NOT NULL,
  quantite_scannee INTEGER NOT NULL DEFAULT 1,
  operateur_id UUID REFERENCES auth.users(id),
  date_scan TIMESTAMP WITH TIME ZONE DEFAULT now(),
  statut_scan VARCHAR(50) DEFAULT 'valide',
  remarques TEXT
);

-- Ajout des colonnes à la table commande
ALTER TABLE public.commande
ADD COLUMN IF NOT EXISTS sendcloud_shipment_id TEXT,
ADD COLUMN IF NOT EXISTS tracking_number TEXT,
ADD COLUMN IF NOT EXISTS tracking_url TEXT,
ADD COLUMN IF NOT EXISTS label_url TEXT,
ADD COLUMN IF NOT EXISTS label_source VARCHAR(100),
ADD COLUMN IF NOT EXISTS tags TEXT[] DEFAULT '{}',
ADD COLUMN IF NOT EXISTS poids_reel_kg NUMERIC,
ADD COLUMN IF NOT EXISTS poids_volumetrique_kg NUMERIC,
ADD COLUMN IF NOT EXISTS transporteur_choisi VARCHAR(100),
ADD COLUMN IF NOT EXISTS zone_livraison VARCHAR(100),
ADD COLUMN IF NOT EXISTS type_carton_id UUID REFERENCES type_carton(id),
ADD COLUMN IF NOT EXISTS notes_expedition TEXT;

-- Index pour performance
CREATE INDEX idx_regle_tag_actif ON regle_tag_automatique(actif, priorite);
CREATE INDEX idx_regle_transport_actif ON regle_transport_automatique(actif, priorite);
CREATE INDEX idx_scan_picking_session ON scan_picking(session_id, date_scan);
CREATE INDEX idx_scan_picking_commande ON scan_picking(commande_id);
CREATE INDEX idx_commande_tags ON commande USING GIN(tags);

-- RLS policies
ALTER TABLE public.regle_tag_automatique ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.regle_transport_automatique ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.type_carton ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.scan_picking ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Admin full access on regle_tag_automatique" ON regle_tag_automatique FOR ALL USING (has_role(auth.uid(), 'admin'::app_role));
CREATE POLICY "Gestionnaire read regle_tag_automatique" ON regle_tag_automatique FOR SELECT USING (has_role(auth.uid(), 'gestionnaire'::app_role));

CREATE POLICY "Admin full access on regle_transport_automatique" ON regle_transport_automatique FOR ALL USING (has_role(auth.uid(), 'admin'::app_role));
CREATE POLICY "Gestionnaire read regle_transport_automatique" ON regle_transport_automatique FOR SELECT USING (has_role(auth.uid(), 'gestionnaire'::app_role));

CREATE POLICY "Admin full access on type_carton" ON type_carton FOR ALL USING (has_role(auth.uid(), 'admin'::app_role));
CREATE POLICY "Operateur read type_carton" ON type_carton FOR SELECT USING (has_role(auth.uid(), 'operateur'::app_role));

CREATE POLICY "Admin full access on scan_picking" ON scan_picking FOR ALL USING (has_role(auth.uid(), 'admin'::app_role));
CREATE POLICY "Operateur insert scan_picking" ON scan_picking FOR INSERT WITH CHECK (has_role(auth.uid(), 'operateur'::app_role));
CREATE POLICY "Operateur read scan_picking" ON scan_picking FOR SELECT USING (has_role(auth.uid(), 'operateur'::app_role));

-- Trigger pour date_modification
CREATE TRIGGER update_regle_tag_date_modification
  BEFORE UPDATE ON regle_tag_automatique
  FOR EACH ROW
  EXECUTE FUNCTION update_session_preparation_date_modification();

CREATE TRIGGER update_regle_transport_date_modification
  BEFORE UPDATE ON regle_transport_automatique
  FOR EACH ROW
  EXECUTE FUNCTION update_session_preparation_date_modification();