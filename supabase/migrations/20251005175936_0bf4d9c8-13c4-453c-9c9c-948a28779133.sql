-- =====================================================
-- Table attendu_reception (Expected Receipts)
-- =====================================================

-- Type enum pour le statut d'attendu de réception
CREATE TYPE public.statut_attendu_reception AS ENUM (
  'prévu',
  'en_transit',
  'arrivé',
  'en_cours_réception',
  'réceptionné_partiellement',
  'réceptionné_totalement',
  'anomalie',
  'annulé'
);

-- Type enum pour le statut de ligne attendu
CREATE TYPE public.statut_ligne_attendu AS ENUM (
  'attendu',
  'réceptionné',
  'manquant',
  'excédent',
  'endommagé'
);

-- Table principale attendu_reception
CREATE TABLE public.attendu_reception (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  numero_attendu TEXT NOT NULL UNIQUE,
  client_id UUID REFERENCES public.profiles(client_id) ON DELETE CASCADE,
  fournisseur TEXT,
  date_creation TIMESTAMP WITH TIME ZONE DEFAULT now() NOT NULL,
  date_modification TIMESTAMP WITH TIME ZONE DEFAULT now() NOT NULL,
  date_reception_prevue DATE,
  date_arrivee_reelle TIMESTAMP WITH TIME ZONE,
  statut statut_attendu_reception DEFAULT 'prévu' NOT NULL,
  transporteur TEXT,
  numero_tracking TEXT,
  nombre_palettes INTEGER DEFAULT 0,
  nombre_colis INTEGER DEFAULT 0,
  poids_total_kg NUMERIC(10,2),
  volume_total_m3 NUMERIC(10,3),
  remarques TEXT,
  instructions_speciales TEXT,
  created_by UUID REFERENCES auth.users(id)
);

-- Table lignes d'attendu de réception
CREATE TABLE public.ligne_attendu_reception (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  attendu_reception_id UUID NOT NULL REFERENCES public.attendu_reception(id) ON DELETE CASCADE,
  produit_id UUID REFERENCES public.produit(id) ON DELETE SET NULL,
  produit_reference TEXT NOT NULL,
  produit_nom TEXT NOT NULL,
  quantite_attendue INTEGER NOT NULL CHECK (quantite_attendue > 0),
  quantite_recue INTEGER DEFAULT 0 CHECK (quantite_recue >= 0),
  numero_lot TEXT,
  date_peremption DATE,
  date_fabrication DATE,
  statut_ligne statut_ligne_attendu DEFAULT 'attendu' NOT NULL,
  emplacement_stockage_prevu TEXT,
  remarques TEXT,
  date_creation TIMESTAMP WITH TIME ZONE DEFAULT now() NOT NULL
);

-- Index pour améliorer les performances
CREATE INDEX idx_attendu_reception_client_id ON public.attendu_reception(client_id);
CREATE INDEX idx_attendu_reception_statut ON public.attendu_reception(statut);
CREATE INDEX idx_attendu_reception_date_prevue ON public.attendu_reception(date_reception_prevue);
CREATE INDEX idx_ligne_attendu_reception_attendu_id ON public.ligne_attendu_reception(attendu_reception_id);
CREATE INDEX idx_ligne_attendu_reception_produit_id ON public.ligne_attendu_reception(produit_id);
CREATE INDEX idx_ligne_attendu_reception_lot ON public.ligne_attendu_reception(numero_lot) WHERE numero_lot IS NOT NULL;

-- Fonction pour générer automatiquement le numéro d'attendu
CREATE OR REPLACE FUNCTION public.generate_numero_attendu()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF NEW.numero_attendu IS NULL THEN
    NEW.numero_attendu := 'ATT-' || TO_CHAR(now(), 'YYYYMMDD') || '-' || LPAD(nextval('attendu_reception_seq')::TEXT, 6, '0');
  END IF;
  RETURN NEW;
END;
$$;

-- Séquence pour les numéros d'attendu
CREATE SEQUENCE IF NOT EXISTS public.attendu_reception_seq;

-- Trigger pour générer le numéro automatiquement
CREATE TRIGGER trigger_generate_numero_attendu
  BEFORE INSERT ON public.attendu_reception
  FOR EACH ROW
  EXECUTE FUNCTION public.generate_numero_attendu();

-- Trigger pour mettre à jour date_modification
CREATE TRIGGER trigger_update_attendu_reception_date_modification
  BEFORE UPDATE ON public.attendu_reception
  FOR EACH ROW
  EXECUTE FUNCTION public.update_produit_date_modification();

-- =====================================================
-- RLS Policies pour attendu_reception
-- =====================================================

ALTER TABLE public.attendu_reception ENABLE ROW LEVEL SECURITY;

-- Admin full access
CREATE POLICY "Admin full access on attendu_reception"
  ON public.attendu_reception
  FOR ALL
  TO authenticated
  USING (has_role(auth.uid(), 'admin'::app_role))
  WITH CHECK (has_role(auth.uid(), 'admin'::app_role));

-- Gestionnaire read access
CREATE POLICY "Gestionnaire read attendu_reception"
  ON public.attendu_reception
  FOR SELECT
  TO authenticated
  USING (has_role(auth.uid(), 'gestionnaire'::app_role));

-- Operateur read/write access
CREATE POLICY "Operateur read attendu_reception"
  ON public.attendu_reception
  FOR SELECT
  TO authenticated
  USING (has_role(auth.uid(), 'operateur'::app_role));

CREATE POLICY "Operateur insert attendu_reception"
  ON public.attendu_reception
  FOR INSERT
  TO authenticated
  WITH CHECK (has_role(auth.uid(), 'operateur'::app_role));

CREATE POLICY "Operateur update attendu_reception"
  ON public.attendu_reception
  FOR UPDATE
  TO authenticated
  USING (has_role(auth.uid(), 'operateur'::app_role))
  WITH CHECK (has_role(auth.uid(), 'operateur'::app_role));

-- Client read own attendu_reception
CREATE POLICY "Client read own attendu_reception"
  ON public.attendu_reception
  FOR SELECT
  TO authenticated
  USING (
    has_role(auth.uid(), 'client'::app_role) 
    AND client_id IN (
      SELECT client_id FROM public.profiles WHERE id = auth.uid()
    )
  );

-- Client insert own attendu_reception
CREATE POLICY "Client insert own attendu_reception"
  ON public.attendu_reception
  FOR INSERT
  TO authenticated
  WITH CHECK (
    has_role(auth.uid(), 'client'::app_role) 
    AND client_id IN (
      SELECT client_id FROM public.profiles WHERE id = auth.uid()
    )
  );

-- Client update own attendu_reception (only if not finalized)
CREATE POLICY "Client update own attendu_reception"
  ON public.attendu_reception
  FOR UPDATE
  TO authenticated
  USING (
    has_role(auth.uid(), 'client'::app_role) 
    AND client_id IN (
      SELECT client_id FROM public.profiles WHERE id = auth.uid()
    )
    AND statut IN ('prévu', 'en_transit')
  )
  WITH CHECK (
    has_role(auth.uid(), 'client'::app_role) 
    AND client_id IN (
      SELECT client_id FROM public.profiles WHERE id = auth.uid()
    )
  );

-- =====================================================
-- RLS Policies pour ligne_attendu_reception
-- =====================================================

ALTER TABLE public.ligne_attendu_reception ENABLE ROW LEVEL SECURITY;

-- Admin full access
CREATE POLICY "Admin full access on ligne_attendu_reception"
  ON public.ligne_attendu_reception
  FOR ALL
  TO authenticated
  USING (has_role(auth.uid(), 'admin'::app_role))
  WITH CHECK (has_role(auth.uid(), 'admin'::app_role));

-- Gestionnaire read access
CREATE POLICY "Gestionnaire read ligne_attendu_reception"
  ON public.ligne_attendu_reception
  FOR SELECT
  TO authenticated
  USING (has_role(auth.uid(), 'gestionnaire'::app_role));

-- Operateur read/write access
CREATE POLICY "Operateur read ligne_attendu_reception"
  ON public.ligne_attendu_reception
  FOR SELECT
  TO authenticated
  USING (has_role(auth.uid(), 'operateur'::app_role));

CREATE POLICY "Operateur insert ligne_attendu_reception"
  ON public.ligne_attendu_reception
  FOR INSERT
  TO authenticated
  WITH CHECK (has_role(auth.uid(), 'operateur'::app_role));

CREATE POLICY "Operateur update ligne_attendu_reception"
  ON public.ligne_attendu_reception
  FOR UPDATE
  TO authenticated
  USING (has_role(auth.uid(), 'operateur'::app_role))
  WITH CHECK (has_role(auth.uid(), 'operateur'::app_role));

-- Client read own ligne_attendu_reception
CREATE POLICY "Client read own ligne_attendu_reception"
  ON public.ligne_attendu_reception
  FOR SELECT
  TO authenticated
  USING (
    has_role(auth.uid(), 'client'::app_role) 
    AND attendu_reception_id IN (
      SELECT id FROM public.attendu_reception 
      WHERE client_id IN (
        SELECT client_id FROM public.profiles WHERE id = auth.uid()
      )
    )
  );

-- Client insert own ligne_attendu_reception
CREATE POLICY "Client insert own ligne_attendu_reception"
  ON public.ligne_attendu_reception
  FOR INSERT
  TO authenticated
  WITH CHECK (
    has_role(auth.uid(), 'client'::app_role) 
    AND attendu_reception_id IN (
      SELECT id FROM public.attendu_reception 
      WHERE client_id IN (
        SELECT client_id FROM public.profiles WHERE id = auth.uid()
      )
    )
  );

-- Client update own ligne_attendu_reception
CREATE POLICY "Client update own ligne_attendu_reception"
  ON public.ligne_attendu_reception
  FOR UPDATE
  TO authenticated
  USING (
    has_role(auth.uid(), 'client'::app_role) 
    AND attendu_reception_id IN (
      SELECT id FROM public.attendu_reception 
      WHERE client_id IN (
        SELECT client_id FROM public.profiles WHERE id = auth.uid()
      )
      AND statut IN ('prévu', 'en_transit')
    )
  )
  WITH CHECK (
    has_role(auth.uid(), 'client'::app_role) 
    AND attendu_reception_id IN (
      SELECT id FROM public.attendu_reception 
      WHERE client_id IN (
        SELECT client_id FROM public.profiles WHERE id = auth.uid()
      )
    )
  );

-- =====================================================
-- Modifications table commande pour labels pré-générés
-- =====================================================

-- Ajouter un champ pour indiquer si l'étiquette est pré-générée
ALTER TABLE public.commande ADD COLUMN IF NOT EXISTS label_pregenere BOOLEAN DEFAULT false;

-- Ajouter un champ pour la source de l'étiquette
ALTER TABLE public.commande ADD COLUMN IF NOT EXISTS label_source TEXT CHECK (label_source IN ('sendcloud', 'manuel', 'import', 'lovable'));

-- Commenter les champs existants pour clarté
COMMENT ON COLUMN public.commande.label_pregenere IS 'Indique si l''étiquette a été fournie à l''avance (ne doit pas passer par Sendcloud)';
COMMENT ON COLUMN public.commande.label_source IS 'Source de l''étiquette: sendcloud, manuel, import (CSV), lovable (génération interne)';
COMMENT ON COLUMN public.commande.label_url IS 'URL de l''étiquette de transport';
COMMENT ON COLUMN public.commande.tracking_number IS 'Numéro de suivi du transporteur';