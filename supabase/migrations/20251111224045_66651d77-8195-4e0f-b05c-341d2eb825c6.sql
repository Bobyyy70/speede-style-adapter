-- ===================================================================
-- MIGRATION COMPLÈTE: Schéma BDD pour système de sélection transporteur
-- ===================================================================

-- 1. TABLE PRINCIPALE: regle_selection_transporteur
-- ===================================================================
CREATE TABLE IF NOT EXISTS public.regle_selection_transporteur (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  nom_regle VARCHAR(255) NOT NULL,
  description TEXT,
  priorite INTEGER DEFAULT 100,
  actif BOOLEAN DEFAULT true,
  critere_principal VARCHAR(50) DEFAULT 'cout',
  conditions JSONB NOT NULL DEFAULT '{}',
  transporteur_force_id UUID REFERENCES public.transporteur_service(id) ON DELETE SET NULL,
  force_transporteur BOOLEAN DEFAULT false,
  score_performance DECIMAL(5,2) DEFAULT 0,
  nombre_utilisations INTEGER DEFAULT 0,
  client_id UUID REFERENCES public.client(id) ON DELETE CASCADE,
  date_creation TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  date_modification TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  CONSTRAINT score_range CHECK (score_performance >= 0 AND score_performance <= 100)
);

CREATE INDEX IF NOT EXISTS idx_regle_actif ON public.regle_selection_transporteur(actif);
CREATE INDEX IF NOT EXISTS idx_regle_client ON public.regle_selection_transporteur(client_id);
CREATE INDEX IF NOT EXISTS idx_regle_priorite ON public.regle_selection_transporteur(priorite DESC);

-- RLS Policies pour regle_selection_transporteur
ALTER TABLE public.regle_selection_transporteur ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Admin full access regle_selection" ON public.regle_selection_transporteur;
CREATE POLICY "Admin full access regle_selection"
  ON public.regle_selection_transporteur
  FOR ALL
  USING (has_role(auth.uid(), 'admin'::app_role))
  WITH CHECK (has_role(auth.uid(), 'admin'::app_role));

DROP POLICY IF EXISTS "Gestionnaire manage regle_selection" ON public.regle_selection_transporteur;
CREATE POLICY "Gestionnaire manage regle_selection"
  ON public.regle_selection_transporteur
  FOR ALL
  USING (has_role(auth.uid(), 'gestionnaire'::app_role))
  WITH CHECK (has_role(auth.uid(), 'gestionnaire'::app_role));

DROP POLICY IF EXISTS "Client read own regle_selection" ON public.regle_selection_transporteur;
CREATE POLICY "Client read own regle_selection"
  ON public.regle_selection_transporteur
  FOR SELECT
  USING (
    has_role(auth.uid(), 'client'::app_role) 
    AND client_id IN (SELECT client_id FROM public.profiles WHERE id = auth.uid())
  );

-- 2. TABLE: decision_transporteur
-- ===================================================================
CREATE TABLE IF NOT EXISTS public.decision_transporteur (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  commande_id UUID NOT NULL REFERENCES public.commande(id) ON DELETE CASCADE,
  transporteur_choisi_code VARCHAR(100) NOT NULL,
  transporteur_choisi_nom VARCHAR(255) NOT NULL,
  score_transporteur DECIMAL(5,2) DEFAULT 0,
  poids_colis DECIMAL(10,2),
  pays_destination VARCHAR(10),
  delai_souhaite VARCHAR(50),
  cout_estime DECIMAL(10,2),
  regles_appliquees JSONB DEFAULT '[]',
  nombre_regles_matchees INTEGER DEFAULT 0,
  analyse_ia TEXT,
  recommandation_ia TEXT,
  confiance_decision DECIMAL(3,2) DEFAULT 0.5,
  mode_decision VARCHAR(50) DEFAULT 'automatique',
  transporteurs_alternatives JSONB DEFAULT '[]',
  duree_calcul_ms INTEGER,
  facteurs_decision JSONB DEFAULT '{}',
  force_manuellement BOOLEAN DEFAULT false,
  raison_forcage TEXT,
  date_decision TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  CONSTRAINT score_range_decision CHECK (score_transporteur >= 0 AND score_transporteur <= 100),
  CONSTRAINT confiance_range CHECK (confiance_decision >= 0 AND confiance_decision <= 1)
);

CREATE INDEX IF NOT EXISTS idx_decision_commande ON public.decision_transporteur(commande_id);
CREATE INDEX IF NOT EXISTS idx_decision_mode ON public.decision_transporteur(mode_decision);
CREATE INDEX IF NOT EXISTS idx_decision_date ON public.decision_transporteur(date_decision DESC);

-- RLS Policies pour decision_transporteur
ALTER TABLE public.decision_transporteur ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Admin full access decision" ON public.decision_transporteur;
CREATE POLICY "Admin full access decision"
  ON public.decision_transporteur
  FOR ALL
  USING (has_role(auth.uid(), 'admin'::app_role))
  WITH CHECK (has_role(auth.uid(), 'admin'::app_role));

DROP POLICY IF EXISTS "Gestionnaire read decision" ON public.decision_transporteur;
CREATE POLICY "Gestionnaire read decision"
  ON public.decision_transporteur
  FOR SELECT
  USING (has_role(auth.uid(), 'gestionnaire'::app_role));

-- 3. TABLE: feedback_decision_transporteur
-- ===================================================================
CREATE TABLE IF NOT EXISTS public.feedback_decision_transporteur (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  decision_id UUID REFERENCES public.decision_transporteur(id) ON DELETE CASCADE,
  commande_id UUID NOT NULL REFERENCES public.commande(id) ON DELETE CASCADE,
  utilisateur_id UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  transporteur_initial VARCHAR(100) NOT NULL,
  transporteur_modifie VARCHAR(100) NOT NULL,
  raison_changement VARCHAR(50),
  commentaire TEXT,
  regles_ignorees JSONB DEFAULT '[]',
  metadata JSONB DEFAULT '{}',
  date_feedback TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_feedback_commande ON public.feedback_decision_transporteur(commande_id);
CREATE INDEX IF NOT EXISTS idx_feedback_date ON public.feedback_decision_transporteur(date_feedback DESC);

-- RLS Policies
ALTER TABLE public.feedback_decision_transporteur ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Admin full access feedback" ON public.feedback_decision_transporteur;
CREATE POLICY "Admin full access feedback"
  ON public.feedback_decision_transporteur
  FOR ALL
  USING (has_role(auth.uid(), 'admin'::app_role))
  WITH CHECK (has_role(auth.uid(), 'admin'::app_role));

DROP POLICY IF EXISTS "Gestionnaire manage feedback" ON public.feedback_decision_transporteur;
CREATE POLICY "Gestionnaire manage feedback"
  ON public.feedback_decision_transporteur
  FOR ALL
  USING (has_role(auth.uid(), 'gestionnaire'::app_role))
  WITH CHECK (has_role(auth.uid(), 'gestionnaire'::app_role));

-- 4. TABLE: performance_reelle_transporteur
-- ===================================================================
CREATE TABLE IF NOT EXISTS public.performance_reelle_transporteur (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  commande_id UUID REFERENCES public.commande(id) ON DELETE CASCADE,
  transporteur_code VARCHAR(100) NOT NULL,
  delai_prevu_jours INTEGER,
  delai_reel_jours INTEGER,
  cout_prevu DECIMAL(10,2),
  cout_reel DECIMAL(10,2),
  statut_livraison VARCHAR(50),
  incidents JSONB DEFAULT '[]',
  note_client INTEGER CHECK (note_client >= 1 AND note_client <= 5),
  commentaire_client TEXT,
  date_expedition TIMESTAMP WITH TIME ZONE,
  date_livraison TIMESTAMP WITH TIME ZONE,
  date_enregistrement TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_perf_transporteur ON public.performance_reelle_transporteur(transporteur_code);
CREATE INDEX IF NOT EXISTS idx_perf_commande ON public.performance_reelle_transporteur(commande_id);
CREATE INDEX IF NOT EXISTS idx_perf_date ON public.performance_reelle_transporteur(date_enregistrement DESC);

-- RLS Policies
ALTER TABLE public.performance_reelle_transporteur ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Admin full access performance" ON public.performance_reelle_transporteur;
CREATE POLICY "Admin full access performance"
  ON public.performance_reelle_transporteur
  FOR ALL
  USING (has_role(auth.uid(), 'admin'::app_role))
  WITH CHECK (has_role(auth.uid(), 'admin'::app_role));

DROP POLICY IF EXISTS "Gestionnaire read performance" ON public.performance_reelle_transporteur;
CREATE POLICY "Gestionnaire read performance"
  ON public.performance_reelle_transporteur
  FOR SELECT
  USING (has_role(auth.uid(), 'gestionnaire'::app_role));

-- 5. TABLE: suggestion_ajustement_regle
-- ===================================================================
CREATE TABLE IF NOT EXISTS public.suggestion_ajustement_regle (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  regle_cible_id UUID REFERENCES public.regle_selection_transporteur(id) ON DELETE CASCADE,
  type_ajustement VARCHAR(50) NOT NULL,
  modification_proposee JSONB NOT NULL,
  justification TEXT NOT NULL,
  confiance DECIMAL(3,2) DEFAULT 0.5,
  impact_estime JSONB DEFAULT '{}',
  statut VARCHAR(50) DEFAULT 'en_attente',
  approuve_par UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  date_approbation TIMESTAMP WITH TIME ZONE,
  applique_le TIMESTAMP WITH TIME ZONE,
  resultat_application JSONB DEFAULT '{}',
  date_creation TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  CONSTRAINT confiance_range_suggestion CHECK (confiance >= 0 AND confiance <= 1),
  CONSTRAINT statut_valide CHECK (statut IN ('en_attente', 'approuve', 'rejete', 'applique', 'rollback'))
);

CREATE INDEX IF NOT EXISTS idx_suggestion_regle ON public.suggestion_ajustement_regle(regle_cible_id);
CREATE INDEX IF NOT EXISTS idx_suggestion_statut ON public.suggestion_ajustement_regle(statut);
CREATE INDEX IF NOT EXISTS idx_suggestion_date ON public.suggestion_ajustement_regle(date_creation DESC);

-- RLS Policies
ALTER TABLE public.suggestion_ajustement_regle ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Admin full access suggestion" ON public.suggestion_ajustement_regle;
CREATE POLICY "Admin full access suggestion"
  ON public.suggestion_ajustement_regle
  FOR ALL
  USING (has_role(auth.uid(), 'admin'::app_role))
  WITH CHECK (has_role(auth.uid(), 'admin'::app_role));

DROP POLICY IF EXISTS "Gestionnaire manage suggestion" ON public.suggestion_ajustement_regle;
CREATE POLICY "Gestionnaire manage suggestion"
  ON public.suggestion_ajustement_regle
  FOR ALL
  USING (has_role(auth.uid(), 'gestionnaire'::app_role))
  WITH CHECK (has_role(auth.uid(), 'gestionnaire'::app_role));

-- 6. TABLE: metrique_apprentissage
-- ===================================================================
CREATE TABLE IF NOT EXISTS public.metrique_apprentissage (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  date_metrique DATE NOT NULL,
  nombre_decisions INTEGER DEFAULT 0,
  nombre_changements_manuels INTEGER DEFAULT 0,
  taux_changement_manuel DECIMAL(5,2) DEFAULT 0,
  nombre_suggestions_generees INTEGER DEFAULT 0,
  nombre_suggestions_appliquees INTEGER DEFAULT 0,
  precision_predictions DECIMAL(5,2) DEFAULT 0,
  economies_potentielles DECIMAL(10,2) DEFAULT 0,
  economies_realisees DECIMAL(10,2) DEFAULT 0,
  metadata JSONB DEFAULT '{}',
  CONSTRAINT date_unique UNIQUE(date_metrique),
  CONSTRAINT taux_range CHECK (taux_changement_manuel >= 0 AND taux_changement_manuel <= 100)
);

CREATE INDEX IF NOT EXISTS idx_metrique_date ON public.metrique_apprentissage(date_metrique DESC);

-- RLS Policies
ALTER TABLE public.metrique_apprentissage ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Admin full access metrique" ON public.metrique_apprentissage;
CREATE POLICY "Admin full access metrique"
  ON public.metrique_apprentissage
  FOR ALL
  USING (has_role(auth.uid(), 'admin'::app_role))
  WITH CHECK (has_role(auth.uid(), 'admin'::app_role));

DROP POLICY IF EXISTS "Gestionnaire read metrique" ON public.metrique_apprentissage;
CREATE POLICY "Gestionnaire read metrique"
  ON public.metrique_apprentissage
  FOR SELECT
  USING (has_role(auth.uid(), 'gestionnaire'::app_role));

-- 7. TABLE: prediction_performance_transporteur
-- ===================================================================
CREATE TABLE IF NOT EXISTS public.prediction_performance_transporteur (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  transporteur_code VARCHAR(100) NOT NULL,
  transporteur_nom VARCHAR(255) NOT NULL,
  score_predictif DECIMAL(5,2) NOT NULL,
  score_delai DECIMAL(5,2),
  score_cout DECIMAL(5,2),
  score_fiabilite DECIMAL(5,2),
  score_qualite DECIMAL(5,2),
  tendance VARCHAR(50),
  confiance_prediction DECIMAL(3,2) DEFAULT 0.5,
  periode_analyse_jours INTEGER DEFAULT 30,
  nombre_commandes_analysees INTEGER DEFAULT 0,
  facteurs_cles JSONB DEFAULT '[]',
  metadata JSONB DEFAULT '{}',
  date_prediction TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  valide_jusqu_a TIMESTAMP WITH TIME ZONE DEFAULT (NOW() + INTERVAL '7 days'),
  CONSTRAINT score_predictif_range CHECK (score_predictif >= 0 AND score_predictif <= 100),
  CONSTRAINT confiance_range_pred CHECK (confiance_prediction >= 0 AND confiance_prediction <= 1)
);

CREATE INDEX IF NOT EXISTS idx_prediction_transporteur ON public.prediction_performance_transporteur(transporteur_code);
CREATE INDEX IF NOT EXISTS idx_prediction_score ON public.prediction_performance_transporteur(score_predictif DESC);
CREATE INDEX IF NOT EXISTS idx_prediction_date ON public.prediction_performance_transporteur(date_prediction DESC);

-- RLS Policies
ALTER TABLE public.prediction_performance_transporteur ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Admin full access prediction" ON public.prediction_performance_transporteur;
CREATE POLICY "Admin full access prediction"
  ON public.prediction_performance_transporteur
  FOR ALL
  USING (has_role(auth.uid(), 'admin'::app_role))
  WITH CHECK (has_role(auth.uid(), 'admin'::app_role));

DROP POLICY IF EXISTS "Gestionnaire read prediction" ON public.prediction_performance_transporteur;
CREATE POLICY "Gestionnaire read prediction"
  ON public.prediction_performance_transporteur
  FOR SELECT
  USING (has_role(auth.uid(), 'gestionnaire'::app_role));

-- 8. TABLE: alerte_performance_transporteur
-- ===================================================================
CREATE TABLE IF NOT EXISTS public.alerte_performance_transporteur (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  transporteur_code VARCHAR(100) NOT NULL,
  type_alerte VARCHAR(50) NOT NULL,
  severite VARCHAR(20) NOT NULL,
  score_actuel DECIMAL(5,2),
  score_precedent DECIMAL(5,2),
  degradation_pourcentage DECIMAL(5,2),
  message TEXT NOT NULL,
  actions_recommandees JSONB DEFAULT '[]',
  statut VARCHAR(50) DEFAULT 'active',
  traitee_par UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  date_traitement TIMESTAMP WITH TIME ZONE,
  date_creation TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  CONSTRAINT severite_valide CHECK (severite IN ('info', 'warning', 'critical')),
  CONSTRAINT statut_alerte_valide CHECK (statut IN ('active', 'traitee', 'ignoree'))
);

CREATE INDEX IF NOT EXISTS idx_alerte_transporteur ON public.alerte_performance_transporteur(transporteur_code);
CREATE INDEX IF NOT EXISTS idx_alerte_statut ON public.alerte_performance_transporteur(statut);
CREATE INDEX IF NOT EXISTS idx_alerte_date ON public.alerte_performance_transporteur(date_creation DESC);

-- RLS Policies
ALTER TABLE public.alerte_performance_transporteur ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Admin full access alerte" ON public.alerte_performance_transporteur;
CREATE POLICY "Admin full access alerte"
  ON public.alerte_performance_transporteur
  FOR ALL
  USING (has_role(auth.uid(), 'admin'::app_role))
  WITH CHECK (has_role(auth.uid(), 'admin'::app_role));

DROP POLICY IF EXISTS "Gestionnaire manage alerte" ON public.alerte_performance_transporteur;
CREATE POLICY "Gestionnaire manage alerte"
  ON public.alerte_performance_transporteur
  FOR ALL
  USING (has_role(auth.uid(), 'gestionnaire'::app_role))
  WITH CHECK (has_role(auth.uid(), 'gestionnaire'::app_role));

-- 9. TABLE: analyse_optimisation_couts
-- ===================================================================
CREATE TABLE IF NOT EXISTS public.analyse_optimisation_couts (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  periode_debut DATE NOT NULL,
  periode_fin DATE NOT NULL,
  nombre_commandes_analysees INTEGER DEFAULT 0,
  cout_total_actuel DECIMAL(10,2) DEFAULT 0,
  cout_total_optimal DECIMAL(10,2) DEFAULT 0,
  economies_potentielles DECIMAL(10,2) DEFAULT 0,
  pourcentage_economie DECIMAL(5,2) DEFAULT 0,
  nombre_suggestions INTEGER DEFAULT 0,
  metadata JSONB DEFAULT '{}',
  generee_par UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  date_analyse TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_analyse_date ON public.analyse_optimisation_couts(date_analyse DESC);

-- RLS Policies
ALTER TABLE public.analyse_optimisation_couts ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Admin full access analyse" ON public.analyse_optimisation_couts;
CREATE POLICY "Admin full access analyse"
  ON public.analyse_optimisation_couts
  FOR ALL
  USING (has_role(auth.uid(), 'admin'::app_role))
  WITH CHECK (has_role(auth.uid(), 'admin'::app_role));

DROP POLICY IF EXISTS "Gestionnaire read analyse" ON public.analyse_optimisation_couts;
CREATE POLICY "Gestionnaire read analyse"
  ON public.analyse_optimisation_couts
  FOR SELECT
  USING (has_role(auth.uid(), 'gestionnaire'::app_role));

-- 10. TABLE: suggestion_optimisation
-- ===================================================================
CREATE TABLE IF NOT EXISTS public.suggestion_optimisation (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  analyse_id UUID REFERENCES public.analyse_optimisation_couts(id) ON DELETE CASCADE,
  type_suggestion VARCHAR(50) NOT NULL,
  description TEXT NOT NULL,
  impact_financier DECIMAL(10,2),
  pourcentage_economie DECIMAL(5,2),
  confiance DECIMAL(3,2) DEFAULT 0.5,
  priorite INTEGER DEFAULT 100,
  actions_requises JSONB DEFAULT '[]',
  statut VARCHAR(50) DEFAULT 'en_attente',
  appliquee_le TIMESTAMP WITH TIME ZONE,
  date_creation TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  CONSTRAINT confiance_range_opt CHECK (confiance >= 0 AND confiance <= 1),
  CONSTRAINT statut_opt_valide CHECK (statut IN ('en_attente', 'appliquee', 'rejetee'))
);

CREATE INDEX IF NOT EXISTS idx_sugg_opt_analyse ON public.suggestion_optimisation(analyse_id);
CREATE INDEX IF NOT EXISTS idx_sugg_opt_statut ON public.suggestion_optimisation(statut);

-- RLS Policies
ALTER TABLE public.suggestion_optimisation ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Admin full access sugg_opt" ON public.suggestion_optimisation;
CREATE POLICY "Admin full access sugg_opt"
  ON public.suggestion_optimisation
  FOR ALL
  USING (has_role(auth.uid(), 'admin'::app_role))
  WITH CHECK (has_role(auth.uid(), 'admin'::app_role));

DROP POLICY IF EXISTS "Gestionnaire manage sugg_opt" ON public.suggestion_optimisation;
CREATE POLICY "Gestionnaire manage sugg_opt"
  ON public.suggestion_optimisation
  FOR ALL
  USING (has_role(auth.uid(), 'gestionnaire'::app_role))
  WITH CHECK (has_role(auth.uid(), 'gestionnaire'::app_role));

-- 11. TABLE: config_auto_selection_transporteur
-- ===================================================================
CREATE TABLE IF NOT EXISTS public.config_auto_selection_transporteur (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  client_id UUID REFERENCES public.client(id) ON DELETE CASCADE,
  actif BOOLEAN DEFAULT false,
  mode_selection VARCHAR(50) DEFAULT 'regles',
  utiliser_ia BOOLEAN DEFAULT false,
  seuil_confiance_minimum DECIMAL(3,2) DEFAULT 0.7,
  fallback_manuel BOOLEAN DEFAULT true,
  regles_prioritaires JSONB DEFAULT '[]',
  metadata JSONB DEFAULT '{}',
  date_activation TIMESTAMP WITH TIME ZONE,
  date_modification TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  CONSTRAINT mode_valide CHECK (mode_selection IN ('regles', 'ia', 'hybride')),
  CONSTRAINT client_unique UNIQUE(client_id)
);

CREATE INDEX IF NOT EXISTS idx_config_client ON public.config_auto_selection_transporteur(client_id);
CREATE INDEX IF NOT EXISTS idx_config_actif ON public.config_auto_selection_transporteur(actif);

-- RLS Policies
ALTER TABLE public.config_auto_selection_transporteur ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Admin full access config" ON public.config_auto_selection_transporteur;
CREATE POLICY "Admin full access config"
  ON public.config_auto_selection_transporteur
  FOR ALL
  USING (has_role(auth.uid(), 'admin'::app_role))
  WITH CHECK (has_role(auth.uid(), 'admin'::app_role));

DROP POLICY IF EXISTS "Gestionnaire manage config" ON public.config_auto_selection_transporteur;
CREATE POLICY "Gestionnaire manage config"
  ON public.config_auto_selection_transporteur
  FOR ALL
  USING (has_role(auth.uid(), 'gestionnaire'::app_role))
  WITH CHECK (has_role(auth.uid(), 'gestionnaire'::app_role));

DROP POLICY IF EXISTS "Client manage own config" ON public.config_auto_selection_transporteur;
CREATE POLICY "Client manage own config"
  ON public.config_auto_selection_transporteur
  FOR ALL
  USING (
    has_role(auth.uid(), 'client'::app_role) 
    AND client_id IN (SELECT client_id FROM public.profiles WHERE id = auth.uid())
  )
  WITH CHECK (
    has_role(auth.uid(), 'client'::app_role) 
    AND client_id IN (SELECT client_id FROM public.profiles WHERE id = auth.uid())
  );

-- 12. TABLE: log_auto_selection_transporteur
-- ===================================================================
CREATE TABLE IF NOT EXISTS public.log_auto_selection_transporteur (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  commande_id UUID NOT NULL REFERENCES public.commande(id) ON DELETE CASCADE,
  decision_id UUID REFERENCES public.decision_transporteur(id) ON DELETE SET NULL,
  client_id UUID REFERENCES public.client(id) ON DELETE SET NULL,
  transporteur_selectionne VARCHAR(100),
  methode_selection VARCHAR(50),
  duree_ms INTEGER,
  succes BOOLEAN DEFAULT true,
  erreur TEXT,
  metadata JSONB DEFAULT '{}',
  date_log TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_log_auto_commande ON public.log_auto_selection_transporteur(commande_id);
CREATE INDEX IF NOT EXISTS idx_log_auto_date ON public.log_auto_selection_transporteur(date_log DESC);
CREATE INDEX IF NOT EXISTS idx_log_auto_succes ON public.log_auto_selection_transporteur(succes);

-- RLS Policies
ALTER TABLE public.log_auto_selection_transporteur ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Admin full access log_auto" ON public.log_auto_selection_transporteur;
CREATE POLICY "Admin full access log_auto"
  ON public.log_auto_selection_transporteur
  FOR ALL
  USING (has_role(auth.uid(), 'admin'::app_role))
  WITH CHECK (has_role(auth.uid(), 'admin'::app_role));

DROP POLICY IF EXISTS "Gestionnaire read log_auto" ON public.log_auto_selection_transporteur;
CREATE POLICY "Gestionnaire read log_auto"
  ON public.log_auto_selection_transporteur
  FOR SELECT
  USING (has_role(auth.uid(), 'gestionnaire'::app_role));