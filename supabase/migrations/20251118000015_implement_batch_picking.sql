-- =====================================================
-- BATCH PICKING OPTIMISÉ - Picking Multi-Commandes
-- Description: Picking de plusieurs commandes en un seul passage
-- Impact attendu: 25% réduction temps picking
-- Date: 2025-11-18
-- =====================================================

-- =====================================================
-- 1. Table BATCH_PICKING
-- =====================================================

CREATE TABLE IF NOT EXISTS public.batch_picking (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  nom_batch TEXT NOT NULL,
  statut TEXT NOT NULL DEFAULT 'planifie',
  -- Statuts: 'planifie', 'en_cours', 'termine', 'annule'

  -- Configuration
  mode_batch TEXT DEFAULT 'multi_commande',
  -- Modes: 'multi_commande' (standard), 'multi_produit' (cluster picking), 'zone' (zone picking)

  max_commandes INTEGER DEFAULT 10, -- Limite de commandes par batch
  zone_cible TEXT, -- Zone de picking ciblée

  -- Affectation
  operateur_id UUID REFERENCES auth.users(id),
  date_assignation TIMESTAMPTZ,

  -- Métriques
  nb_commandes INTEGER DEFAULT 0,
  nb_produits_distincts INTEGER DEFAULT 0,
  quantite_totale INTEGER DEFAULT 0,
  distance_estimee DECIMAL(10,2), -- Mètres
  distance_parcourue DECIMAL(10,2), -- Mètres réels

  -- Timing
  date_creation TIMESTAMPTZ DEFAULT now(),
  date_debut TIMESTAMPTZ,
  date_fin TIMESTAMPTZ,
  duree_minutes INTEGER GENERATED ALWAYS AS (
    CASE
      WHEN date_debut IS NOT NULL AND date_fin IS NOT NULL
      THEN EXTRACT(EPOCH FROM (date_fin - date_debut)) / 60
      ELSE NULL
    END
  ) STORED,

  -- Performance
  taux_completion DECIMAL(5,2) DEFAULT 0.0,
  efficacite_picking DECIMAL(5,2), -- Articles/minute
  nb_erreurs INTEGER DEFAULT 0,

  -- Route optimisée (ordre des emplacements à visiter)
  route_optimisee JSONB,
  -- Format: [{"emplacement_id": "...", "zone": "A", "allee": "1", "ordre": 1}, ...]

  -- Audit
  created_by UUID REFERENCES auth.users(id),
  updated_at TIMESTAMPTZ DEFAULT now(),

  CONSTRAINT valid_statut_batch CHECK (statut IN ('planifie', 'en_cours', 'termine', 'annule')),
  CONSTRAINT valid_mode_batch CHECK (mode_batch IN ('multi_commande', 'multi_produit', 'zone')),
  CONSTRAINT valid_taux_completion CHECK (taux_completion BETWEEN 0 AND 100)
);

-- =====================================================
-- 2. Table BATCH_COMMANDE (Commandes du batch)
-- =====================================================

CREATE TABLE IF NOT EXISTS public.batch_commande (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  batch_id UUID NOT NULL REFERENCES public.batch_picking(id) ON DELETE CASCADE,
  commande_id UUID NOT NULL REFERENCES public.commande(id) ON DELETE CASCADE,

  -- Statut
  statut TEXT DEFAULT 'en_attente',
  -- Statuts: 'en_attente', 'en_cours', 'termine', 'probleme'

  -- Ordre
  ordre_traitement INTEGER,

  -- Métriques
  nb_lignes INTEGER DEFAULT 0,
  lignes_pickees INTEGER DEFAULT 0,

  -- Timing
  date_ajout TIMESTAMPTZ DEFAULT now(),
  date_debut TIMESTAMPTZ,
  date_fin TIMESTAMPTZ,

  CONSTRAINT unique_batch_commande UNIQUE (batch_id, commande_id),
  CONSTRAINT valid_statut_batch_commande CHECK (statut IN ('en_attente', 'en_cours', 'termine', 'probleme'))
);

-- =====================================================
-- 3. Table BATCH_ITEM (Articles à picker)
-- =====================================================

CREATE TABLE IF NOT EXISTS public.batch_item (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  batch_id UUID NOT NULL REFERENCES public.batch_picking(id) ON DELETE CASCADE,
  produit_id UUID NOT NULL REFERENCES public.produit(id),

  -- Emplacements sources
  emplacement_id UUID REFERENCES public.emplacement(id),
  zone TEXT,
  allee TEXT,
  travee TEXT,
  niveau TEXT,

  -- Quantités
  quantite_totale_a_picker INTEGER NOT NULL, -- Somme pour toutes les commandes
  quantite_pickee INTEGER DEFAULT 0,

  -- Statut
  statut TEXT DEFAULT 'en_attente',
  -- Statuts: 'en_attente', 'en_cours', 'termine', 'rupture'

  -- Ordre dans la route
  ordre_route INTEGER,

  -- Affectation aux commandes (pour le tri)
  affectations JSONB,
  -- Format: [{"commande_id": "...", "quantite": 5}, ...]

  -- Timing
  date_picking TIMESTAMPTZ,

  CONSTRAINT valid_statut_batch_item CHECK (statut IN ('en_attente', 'en_cours', 'termine', 'rupture')),
  CONSTRAINT valid_quantites CHECK (quantite_pickee <= quantite_totale_a_picker)
);

-- =====================================================
-- 4. Table BATCH_CONTAINER (Contenants de tri)
-- =====================================================

CREATE TABLE IF NOT EXISTS public.batch_container (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  batch_id UUID NOT NULL REFERENCES public.batch_picking(id) ON DELETE CASCADE,
  commande_id UUID NOT NULL REFERENCES public.commande(id) ON DELETE CASCADE,

  -- Identifiant physique
  code_container TEXT NOT NULL, -- Code-barres ou numéro du bac/carton
  type_container TEXT DEFAULT 'bac',
  -- Types: 'bac', 'carton', 'palette'

  -- Position
  position_tri INTEGER, -- Position dans la zone de tri
  zone_tri TEXT,

  -- Statut
  statut TEXT DEFAULT 'actif',
  -- Statuts: 'actif', 'complet', 'verifie'

  -- Contenu
  items_count INTEGER DEFAULT 0,

  -- Timing
  date_creation TIMESTAMPTZ DEFAULT now(),
  date_completion TIMESTAMPTZ,

  CONSTRAINT unique_batch_container UNIQUE (batch_id, commande_id),
  CONSTRAINT valid_statut_container CHECK (statut IN ('actif', 'complet', 'verifie'))
);

-- =====================================================
-- 5. Indexes de Performance
-- =====================================================

-- Batch Picking
CREATE INDEX IF NOT EXISTS idx_batch_picking_statut
  ON public.batch_picking(statut, date_creation DESC);

CREATE INDEX IF NOT EXISTS idx_batch_picking_operateur
  ON public.batch_picking(operateur_id, statut)
  WHERE operateur_id IS NOT NULL;

CREATE INDEX IF NOT EXISTS idx_batch_picking_zone
  ON public.batch_picking(zone_cible, statut)
  WHERE zone_cible IS NOT NULL;

-- Batch Commande
CREATE INDEX IF NOT EXISTS idx_batch_commande_batch
  ON public.batch_commande(batch_id, statut);

CREATE INDEX IF NOT EXISTS idx_batch_commande_commande
  ON public.batch_commande(commande_id);

CREATE INDEX IF NOT EXISTS idx_batch_commande_ordre
  ON public.batch_commande(batch_id, ordre_traitement);

-- Batch Item
CREATE INDEX IF NOT EXISTS idx_batch_item_batch
  ON public.batch_item(batch_id, ordre_route);

CREATE INDEX IF NOT EXISTS idx_batch_item_produit
  ON public.batch_item(produit_id, statut);

CREATE INDEX IF NOT EXISTS idx_batch_item_emplacement
  ON public.batch_item(emplacement_id)
  WHERE emplacement_id IS NOT NULL;

CREATE INDEX IF NOT EXISTS idx_batch_item_route
  ON public.batch_item(batch_id, ordre_route, statut);

-- Batch Container
CREATE INDEX IF NOT EXISTS idx_batch_container_batch
  ON public.batch_container(batch_id, position_tri);

CREATE INDEX IF NOT EXISTS idx_batch_container_commande
  ON public.batch_container(commande_id);

CREATE INDEX IF NOT EXISTS idx_batch_container_code
  ON public.batch_container(code_container);

-- =====================================================
-- 6. Trigger auto-update updated_at
-- =====================================================

CREATE OR REPLACE FUNCTION update_batch_picking_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER trigger_batch_picking_updated_at
  BEFORE UPDATE ON public.batch_picking
  FOR EACH ROW
  EXECUTE FUNCTION update_batch_picking_updated_at();

-- =====================================================
-- 7. RLS Policies
-- =====================================================

-- Enable RLS
ALTER TABLE public.batch_picking ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.batch_commande ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.batch_item ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.batch_container ENABLE ROW LEVEL SECURITY;

-- Service role full access
CREATE POLICY "service_role_full_batch_picking" ON public.batch_picking
  FOR ALL TO service_role USING (true) WITH CHECK (true);

CREATE POLICY "service_role_full_batch_commande" ON public.batch_commande
  FOR ALL TO service_role USING (true) WITH CHECK (true);

CREATE POLICY "service_role_full_batch_item" ON public.batch_item
  FOR ALL TO service_role USING (true) WITH CHECK (true);

CREATE POLICY "service_role_full_batch_container" ON public.batch_container
  FOR ALL TO service_role USING (true) WITH CHECK (true);

-- Gestionnaire: Full access
CREATE POLICY "gestionnaire_full_batch_picking" ON public.batch_picking
  FOR ALL TO authenticated
  USING (has_role(auth.uid(), 'gestionnaire'::app_role))
  WITH CHECK (has_role(auth.uid(), 'gestionnaire'::app_role));

CREATE POLICY "gestionnaire_full_batch_commande" ON public.batch_commande
  FOR ALL TO authenticated
  USING (has_role(auth.uid(), 'gestionnaire'::app_role))
  WITH CHECK (has_role(auth.uid(), 'gestionnaire'::app_role));

CREATE POLICY "gestionnaire_full_batch_item" ON public.batch_item
  FOR ALL TO authenticated
  USING (has_role(auth.uid(), 'gestionnaire'::app_role))
  WITH CHECK (has_role(auth.uid(), 'gestionnaire'::app_role));

CREATE POLICY "gestionnaire_full_batch_container" ON public.batch_container
  FOR ALL TO authenticated
  USING (has_role(auth.uid(), 'gestionnaire'::app_role))
  WITH CHECK (has_role(auth.uid(), 'gestionnaire'::app_role));

-- Opérateur: Ses batchs assignés
CREATE POLICY "operateur_own_batch_picking" ON public.batch_picking
  FOR ALL TO authenticated
  USING (
    has_role(auth.uid(), 'operateur'::app_role) AND
    operateur_id = auth.uid()
  )
  WITH CHECK (
    has_role(auth.uid(), 'operateur'::app_role) AND
    operateur_id = auth.uid()
  );

CREATE POLICY "operateur_batch_commande" ON public.batch_commande
  FOR ALL TO authenticated
  USING (
    has_role(auth.uid(), 'operateur'::app_role) AND
    EXISTS (
      SELECT 1 FROM public.batch_picking bp
      WHERE bp.id = batch_id AND bp.operateur_id = auth.uid()
    )
  )
  WITH CHECK (
    has_role(auth.uid(), 'operateur'::app_role) AND
    EXISTS (
      SELECT 1 FROM public.batch_picking bp
      WHERE bp.id = batch_id AND bp.operateur_id = auth.uid()
    )
  );

CREATE POLICY "operateur_batch_item" ON public.batch_item
  FOR ALL TO authenticated
  USING (
    has_role(auth.uid(), 'operateur'::app_role) AND
    EXISTS (
      SELECT 1 FROM public.batch_picking bp
      WHERE bp.id = batch_id AND bp.operateur_id = auth.uid()
    )
  )
  WITH CHECK (
    has_role(auth.uid(), 'operateur'::app_role) AND
    EXISTS (
      SELECT 1 FROM public.batch_picking bp
      WHERE bp.id = batch_id AND bp.operateur_id = auth.uid()
    )
  );

CREATE POLICY "operateur_batch_container" ON public.batch_container
  FOR ALL TO authenticated
  USING (
    has_role(auth.uid(), 'operateur'::app_role) AND
    EXISTS (
      SELECT 1 FROM public.batch_picking bp
      WHERE bp.id = batch_id AND bp.operateur_id = auth.uid()
    )
  )
  WITH CHECK (
    has_role(auth.uid(), 'operateur'::app_role) AND
    EXISTS (
      SELECT 1 FROM public.batch_picking bp
      WHERE bp.id = batch_id AND bp.operateur_id = auth.uid()
    )
  );

-- =====================================================
-- 8. Vue Matérialisée - Statistiques Batchs
-- =====================================================

CREATE MATERIALIZED VIEW IF NOT EXISTS public.batch_picking_stats AS
SELECT
  bp.id AS batch_id,
  bp.nom_batch,
  bp.statut,
  bp.mode_batch,
  bp.operateur_id,
  bp.date_creation,
  bp.date_debut,
  bp.date_fin,
  bp.duree_minutes,

  -- Métriques commandes
  COUNT(DISTINCT bc.commande_id) AS nb_commandes,
  COUNT(DISTINCT CASE WHEN bc.statut = 'termine' THEN bc.commande_id END) AS nb_commandes_terminees,

  -- Métriques produits
  COUNT(DISTINCT bi.produit_id) AS nb_produits_distincts,
  COALESCE(SUM(bi.quantite_totale_a_picker), 0) AS quantite_totale,
  COALESCE(SUM(bi.quantite_pickee), 0) AS quantite_pickee,

  -- Taux de complétion
  CASE
    WHEN COUNT(bi.id) > 0
    THEN ROUND(100.0 * COUNT(CASE WHEN bi.statut = 'termine' THEN 1 END) / COUNT(bi.id), 2)
    ELSE 0
  END AS taux_completion_items,

  -- Performance
  CASE
    WHEN bp.duree_minutes > 0
    THEN ROUND(COALESCE(SUM(bi.quantite_pickee), 0) / bp.duree_minutes::DECIMAL, 2)
    ELSE NULL
  END AS articles_par_minute,

  -- Distance
  bp.distance_estimee,
  bp.distance_parcourue,
  CASE
    WHEN bp.distance_estimee > 0 AND bp.distance_parcourue > 0
    THEN ROUND(100.0 * (bp.distance_estimee - bp.distance_parcourue) / bp.distance_estimee, 2)
    ELSE NULL
  END AS economie_distance_pct

FROM public.batch_picking bp
LEFT JOIN public.batch_commande bc ON bc.batch_id = bp.id
LEFT JOIN public.batch_item bi ON bi.batch_id = bp.id
GROUP BY bp.id;

-- Index sur vue matérialisée
CREATE UNIQUE INDEX IF NOT EXISTS idx_batch_picking_stats_batch_id
  ON public.batch_picking_stats(batch_id);

CREATE INDEX IF NOT EXISTS idx_batch_picking_stats_statut
  ON public.batch_picking_stats(statut);

CREATE INDEX IF NOT EXISTS idx_batch_picking_stats_operateur
  ON public.batch_picking_stats(operateur_id)
  WHERE operateur_id IS NOT NULL;

-- =====================================================
-- 9. Fonction de rafraîchissement stats
-- =====================================================

CREATE OR REPLACE FUNCTION refresh_batch_picking_stats()
RETURNS void AS $$
BEGIN
  REFRESH MATERIALIZED VIEW CONCURRENTLY public.batch_picking_stats;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- =====================================================
-- 10. Summary
-- =====================================================

DO $$
BEGIN
  RAISE NOTICE '';
  RAISE NOTICE '========================================';
  RAISE NOTICE '  BATCH PICKING OPTIMISÉ';
  RAISE NOTICE '========================================';
  RAISE NOTICE 'Impact attendu: 25%% réduction temps picking';
  RAISE NOTICE '';
  RAISE NOTICE 'Tables créées:';
  RAISE NOTICE '  ✅ batch_picking';
  RAISE NOTICE '  ✅ batch_commande';
  RAISE NOTICE '  ✅ batch_item';
  RAISE NOTICE '  ✅ batch_container';
  RAISE NOTICE '';
  RAISE NOTICE 'Vues matérialisées:';
  RAISE NOTICE '  ✅ batch_picking_stats';
  RAISE NOTICE '';
  RAISE NOTICE 'Fonctionnalités:';
  RAISE NOTICE '  • Multi-commandes en 1 passage';
  RAISE NOTICE '  • Route optimisée automatique';
  RAISE NOTICE '  • Tri par contenants';
  RAISE NOTICE '  • Tracking distance/performance';
  RAISE NOTICE '';
  RAISE NOTICE 'Prochaines étapes:';
  RAISE NOTICE '  1. Créer RPC optimisation routes';
  RAISE NOTICE '  2. Créer UI écran mobile guidé';
  RAISE NOTICE '========================================';
  RAISE NOTICE '';
END $$;
