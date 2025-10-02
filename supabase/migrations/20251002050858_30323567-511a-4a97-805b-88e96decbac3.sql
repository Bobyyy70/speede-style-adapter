-- Phase 1: Foundation & Structure de Données

-- 1. Créer la table service_logistique pour tous les services et tarifs
CREATE TABLE IF NOT EXISTS public.service_logistique (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  code_service VARCHAR(50) UNIQUE NOT NULL,
  nom_service VARCHAR(255) NOT NULL,
  description TEXT,
  categorie VARCHAR(100) NOT NULL, -- 'base', 'pcb_volumineux', 'mise_en_stock', 'retours', 'optionnel'
  type_facturation VARCHAR(50) NOT NULL, -- 'par_commande', 'par_produit', 'par_kg', 'par_bac', 'forfait'
  prix_unitaire NUMERIC(10, 2) NOT NULL,
  actif BOOLEAN DEFAULT true,
  date_creation TIMESTAMP WITH TIME ZONE DEFAULT now(),
  date_modification TIMESTAMP WITH TIME ZONE DEFAULT now()
);

-- 2. Créer la table ligne_service_commande pour lier services aux commandes
CREATE TABLE IF NOT EXISTS public.ligne_service_commande (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  commande_id UUID REFERENCES public.commande(id) ON DELETE CASCADE,
  service_id UUID REFERENCES public.service_logistique(id) ON DELETE RESTRICT,
  quantite INTEGER NOT NULL DEFAULT 1,
  prix_unitaire NUMERIC(10, 2) NOT NULL,
  prix_total NUMERIC(10, 2) GENERATED ALWAYS AS (quantite * prix_unitaire) STORED,
  genere_automatiquement BOOLEAN DEFAULT false,
  remarques TEXT,
  date_creation TIMESTAMP WITH TIME ZONE DEFAULT now()
);

-- 3. Ajouter categorie_emballage aux produits
ALTER TABLE public.produit 
ADD COLUMN IF NOT EXISTS categorie_emballage INTEGER CHECK (categorie_emballage IN (1, 2, 3, 4));

COMMENT ON COLUMN public.produit.categorie_emballage IS 'Catégorie emballage: 1=Standard, 2=Moyen, 3=Grand, 4=PCB/Volumineux';

-- 4. Étendre mouvement_stock avec statuts pipeline et type_contenant
ALTER TABLE public.mouvement_stock 
ADD COLUMN IF NOT EXISTS statut_mouvement VARCHAR(50) DEFAULT 'stock_physique',
ADD COLUMN IF NOT EXISTS type_contenant VARCHAR(50);

-- Contrainte pour les statuts valides
ALTER TABLE public.mouvement_stock 
ADD CONSTRAINT check_statut_mouvement CHECK (
  statut_mouvement IN (
    'attente_arrivage_reappro',
    'mise_en_stock',
    'stock_physique',
    'stock_reserve',
    'en_cours_picking',
    'en_cours_emballage',
    'attente_transporteur',
    'en_cours_livraison',
    'livree'
  )
);

-- Contrainte pour les types de contenant
ALTER TABLE public.mouvement_stock 
ADD CONSTRAINT check_type_contenant CHECK (
  type_contenant IS NULL OR type_contenant IN ('carton_pcb', 'bac', 'palette', 'vrac')
);

COMMENT ON COLUMN public.mouvement_stock.statut_mouvement IS 'Statut dans le pipeline logistique';
COMMENT ON COLUMN public.mouvement_stock.type_contenant IS 'Type de contenant utilisé pour ce mouvement';

-- 5. Créer table sku_variante pour PCB multi-produits
CREATE TABLE IF NOT EXISTS public.sku_variante (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  sku_principal VARCHAR(100) NOT NULL,
  produit_id UUID REFERENCES public.produit(id) ON DELETE CASCADE,
  quantite_par_unite INTEGER NOT NULL DEFAULT 1,
  type_variante VARCHAR(50) NOT NULL DEFAULT 'pcb_multiple',
  code_barre_variante VARCHAR(255),
  actif BOOLEAN DEFAULT true,
  date_creation TIMESTAMP WITH TIME ZONE DEFAULT now(),
  UNIQUE(sku_principal, produit_id)
);

COMMENT ON TABLE public.sku_variante IS 'Gestion des SKU variantes pour PCB contenant plusieurs fois le même produit';

-- 6. Créer table bac_adresse pour système d'adresses
CREATE TABLE IF NOT EXISTS public.bac_adresse (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  code_bac VARCHAR(50) UNIQUE NOT NULL,
  zone VARCHAR(50) NOT NULL,
  allee VARCHAR(10),
  niveau INTEGER,
  position VARCHAR(10),
  type_bac VARCHAR(50) NOT NULL, -- 'petit', 'moyen', 'grand'
  capacite_max_kg NUMERIC(10, 2),
  capacite_max_volume NUMERIC(10, 2),
  statut VARCHAR(50) DEFAULT 'disponible',
  produit_actuel_id UUID REFERENCES public.produit(id) ON DELETE SET NULL,
  quantite_actuelle INTEGER DEFAULT 0,
  date_derniere_activite TIMESTAMP WITH TIME ZONE,
  date_creation TIMESTAMP WITH TIME ZONE DEFAULT now()
);

COMMENT ON TABLE public.bac_adresse IS 'Système d''adressage pour les bacs de stockage';

-- 7. Créer table retour_produit
CREATE TABLE IF NOT EXISTS public.retour_produit (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  numero_retour VARCHAR(100) UNIQUE NOT NULL,
  commande_origine_id UUID REFERENCES public.commande(id) ON DELETE SET NULL,
  client_nom VARCHAR(255) NOT NULL,
  date_retour TIMESTAMP WITH TIME ZONE DEFAULT now(),
  statut_retour VARCHAR(50) DEFAULT 'recu',
  raison_retour TEXT,
  valeur_totale NUMERIC(10, 2) DEFAULT 0,
  remarques TEXT,
  date_creation TIMESTAMP WITH TIME ZONE DEFAULT now(),
  date_modification TIMESTAMP WITH TIME ZONE DEFAULT now()
);

COMMENT ON TABLE public.retour_produit IS 'Gestion des retours produits avec facturation similaire aux commandes';

-- 8. Créer table ligne_retour_produit
CREATE TABLE IF NOT EXISTS public.ligne_retour_produit (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  retour_id UUID REFERENCES public.retour_produit(id) ON DELETE CASCADE,
  produit_id UUID REFERENCES public.produit(id) ON DELETE SET NULL,
  produit_reference VARCHAR(100) NOT NULL,
  produit_nom VARCHAR(255) NOT NULL,
  quantite_retournee INTEGER NOT NULL,
  statut_produit VARCHAR(50) DEFAULT 'a_traiter',
  action_a_faire VARCHAR(50), -- 'remettre_stock', 'declasser', 'detruire'
  categorie_emballage INTEGER,
  cout_traitement NUMERIC(10, 2),
  date_creation TIMESTAMP WITH TIME ZONE DEFAULT now()
);

COMMENT ON TABLE public.ligne_retour_produit IS 'Lignes de produits dans les retours';

-- 9. Créer table calculateur_volumetrique pour stocker les calculs
CREATE TABLE IF NOT EXISTS public.calculateur_volumetrique (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  commande_id UUID REFERENCES public.commande(id) ON DELETE CASCADE,
  poids_total_kg NUMERIC(10, 2),
  volume_total_m3 NUMERIC(10, 4),
  nombre_bacs_petit INTEGER DEFAULT 0,
  nombre_bacs_moyen INTEGER DEFAULT 0,
  nombre_bacs_grand INTEGER DEFAULT 0,
  nombre_cartons_pcb INTEGER DEFAULT 0,
  nombre_palettes INTEGER DEFAULT 0,
  est_multi_colis BOOLEAN DEFAULT false,
  nombre_colis_total INTEGER DEFAULT 1,
  services_auto_generes JSONB,
  date_calcul TIMESTAMP WITH TIME ZONE DEFAULT now()
);

COMMENT ON TABLE public.calculateur_volumetrique IS 'Résultats des calculs volumétriques pour attribution automatique';

-- Insérer les services logistiques de base
INSERT INTO public.service_logistique (code_service, nom_service, description, categorie, type_facturation, prix_unitaire) VALUES
-- Services de Base
('PREP_CAT1', 'Préparation Catégorie 1', 'Préparation produit standard petit format', 'base', 'par_produit', 0.15),
('PREP_CAT2', 'Préparation Catégorie 2', 'Préparation produit standard moyen format', 'base', 'par_produit', 0.40),
('PREP_CAT3', 'Préparation Catégorie 3', 'Préparation produit standard grand format', 'base', 'par_produit', 0.60),
('PREP_COMMANDE', 'Préparation de Commande', 'Traitement et validation commande', 'base', 'par_commande', 1.00),

-- PCB/Volumineux & Prépa Palette
('PREP_CAT4_PCB', 'Préparation PCB/Volumineux', 'Préparation produit PCB ou volumineux', 'pcb_volumineux', 'par_produit', 1.00),
('PREP_PALETTE', 'Préparation Palette', 'Préparation et filmage palette complète', 'pcb_volumineux', 'par_commande', 8.00),

-- Mise en Stock (Transvasement)
('MISE_STOCK_BAC', 'Mise en Stock - Transvasement Bac', 'Transvasement et mise en bac avec adresse', 'mise_en_stock', 'par_bac', 1.50),
('MISE_STOCK_PCB', 'Mise en Stock - PCB Direct', 'Mise en stock PCB sans transvasement', 'mise_en_stock', 'par_produit', 0.15),

-- Retours
('RETOUR_BASE', 'Traitement Retour', 'Réception et traitement retour de base', 'retours', 'par_commande', 1.00),
('RETOUR_CAT1', 'Retour Catégorie 1', 'Rangement/déclassement produit cat 1', 'retours', 'par_produit', 0.15),
('RETOUR_CAT2', 'Retour Catégorie 2', 'Rangement/déclassement produit cat 2', 'retours', 'par_produit', 0.40),
('RETOUR_CAT3', 'Retour Catégorie 3', 'Rangement/déclassement produit cat 3', 'retours', 'par_produit', 0.60),
('RETOUR_CAT4', 'Retour PCB/Volumineux', 'Rangement/déclassement produit cat 4', 'retours', 'par_produit', 1.00),

-- Services Optionnels
('CN23', 'Déclaration CN23', 'Remplissage formulaire douanier CN23', 'optionnel', 'par_commande', 1.00),
('PHOTO_COLIS', 'Photo de Colis', 'Prise de photo du colis préparé', 'optionnel', 'par_commande', 0.50),
('EMBALLAGE_RENFORCE', 'Emballage Renforcé', 'Protection supplémentaire pour produits fragiles', 'optionnel', 'par_commande', 2.00),
('ETIQUETTE_PERSO', 'Étiquette Personnalisée', 'Impression étiquette marketing client', 'optionnel', 'par_commande', 0.30)
ON CONFLICT (code_service) DO NOTHING;

-- Créer des index pour les performances
CREATE INDEX IF NOT EXISTS idx_ligne_service_commande_commande ON public.ligne_service_commande(commande_id);
CREATE INDEX IF NOT EXISTS idx_ligne_service_commande_service ON public.ligne_service_commande(service_id);
CREATE INDEX IF NOT EXISTS idx_sku_variante_produit ON public.sku_variante(produit_id);
CREATE INDEX IF NOT EXISTS idx_sku_variante_sku ON public.sku_variante(sku_principal);
CREATE INDEX IF NOT EXISTS idx_bac_adresse_statut ON public.bac_adresse(statut);
CREATE INDEX IF NOT EXISTS idx_bac_adresse_produit ON public.bac_adresse(produit_actuel_id);
CREATE INDEX IF NOT EXISTS idx_retour_produit_statut ON public.retour_produit(statut_retour);
CREATE INDEX IF NOT EXISTS idx_ligne_retour_produit_retour ON public.ligne_retour_produit(retour_id);
CREATE INDEX IF NOT EXISTS idx_calculateur_commande ON public.calculateur_volumetrique(commande_id);
CREATE INDEX IF NOT EXISTS idx_mouvement_statut ON public.mouvement_stock(statut_mouvement);
CREATE INDEX IF NOT EXISTS idx_mouvement_type_contenant ON public.mouvement_stock(type_contenant);

-- Trigger pour mettre à jour date_modification sur service_logistique
CREATE OR REPLACE FUNCTION update_service_date_modification()
RETURNS TRIGGER AS $$
BEGIN
  NEW.date_modification = now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public;

CREATE TRIGGER trigger_update_service_date_modification
BEFORE UPDATE ON public.service_logistique
FOR EACH ROW
EXECUTE FUNCTION update_service_date_modification();

-- Trigger pour mettre à jour date_modification sur retour_produit
CREATE TRIGGER trigger_update_retour_date_modification
BEFORE UPDATE ON public.retour_produit
FOR EACH ROW
EXECUTE FUNCTION update_service_date_modification();

-- RLS Policies pour les nouvelles tables
ALTER TABLE public.service_logistique ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.ligne_service_commande ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.sku_variante ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.bac_adresse ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.retour_produit ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.ligne_retour_produit ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.calculateur_volumetrique ENABLE ROW LEVEL SECURITY;

-- Policies pour service_logistique
CREATE POLICY "Admin full access on service_logistique"
ON public.service_logistique FOR ALL
TO authenticated
USING (has_role(auth.uid(), 'admin'));

CREATE POLICY "Gestionnaire read service_logistique"
ON public.service_logistique FOR SELECT
TO authenticated
USING (has_role(auth.uid(), 'gestionnaire'));

CREATE POLICY "Operateur read service_logistique"
ON public.service_logistique FOR SELECT
TO authenticated
USING (has_role(auth.uid(), 'operateur'));

-- Policies pour ligne_service_commande
CREATE POLICY "Admin full access on ligne_service_commande"
ON public.ligne_service_commande FOR ALL
TO authenticated
USING (has_role(auth.uid(), 'admin'));

CREATE POLICY "Gestionnaire read ligne_service_commande"
ON public.ligne_service_commande FOR SELECT
TO authenticated
USING (has_role(auth.uid(), 'gestionnaire'));

CREATE POLICY "Operateur read ligne_service_commande"
ON public.ligne_service_commande FOR SELECT
TO authenticated
USING (has_role(auth.uid(), 'operateur'));

-- Policies pour sku_variante
CREATE POLICY "Admin full access on sku_variante"
ON public.sku_variante FOR ALL
TO authenticated
USING (has_role(auth.uid(), 'admin'));

CREATE POLICY "Operateur read sku_variante"
ON public.sku_variante FOR SELECT
TO authenticated
USING (has_role(auth.uid(), 'operateur'));

-- Policies pour bac_adresse
CREATE POLICY "Admin full access on bac_adresse"
ON public.bac_adresse FOR ALL
TO authenticated
USING (has_role(auth.uid(), 'admin'));

CREATE POLICY "Operateur read bac_adresse"
ON public.bac_adresse FOR SELECT
TO authenticated
USING (has_role(auth.uid(), 'operateur'));

CREATE POLICY "Operateur update bac_adresse"
ON public.bac_adresse FOR UPDATE
TO authenticated
USING (has_role(auth.uid(), 'operateur'));

-- Policies pour retour_produit
CREATE POLICY "Admin full access on retour_produit"
ON public.retour_produit FOR ALL
TO authenticated
USING (has_role(auth.uid(), 'admin'));

CREATE POLICY "Gestionnaire read retour_produit"
ON public.retour_produit FOR SELECT
TO authenticated
USING (has_role(auth.uid(), 'gestionnaire'));

CREATE POLICY "Operateur read retour_produit"
ON public.retour_produit FOR SELECT
TO authenticated
USING (has_role(auth.uid(), 'operateur'));

CREATE POLICY "Operateur insert retour_produit"
ON public.retour_produit FOR INSERT
TO authenticated
WITH CHECK (has_role(auth.uid(), 'operateur'));

CREATE POLICY "Operateur update retour_produit"
ON public.retour_produit FOR UPDATE
TO authenticated
USING (has_role(auth.uid(), 'operateur'));

-- Policies pour ligne_retour_produit
CREATE POLICY "Admin full access on ligne_retour_produit"
ON public.ligne_retour_produit FOR ALL
TO authenticated
USING (has_role(auth.uid(), 'admin'));

CREATE POLICY "Operateur read ligne_retour_produit"
ON public.ligne_retour_produit FOR SELECT
TO authenticated
USING (has_role(auth.uid(), 'operateur'));

CREATE POLICY "Operateur write ligne_retour_produit"
ON public.ligne_retour_produit FOR INSERT
TO authenticated
WITH CHECK (has_role(auth.uid(), 'operateur'));

-- Policies pour calculateur_volumetrique
CREATE POLICY "Admin full access on calculateur_volumetrique"
ON public.calculateur_volumetrique FOR ALL
TO authenticated
USING (has_role(auth.uid(), 'admin'));

CREATE POLICY "Gestionnaire read calculateur_volumetrique"
ON public.calculateur_volumetrique FOR SELECT
TO authenticated
USING (has_role(auth.uid(), 'gestionnaire'));

CREATE POLICY "Operateur read calculateur_volumetrique"
ON public.calculateur_volumetrique FOR SELECT
TO authenticated
USING (has_role(auth.uid(), 'operateur'));