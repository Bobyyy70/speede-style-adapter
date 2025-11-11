-- ===================================================================
-- MIGRATION PARTIE 3: Triggers et Fonctions de Capture
-- ===================================================================

-- 29. TRIGGER: Capture des changements manuels de transporteur
-- ===================================================================
CREATE OR REPLACE FUNCTION public.capturer_changement_manuel_transporteur()
RETURNS TRIGGER AS $$
DECLARE
  v_decision_id UUID;
  v_transporteur_nom VARCHAR;
BEGIN
  -- Si le transporteur a été modifié manuellement
  IF OLD.transporteur IS DISTINCT FROM NEW.transporteur AND NEW.transporteur IS NOT NULL THEN
    
    -- Récupérer le nom du nouveau transporteur
    SELECT nom_affichage INTO v_transporteur_nom
    FROM public.transporteur_service
    WHERE code_service = NEW.transporteur
    LIMIT 1;
    
    -- Récupérer l'ID de la dernière décision pour cette commande
    SELECT id INTO v_decision_id
    FROM public.decision_transporteur
    WHERE commande_id = NEW.id
    ORDER BY date_decision DESC
    LIMIT 1;
    
    -- Créer un feedback de changement manuel
    INSERT INTO public.feedback_decision_transporteur (
      decision_id,
      commande_id,
      utilisateur_id,
      transporteur_initial,
      transporteur_modifie,
      raison_changement,
      commentaire,
      date_feedback
    ) VALUES (
      v_decision_id,
      NEW.id,
      auth.uid(),
      OLD.transporteur,
      NEW.transporteur,
      'changement_manuel',
      format('Transporteur modifié manuellement: %s → %s', OLD.transporteur, v_transporteur_nom),
      NOW()
    );
    
    -- Mettre à jour la décision si elle existe
    IF v_decision_id IS NOT NULL THEN
      UPDATE public.decision_transporteur
      SET 
        mode_decision = 'manuel',
        force_manuellement = true,
        transporteur_choisi_code = NEW.transporteur,
        transporteur_choisi_nom = COALESCE(v_transporteur_nom, NEW.transporteur)
      WHERE id = v_decision_id;
    END IF;
    
    RAISE NOTICE 'Changement manuel capturé: % → %', OLD.transporteur, NEW.transporteur;
  END IF;
  
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

DROP TRIGGER IF EXISTS capture_changement_manuel_trigger ON public.commande;
CREATE TRIGGER capture_changement_manuel_trigger
  AFTER UPDATE ON public.commande
  FOR EACH ROW
  WHEN (OLD.transporteur IS DISTINCT FROM NEW.transporteur)
  EXECUTE FUNCTION public.capturer_changement_manuel_transporteur();

-- 30. TRIGGER: Auto-sélection transporteur sur nouvelle commande
-- ===================================================================
CREATE OR REPLACE FUNCTION public.trigger_auto_selection_transporteur()
RETURNS TRIGGER AS $$
DECLARE
  v_config RECORD;
  v_log_id UUID;
BEGIN
  -- Vérifier si l'auto-sélection est activée pour ce client
  SELECT * INTO v_config
  FROM public.config_auto_selection_transporteur
  WHERE client_id = NEW.client_id
    AND actif = true;
  
  -- Si pas d'auto-sélection ou transporteur déjà défini, passer
  IF NOT FOUND OR NEW.transporteur IS NOT NULL THEN
    RETURN NEW;
  END IF;
  
  -- Logger le déclenchement
  INSERT INTO public.log_auto_selection_transporteur (
    commande_id,
    client_id,
    methode_selection,
    date_log
  ) VALUES (
    NEW.id,
    NEW.client_id,
    v_config.mode_selection,
    NOW()
  ) RETURNING id INTO v_log_id;
  
  -- Déclencher l'edge function de sélection automatique (via pg_net si disponible)
  -- Note: En production, utiliser pg_net.http_post ou notification système
  RAISE NOTICE 'Auto-sélection déclenchée pour commande %', NEW.id;
  
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Note: Le trigger est optionnel et peut être activé/désactivé selon les besoins
-- DROP TRIGGER IF EXISTS auto_selection_transporteur_trigger ON public.commande;
-- CREATE TRIGGER auto_selection_transporteur_trigger
--   AFTER INSERT ON public.commande
--   FOR EACH ROW
--   EXECUTE FUNCTION public.trigger_auto_selection_transporteur();

-- 31. FONCTION: Rafraîchir les vues matérialisées
-- ===================================================================
CREATE OR REPLACE FUNCTION public.refresh_materialized_views()
RETURNS VOID AS $$
BEGIN
  REFRESH MATERIALIZED VIEW CONCURRENTLY public.stats_performance_transporteur;
  REFRESH MATERIALIZED VIEW CONCURRENTLY public.dashboard_predictions_transporteurs;
  REFRESH MATERIALIZED VIEW CONCURRENTLY public.comparaison_couts_transporteurs;
  REFRESH MATERIALIZED VIEW CONCURRENTLY public.evolution_couts_temporelle;
  REFRESH MATERIALIZED VIEW CONCURRENTLY public.patterns_changements_transporteur;
  REFRESH MATERIALIZED VIEW CONCURRENTLY public.dashboard_apprentissage;
  REFRESH MATERIALIZED VIEW CONCURRENTLY public.dashboard_decisions_transporteurs;
  REFRESH MATERIALIZED VIEW CONCURRENTLY public.dashboard_auto_selection;
  
  RAISE NOTICE 'Toutes les vues matérialisées ont été rafraîchies';
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- 32. TABLE: suggestion_vote (pour workflow collaboratif)
-- ===================================================================
CREATE TABLE IF NOT EXISTS public.suggestion_vote (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  suggestion_id UUID NOT NULL REFERENCES public.suggestion_ajustement_regle(id) ON DELETE CASCADE,
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  vote VARCHAR(20) NOT NULL CHECK (vote IN ('approuver', 'rejeter', 'abstention')),
  commentaire TEXT,
  date_vote TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  UNIQUE(suggestion_id, user_id)
);

CREATE INDEX IF NOT EXISTS idx_vote_suggestion ON public.suggestion_vote(suggestion_id);
CREATE INDEX IF NOT EXISTS idx_vote_user ON public.suggestion_vote(user_id);

-- RLS Policies
ALTER TABLE public.suggestion_vote ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Admin full access vote" ON public.suggestion_vote;
CREATE POLICY "Admin full access vote"
  ON public.suggestion_vote
  FOR ALL
  USING (has_role(auth.uid(), 'admin'::app_role))
  WITH CHECK (has_role(auth.uid(), 'admin'::app_role));

DROP POLICY IF EXISTS "Gestionnaire manage own vote" ON public.suggestion_vote;
CREATE POLICY "Gestionnaire manage own vote"
  ON public.suggestion_vote
  FOR ALL
  USING (
    has_role(auth.uid(), 'gestionnaire'::app_role) 
    AND user_id = auth.uid()
  )
  WITH CHECK (
    has_role(auth.uid(), 'gestionnaire'::app_role) 
    AND user_id = auth.uid()
  );

-- 33. TABLE: notification_transporteur (pour système de notifications)
-- ===================================================================
CREATE TABLE IF NOT EXISTS public.notification_transporteur (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE,
  type_notification VARCHAR(50) NOT NULL,
  severite VARCHAR(20) NOT NULL CHECK (severite IN ('info', 'warning', 'critical')),
  titre VARCHAR(255) NOT NULL,
  message TEXT NOT NULL,
  lien_action VARCHAR(255),
  lue BOOLEAN DEFAULT false,
  metadata JSONB DEFAULT '{}',
  date_creation TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  date_lecture TIMESTAMP WITH TIME ZONE
);

CREATE INDEX IF NOT EXISTS idx_notif_user ON public.notification_transporteur(user_id);
CREATE INDEX IF NOT EXISTS idx_notif_lue ON public.notification_transporteur(lue);
CREATE INDEX IF NOT EXISTS idx_notif_date ON public.notification_transporteur(date_creation DESC);

-- RLS Policies
ALTER TABLE public.notification_transporteur ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Users read own notif" ON public.notification_transporteur;
CREATE POLICY "Users read own notif"
  ON public.notification_transporteur
  FOR SELECT
  USING (user_id = auth.uid());

DROP POLICY IF EXISTS "Users update own notif" ON public.notification_transporteur;
CREATE POLICY "Users update own notif"
  ON public.notification_transporteur
  FOR UPDATE
  USING (user_id = auth.uid())
  WITH CHECK (user_id = auth.uid());

-- 34. FONCTION: Créer notification pour utilisateurs
-- ===================================================================
CREATE OR REPLACE FUNCTION public.creer_notification(
  p_user_ids UUID[],
  p_type VARCHAR,
  p_severite VARCHAR,
  p_titre VARCHAR,
  p_message TEXT,
  p_lien_action VARCHAR DEFAULT NULL,
  p_metadata JSONB DEFAULT '{}'
)
RETURNS VOID AS $$
DECLARE
  v_user_id UUID;
BEGIN
  FOREACH v_user_id IN ARRAY p_user_ids
  LOOP
    INSERT INTO public.notification_transporteur (
      user_id,
      type_notification,
      severite,
      titre,
      message,
      lien_action,
      metadata
    ) VALUES (
      v_user_id,
      p_type,
      p_severite,
      p_titre,
      p_message,
      p_lien_action,
      p_metadata
    );
  END LOOP;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- 35. FONCTION: Obtenir votes unanimité pour suggestion
-- ===================================================================
CREATE OR REPLACE FUNCTION public.check_unanimite_suggestion(p_suggestion_id UUID)
RETURNS JSONB AS $$
DECLARE
  v_nb_votes_total INTEGER;
  v_nb_approuver INTEGER;
  v_nb_rejeter INTEGER;
  v_unanimite BOOLEAN := false;
BEGIN
  SELECT 
    COUNT(*),
    COUNT(*) FILTER (WHERE vote = 'approuver'),
    COUNT(*) FILTER (WHERE vote = 'rejeter')
  INTO v_nb_votes_total, v_nb_approuver, v_nb_rejeter
  FROM public.suggestion_vote
  WHERE suggestion_id = p_suggestion_id;
  
  -- Unanimité si au moins 2 votes et tous sont "approuver"
  v_unanimite := v_nb_votes_total >= 2 AND v_nb_rejeter = 0 AND v_nb_approuver = v_nb_votes_total;
  
  RETURN jsonb_build_object(
    'unanimite', v_unanimite,
    'votes_total', v_nb_votes_total,
    'votes_approuver', v_nb_approuver,
    'votes_rejeter', v_nb_rejeter
  );
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- ===================================================================
-- MISE À JOUR DES COLONNES pour cohérence
-- ===================================================================

-- S'assurer que les colonnes nécessaires existent dans la table commande
DO $$ 
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_schema = 'public' 
    AND table_name = 'commande' 
    AND column_name = 'montant_expedition'
  ) THEN
    ALTER TABLE public.commande ADD COLUMN montant_expedition DECIMAL(10,2);
  END IF;
END $$;

-- ===================================================================
-- INDEX SUPPLÉMENTAIRES POUR PERFORMANCE
-- ===================================================================

CREATE INDEX IF NOT EXISTS idx_commande_transporteur ON public.commande(transporteur) WHERE transporteur IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_commande_client_date ON public.commande(client_id, date_creation DESC);
CREATE INDEX IF NOT EXISTS idx_decision_date_transporteur ON public.decision_transporteur(date_decision DESC, transporteur_choisi_code);
CREATE INDEX IF NOT EXISTS idx_feedback_date ON public.feedback_decision_transporteur(date_feedback DESC);
CREATE INDEX IF NOT EXISTS idx_perf_date_transporteur ON public.performance_reelle_transporteur(date_enregistrement DESC, transporteur_code);

-- ===================================================================
-- FIN DE LA MIGRATION PARTIE 3
-- ===================================================================