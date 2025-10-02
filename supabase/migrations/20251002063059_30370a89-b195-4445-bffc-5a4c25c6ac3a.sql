-- Créer la table pour les alertes de stock personnalisables
CREATE TABLE IF NOT EXISTS public.produit_alertes_stock (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  produit_id UUID NOT NULL REFERENCES public.produit(id) ON DELETE CASCADE,
  type_alerte VARCHAR(50) NOT NULL,
  seuil INTEGER NOT NULL,
  couleur VARCHAR(20) NOT NULL,
  message_alerte TEXT,
  actif BOOLEAN DEFAULT true,
  date_creation TIMESTAMP WITH TIME ZONE DEFAULT now()
);

-- Index pour optimiser les requêtes par produit
CREATE INDEX IF NOT EXISTS idx_produit_alertes_stock_produit_id ON public.produit_alertes_stock(produit_id);

-- RLS pour produit_alertes_stock
ALTER TABLE public.produit_alertes_stock ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Admin full access on produit_alertes_stock"
  ON public.produit_alertes_stock
  FOR ALL
  TO authenticated
  USING (has_role(auth.uid(), 'admin'::app_role))
  WITH CHECK (has_role(auth.uid(), 'admin'::app_role));

CREATE POLICY "Operateur read produit_alertes_stock"
  ON public.produit_alertes_stock
  FOR SELECT
  TO authenticated
  USING (has_role(auth.uid(), 'operateur'::app_role));

CREATE POLICY "Gestionnaire read produit_alertes_stock"
  ON public.produit_alertes_stock
  FOR SELECT
  TO authenticated
  USING (has_role(auth.uid(), 'gestionnaire'::app_role));

-- Créer le bucket storage pour les images produits
INSERT INTO storage.buckets (id, name, public)
VALUES ('produits-images', 'produits-images', true)
ON CONFLICT (id) DO NOTHING;

-- Politique de storage : tout le monde peut voir les images (bucket public)
CREATE POLICY "Public Access"
  ON storage.objects FOR SELECT
  USING (bucket_id = 'produits-images');

-- Politique de storage : admin et opérateur peuvent uploader
CREATE POLICY "Admin and Operateur can upload"
  ON storage.objects FOR INSERT
  TO authenticated
  WITH CHECK (
    bucket_id = 'produits-images' 
    AND (has_role(auth.uid(), 'admin'::app_role) OR has_role(auth.uid(), 'operateur'::app_role))
  );

-- Politique de storage : admin et opérateur peuvent mettre à jour
CREATE POLICY "Admin and Operateur can update"
  ON storage.objects FOR UPDATE
  TO authenticated
  USING (
    bucket_id = 'produits-images' 
    AND (has_role(auth.uid(), 'admin'::app_role) OR has_role(auth.uid(), 'operateur'::app_role))
  );

-- Politique de storage : admin peut supprimer
CREATE POLICY "Admin can delete"
  ON storage.objects FOR DELETE
  TO authenticated
  USING (
    bucket_id = 'produits-images' 
    AND has_role(auth.uid(), 'admin'::app_role)
  );