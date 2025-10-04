-- Créer la table pour stocker les métadonnées des documents de commande
CREATE TABLE IF NOT EXISTS public.document_commande (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  commande_id UUID REFERENCES public.commande(id) ON DELETE CASCADE NOT NULL,
  type_document VARCHAR(50) NOT NULL,
  categorie VARCHAR(30) NOT NULL,
  nom_fichier VARCHAR(255) NOT NULL,
  url_fichier TEXT NOT NULL,
  date_generation TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  genere_par UUID REFERENCES auth.users(id),
  taille_fichier INTEGER,
  format VARCHAR(10) DEFAULT 'PDF',
  UNIQUE(commande_id, type_document)
);

-- Index pour optimiser les requêtes
CREATE INDEX IF NOT EXISTS idx_document_commande_commande ON public.document_commande(commande_id);
CREATE INDEX IF NOT EXISTS idx_document_commande_categorie ON public.document_commande(categorie);

-- Enable RLS
ALTER TABLE public.document_commande ENABLE ROW LEVEL SECURITY;

-- RLS Policies
CREATE POLICY "Admin full access on document_commande"
ON public.document_commande
FOR ALL
TO authenticated
USING (public.has_role(auth.uid(), 'admin'::public.app_role))
WITH CHECK (public.has_role(auth.uid(), 'admin'::public.app_role));

CREATE POLICY "Gestionnaire read document_commande"
ON public.document_commande
FOR SELECT
TO authenticated
USING (public.has_role(auth.uid(), 'gestionnaire'::public.app_role));

CREATE POLICY "Operateur read document_commande"
ON public.document_commande
FOR SELECT
TO authenticated
USING (public.has_role(auth.uid(), 'operateur'::public.app_role));

CREATE POLICY "Operateur insert document_commande"
ON public.document_commande
FOR INSERT
TO authenticated
WITH CHECK (public.has_role(auth.uid(), 'operateur'::public.app_role));

CREATE POLICY "Client read own document_commande"
ON public.document_commande
FOR SELECT
TO authenticated
USING (
  public.has_role(auth.uid(), 'client'::public.app_role)
  AND commande_id IN (
    SELECT id FROM public.commande 
    WHERE client_id IN (
      SELECT client_id FROM public.profiles WHERE id = auth.uid()
    )
  )
  AND categorie IN ('douane', 'transport', 'commercial')
);

-- Créer le bucket storage pour les documents (privé avec RLS)
INSERT INTO storage.buckets (id, name, public)
VALUES ('documents-commande', 'documents-commande', false)
ON CONFLICT (id) DO NOTHING;

-- Storage policies
CREATE POLICY "Admin full access documents-commande"
ON storage.objects
FOR ALL
TO authenticated
USING (
  bucket_id = 'documents-commande'
  AND public.has_role(auth.uid(), 'admin'::public.app_role)
)
WITH CHECK (
  bucket_id = 'documents-commande'
  AND public.has_role(auth.uid(), 'admin'::public.app_role)
);

CREATE POLICY "Operateur upload documents-commande"
ON storage.objects
FOR INSERT
TO authenticated
WITH CHECK (
  bucket_id = 'documents-commande'
  AND public.has_role(auth.uid(), 'operateur'::public.app_role)
);

CREATE POLICY "Users read own documents-commande"
ON storage.objects
FOR SELECT
TO authenticated
USING (
  bucket_id = 'documents-commande'
  AND (
    public.has_role(auth.uid(), 'admin'::public.app_role)
    OR public.has_role(auth.uid(), 'gestionnaire'::public.app_role)
    OR public.has_role(auth.uid(), 'operateur'::public.app_role)
  )
);