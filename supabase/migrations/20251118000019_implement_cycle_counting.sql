-- =====================================================
-- CYCLE COUNTING - Comptage Cyclique Inventaire
-- Description: Comptage rotatif pour améliorer précision inventaire
-- Impact attendu: 15% amélioration précision inventaire
-- Date: 2025-11-18
-- =====================================================

-- =====================================================
-- 1. Table CYCLE_COUNT_TASK
-- =====================================================

CREATE TABLE IF NOT EXISTS public.cycle_count_task (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),

  -- Emplacement/Produit à compter
  emplacement_id UUID REFERENCES public.emplacement(id) ON DELETE CASCADE,
  produit_id UUID REFERENCES public.produit(id) ON DELETE CASCADE,

  -- Priorité basée sur ABC
  priorite INTEGER DEFAULT 1,
  -- 1=basse (C), 2=moyenne (B), 3=haute (A)

  -- Fréquence de comptage
  frequence_jours INTEGER DEFAULT 30,
  -- A: 7 jours, B: 30 jours, C: 90 jours

  -- Quantité système vs comptée
  quantite_systeme INTEGER NOT NULL,
  quantite_comptee INTEGER,
  ecart INTEGER GENERATED ALWAYS AS (quantite_comptee - quantite_systeme) STORED,
  ecart_pct DECIMAL(5,2) GENERATED ALWAYS AS (
    CASE
      WHEN quantite_systeme > 0
      THEN ROUND(100.0 * (quantite_comptee - quantite_systeme) / quantite_systeme, 2)
      ELSE NULL
    END
  ) STORED,

  -- Statut
  statut TEXT DEFAULT 'en_attente',
  -- Statuts: 'en_attente', 'en_cours', 'termine', 'ecart_majeur', 'valide'

  -- Affectation
  operateur_id UUID REFERENCES auth.users(id),
  date_assignation TIMESTAMPTZ,

  -- Timing
  date_creation TIMESTAMPTZ DEFAULT now(),
  date_debut_comptage TIMESTAMPTZ,
  date_fin_comptage TIMESTAMPTZ,

  -- Validation (si écart)
  validateur_id UUID REFERENCES auth.users(id),
  date_validation TIMESTAMPTZ,
  commentaire TEXT,

  -- Action corrective
  action_corrective TEXT,
  -- 'ajustement_stock', 'recomptage', 'aucune'

  CONSTRAINT valid_statut_cycle_count CHECK (statut IN ('en_attente', 'en_cours', 'termine', 'ecart_majeur', 'valide')),
  CONSTRAINT valid_priorite_cycle_count CHECK (priorite BETWEEN 1 AND 3)
);

-- =====================================================
-- 2. Table CYCLE_COUNT_HISTORY
-- =====================================================

CREATE TABLE IF NOT EXISTS public.cycle_count_history (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  task_id UUID REFERENCES public.cycle_count_task(id) ON DELETE SET NULL,

  produit_id UUID NOT NULL REFERENCES public.produit(id),
  emplacement_id UUID REFERENCES public.emplacement(id),

  -- Valeurs au moment du comptage
  quantite_systeme INTEGER NOT NULL,
  quantite_comptee INTEGER NOT NULL,
  ecart INTEGER NOT NULL,
  ecart_pct DECIMAL(5,2),

  -- Opérateur
  operateur_id UUID REFERENCES auth.users(id),
  validateur_id UUID REFERENCES auth.users(id),

  -- Date
  date_comptage TIMESTAMPTZ DEFAULT now(),

  -- Commentaires
  commentaire TEXT,
  action_prise TEXT
);

-- =====================================================
-- 3. Table CYCLE_COUNT_SCHEDULE
-- =====================================================

CREATE TABLE IF NOT EXISTS public.cycle_count_schedule (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  produit_id UUID NOT NULL REFERENCES public.produit(id),

  -- Fréquence de comptage (basée sur ABC)
  frequence_jours INTEGER NOT NULL DEFAULT 30,

  -- Dernier comptage
  derniere_tache_id UUID REFERENCES public.cycle_count_task(id),
  date_dernier_comptage TIMESTAMPTZ,

  -- Prochain comptage
  date_prochain_comptage DATE,

  -- Métriques
  nb_comptages_total INTEGER DEFAULT 0,
  nb_ecarts_detectes INTEGER DEFAULT 0,
  precision_moyenne_pct DECIMAL(5,2),

  -- Auto-génération activée
  auto_generate BOOLEAN DEFAULT TRUE,

  updated_at TIMESTAMPTZ DEFAULT now()
);

-- =====================================================
-- 4. Indexes de Performance
-- =====================================================

-- Cycle Count Task
CREATE INDEX IF NOT EXISTS idx_cycle_count_task_statut
  ON public.cycle_count_task(statut, priorite DESC, date_creation DESC);

CREATE INDEX IF NOT EXISTS idx_cycle_count_task_operateur
  ON public.cycle_count_task(operateur_id, statut)
  WHERE operateur_id IS NOT NULL;

CREATE INDEX IF NOT EXISTS idx_cycle_count_task_produit
  ON public.cycle_count_task(produit_id, statut);

CREATE INDEX IF NOT EXISTS idx_cycle_count_task_emplacement
  ON public.cycle_count_task(emplacement_id, statut);

CREATE INDEX IF NOT EXISTS idx_cycle_count_task_ecart
  ON public.cycle_count_task(ABS(ecart) DESC)
  WHERE ecart IS NOT NULL;

-- Cycle Count History
CREATE INDEX IF NOT EXISTS idx_cycle_count_history_produit
  ON public.cycle_count_history(produit_id, date_comptage DESC);

CREATE INDEX IF NOT EXISTS idx_cycle_count_history_date
  ON public.cycle_count_history(date_comptage DESC);

CREATE INDEX IF NOT EXISTS idx_cycle_count_history_ecart
  ON public.cycle_count_history(ABS(ecart) DESC);

-- Cycle Count Schedule
CREATE INDEX IF NOT EXISTS idx_cycle_count_schedule_prochain
  ON public.cycle_count_schedule(date_prochain_comptage)
  WHERE auto_generate = TRUE;

CREATE INDEX IF NOT EXISTS idx_cycle_count_schedule_produit
  ON public.cycle_count_schedule(produit_id);

-- =====================================================
-- 5. Trigger auto-update updated_at
-- =====================================================

CREATE OR REPLACE FUNCTION update_cycle_count_schedule_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER trigger_cycle_count_schedule_updated_at
  BEFORE UPDATE ON public.cycle_count_schedule
  FOR EACH ROW
  EXECUTE FUNCTION update_cycle_count_schedule_updated_at();

-- =====================================================
-- 6. RLS Policies
-- =====================================================

-- Enable RLS
ALTER TABLE public.cycle_count_task ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.cycle_count_history ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.cycle_count_schedule ENABLE ROW LEVEL SECURITY;

-- Service role full access
CREATE POLICY "service_role_full_cycle_count_task" ON public.cycle_count_task
  FOR ALL TO service_role USING (true) WITH CHECK (true);

CREATE POLICY "service_role_full_cycle_count_history" ON public.cycle_count_history
  FOR ALL TO service_role USING (true) WITH CHECK (true);

CREATE POLICY "service_role_full_cycle_count_schedule" ON public.cycle_count_schedule
  FOR ALL TO service_role USING (true) WITH CHECK (true);

-- Gestionnaire: Full access
CREATE POLICY "gestionnaire_full_cycle_count_task" ON public.cycle_count_task
  FOR ALL TO authenticated
  USING (has_role(auth.uid(), 'gestionnaire'::app_role))
  WITH CHECK (has_role(auth.uid(), 'gestionnaire'::app_role));

CREATE POLICY "gestionnaire_full_cycle_count_history" ON public.cycle_count_history
  FOR ALL TO authenticated
  USING (has_role(auth.uid(), 'gestionnaire'::app_role))
  WITH CHECK (has_role(auth.uid(), 'gestionnaire'::app_role));

CREATE POLICY "gestionnaire_full_cycle_count_schedule" ON public.cycle_count_schedule
  FOR ALL TO authenticated
  USING (has_role(auth.uid(), 'gestionnaire'::app_role))
  WITH CHECK (has_role(auth.uid(), 'gestionnaire'::app_role));

-- Opérateur: Ses tâches assignées
CREATE POLICY "operateur_own_cycle_count_task" ON public.cycle_count_task
  FOR ALL TO authenticated
  USING (
    has_role(auth.uid(), 'operateur'::app_role) AND
    (operateur_id = auth.uid() OR operateur_id IS NULL)
  )
  WITH CHECK (
    has_role(auth.uid(), 'operateur'::app_role) AND
    operateur_id = auth.uid()
  );

CREATE POLICY "operateur_read_cycle_count_history" ON public.cycle_count_history
  FOR SELECT TO authenticated
  USING (has_role(auth.uid(), 'operateur'::app_role));

-- =====================================================
-- 7. RPC - initialiser_cycle_counting
-- =====================================================

CREATE OR REPLACE FUNCTION initialiser_cycle_counting()
RETURNS INTEGER AS $$
DECLARE
  v_nb_schedules INTEGER := 0;
BEGIN
  -- Créer les schedules pour tous les produits
  INSERT INTO public.cycle_count_schedule (
    produit_id,
    frequence_jours,
    date_prochain_comptage,
    auto_generate
  )
  SELECT
    p.id,
    CASE
      WHEN pvs.abc_category = 'A' THEN 7   -- Produits A: toutes les semaines
      WHEN pvs.abc_category = 'B' THEN 30  -- Produits B: tous les mois
      WHEN pvs.abc_category = 'C' THEN 90  -- Produits C: tous les trimestres
      ELSE 30
    END AS frequence_jours,
    CURRENT_DATE + (
      CASE
        WHEN pvs.abc_category = 'A' THEN 7
        WHEN pvs.abc_category = 'B' THEN 30
        ELSE 90
      END
    )::INTEGER AS date_prochain_comptage,
    TRUE
  FROM public.produit p
  LEFT JOIN public.produit_velocity_score pvs ON pvs.produit_id = p.id
  ON CONFLICT (produit_id) DO NOTHING;

  GET DIAGNOSTICS v_nb_schedules = ROW_COUNT;

  RAISE NOTICE 'Initialisé % schedules de cycle counting', v_nb_schedules;

  RETURN v_nb_schedules;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- =====================================================
-- 8. RPC - generer_taches_cycle_count
-- =====================================================

CREATE OR REPLACE FUNCTION generer_taches_cycle_count(p_nb_taches INTEGER DEFAULT 20)
RETURNS INTEGER AS $$
DECLARE
  v_nb_taches INTEGER := 0;
BEGIN
  -- Générer des tâches pour les produits dont la date de comptage est arrivée
  INSERT INTO public.cycle_count_task (
    emplacement_id,
    produit_id,
    priorite,
    frequence_jours,
    quantite_systeme,
    statut
  )
  SELECT
    es.emplacement_id,
    ccs.produit_id,
    CASE
      WHEN ccs.frequence_jours <= 7 THEN 3   -- Haute priorité (A)
      WHEN ccs.frequence_jours <= 30 THEN 2  -- Moyenne (B)
      ELSE 1                                  -- Basse (C)
    END AS priorite,
    ccs.frequence_jours,
    es.quantite_disponible,
    'en_attente'
  FROM public.cycle_count_schedule ccs
  JOIN public.emplacement_stock es ON es.produit_id = ccs.produit_id
  WHERE ccs.auto_generate = TRUE
  AND ccs.date_prochain_comptage <= CURRENT_DATE
  ORDER BY ccs.date_prochain_comptage, ccs.frequence_jours
  LIMIT p_nb_taches;

  GET DIAGNOSTICS v_nb_taches = ROW_COUNT;

  RAISE NOTICE 'Généré % tâches de cycle counting', v_nb_taches;

  RETURN v_nb_taches;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- =====================================================
-- 9. RPC - enregistrer_comptage
-- =====================================================

CREATE OR REPLACE FUNCTION enregistrer_comptage(
  p_task_id UUID,
  p_quantite_comptee INTEGER,
  p_commentaire TEXT DEFAULT NULL
)
RETURNS JSONB AS $$
DECLARE
  v_task RECORD;
  v_ecart INTEGER;
  v_ecart_pct DECIMAL;
  v_seuil_ecart_majeur DECIMAL := 5.0; -- 5% d'écart = majeur
BEGIN
  -- Récupérer la tâche
  SELECT * INTO v_task
  FROM public.cycle_count_task
  WHERE id = p_task_id;

  IF v_task IS NULL THEN
    RAISE EXCEPTION 'Tâche inexistante';
  END IF;

  -- Calculer l'écart
  v_ecart := p_quantite_comptee - v_task.quantite_systeme;
  v_ecart_pct := CASE
    WHEN v_task.quantite_systeme > 0
    THEN ABS(100.0 * v_ecart / v_task.quantite_systeme)
    ELSE 0
  END;

  -- Mettre à jour la tâche
  UPDATE public.cycle_count_task
  SET
    quantite_comptee = p_quantite_comptee,
    statut = CASE
      WHEN v_ecart_pct > v_seuil_ecart_majeur THEN 'ecart_majeur'
      ELSE 'termine'
    END,
    date_fin_comptage = now(),
    commentaire = p_commentaire,
    action_corrective = CASE
      WHEN v_ecart_pct > v_seuil_ecart_majeur THEN 'recomptage'
      WHEN v_ecart != 0 THEN 'ajustement_stock'
      ELSE 'aucune'
    END
  WHERE id = p_task_id;

  -- Enregistrer dans l'historique
  INSERT INTO public.cycle_count_history (
    task_id,
    produit_id,
    emplacement_id,
    quantite_systeme,
    quantite_comptee,
    ecart,
    ecart_pct,
    operateur_id,
    commentaire
  ) VALUES (
    p_task_id,
    v_task.produit_id,
    v_task.emplacement_id,
    v_task.quantite_systeme,
    p_quantite_comptee,
    v_ecart,
    v_ecart_pct,
    auth.uid(),
    p_commentaire
  );

  -- Mettre à jour le schedule
  UPDATE public.cycle_count_schedule
  SET
    derniere_tache_id = p_task_id,
    date_dernier_comptage = now(),
    date_prochain_comptage = CURRENT_DATE + frequence_jours,
    nb_comptages_total = nb_comptages_total + 1,
    nb_ecarts_detectes = nb_ecarts_detectes + CASE WHEN v_ecart != 0 THEN 1 ELSE 0 END,
    precision_moyenne_pct = (
      SELECT AVG(100.0 - ABS(ecart_pct))
      FROM public.cycle_count_history
      WHERE produit_id = v_task.produit_id
    )
  WHERE produit_id = v_task.produit_id;

  RETURN jsonb_build_object(
    'success', true,
    'ecart', v_ecart,
    'ecart_pct', v_ecart_pct,
    'ecart_majeur', v_ecart_pct > v_seuil_ecart_majeur,
    'action_recommandee', CASE
      WHEN v_ecart_pct > v_seuil_ecart_majeur THEN 'Recompter le produit'
      WHEN v_ecart != 0 THEN 'Ajuster le stock'
      ELSE 'Aucune action nécessaire'
    END
  );
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- =====================================================
-- 10. RPC - valider_ecart_comptage
-- =====================================================

CREATE OR REPLACE FUNCTION valider_ecart_comptage(
  p_task_id UUID,
  p_ajuster_stock BOOLEAN DEFAULT TRUE
)
RETURNS BOOLEAN AS $$
DECLARE
  v_task RECORD;
BEGIN
  -- Récupérer la tâche
  SELECT * INTO v_task
  FROM public.cycle_count_task
  WHERE id = p_task_id;

  IF v_task IS NULL THEN
    RAISE EXCEPTION 'Tâche inexistante';
  END IF;

  IF v_task.quantite_comptee IS NULL THEN
    RAISE EXCEPTION 'Comptage non effectué';
  END IF;

  -- Ajuster le stock si demandé
  IF p_ajuster_stock AND v_task.ecart != 0 THEN
    UPDATE public.emplacement_stock
    SET
      quantite_disponible = v_task.quantite_comptee,
      quantite_reservee = CASE
        WHEN quantite_reservee > v_task.quantite_comptee THEN v_task.quantite_comptee
        ELSE quantite_reservee
      END
    WHERE emplacement_id = v_task.emplacement_id
    AND produit_id = v_task.produit_id;

    -- Enregistrer dans mouvement_stock
    INSERT INTO public.mouvement_stock (
      produit_id,
      type_mouvement,
      quantite,
      emplacement_destination_id,
      raison,
      user_id
    ) VALUES (
      v_task.produit_id,
      CASE WHEN v_task.ecart > 0 THEN 'ajustement_plus' ELSE 'ajustement_moins' END,
      ABS(v_task.ecart),
      v_task.emplacement_id,
      'Ajustement cycle counting - Écart: ' || v_task.ecart,
      auth.uid()
    );
  END IF;

  -- Marquer comme validé
  UPDATE public.cycle_count_task
  SET
    statut = 'valide',
    validateur_id = auth.uid(),
    date_validation = now()
  WHERE id = p_task_id;

  RETURN TRUE;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- =====================================================
-- 11. Vue - Statistiques Cycle Counting
-- =====================================================

CREATE OR REPLACE VIEW public.cycle_counting_stats AS
SELECT
  -- Tâches
  COUNT(*) FILTER (WHERE statut = 'en_attente') AS taches_en_attente,
  COUNT(*) FILTER (WHERE statut = 'en_cours') AS taches_en_cours,
  COUNT(*) FILTER (WHERE statut = 'termine') AS taches_terminees,
  COUNT(*) FILTER (WHERE statut = 'ecart_majeur') AS ecarts_majeurs,

  -- Précision
  AVG(
    CASE
      WHEN quantite_comptee IS NOT NULL AND quantite_systeme > 0
      THEN 100.0 - ABS(100.0 * (quantite_comptee - quantite_systeme) / quantite_systeme)
      ELSE NULL
    END
  ) AS precision_moyenne_pct,

  -- Écarts
  COUNT(*) FILTER (WHERE ecart IS NOT NULL AND ecart != 0) AS nb_ecarts_detectes,
  SUM(ABS(ecart)) FILTER (WHERE ecart IS NOT NULL) AS ecart_total_abs,

  -- Aujourd'hui
  COUNT(*) FILTER (WHERE DATE(date_creation) = CURRENT_DATE) AS taches_creees_aujourdhui,
  COUNT(*) FILTER (WHERE DATE(date_fin_comptage) = CURRENT_DATE) AS taches_terminees_aujourdhui

FROM public.cycle_count_task;

-- =====================================================
-- 12. Summary
-- =====================================================

DO $$
BEGIN
  RAISE NOTICE '';
  RAISE NOTICE '========================================';
  RAISE NOTICE '  CYCLE COUNTING IMPLÉMENTÉ';
  RAISE NOTICE '========================================';
  RAISE NOTICE 'Impact attendu: 15%% amélioration précision';
  RAISE NOTICE '';
  RAISE NOTICE 'Tables créées:';
  RAISE NOTICE '  ✅ cycle_count_task';
  RAISE NOTICE '  ✅ cycle_count_history';
  RAISE NOTICE '  ✅ cycle_count_schedule';
  RAISE NOTICE '';
  RAISE NOTICE 'RPC Functions:';
  RAISE NOTICE '  ✅ initialiser_cycle_counting()';
  RAISE NOTICE '  ✅ generer_taches_cycle_count()';
  RAISE NOTICE '  ✅ enregistrer_comptage()';
  RAISE NOTICE '  ✅ valider_ecart_comptage()';
  RAISE NOTICE '';
  RAISE NOTICE 'Fréquences ABC:';
  RAISE NOTICE '  • Produits A: tous les 7 jours';
  RAISE NOTICE '  • Produits B: tous les 30 jours';
  RAISE NOTICE '  • Produits C: tous les 90 jours';
  RAISE NOTICE '';
  RAISE NOTICE 'Workflow:';
  RAISE NOTICE '  1. Initialiser schedules (1x)';
  RAISE NOTICE '  2. Génération auto tâches quotidiennes';
  RAISE NOTICE '  3. Opérateur compte et enregistre';
  RAISE NOTICE '  4. Validation écarts automatique';
  RAISE NOTICE '  5. Ajustement stock si nécessaire';
  RAISE NOTICE '';
  RAISE NOTICE 'À faire:';
  RAISE NOTICE '  - SELECT initialiser_cycle_counting();';
  RAISE NOTICE '  - Créer CRON génération quotidienne';
  RAISE NOTICE '========================================';
  RAISE NOTICE '';
END $$;
