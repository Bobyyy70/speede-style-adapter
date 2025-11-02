-- Phase 1: Supprimer les anciens services logistiques et créer le système de services personnalisés
DROP TABLE IF EXISTS public.ligne_service_commande CASCADE;
DROP TABLE IF EXISTS public.service_logistique CASCADE;

-- Table des services personnalisés (les 8 nouveaux services)
CREATE TABLE public.service_logistique (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  code_service VARCHAR(100) NOT NULL UNIQUE,
  nom_service VARCHAR(255) NOT NULL,
  description TEXT,
  categorie VARCHAR(100) NOT NULL, -- 'emballage', 'logistique', 'valeur_ajoutee'
  type_facturation VARCHAR(50) NOT NULL, -- 'unitaire', 'horaire', 'forfait', 'devis'
  prix_unitaire NUMERIC(10,2) DEFAULT 0,
  formulaire_hubspot_url TEXT,
  actif BOOLEAN DEFAULT true,
  date_creation TIMESTAMPTZ DEFAULT NOW(),
  date_modification TIMESTAMPTZ DEFAULT NOW()
);

-- Table des demandes de services personnalisés
CREATE TABLE public.demande_service_personnalise (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  client_id UUID REFERENCES public.client(id) NOT NULL,
  service_id UUID REFERENCES public.service_logistique(id) NOT NULL,
  formulaire_data JSONB NOT NULL,
  statut VARCHAR(50) DEFAULT 'en_attente_rdv', -- 'en_attente_rdv', 'rdv_planifie', 'valide', 'en_cours', 'termine', 'annule'
  prix_estime NUMERIC(10,2),
  prix_final NUMERIC(10,2),
  hubspot_ticket_id TEXT,
  date_rdv TIMESTAMPTZ,
  date_creation TIMESTAMPTZ DEFAULT NOW(),
  date_modification TIMESTAMPTZ DEFAULT NOW(),
  remarques_admin TEXT,
  created_by UUID REFERENCES auth.users(id)
);

-- Phase 2: Tables de règles automatiques

-- Règles de sessions de préparation (Commandes)
CREATE TABLE public.regle_session_preparation (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  nom_regle VARCHAR(255) NOT NULL,
  description TEXT,
  conditions JSONB NOT NULL, -- [{"relation": "Commande", "field": "statut", "operator": "equals", "value": "stock_reserve"}]
  type_session VARCHAR(100) DEFAULT 'standard', -- 'standard', 'express', 'client_dedie'
  auto_assignation_operateur UUID REFERENCES auth.users(id),
  actif BOOLEAN DEFAULT true,
  priorite INTEGER DEFAULT 100,
  date_creation TIMESTAMPTZ DEFAULT NOW(),
  date_modification TIMESTAMPTZ DEFAULT NOW()
);

-- Règles d'attribution d'emballage (Préparation)
CREATE TABLE public.regle_attribution_emballage (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  nom_regle VARCHAR(255) NOT NULL,
  description TEXT,
  conditions JSONB NOT NULL, -- [{"relation": "Produit", "field": "poids", "operator": "lessThan", "value": 500}]
  type_carton_id UUID REFERENCES public.type_carton(id),
  code_emballage VARCHAR(100), -- Si pas de type_carton_id, code libre
  priorite INTEGER DEFAULT 100,
  actif BOOLEAN DEFAULT true,
  date_creation TIMESTAMPTZ DEFAULT NOW()
);

-- Règles de picking optimal (Préparation)
CREATE TABLE public.regle_picking_optimal (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  nom_regle VARCHAR(255) NOT NULL,
  description TEXT,
  strategie VARCHAR(100) NOT NULL, -- 'zone_prioritaire', 'chemin_court', 'fefo', 'fifo'
  conditions JSONB, -- [{"relation": "Session", "field": "type", "operator": "equals", "value": "express"}]
  parametres JSONB, -- {"zones_prioritaires": ["A", "B"], "max_distance": 50}
  actif BOOLEAN DEFAULT true,
  priorite INTEGER DEFAULT 100,
  date_creation TIMESTAMPTZ DEFAULT NOW()
);

-- Règles de traitement automatique des retours (Retours)
CREATE TABLE public.regle_traitement_retour (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  nom_regle VARCHAR(255) NOT NULL,
  description TEXT,
  conditions JSONB NOT NULL, -- [{"relation": "Retour", "field": "raison_retour", "operator": "equals", "value": "defaut_qualite"}]
  actions_automatiques JSONB NOT NULL, -- [{"type": "creer_ticket", "priorite": "haute"}, {"type": "quarantaine"}]
  validation_manuelle_requise BOOLEAN DEFAULT false,
  actif BOOLEAN DEFAULT true,
  priorite INTEGER DEFAULT 100,
  date_creation TIMESTAMPTZ DEFAULT NOW()
);

-- Règles d'attribution d'emplacement à la réception (Stock)
CREATE TABLE public.regle_attribution_emplacement (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  nom_regle VARCHAR(255) NOT NULL,
  description TEXT,
  conditions JSONB NOT NULL, -- [{"relation": "Produit", "field": "categorie", "operator": "equals", "value": "textile"}]
  zone_cible VARCHAR(100),
  type_emplacement_cible VARCHAR(100), -- 'picking', 'reserve', 'palette'
  priorite INTEGER DEFAULT 100,
  actif BOOLEAN DEFAULT true,
  date_creation TIMESTAMPTZ DEFAULT NOW()
);

-- Phase 3: Colonnes additionnelles pour support des règles
ALTER TABLE public.produit ADD COLUMN IF NOT EXISTS rotation_stock VARCHAR(50); -- 'haute', 'moyenne', 'basse'
ALTER TABLE public.session_preparation ADD COLUMN IF NOT EXISTS strategie_picking VARCHAR(100);

-- Phase 4: Insertion des 8 services personnalisés par défaut
INSERT INTO public.service_logistique (code_service, nom_service, description, categorie, type_facturation, prix_unitaire) VALUES
('carton_personnalise', 'Carton Personnalisé', 'Fourniture de cartons avec votre branding. Envoyez vos cartons ou commandez via nos partenaires.', 'emballage', 'devis', 0),
('montage_boxes', 'Montage de Boxes', 'Assemblage de coffrets cadeaux, kits marketing ou boxes personnalisées.', 'valeur_ajoutee', 'unitaire', 2.50),
('re_etiquetage', 'Ré-étiquetage', 'Retrait des anciennes étiquettes et pose de nouvelles étiquettes personnalisées.', 'valeur_ajoutee', 'unitaire', 0.80),
('etiquetage_asin_fba', 'Étiquetage ASIN FBA', 'Étiquettes Amazon FBA conformes pour vos produits.', 'valeur_ajoutee', 'unitaire', 0.50),
('emballage_specifique', 'Emballage Spécifique', 'Emballage sur-mesure pour produits fragiles, luxe ou nécessitant une protection particulière.', 'emballage', 'devis', 0),
('dechargement_conteneur', 'Déchargement Conteneur', 'Déchargement et mise en stock de conteneurs maritimes ou routiers.', 'logistique', 'forfait', 350),
('inventaire_demande', 'Inventaire à la Demande', 'Inventaire physique complet ou partiel de votre stock.', 'logistique', 'devis', 0),
('carte_personnalisee', 'Carte Personnalisée', 'Insertion de cartes personnalisées ou flyers dans vos colis.', 'valeur_ajoutee', 'unitaire', 0.30);

-- Phase 5: RLS Policies pour les nouvelles tables

-- service_logistique
ALTER TABLE public.service_logistique ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Admin full access on service_logistique"
ON public.service_logistique FOR ALL
TO authenticated
USING (has_role(auth.uid(), 'admin'::app_role))
WITH CHECK (has_role(auth.uid(), 'admin'::app_role));

CREATE POLICY "All authenticated read service_logistique"
ON public.service_logistique FOR SELECT
TO authenticated
USING (actif = true);

-- demande_service_personnalise
ALTER TABLE public.demande_service_personnalise ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Admin full access on demande_service_personnalise"
ON public.demande_service_personnalise FOR ALL
TO authenticated
USING (has_role(auth.uid(), 'admin'::app_role))
WITH CHECK (has_role(auth.uid(), 'admin'::app_role));

CREATE POLICY "Client read own demandes"
ON public.demande_service_personnalise FOR SELECT
TO authenticated
USING (
  has_role(auth.uid(), 'client'::app_role) AND
  client_id IN (SELECT client_id FROM public.profiles WHERE id = auth.uid())
);

CREATE POLICY "Client insert own demandes"
ON public.demande_service_personnalise FOR INSERT
TO authenticated
WITH CHECK (
  has_role(auth.uid(), 'client'::app_role) AND
  client_id IN (SELECT client_id FROM public.profiles WHERE id = auth.uid())
);

-- Règles de session
ALTER TABLE public.regle_session_preparation ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Admin full access on regle_session_preparation"
ON public.regle_session_preparation FOR ALL
TO authenticated
USING (has_role(auth.uid(), 'admin'::app_role) OR has_role(auth.uid(), 'gestionnaire'::app_role))
WITH CHECK (has_role(auth.uid(), 'admin'::app_role) OR has_role(auth.uid(), 'gestionnaire'::app_role));

-- Règles d'emballage
ALTER TABLE public.regle_attribution_emballage ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Admin full access on regle_attribution_emballage"
ON public.regle_attribution_emballage FOR ALL
TO authenticated
USING (has_role(auth.uid(), 'admin'::app_role) OR has_role(auth.uid(), 'gestionnaire'::app_role))
WITH CHECK (has_role(auth.uid(), 'admin'::app_role) OR has_role(auth.uid(), 'gestionnaire'::app_role));

-- Règles de picking
ALTER TABLE public.regle_picking_optimal ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Admin full access on regle_picking_optimal"
ON public.regle_picking_optimal FOR ALL
TO authenticated
USING (has_role(auth.uid(), 'admin'::app_role) OR has_role(auth.uid(), 'gestionnaire'::app_role))
WITH CHECK (has_role(auth.uid(), 'admin'::app_role) OR has_role(auth.uid(), 'gestionnaire'::app_role));

-- Règles de retour
ALTER TABLE public.regle_traitement_retour ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Admin full access on regle_traitement_retour"
ON public.regle_traitement_retour FOR ALL
TO authenticated
USING (has_role(auth.uid(), 'admin'::app_role) OR has_role(auth.uid(), 'gestionnaire'::app_role))
WITH CHECK (has_role(auth.uid(), 'admin'::app_role) OR has_role(auth.uid(), 'gestionnaire'::app_role));

-- Règles d'emplacement
ALTER TABLE public.regle_attribution_emplacement ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Admin full access on regle_attribution_emplacement"
ON public.regle_attribution_emplacement FOR ALL
TO authenticated
USING (has_role(auth.uid(), 'admin'::app_role) OR has_role(auth.uid(), 'gestionnaire'::app_role))
WITH CHECK (has_role(auth.uid(), 'admin'::app_role) OR has_role(auth.uid(), 'gestionnaire'::app_role));