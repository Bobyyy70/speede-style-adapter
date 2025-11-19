-- =====================================================
-- PUTAWAY MANAGEMENT - Gestion Intelligente Rangement
-- Description: Rangement optimisé basé sur vélocité produits (ABC Analysis)
-- Impact attendu: 20% réduction temps recherche
-- Date: 2025-11-18
-- =====================================================

-- =====================================================
-- 1. Table PRODUIT_VELOCITY_SCORE
-- =====================================================

CREATE TABLE IF NOT EXISTS public.produit_velocity_score (
  produit_id UUID PRIMARY KEY REFERENCES public.produit(id) ON DELETE CASCADE,

  -- Vélocité (vitesse de rotation)
  velocity_score DECIMAL(10,2) DEFAULT 0, -- Ventes moyennes par jour
  velocity_rank INTEGER, -- Classement relatif

  -- ABC Analysis
  abc_category CHAR(1) DEFAULT 'C',
  -- A: Fast-moving (top 20% = 80% ventes)
  -- B: Medium-moving (30% suivants = 15% ventes)
  -- C: Slow-moving (50% restants = 5% ventes)

  -- Zone optimale recommandée
  zone_optimale TEXT,
  -- A → Zones chaudes (proche expédition)
  -- B → Zones moyennes
  -- C → Zones froides (éloignées)

  -- Métriques de calcul (30 derniers jours)
  total_commandes INTEGER DEFAULT 0,
  total_lignes INTEGER DEFAULT 0,
  quantite_totale_vendue INTEGER DEFAULT 0,
  nb_jours_analyse INTEGER DEFAULT 30,

  -- Fréquence picking
  picks_per_day DECIMAL(10,2) DEFAULT 0,
  jours_avec_picking INTEGER DEFAULT 0,

  -- Dernière mise à jour
  date_calcul TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now(),

  CONSTRAINT valid_abc_category CHECK (abc_category IN ('A', 'B', 'C'))
);

-- =====================================================
-- 2. Table SUGGESTION_EMPLACEMENT
-- =====================================================

CREATE TABLE IF NOT EXISTS public.suggestion_emplacement (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  produit_id UUID NOT NULL REFERENCES public.produit(id) ON DELETE CASCADE,

  -- Emplacement actuel vs suggéré
  emplacement_actuel_id UUID REFERENCES public.emplacement(id),
  emplacement_suggere_id UUID REFERENCES public.emplacement(id),

  -- Raison de la suggestion
  raison_suggestion TEXT NOT NULL,
  -- Ex: "Produit A en zone froide", "Produit C en zone chaude"

  -- Priorité
  priorite INTEGER DEFAULT 1,
  -- 1=basse, 2=moyenne, 3=haute

  -- Gain estimé
  gain_estime_pct DECIMAL(5,2),
  -- Pourcentage de réduction de temps de picking estimé

  -- Statut
  statut TEXT DEFAULT 'en_attente',
  -- Statuts: 'en_attente', 'accepte', 'refuse', 'applique'

  -- Dates
  date_suggestion TIMESTAMPTZ DEFAULT now(),
  date_action TIMESTAMPTZ,

  -- Audit
  actioned_by UUID REFERENCES auth.users(id),

  CONSTRAINT valid_statut_suggestion CHECK (statut IN ('en_attente', 'accepte', 'refuse', 'applique')),
  CONSTRAINT valid_priorite_suggestion CHECK (priorite BETWEEN 1 AND 3)
);

-- =====================================================
-- 3. Table HISTORIQUE_PUTAWAY
-- =====================================================

CREATE TABLE IF NOT EXISTS public.historique_putaway (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  produit_id UUID NOT NULL REFERENCES public.produit(id) ON DELETE CASCADE,

  -- Emplacements
  emplacement_origine_id UUID REFERENCES public.emplacement(id),
  emplacement_destination_id UUID NOT NULL REFERENCES public.emplacement(id),

  -- Quantité déplacée
  quantite INTEGER NOT NULL,

  -- Type de putaway
  type_putaway TEXT DEFAULT 'manuel',
  -- Types: 'manuel', 'suggestion', 'automatique', 'reorg'

  -- Raison
  raison TEXT,

  -- Opérateur
  operateur_id UUID REFERENCES auth.users(id),

  -- Date
  date_putaway TIMESTAMPTZ DEFAULT now(),

  CONSTRAINT valid_type_putaway CHECK (type_putaway IN ('manuel', 'suggestion', 'automatique', 'reorg'))
);

-- =====================================================
-- 4. Indexes de Performance
-- =====================================================

-- Velocity Score
CREATE INDEX IF NOT EXISTS idx_velocity_score_abc
  ON public.produit_velocity_score(abc_category, velocity_score DESC);

CREATE INDEX IF NOT EXISTS idx_velocity_score_zone
  ON public.produit_velocity_score(zone_optimale)
  WHERE zone_optimale IS NOT NULL;

CREATE INDEX IF NOT EXISTS idx_velocity_score_rank
  ON public.produit_velocity_score(velocity_rank);

-- Suggestions
CREATE INDEX IF NOT EXISTS idx_suggestion_statut
  ON public.suggestion_emplacement(statut, priorite DESC);

CREATE INDEX IF NOT EXISTS idx_suggestion_produit
  ON public.suggestion_emplacement(produit_id, statut);

CREATE INDEX IF NOT EXISTS idx_suggestion_date
  ON public.suggestion_emplacement(date_suggestion DESC)
  WHERE statut = 'en_attente';

-- Historique
CREATE INDEX IF NOT EXISTS idx_historique_putaway_produit
  ON public.historique_putaway(produit_id, date_putaway DESC);

CREATE INDEX IF NOT EXISTS idx_historique_putaway_date
  ON public.historique_putaway(date_putaway DESC);

CREATE INDEX IF NOT EXISTS idx_historique_putaway_type
  ON public.historique_putaway(type_putaway, date_putaway DESC);

-- =====================================================
-- 5. Trigger auto-update updated_at
-- =====================================================

CREATE OR REPLACE FUNCTION update_velocity_score_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER trigger_velocity_score_updated_at
  BEFORE UPDATE ON public.produit_velocity_score
  FOR EACH ROW
  EXECUTE FUNCTION update_velocity_score_updated_at();

-- =====================================================
-- 6. RLS Policies
-- =====================================================

-- Enable RLS
ALTER TABLE public.produit_velocity_score ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.suggestion_emplacement ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.historique_putaway ENABLE ROW LEVEL SECURITY;

-- Service role full access
CREATE POLICY "service_role_full_produit_velocity_score" ON public.produit_velocity_score
  FOR ALL TO service_role USING (true) WITH CHECK (true);

CREATE POLICY "service_role_full_suggestion_emplacement" ON public.suggestion_emplacement
  FOR ALL TO service_role USING (true) WITH CHECK (true);

CREATE POLICY "service_role_full_historique_putaway" ON public.historique_putaway
  FOR ALL TO service_role USING (true) WITH CHECK (true);

-- Gestionnaire: Full access
CREATE POLICY "gestionnaire_full_velocity_score" ON public.produit_velocity_score
  FOR ALL TO authenticated
  USING (has_role(auth.uid(), 'gestionnaire'::app_role))
  WITH CHECK (has_role(auth.uid(), 'gestionnaire'::app_role));

CREATE POLICY "gestionnaire_full_suggestion" ON public.suggestion_emplacement
  FOR ALL TO authenticated
  USING (has_role(auth.uid(), 'gestionnaire'::app_role))
  WITH CHECK (has_role(auth.uid(), 'gestionnaire'::app_role));

CREATE POLICY "gestionnaire_full_historique" ON public.historique_putaway
  FOR ALL TO authenticated
  USING (has_role(auth.uid(), 'gestionnaire'::app_role))
  WITH CHECK (has_role(auth.uid(), 'gestionnaire'::app_role));

-- Opérateur: Read velocity + suggestions
CREATE POLICY "operateur_read_velocity_score" ON public.produit_velocity_score
  FOR SELECT TO authenticated
  USING (has_role(auth.uid(), 'operateur'::app_role));

CREATE POLICY "operateur_read_suggestion" ON public.suggestion_emplacement
  FOR SELECT TO authenticated
  USING (has_role(auth.uid(), 'operateur'::app_role));

CREATE POLICY "operateur_create_historique" ON public.historique_putaway
  FOR INSERT TO authenticated
  WITH CHECK (
    has_role(auth.uid(), 'operateur'::app_role) AND
    operateur_id = auth.uid()
  );

-- =====================================================
-- 7. Vue Matérialisée - Statistiques Putaway
-- =====================================================

CREATE MATERIALIZED VIEW IF NOT EXISTS public.putaway_stats AS
SELECT
  -- Répartition ABC
  COUNT(*) FILTER (WHERE abc_category = 'A') AS nb_produits_a,
  COUNT(*) FILTER (WHERE abc_category = 'B') AS nb_produits_b,
  COUNT(*) FILTER (WHERE abc_category = 'C') AS nb_produits_c,

  -- Vélocité moyenne par catégorie
  AVG(velocity_score) FILTER (WHERE abc_category = 'A') AS velocity_avg_a,
  AVG(velocity_score) FILTER (WHERE abc_category = 'B') AS velocity_avg_b,
  AVG(velocity_score) FILTER (WHERE abc_category = 'C') AS velocity_avg_c,

  -- Picks moyens par jour
  AVG(picks_per_day) AS picks_per_day_avg,

  -- Dernière mise à jour
  MAX(date_calcul) AS last_calculation

FROM public.produit_velocity_score;

-- =====================================================
-- 8. Fonction de rafraîchissement stats
-- =====================================================

CREATE OR REPLACE FUNCTION refresh_putaway_stats()
RETURNS void AS $$
BEGIN
  REFRESH MATERIALIZED VIEW public.putaway_stats;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- =====================================================
-- 9. Summary
-- =====================================================

DO $$
BEGIN
  RAISE NOTICE '';
  RAISE NOTICE '========================================';
  RAISE NOTICE '  PUTAWAY MANAGEMENT - ABC ANALYSIS';
  RAISE NOTICE '========================================';
  RAISE NOTICE 'Impact attendu: 20%% réduction temps recherche';
  RAISE NOTICE '';
  RAISE NOTICE 'Tables créées:';
  RAISE NOTICE '  ✅ produit_velocity_score';
  RAISE NOTICE '  ✅ suggestion_emplacement';
  RAISE NOTICE '  ✅ historique_putaway';
  RAISE NOTICE '';
  RAISE NOTICE 'ABC Analysis:';
  RAISE NOTICE '  • A: Fast-moving (20%% produits = 80%% ventes)';
  RAISE NOTICE '  • B: Medium-moving (30%% = 15%% ventes)';
  RAISE NOTICE '  • C: Slow-moving (50%% = 5%% ventes)';
  RAISE NOTICE '';
  RAISE NOTICE 'Zones optimales:';
  RAISE NOTICE '  • Produits A → Zones chaudes (proche expé)';
  RAISE NOTICE '  • Produits B → Zones moyennes';
  RAISE NOTICE '  • Produits C → Zones froides';
  RAISE NOTICE '';
  RAISE NOTICE 'Prochaines étapes:';
  RAISE NOTICE '  1. Créer RPC calcul velocity + ABC';
  RAISE NOTICE '  2. Créer CRON calcul quotidien';
  RAISE NOTICE '  3. Créer RPC suggestions réorg';
  RAISE NOTICE '  4. Créer UI affichage suggestions';
  RAISE NOTICE '========================================';
  RAISE NOTICE '';
END $$;
