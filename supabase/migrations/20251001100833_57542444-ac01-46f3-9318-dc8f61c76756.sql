-- Table centrale COMMANDE pour unifier toutes les commandes (Sendcloud + Manuel)
CREATE TABLE public.commande (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  numero_commande TEXT UNIQUE NOT NULL,
  sendcloud_id TEXT UNIQUE,
  
  -- Informations client
  nom_client TEXT NOT NULL,
  email_client TEXT,
  telephone_client TEXT,
  
  -- Adresse de livraison (simplifié depuis Sendcloud API)
  adresse_nom TEXT NOT NULL,
  adresse_ligne_1 TEXT NOT NULL,
  adresse_ligne_2 TEXT,
  code_postal TEXT NOT NULL,
  ville TEXT NOT NULL,
  pays_code TEXT NOT NULL CHECK (length(pays_code) = 2),
  
  -- Adresse de facturation
  facturation_nom TEXT,
  facturation_ligne_1 TEXT,
  facturation_ligne_2 TEXT,
  facturation_code_postal TEXT,
  facturation_ville TEXT,
  facturation_pays_code TEXT CHECK (facturation_pays_code IS NULL OR length(facturation_pays_code) = 2),
  
  -- Informations commande
  valeur_totale NUMERIC(10,2) NOT NULL DEFAULT 0 CHECK (valeur_totale >= 0),
  devise TEXT DEFAULT 'EUR' CHECK (length(devise) = 3),
  poids_total NUMERIC(10,3) CHECK (poids_total IS NULL OR poids_total >= 0),
  
  -- Statuts WMS
  statut_wms TEXT NOT NULL DEFAULT 'En attente de réappro' CHECK (
    statut_wms IN (
      'En attente de réappro',
      'En état de stock physique',
      'En réservation',
      'En picking',
      'En préparation',
      'En attente d''expédition'
    )
  ),
  
  -- Métadonnées
  source TEXT NOT NULL CHECK (source IN ('sendcloud', 'manuel')),
  date_creation TIMESTAMP WITH TIME ZONE DEFAULT now() NOT NULL,
  date_modification TIMESTAMP WITH TIME ZONE DEFAULT now() NOT NULL,
  
  -- Champs optionnels depuis Sendcloud
  numero_facture_commerciale TEXT,
  transporteur TEXT,
  methode_expedition TEXT,
  
  -- Notes et remarques
  remarques TEXT
);

-- Table LIGNE_COMMANDE pour les produits
CREATE TABLE public.ligne_commande (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  commande_id UUID NOT NULL REFERENCES public.commande(id) ON DELETE CASCADE,
  
  -- Référence produit
  produit_reference TEXT NOT NULL,
  produit_nom TEXT NOT NULL,
  
  -- Quantités
  quantite_commandee INTEGER NOT NULL CHECK (quantite_commandee > 0),
  quantite_preparee INTEGER DEFAULT 0 CHECK (quantite_preparee >= 0),
  
  -- Valeurs
  prix_unitaire NUMERIC(10,2) CHECK (prix_unitaire IS NULL OR prix_unitaire >= 0),
  valeur_totale NUMERIC(10,2) CHECK (valeur_totale IS NULL OR valeur_totale >= 0),
  
  -- Poids et dimensions
  poids_unitaire NUMERIC(10,3) CHECK (poids_unitaire IS NULL OR poids_unitaire >= 0),
  
  -- Traçabilité
  numero_lot TEXT,
  date_peremption DATE,
  
  -- Métadonnées
  date_creation TIMESTAMP WITH TIME ZONE DEFAULT now() NOT NULL
);

-- Enable RLS
ALTER TABLE public.commande ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.ligne_commande ENABLE ROW LEVEL SECURITY;

-- Policies basiques (à adapter selon authentification)
CREATE POLICY "Allow authenticated users to read commandes"
ON public.commande FOR SELECT
TO authenticated
USING (true);

CREATE POLICY "Allow authenticated users to insert commandes"
ON public.commande FOR INSERT
TO authenticated
WITH CHECK (true);

CREATE POLICY "Allow authenticated users to update commandes"
ON public.commande FOR UPDATE
TO authenticated
USING (true);

CREATE POLICY "Allow authenticated users to read lignes"
ON public.ligne_commande FOR SELECT
TO authenticated
USING (true);

CREATE POLICY "Allow authenticated users to insert lignes"
ON public.ligne_commande FOR INSERT
TO authenticated
WITH CHECK (true);

CREATE POLICY "Allow authenticated users to update lignes"
ON public.ligne_commande FOR UPDATE
TO authenticated
USING (true);

-- Indexes pour performance
CREATE INDEX idx_commande_numero ON public.commande(numero_commande);
CREATE INDEX idx_commande_sendcloud_id ON public.commande(sendcloud_id);
CREATE INDEX idx_commande_statut_wms ON public.commande(statut_wms);
CREATE INDEX idx_commande_pays_code ON public.commande(pays_code);
CREATE INDEX idx_commande_date_creation ON public.commande(date_creation DESC);
CREATE INDEX idx_commande_source ON public.commande(source);
CREATE INDEX idx_ligne_commande_commande_id ON public.ligne_commande(commande_id);
CREATE INDEX idx_ligne_commande_produit_ref ON public.ligne_commande(produit_reference);

-- Trigger pour mise à jour automatique de date_modification
CREATE OR REPLACE FUNCTION public.update_commande_date_modification()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  NEW.date_modification = now();
  RETURN NEW;
END;
$$;

CREATE TRIGGER trigger_update_commande_date_modification
BEFORE UPDATE ON public.commande
FOR EACH ROW
EXECUTE FUNCTION public.update_commande_date_modification();