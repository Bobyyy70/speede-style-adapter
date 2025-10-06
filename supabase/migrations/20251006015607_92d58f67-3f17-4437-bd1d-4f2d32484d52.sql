-- Création de la table client pour la gestion des clients
CREATE TABLE IF NOT EXISTS public.client (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  nom_entreprise TEXT NOT NULL,
  siret TEXT UNIQUE,
  email_contact TEXT,
  telephone TEXT,
  adresse TEXT,
  remarques TEXT,
  actif BOOLEAN DEFAULT true,
  date_creation TIMESTAMP WITH TIME ZONE DEFAULT now(),
  date_modification TIMESTAMP WITH TIME ZONE DEFAULT now()
);

-- Index pour améliorer les performances de recherche
CREATE INDEX IF NOT EXISTS idx_client_siret ON public.client(siret);
CREATE INDEX IF NOT EXISTS idx_client_nom_entreprise ON public.client(nom_entreprise);
CREATE INDEX IF NOT EXISTS idx_client_actif ON public.client(actif);

-- Trigger pour mettre à jour automatiquement date_modification
CREATE OR REPLACE FUNCTION public.update_client_date_modification()
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

CREATE TRIGGER trigger_update_client_date_modification
  BEFORE UPDATE ON public.client
  FOR EACH ROW
  EXECUTE FUNCTION public.update_client_date_modification();

-- Enable RLS
ALTER TABLE public.client ENABLE ROW LEVEL SECURITY;

-- Politique pour les admins (accès complet)
CREATE POLICY "Admin full access on client"
  ON public.client
  FOR ALL
  TO authenticated
  USING (has_role(auth.uid(), 'admin'))
  WITH CHECK (has_role(auth.uid(), 'admin'));

-- Politique pour les gestionnaires (lecture seule)
CREATE POLICY "Gestionnaire read client"
  ON public.client
  FOR SELECT
  TO authenticated
  USING (has_role(auth.uid(), 'gestionnaire'));

-- Politique pour les clients (lecture de leurs propres données)
CREATE POLICY "Client read own data"
  ON public.client
  FOR SELECT
  TO authenticated
  USING (
    has_role(auth.uid(), 'client') 
    AND id IN (
      SELECT client_id 
      FROM public.profiles 
      WHERE id = auth.uid()
    )
  );