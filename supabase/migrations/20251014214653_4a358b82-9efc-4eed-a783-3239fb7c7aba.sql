-- Extension des statuts de commande
ALTER TABLE public.commande DROP CONSTRAINT IF EXISTS commande_statut_wms_check;
ALTER TABLE public.commande ADD CONSTRAINT commande_statut_wms_check 
  CHECK (statut_wms IN (
    'En attente de réappro',
    'Prêt à préparer',
    'Réservé',
    'En préparation',
    'En attente d''expédition',
    'Expédié',
    'Livré',
    'prete',
    'expediee',
    'Annulée'
  ));

-- Ajout des colonnes expéditeur dans la table commande
ALTER TABLE public.commande ADD COLUMN IF NOT EXISTS expediteur_nom TEXT;
ALTER TABLE public.commande ADD COLUMN IF NOT EXISTS expediteur_entreprise TEXT;
ALTER TABLE public.commande ADD COLUMN IF NOT EXISTS expediteur_email TEXT;
ALTER TABLE public.commande ADD COLUMN IF NOT EXISTS expediteur_telephone TEXT;
ALTER TABLE public.commande ADD COLUMN IF NOT EXISTS expediteur_adresse_ligne_1 TEXT;
ALTER TABLE public.commande ADD COLUMN IF NOT EXISTS expediteur_adresse_ligne_2 TEXT;
ALTER TABLE public.commande ADD COLUMN IF NOT EXISTS expediteur_code_postal TEXT;
ALTER TABLE public.commande ADD COLUMN IF NOT EXISTS expediteur_ville TEXT;
ALTER TABLE public.commande ADD COLUMN IF NOT EXISTS expediteur_pays_code TEXT;

-- Contrainte sur le code pays expéditeur
ALTER TABLE public.commande ADD CONSTRAINT expediteur_pays_code_check 
  CHECK (expediteur_pays_code IS NULL OR length(expediteur_pays_code) = 2);

-- Index pour recherche rapide sur entreprise expéditeur
CREATE INDEX IF NOT EXISTS idx_commande_expediteur_entreprise ON public.commande(expediteur_entreprise);

-- Création de la table contact_destinataire
CREATE TABLE IF NOT EXISTS public.contact_destinataire (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  client_id UUID NOT NULL REFERENCES public.client(id) ON DELETE CASCADE,
  
  -- Informations contact
  nom TEXT NOT NULL,
  prenom TEXT,
  entreprise TEXT,
  email TEXT,
  telephone TEXT,
  telephone_mobile TEXT,
  
  -- Adresse complète
  adresse_ligne_1 TEXT NOT NULL,
  adresse_ligne_2 TEXT,
  adresse_ligne_3 TEXT,
  code_postal TEXT NOT NULL,
  ville TEXT NOT NULL,
  pays_code TEXT NOT NULL CHECK (length(pays_code) = 2),
  
  -- Instructions de livraison
  digicode TEXT,
  interphone TEXT,
  instructions_acces TEXT,
  instructions_livraison TEXT,
  
  -- Métadonnées
  label_contact TEXT,
  utilisation_count INTEGER DEFAULT 0,
  derniere_utilisation TIMESTAMP WITH TIME ZONE,
  date_creation TIMESTAMP WITH TIME ZONE DEFAULT now() NOT NULL,
  date_modification TIMESTAMP WITH TIME ZONE DEFAULT now() NOT NULL,
  
  -- Favoris et archivage
  est_favori BOOLEAN DEFAULT false,
  est_archive BOOLEAN DEFAULT false
);

-- Index pour performance
CREATE INDEX IF NOT EXISTS idx_contact_client_id ON public.contact_destinataire(client_id);
CREATE INDEX IF NOT EXISTS idx_contact_nom ON public.contact_destinataire(nom);
CREATE INDEX IF NOT EXISTS idx_contact_entreprise ON public.contact_destinataire(entreprise);
CREATE INDEX IF NOT EXISTS idx_contact_favori ON public.contact_destinataire(client_id, est_favori);
CREATE INDEX IF NOT EXISTS idx_contact_archive ON public.contact_destinataire(client_id, est_archive);

-- Trigger pour mise à jour automatique de date_modification
CREATE OR REPLACE FUNCTION update_contact_date_modification()
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

CREATE TRIGGER update_contact_destinataire_date_modification
BEFORE UPDATE ON public.contact_destinataire
FOR EACH ROW
EXECUTE FUNCTION update_contact_date_modification();

-- RLS policies pour contact_destinataire
ALTER TABLE public.contact_destinataire ENABLE ROW LEVEL SECURITY;

-- Admin full access
CREATE POLICY "Admin full access on contact_destinataire"
ON public.contact_destinataire
FOR ALL
TO authenticated
USING (has_role(auth.uid(), 'admin'::app_role))
WITH CHECK (has_role(auth.uid(), 'admin'::app_role));

-- Client read own contacts
CREATE POLICY "Client read own contacts"
ON public.contact_destinataire
FOR SELECT
TO authenticated
USING (
  has_role(auth.uid(), 'client'::app_role) 
  AND client_id IN (
    SELECT client_id FROM public.profiles WHERE id = auth.uid()
  )
);

-- Client insert own contacts
CREATE POLICY "Client insert own contacts"
ON public.contact_destinataire
FOR INSERT
TO authenticated
WITH CHECK (
  has_role(auth.uid(), 'client'::app_role) 
  AND client_id IN (
    SELECT client_id FROM public.profiles WHERE id = auth.uid()
  )
);

-- Client update own contacts
CREATE POLICY "Client update own contacts"
ON public.contact_destinataire
FOR UPDATE
TO authenticated
USING (
  has_role(auth.uid(), 'client'::app_role) 
  AND client_id IN (
    SELECT client_id FROM public.profiles WHERE id = auth.uid()
  )
)
WITH CHECK (
  has_role(auth.uid(), 'client'::app_role) 
  AND client_id IN (
    SELECT client_id FROM public.profiles WHERE id = auth.uid()
  )
);

-- Client delete own contacts
CREATE POLICY "Client delete own contacts"
ON public.contact_destinataire
FOR DELETE
TO authenticated
USING (
  has_role(auth.uid(), 'client'::app_role) 
  AND client_id IN (
    SELECT client_id FROM public.profiles WHERE id = auth.uid()
  )
);

-- Gestionnaire read all contacts
CREATE POLICY "Gestionnaire read contacts"
ON public.contact_destinataire
FOR SELECT
TO authenticated
USING (has_role(auth.uid(), 'gestionnaire'::app_role));