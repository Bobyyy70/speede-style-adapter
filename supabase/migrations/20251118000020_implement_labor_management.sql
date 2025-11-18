-- =====================================================
-- LABOR MANAGEMENT - Gestion Performance Opérateurs
-- Description: Tracking KPI picking et productivité
-- Impact: Mesure ROI des optimisations + coaching
-- Date: 2025-11-18
-- =====================================================

-- =====================================================
-- 1. Table PERFORMANCE_OPERATEUR_QUOTIDIEN
-- =====================================================

CREATE TABLE IF NOT EXISTS public.performance_operateur_quotidien (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  operateur_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  date_performance DATE NOT NULL DEFAULT CURRENT_DATE,

  -- Métriques picking
  nb_waves_completees INTEGER DEFAULT 0,
  nb_batchs_completes INTEGER DEFAULT 0,
  nb_commandes_pickees INTEGER DEFAULT 0,
  nb_lignes_pickees INTEGER DEFAULT 0,
  quantite_totale_pickee INTEGER DEFAULT 0,

  -- Temps de travail
  temps_travail_minutes INTEGER DEFAULT 0,
  temps_picking_effectif_minutes INTEGER DEFAULT 0,

  -- Performance
  picks_per_hour DECIMAL(10,2) GENERATED ALWAYS AS (
    CASE
      WHEN temps_picking_effectif_minutes > 0
      THEN ROUND((nb_lignes_pickees * 60.0) / temps_picking_effectif_minutes, 2)
      ELSE 0
    END
  ) STORED,

  articles_per_minute DECIMAL(10,2) GENERATED ALWAYS AS (
    CASE
      WHEN temps_picking_effectif_minutes > 0
      THEN ROUND(quantite_totale_pickee::DECIMAL / temps_picking_effectif_minutes, 2)
      ELSE 0
    END
  ) STORED,

  -- Qualité
  nb_erreurs INTEGER DEFAULT 0,
  accuracy_rate DECIMAL(5,2) GENERATED ALWAYS AS (
    CASE
      WHEN nb_lignes_pickees > 0
      THEN ROUND(100.0 * (nb_lignes_pickees - nb_erreurs) / nb_lignes_pickees, 2)
      ELSE 100
    END
  ) STORED,

  -- Distance
  distance_parcourue DECIMAL(10,2) DEFAULT 0, -- Mètres

  -- Cycle counting
  nb_comptages_effectues INTEGER DEFAULT 0,

  -- Timestamps
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now(),

  CONSTRAINT unique_operateur_date UNIQUE (operateur_id, date_performance)
);

-- =====================================================
-- 2. Table KPI_PICKING_GLOBAL
-- =====================================================

CREATE TABLE IF NOT EXISTS public.kpi_picking_global (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  date_kpi DATE NOT NULL DEFAULT CURRENT_DATE,

  -- Volumes globaux
  total_commandes_pickees INTEGER DEFAULT 0,
  total_lignes_pickees INTEGER DEFAULT 0,
  total_articles_pickes INTEGER DEFAULT 0,

  -- Performance moyenne
  picks_per_hour_moyen DECIMAL(10,2) DEFAULT 0,
  articles_per_minute_moyen DECIMAL(10,2) DEFAULT 0,
  accuracy_rate_moyen DECIMAL(5,2) DEFAULT 0,

  -- Opérateurs
  nb_operateurs_actifs INTEGER DEFAULT 0,

  -- Waves & Batchs
  nb_waves_completees INTEGER DEFAULT 0,
  nb_batchs_completes INTEGER DEFAULT 0,

  -- Gains estimés (vs baseline)
  gain_productivite_pct DECIMAL(5,2) DEFAULT 0,

  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now(),

  CONSTRAINT unique_date_kpi UNIQUE (date_kpi)
);

-- =====================================================
-- 3. Table OBJECTIFS_OPERATEUR
-- =====================================================

CREATE TABLE IF NOT EXISTS public.objectifs_operateur (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  operateur_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,

  -- Objectifs quotidiens
  objectif_picks_per_hour DECIMAL(10,2) DEFAULT 60, -- Standard: 60 lignes/heure
  objectif_accuracy_rate DECIMAL(5,2) DEFAULT 99.5, -- Standard: 99.5%

  -- Niveau de compétence
  niveau TEXT DEFAULT 'junior',
  -- Niveaux: 'junior', 'intermediaire', 'senior', 'expert'

  -- Actif
  actif BOOLEAN DEFAULT TRUE,

  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now(),

  CONSTRAINT unique_objectifs_operateur UNIQUE (operateur_id),
  CONSTRAINT valid_niveau CHECK (niveau IN ('junior', 'intermediaire', 'senior', 'expert'))
);

-- =====================================================
-- 4. Indexes de Performance
-- =====================================================

-- Performance Opérateur
CREATE INDEX IF NOT EXISTS idx_performance_operateur_date
  ON public.performance_operateur_quotidien(date_performance DESC);

CREATE INDEX IF NOT EXISTS idx_performance_operateur_operateur
  ON public.performance_operateur_quotidien(operateur_id, date_performance DESC);

CREATE INDEX IF NOT EXISTS idx_performance_operateur_picks
  ON public.performance_operateur_quotidien(picks_per_hour DESC);

-- KPI Global
CREATE INDEX IF NOT EXISTS idx_kpi_picking_global_date
  ON public.kpi_picking_global(date_kpi DESC);

-- Objectifs
CREATE INDEX IF NOT EXISTS idx_objectifs_operateur_actif
  ON public.objectifs_operateur(operateur_id)
  WHERE actif = TRUE;

-- =====================================================
-- 5. Triggers auto-update updated_at
-- =====================================================

CREATE OR REPLACE FUNCTION update_performance_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER trigger_performance_operateur_updated_at
  BEFORE UPDATE ON public.performance_operateur_quotidien
  FOR EACH ROW
  EXECUTE FUNCTION update_performance_updated_at();

CREATE TRIGGER trigger_kpi_picking_global_updated_at
  BEFORE UPDATE ON public.kpi_picking_global
  FOR EACH ROW
  EXECUTE FUNCTION update_performance_updated_at();

CREATE TRIGGER trigger_objectifs_operateur_updated_at
  BEFORE UPDATE ON public.objectifs_operateur
  FOR EACH ROW
  EXECUTE FUNCTION update_performance_updated_at();

-- =====================================================
-- 6. RLS Policies
-- =====================================================

-- Enable RLS
ALTER TABLE public.performance_operateur_quotidien ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.kpi_picking_global ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.objectifs_operateur ENABLE ROW LEVEL SECURITY;

-- Service role full access
CREATE POLICY "service_role_full_performance" ON public.performance_operateur_quotidien
  FOR ALL TO service_role USING (true) WITH CHECK (true);

CREATE POLICY "service_role_full_kpi" ON public.kpi_picking_global
  FOR ALL TO service_role USING (true) WITH CHECK (true);

CREATE POLICY "service_role_full_objectifs" ON public.objectifs_operateur
  FOR ALL TO service_role USING (true) WITH CHECK (true);

-- Gestionnaire: Full access
CREATE POLICY "gestionnaire_full_performance" ON public.performance_operateur_quotidien
  FOR ALL TO authenticated
  USING (has_role(auth.uid(), 'gestionnaire'::app_role))
  WITH CHECK (has_role(auth.uid(), 'gestionnaire'::app_role));

CREATE POLICY "gestionnaire_full_kpi" ON public.kpi_picking_global
  FOR ALL TO authenticated
  USING (has_role(auth.uid(), 'gestionnaire'::app_role))
  WITH CHECK (has_role(auth.uid(), 'gestionnaire'::app_role));

CREATE POLICY "gestionnaire_full_objectifs" ON public.objectifs_operateur
  FOR ALL TO authenticated
  USING (has_role(auth.uid(), 'gestionnaire'::app_role))
  WITH CHECK (has_role(auth.uid(), 'gestionnaire'::app_role));

-- Opérateur: Read ses propres performances
CREATE POLICY "operateur_own_performance" ON public.performance_operateur_quotidien
  FOR SELECT TO authenticated
  USING (
    has_role(auth.uid(), 'operateur'::app_role) AND
    operateur_id = auth.uid()
  );

CREATE POLICY "operateur_own_objectifs" ON public.objectifs_operateur
  FOR SELECT TO authenticated
  USING (
    has_role(auth.uid(), 'operateur'::app_role) AND
    operateur_id = auth.uid()
  );

-- =====================================================
-- 7. RPC - calculer_performance_quotidienne
-- =====================================================

CREATE OR REPLACE FUNCTION calculer_performance_quotidienne(
  p_operateur_id UUID,
  p_date DATE DEFAULT CURRENT_DATE
)
RETURNS JSONB AS $$
DECLARE
  v_performance RECORD;
BEGIN
  -- Calculer les métriques du jour
  INSERT INTO public.performance_operateur_quotidien (
    operateur_id,
    date_performance,
    nb_waves_completees,
    nb_batchs_completes,
    nb_commandes_pickees,
    nb_lignes_pickees,
    quantite_totale_pickee,
    temps_picking_effectif_minutes,
    distance_parcourue,
    nb_comptages_effectues
  )
  SELECT
    p_operateur_id,
    p_date,
    -- Waves
    (SELECT COUNT(*) FROM public.wave_picking
     WHERE operateur_assigne = p_operateur_id
     AND DATE(date_fin_picking) = p_date
     AND statut = 'termine'),
    -- Batchs
    (SELECT COUNT(*) FROM public.batch_picking
     WHERE operateur_id = p_operateur_id
     AND DATE(date_fin) = p_date
     AND statut = 'termine'),
    -- Commandes (via waves)
    (SELECT COUNT(DISTINCT wc.commande_id)
     FROM public.wave_commande wc
     JOIN public.wave_picking w ON w.id = wc.wave_id
     WHERE w.operateur_assigne = p_operateur_id
     AND DATE(w.date_fin_picking) = p_date),
    -- Lignes pickées
    (SELECT COUNT(*)
     FROM public.wave_ligne_picking wlp
     JOIN public.wave_commande wc ON wc.id = wlp.wave_commande_id
     JOIN public.wave_picking w ON w.id = wc.wave_id
     WHERE w.operateur_assigne = p_operateur_id
     AND DATE(wlp.date_picking) = p_date
     AND wlp.statut = 'termine'),
    -- Quantité totale
    (SELECT COALESCE(SUM(wlp.quantite_pickee), 0)
     FROM public.wave_ligne_picking wlp
     JOIN public.wave_commande wc ON wc.id = wlp.wave_commande_id
     JOIN public.wave_picking w ON w.id = wc.wave_id
     WHERE w.operateur_assigne = p_operateur_id
     AND DATE(wlp.date_picking) = p_date),
    -- Temps picking effectif
    (SELECT COALESCE(SUM(duree_picking_minutes), 0)
     FROM public.wave_picking
     WHERE operateur_assigne = p_operateur_id
     AND DATE(date_fin_picking) = p_date),
    -- Distance
    (SELECT COALESCE(SUM(distance_parcourue), 0)
     FROM public.wave_picking
     WHERE operateur_assigne = p_operateur_id
     AND DATE(date_fin_picking) = p_date),
    -- Comptages
    (SELECT COUNT(*)
     FROM public.cycle_count_task
     WHERE operateur_id = p_operateur_id
     AND DATE(date_fin_comptage) = p_date
     AND statut IN ('termine', 'valide'))
  ON CONFLICT (operateur_id, date_performance)
  DO UPDATE SET
    nb_waves_completees = EXCLUDED.nb_waves_completees,
    nb_batchs_completes = EXCLUDED.nb_batchs_completes,
    nb_commandes_pickees = EXCLUDED.nb_commandes_pickees,
    nb_lignes_pickees = EXCLUDED.nb_lignes_pickees,
    quantite_totale_pickee = EXCLUDED.quantite_totale_pickee,
    temps_picking_effectif_minutes = EXCLUDED.temps_picking_effectif_minutes,
    distance_parcourue = EXCLUDED.distance_parcourue,
    nb_comptages_effectues = EXCLUDED.nb_comptages_effectues
  RETURNING * INTO v_performance;

  RETURN to_jsonb(v_performance);
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- =====================================================
-- 8. RPC - calculer_kpi_global_quotidien
-- =====================================================

CREATE OR REPLACE FUNCTION calculer_kpi_global_quotidien(p_date DATE DEFAULT CURRENT_DATE)
RETURNS JSONB AS $$
DECLARE
  v_kpi RECORD;
BEGIN
  INSERT INTO public.kpi_picking_global (
    date_kpi,
    total_commandes_pickees,
    total_lignes_pickees,
    total_articles_pickes,
    picks_per_hour_moyen,
    articles_per_minute_moyen,
    accuracy_rate_moyen,
    nb_operateurs_actifs,
    nb_waves_completees,
    nb_batchs_completes
  )
  SELECT
    p_date,
    COALESCE(SUM(nb_commandes_pickees), 0),
    COALESCE(SUM(nb_lignes_pickees), 0),
    COALESCE(SUM(quantite_totale_pickee), 0),
    COALESCE(AVG(picks_per_hour), 0),
    COALESCE(AVG(articles_per_minute), 0),
    COALESCE(AVG(accuracy_rate), 100),
    COUNT(DISTINCT operateur_id),
    COALESCE(SUM(nb_waves_completees), 0),
    COALESCE(SUM(nb_batchs_completes), 0)
  FROM public.performance_operateur_quotidien
  WHERE date_performance = p_date
  ON CONFLICT (date_kpi)
  DO UPDATE SET
    total_commandes_pickees = EXCLUDED.total_commandes_pickees,
    total_lignes_pickees = EXCLUDED.total_lignes_pickees,
    total_articles_pickes = EXCLUDED.total_articles_pickes,
    picks_per_hour_moyen = EXCLUDED.picks_per_hour_moyen,
    articles_per_minute_moyen = EXCLUDED.articles_per_minute_moyen,
    accuracy_rate_moyen = EXCLUDED.accuracy_rate_moyen,
    nb_operateurs_actifs = EXCLUDED.nb_operateurs_actifs,
    nb_waves_completees = EXCLUDED.nb_waves_completees,
    nb_batchs_completes = EXCLUDED.nb_batchs_completes
  RETURNING * INTO v_kpi;

  RETURN to_jsonb(v_kpi);
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- =====================================================
-- 9. Vue - Classement Opérateurs
-- =====================================================

CREATE OR REPLACE VIEW public.classement_operateurs AS
SELECT
  po.operateur_id,
  p.prenom || ' ' || p.nom AS nom_complet,
  AVG(po.picks_per_hour) AS picks_per_hour_moyen,
  AVG(po.articles_per_minute) AS articles_per_minute_moyen,
  AVG(po.accuracy_rate) AS accuracy_rate_moyen,
  SUM(po.nb_lignes_pickees) AS total_lignes_pickees,
  COUNT(DISTINCT po.date_performance) AS jours_travailles,
  RANK() OVER (ORDER BY AVG(po.picks_per_hour) DESC) AS rang_productivite
FROM public.performance_operateur_quotidien po
JOIN public.profiles p ON p.id = po.operateur_id
WHERE po.date_performance >= CURRENT_DATE - 30 -- Derniers 30 jours
GROUP BY po.operateur_id, p.prenom, p.nom;

-- =====================================================
-- 10. Summary
-- =====================================================

DO $$
BEGIN
  RAISE NOTICE '';
  RAISE NOTICE '========================================';
  RAISE NOTICE '  LABOR MANAGEMENT IMPLÉMENTÉ';
  RAISE NOTICE '========================================';
  RAISE NOTICE 'Impact: Mesure ROI + Coaching opérateurs';
  RAISE NOTICE '';
  RAISE NOTICE 'Tables créées:';
  RAISE NOTICE '  ✅ performance_operateur_quotidien';
  RAISE NOTICE '  ✅ kpi_picking_global';
  RAISE NOTICE '  ✅ objectifs_operateur';
  RAISE NOTICE '';
  RAISE NOTICE 'RPC Functions:';
  RAISE NOTICE '  ✅ calculer_performance_quotidienne()';
  RAISE NOTICE '  ✅ calculer_kpi_global_quotidien()';
  RAISE NOTICE '';
  RAISE NOTICE 'KPI mesurés:';
  RAISE NOTICE '  • Picks per hour (lignes/heure)';
  RAISE NOTICE '  • Articles per minute';
  RAISE NOTICE '  • Accuracy rate (%)';
  RAISE NOTICE '  • Distance parcourue';
  RAISE NOTICE '';
  RAISE NOTICE 'Vues créées:';
  RAISE NOTICE '  ✅ classement_operateurs';
  RAISE NOTICE '';
  RAISE NOTICE 'Workflow:';
  RAISE NOTICE '  1. Calcul auto performance quotidienne';
  RAISE NOTICE '  2. Agrégation KPI globaux';
  RAISE NOTICE '  3. Classement opérateurs';
  RAISE NOTICE '  4. Dashboard analytics (UI à créer)';
  RAISE NOTICE '========================================';
  RAISE NOTICE '';
END $$;
