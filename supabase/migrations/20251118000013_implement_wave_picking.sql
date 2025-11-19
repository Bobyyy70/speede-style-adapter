-- =====================================================
-- WAVE PICKING - Optimisation Productivité Picking
-- Description: Regroupement intelligent de commandes en vagues
-- Impact attendu: 30-40% gain productivité picking
-- Date: 2025-11-18
-- =====================================================

-- =====================================================
-- 1. Table WAVE_PICKING
-- =====================================================

CREATE TABLE IF NOT EXISTS public.wave_picking (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  nom_wave TEXT NOT NULL,
  statut TEXT NOT NULL DEFAULT 'planifie',
  -- Statuts: 'planifie', 'en_cours', 'termine', 'annule'

  -- Informations de configuration
  zone_picking TEXT, -- Zone ciblée (A, B, C, etc.)
  priorite INTEGER DEFAULT 1, -- 1=normale, 2=haute, 3=urgente
  type_wave TEXT DEFAULT 'standard', -- 'standard', 'express', 'fragile', 'volumineux'

  -- Métriques
  nombre_commandes INTEGER DEFAULT 0,
  nombre_lignes_total INTEGER DEFAULT 0,
  nombre_articles_total INTEGER DEFAULT 0,
  volume_estime DECIMAL(10,3), -- m³
  poids_estime DECIMAL(10,2), -- kg

  -- Affectation
  operateur_assigne UUID REFERENCES auth.users(id),
  date_assignation TIMESTAMPTZ,

  -- Timing
  date_creation TIMESTAMPTZ DEFAULT now(),
  date_debut_picking TIMESTAMPTZ,
  date_fin_picking TIMESTAMPTZ,
  duree_picking_minutes INTEGER GENERATED ALWAYS AS (
    CASE
      WHEN date_debut_picking IS NOT NULL AND date_fin_picking IS NOT NULL
      THEN EXTRACT(EPOCH FROM (date_fin_picking - date_debut_picking)) / 60
      ELSE NULL
    END
  ) STORED,

  -- Performance
  taux_completion DECIMAL(5,2) DEFAULT 0.0, -- %
  nb_erreurs INTEGER DEFAULT 0,

  -- Audit
  created_by UUID REFERENCES auth.users(id),
  updated_at TIMESTAMPTZ DEFAULT now(),

  CONSTRAINT valid_statut_wave CHECK (statut IN ('planifie', 'en_cours', 'termine', 'annule')),
  CONSTRAINT valid_priorite CHECK (priorite BETWEEN 1 AND 3),
  CONSTRAINT valid_taux_completion CHECK (taux_completion BETWEEN 0 AND 100)
);

-- =====================================================
-- 2. Table WAVE_COMMANDE (Many-to-Many)
-- =====================================================

CREATE TABLE IF NOT EXISTS public.wave_commande (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  wave_id UUID NOT NULL REFERENCES public.wave_picking(id) ON DELETE CASCADE,
  commande_id UUID NOT NULL REFERENCES public.commande(id) ON DELETE CASCADE,

  -- Statut picking pour cette commande dans la wave
  statut_picking TEXT DEFAULT 'en_attente',
  -- Statuts: 'en_attente', 'en_cours', 'termine', 'probleme'

  -- Séquence de picking
  ordre_picking INTEGER, -- Ordre optimal de picking dans la wave

  -- Timing
  date_ajout TIMESTAMPTZ DEFAULT now(),
  date_debut_picking TIMESTAMPTZ,
  date_fin_picking TIMESTAMPTZ,

  -- Métriques
  nombre_lignes INTEGER DEFAULT 0,
  lignes_pickees INTEGER DEFAULT 0,
  nb_erreurs INTEGER DEFAULT 0,

  CONSTRAINT unique_wave_commande UNIQUE (wave_id, commande_id),
  CONSTRAINT valid_statut_picking CHECK (statut_picking IN ('en_attente', 'en_cours', 'termine', 'probleme'))
);

-- =====================================================
-- 3. Table WAVE_LIGNE_PICKING (Détail des lignes)
-- =====================================================

CREATE TABLE IF NOT EXISTS public.wave_ligne_picking (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  wave_commande_id UUID NOT NULL REFERENCES public.wave_commande(id) ON DELETE CASCADE,
  ligne_commande_id UUID NOT NULL REFERENCES public.ligne_commande(id) ON DELETE CASCADE,
  produit_id UUID NOT NULL REFERENCES public.produit(id),

  -- Localisation
  emplacement_id UUID REFERENCES public.emplacement(id),
  zone_picking TEXT,

  -- Quantités
  quantite_a_picker INTEGER NOT NULL,
  quantite_pickee INTEGER DEFAULT 0,

  -- Statut
  statut TEXT DEFAULT 'en_attente',
  -- Statuts: 'en_attente', 'en_cours', 'termine', 'rupture', 'erreur'

  -- Séquence optimisée
  ordre_dans_route INTEGER, -- Ordre optimal dans le parcours

  -- Timing
  date_picking TIMESTAMPTZ,

  -- Traçabilité
  operateur_id UUID REFERENCES auth.users(id),

  CONSTRAINT unique_wave_ligne UNIQUE (wave_commande_id, ligne_commande_id),
  CONSTRAINT valid_quantites CHECK (quantite_pickee <= quantite_a_picker),
  CONSTRAINT valid_statut_ligne CHECK (statut IN ('en_attente', 'en_cours', 'termine', 'rupture', 'erreur'))
);

-- =====================================================
-- 4. Indexes de Performance
-- =====================================================

-- Wave Picking
CREATE INDEX IF NOT EXISTS idx_wave_picking_statut
  ON public.wave_picking(statut, date_creation DESC);

CREATE INDEX IF NOT EXISTS idx_wave_picking_operateur
  ON public.wave_picking(operateur_assigne, statut)
  WHERE operateur_assigne IS NOT NULL;

CREATE INDEX IF NOT EXISTS idx_wave_picking_zone
  ON public.wave_picking(zone_picking, statut)
  WHERE zone_picking IS NOT NULL;

-- Wave Commande
CREATE INDEX IF NOT EXISTS idx_wave_commande_wave
  ON public.wave_commande(wave_id, statut_picking);

CREATE INDEX IF NOT EXISTS idx_wave_commande_commande
  ON public.wave_commande(commande_id);

CREATE INDEX IF NOT EXISTS idx_wave_commande_ordre
  ON public.wave_commande(wave_id, ordre_picking);

-- Wave Ligne Picking
CREATE INDEX IF NOT EXISTS idx_wave_ligne_wave_commande
  ON public.wave_ligne_picking(wave_commande_id, ordre_dans_route);

CREATE INDEX IF NOT EXISTS idx_wave_ligne_produit
  ON public.wave_ligne_picking(produit_id, statut);

CREATE INDEX IF NOT EXISTS idx_wave_ligne_emplacement
  ON public.wave_ligne_picking(emplacement_id)
  WHERE emplacement_id IS NOT NULL;

-- =====================================================
-- 5. Trigger auto-update updated_at
-- =====================================================

CREATE OR REPLACE FUNCTION update_wave_picking_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER trigger_wave_picking_updated_at
  BEFORE UPDATE ON public.wave_picking
  FOR EACH ROW
  EXECUTE FUNCTION update_wave_picking_updated_at();

-- =====================================================
-- 6. RLS Policies
-- =====================================================

-- Enable RLS
ALTER TABLE public.wave_picking ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.wave_commande ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.wave_ligne_picking ENABLE ROW LEVEL SECURITY;

-- Service role full access (edge functions)
CREATE POLICY "service_role_full_wave_picking" ON public.wave_picking
  FOR ALL TO service_role USING (true) WITH CHECK (true);

CREATE POLICY "service_role_full_wave_commande" ON public.wave_commande
  FOR ALL TO service_role USING (true) WITH CHECK (true);

CREATE POLICY "service_role_full_wave_ligne_picking" ON public.wave_ligne_picking
  FOR ALL TO service_role USING (true) WITH CHECK (true);

-- Gestionnaire: Full access
CREATE POLICY "gestionnaire_full_wave_picking" ON public.wave_picking
  FOR ALL TO authenticated
  USING (has_role(auth.uid(), 'gestionnaire'::app_role))
  WITH CHECK (has_role(auth.uid(), 'gestionnaire'::app_role));

CREATE POLICY "gestionnaire_full_wave_commande" ON public.wave_commande
  FOR ALL TO authenticated
  USING (has_role(auth.uid(), 'gestionnaire'::app_role))
  WITH CHECK (has_role(auth.uid(), 'gestionnaire'::app_role));

CREATE POLICY "gestionnaire_full_wave_ligne_picking" ON public.wave_ligne_picking
  FOR ALL TO authenticated
  USING (has_role(auth.uid(), 'gestionnaire'::app_role))
  WITH CHECK (has_role(auth.uid(), 'gestionnaire'::app_role));

-- Opérateur: Peut voir et modifier ses waves assignées
CREATE POLICY "operateur_own_wave_picking" ON public.wave_picking
  FOR ALL TO authenticated
  USING (
    has_role(auth.uid(), 'operateur'::app_role) AND
    operateur_assigne = auth.uid()
  )
  WITH CHECK (
    has_role(auth.uid(), 'operateur'::app_role) AND
    operateur_assigne = auth.uid()
  );

CREATE POLICY "operateur_wave_commande" ON public.wave_commande
  FOR ALL TO authenticated
  USING (
    has_role(auth.uid(), 'operateur'::app_role) AND
    EXISTS (
      SELECT 1 FROM public.wave_picking w
      WHERE w.id = wave_id AND w.operateur_assigne = auth.uid()
    )
  )
  WITH CHECK (
    has_role(auth.uid(), 'operateur'::app_role) AND
    EXISTS (
      SELECT 1 FROM public.wave_picking w
      WHERE w.id = wave_id AND w.operateur_assigne = auth.uid()
    )
  );

CREATE POLICY "operateur_wave_ligne_picking" ON public.wave_ligne_picking
  FOR ALL TO authenticated
  USING (
    has_role(auth.uid(), 'operateur'::app_role) AND
    EXISTS (
      SELECT 1 FROM public.wave_commande wc
      JOIN public.wave_picking w ON w.id = wc.wave_id
      WHERE wc.id = wave_commande_id AND w.operateur_assigne = auth.uid()
    )
  )
  WITH CHECK (
    has_role(auth.uid(), 'operateur'::app_role) AND
    EXISTS (
      SELECT 1 FROM public.wave_commande wc
      JOIN public.wave_picking w ON w.id = wc.wave_id
      WHERE wc.id = wave_commande_id AND w.operateur_assigne = auth.uid()
    )
  );

-- =====================================================
-- 7. Vue Matérialisée - Statistiques Waves
-- =====================================================

CREATE MATERIALIZED VIEW IF NOT EXISTS public.wave_picking_stats AS
SELECT
  w.id AS wave_id,
  w.nom_wave,
  w.statut,
  w.zone_picking,
  w.operateur_assigne,
  w.date_creation,
  w.date_debut_picking,
  w.date_fin_picking,
  w.duree_picking_minutes,

  -- Métriques commandes
  COUNT(DISTINCT wc.commande_id) AS nb_commandes,
  COUNT(DISTINCT CASE WHEN wc.statut_picking = 'termine' THEN wc.commande_id END) AS nb_commandes_terminees,

  -- Métriques lignes
  COUNT(wl.id) AS nb_lignes_total,
  COALESCE(SUM(wl.quantite_a_picker), 0) AS quantite_totale_a_picker,
  COALESCE(SUM(wl.quantite_pickee), 0) AS quantite_totale_pickee,

  -- Taux de complétion
  CASE
    WHEN COUNT(wl.id) > 0
    THEN ROUND(100.0 * COUNT(CASE WHEN wl.statut = 'termine' THEN 1 END) / COUNT(wl.id), 2)
    ELSE 0
  END AS taux_completion_lignes,

  -- Erreurs
  COALESCE(SUM(wl.CASE WHEN statut = 'erreur' THEN 1 ELSE 0 END), 0) AS nb_erreurs,

  -- Performance
  CASE
    WHEN w.duree_picking_minutes > 0
    THEN ROUND(COALESCE(SUM(wl.quantite_pickee), 0) / w.duree_picking_minutes::DECIMAL, 2)
    ELSE NULL
  END AS articles_par_minute

FROM public.wave_picking w
LEFT JOIN public.wave_commande wc ON wc.wave_id = w.id
LEFT JOIN public.wave_ligne_picking wl ON wl.wave_commande_id = wc.id
GROUP BY w.id;

-- Index sur vue matérialisée
CREATE UNIQUE INDEX IF NOT EXISTS idx_wave_picking_stats_wave_id
  ON public.wave_picking_stats(wave_id);

CREATE INDEX IF NOT EXISTS idx_wave_picking_stats_statut
  ON public.wave_picking_stats(statut);

-- =====================================================
-- 8. Fonction de rafraîchissement stats
-- =====================================================

CREATE OR REPLACE FUNCTION refresh_wave_picking_stats()
RETURNS void AS $$
BEGIN
  REFRESH MATERIALIZED VIEW CONCURRENTLY public.wave_picking_stats;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- =====================================================
-- 9. Summary
-- =====================================================

DO $$
BEGIN
  RAISE NOTICE '';
  RAISE NOTICE '========================================';
  RAISE NOTICE '  WAVE PICKING - IMPLÉMENTATION';
  RAISE NOTICE '========================================';
  RAISE NOTICE 'Impact attendu: 30-40%% gain productivité';
  RAISE NOTICE '';
  RAISE NOTICE 'Tables créées:';
  RAISE NOTICE '  ✅ wave_picking';
  RAISE NOTICE '  ✅ wave_commande';
  RAISE NOTICE '  ✅ wave_ligne_picking';
  RAISE NOTICE '';
  RAISE NOTICE 'Vues matérialisées:';
  RAISE NOTICE '  ✅ wave_picking_stats';
  RAISE NOTICE '';
  RAISE NOTICE 'Indexes: 11 créés pour performance';
  RAISE NOTICE 'RLS Policies: Gestionnaire + Opérateur';
  RAISE NOTICE '';
  RAISE NOTICE 'Prochaines étapes:';
  RAISE NOTICE '  1. Créer RPC functions (créer_wave, assigner, finaliser)';
  RAISE NOTICE '  2. Créer UI GestionWaves';
  RAISE NOTICE '  3. Intégrer avec mobile picking';
  RAISE NOTICE '========================================';
  RAISE NOTICE '';
END $$;
