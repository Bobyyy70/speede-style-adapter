-- ============================================
-- CRÉATION DES TABLES PRINCIPALES
-- ============================================

-- Table Produit
CREATE TABLE IF NOT EXISTS public.produit (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  reference TEXT UNIQUE NOT NULL,
  nom TEXT NOT NULL,
  code_barre_ean TEXT,
  description TEXT,
  poids_unitaire NUMERIC(10,2),
  prix_unitaire NUMERIC(10,2),
  stock_actuel INTEGER DEFAULT 0 CHECK (stock_actuel >= 0),
  stock_minimum INTEGER DEFAULT 0 CHECK (stock_minimum >= 0),
  stock_maximum INTEGER,
  statut_actif BOOLEAN DEFAULT true,
  date_creation TIMESTAMP WITH TIME ZONE DEFAULT now(),
  date_modification TIMESTAMP WITH TIME ZONE DEFAULT now()
);

-- Table Emplacement
CREATE TABLE IF NOT EXISTS public.emplacement (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  code_emplacement TEXT UNIQUE NOT NULL,
  zone TEXT NOT NULL,
  type_emplacement TEXT NOT NULL CHECK (type_emplacement IN ('picking', 'stock', 'réception', 'expédition')),
  capacite_maximale NUMERIC(10,2),
  statut_actuel TEXT DEFAULT 'disponible' CHECK (statut_actuel IN ('disponible', 'occupé', 'réservé', 'bloqué')),
  produit_actuel_id UUID REFERENCES public.produit(id) ON DELETE SET NULL,
  quantite_actuelle INTEGER DEFAULT 0 CHECK (quantite_actuelle >= 0),
  date_creation TIMESTAMP WITH TIME ZONE DEFAULT now()
);

-- Table Mouvement de Stock
CREATE TABLE IF NOT EXISTS public.mouvement_stock (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  numero_mouvement TEXT UNIQUE NOT NULL,
  date_mouvement TIMESTAMP WITH TIME ZONE DEFAULT now(),
  type_mouvement TEXT NOT NULL CHECK (type_mouvement IN ('entrée', 'sortie', 'transfert', 'ajustement', 'réservation')),
  produit_id UUID NOT NULL REFERENCES public.produit(id) ON DELETE CASCADE,
  quantite INTEGER NOT NULL,
  emplacement_source_id UUID REFERENCES public.emplacement(id) ON DELETE SET NULL,
  emplacement_destination_id UUID REFERENCES public.emplacement(id) ON DELETE SET NULL,
  reference_origine TEXT,
  type_origine TEXT CHECK (type_origine IN ('commande', 'réception', 'inventaire', 'transfert', 'ajustement')),
  commande_id UUID REFERENCES public.commande(id) ON DELETE SET NULL,
  remarques TEXT,
  created_by UUID REFERENCES auth.users(id)
);

-- ============================================
-- MODIFICATION TABLE LIGNE_COMMANDE
-- ============================================

ALTER TABLE public.ligne_commande 
  ADD COLUMN IF NOT EXISTS produit_id UUID REFERENCES public.produit(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS emplacement_picking_id UUID REFERENCES public.emplacement(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS statut_ligne TEXT DEFAULT 'en_attente' CHECK (statut_ligne IN ('en_attente', 'réservé', 'préparé', 'expédié'));

-- ============================================
-- INDEX POUR PERFORMANCE
-- ============================================

CREATE INDEX IF NOT EXISTS idx_produit_reference ON public.produit(reference);
CREATE INDEX IF NOT EXISTS idx_produit_code_barre ON public.produit(code_barre_ean);
CREATE INDEX IF NOT EXISTS idx_produit_statut ON public.produit(statut_actif);

CREATE INDEX IF NOT EXISTS idx_emplacement_code ON public.emplacement(code_emplacement);
CREATE INDEX IF NOT EXISTS idx_emplacement_zone ON public.emplacement(zone);
CREATE INDEX IF NOT EXISTS idx_emplacement_type ON public.emplacement(type_emplacement);
CREATE INDEX IF NOT EXISTS idx_emplacement_statut ON public.emplacement(statut_actuel);

CREATE INDEX IF NOT EXISTS idx_mouvement_produit ON public.mouvement_stock(produit_id);
CREATE INDEX IF NOT EXISTS idx_mouvement_date ON public.mouvement_stock(date_mouvement);
CREATE INDEX IF NOT EXISTS idx_mouvement_type ON public.mouvement_stock(type_mouvement);
CREATE INDEX IF NOT EXISTS idx_mouvement_commande ON public.mouvement_stock(commande_id);

CREATE INDEX IF NOT EXISTS idx_ligne_commande_produit ON public.ligne_commande(produit_id);
CREATE INDEX IF NOT EXISTS idx_ligne_commande_statut ON public.ligne_commande(statut_ligne);

-- ============================================
-- TRIGGERS POUR MISE À JOUR AUTO
-- ============================================

CREATE OR REPLACE FUNCTION public.update_produit_date_modification()
RETURNS TRIGGER AS $$
BEGIN
  NEW.date_modification = now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public;

CREATE TRIGGER trigger_update_produit_date
  BEFORE UPDATE ON public.produit
  FOR EACH ROW
  EXECUTE FUNCTION public.update_produit_date_modification();

-- Trigger pour générer numéro de mouvement automatique
CREATE OR REPLACE FUNCTION public.generate_numero_mouvement()
RETURNS TRIGGER AS $$
BEGIN
  IF NEW.numero_mouvement IS NULL THEN
    NEW.numero_mouvement := 'MVT-' || TO_CHAR(now(), 'YYYYMMDD') || '-' || LPAD(nextval('mouvement_stock_seq')::TEXT, 6, '0');
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public;

CREATE SEQUENCE IF NOT EXISTS mouvement_stock_seq;

CREATE TRIGGER trigger_generate_numero_mouvement
  BEFORE INSERT ON public.mouvement_stock
  FOR EACH ROW
  EXECUTE FUNCTION public.generate_numero_mouvement();

-- ============================================
-- VUE STOCK DISPONIBLE
-- ============================================

CREATE OR REPLACE VIEW public.stock_disponible AS
SELECT 
  p.id AS produit_id,
  p.reference,
  p.nom,
  p.stock_actuel,
  COALESCE(SUM(CASE WHEN m.type_mouvement = 'réservation' THEN m.quantite ELSE 0 END), 0) AS stock_reserve,
  p.stock_actuel - COALESCE(SUM(CASE WHEN m.type_mouvement = 'réservation' THEN m.quantite ELSE 0 END), 0) AS stock_disponible
FROM public.produit p
LEFT JOIN public.mouvement_stock m ON p.id = m.produit_id 
  AND m.type_mouvement = 'réservation'
  AND m.commande_id IN (
    SELECT id FROM public.commande 
    WHERE statut_wms IN ('En attente de réappro', 'Prêt à préparer', 'En préparation', 'Réservé')
  )
WHERE p.statut_actif = true
GROUP BY p.id, p.reference, p.nom, p.stock_actuel;

-- ============================================
-- FONCTION HELPER POUR RÉSERVATION STOCK
-- ============================================

CREATE OR REPLACE FUNCTION public.reserver_stock(
  p_produit_id UUID,
  p_quantite INTEGER,
  p_commande_id UUID,
  p_reference_origine TEXT
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_stock_disponible INTEGER;
  v_mouvement_id UUID;
  v_result JSONB;
BEGIN
  -- Vérifier le stock disponible
  SELECT stock_disponible INTO v_stock_disponible
  FROM public.stock_disponible
  WHERE produit_id = p_produit_id;

  -- Si pas assez de stock
  IF v_stock_disponible < p_quantite THEN
    RETURN jsonb_build_object(
      'success', false,
      'error', 'Stock insuffisant',
      'stock_disponible', v_stock_disponible,
      'quantite_demandee', p_quantite
    );
  END IF;

  -- Créer le mouvement de réservation
  INSERT INTO public.mouvement_stock (
    type_mouvement,
    produit_id,
    quantite,
    reference_origine,
    type_origine,
    commande_id,
    remarques
  ) VALUES (
    'réservation',
    p_produit_id,
    p_quantite,
    p_reference_origine,
    'commande',
    p_commande_id,
    'Réservation automatique pour commande'
  ) RETURNING id INTO v_mouvement_id;

  RETURN jsonb_build_object(
    'success', true,
    'mouvement_id', v_mouvement_id,
    'stock_disponible', v_stock_disponible - p_quantite
  );
END;
$$;

-- ============================================
-- POLITIQUES RLS
-- ============================================

ALTER TABLE public.produit ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.emplacement ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.mouvement_stock ENABLE ROW LEVEL SECURITY;

-- Produit : Admin full access
CREATE POLICY "Admin full access on produit"
  ON public.produit FOR ALL
  TO authenticated
  USING (public.has_role(auth.uid(), 'admin'::app_role))
  WITH CHECK (public.has_role(auth.uid(), 'admin'::app_role));

-- Produit : Opérateur et Gestionnaire read
CREATE POLICY "Operateur read produit"
  ON public.produit FOR SELECT
  TO authenticated
  USING (public.has_role(auth.uid(), 'operateur'::app_role));

CREATE POLICY "Gestionnaire read produit"
  ON public.produit FOR SELECT
  TO authenticated
  USING (public.has_role(auth.uid(), 'gestionnaire'::app_role));

-- Emplacement : Admin full access
CREATE POLICY "Admin full access on emplacement"
  ON public.emplacement FOR ALL
  TO authenticated
  USING (public.has_role(auth.uid(), 'admin'::app_role))
  WITH CHECK (public.has_role(auth.uid(), 'admin'::app_role));

-- Emplacement : Opérateur read/update
CREATE POLICY "Operateur read emplacement"
  ON public.emplacement FOR SELECT
  TO authenticated
  USING (public.has_role(auth.uid(), 'operateur'::app_role));

CREATE POLICY "Operateur update emplacement"
  ON public.emplacement FOR UPDATE
  TO authenticated
  USING (public.has_role(auth.uid(), 'operateur'::app_role))
  WITH CHECK (public.has_role(auth.uid(), 'operateur'::app_role));

-- Mouvement stock : Admin full access
CREATE POLICY "Admin full access on mouvement_stock"
  ON public.mouvement_stock FOR ALL
  TO authenticated
  USING (public.has_role(auth.uid(), 'admin'::app_role))
  WITH CHECK (public.has_role(auth.uid(), 'admin'::app_role));

-- Mouvement stock : Opérateur read/insert
CREATE POLICY "Operateur read mouvement_stock"
  ON public.mouvement_stock FOR SELECT
  TO authenticated
  USING (public.has_role(auth.uid(), 'operateur'::app_role));

CREATE POLICY "Operateur insert mouvement_stock"
  ON public.mouvement_stock FOR INSERT
  TO authenticated
  WITH CHECK (public.has_role(auth.uid(), 'operateur'::app_role));

-- Mouvement stock : Gestionnaire read
CREATE POLICY "Gestionnaire read mouvement_stock"
  ON public.mouvement_stock FOR SELECT
  TO authenticated
  USING (public.has_role(auth.uid(), 'gestionnaire'::app_role));