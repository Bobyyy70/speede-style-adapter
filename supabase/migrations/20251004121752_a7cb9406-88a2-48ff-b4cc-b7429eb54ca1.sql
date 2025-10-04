-- Table n8n_workflows : Stockage des workflows dynamiques
CREATE TABLE public.n8n_workflows (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  nom VARCHAR(255) NOT NULL UNIQUE,
  description TEXT,
  webhook_url TEXT NOT NULL,
  config_json JSONB NOT NULL,
  actif BOOLEAN DEFAULT true,
  categorie VARCHAR(100),
  declencheur_auto JSONB,
  created_by UUID REFERENCES auth.users(id),
  date_creation TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  date_modification TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  nombre_executions INTEGER DEFAULT 0,
  derniere_execution TIMESTAMP WITH TIME ZONE,
  metadonnees JSONB DEFAULT '{}'::jsonb
);

-- Table n8n_execution_log : Historique des exécutions
CREATE TABLE public.n8n_execution_log (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  workflow_id UUID REFERENCES n8n_workflows(id) ON DELETE CASCADE,
  payload_envoye JSONB NOT NULL,
  reponse_n8n JSONB,
  statut VARCHAR(50) CHECK (statut IN ('success', 'error', 'timeout', 'pending')),
  duree_ms INTEGER,
  declencheur VARCHAR(100),
  user_id UUID REFERENCES auth.users(id),
  error_message TEXT,
  date_execution TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Index pour optimiser les requêtes
CREATE INDEX idx_n8n_workflows_actif ON public.n8n_workflows(actif);
CREATE INDEX idx_n8n_workflows_categorie ON public.n8n_workflows(categorie);
CREATE INDEX idx_n8n_execution_log_workflow ON public.n8n_execution_log(workflow_id);
CREATE INDEX idx_n8n_execution_log_statut ON public.n8n_execution_log(statut);
CREATE INDEX idx_n8n_execution_log_date ON public.n8n_execution_log(date_execution DESC);

-- RLS Policies : Seuls les admins peuvent gérer les workflows
ALTER TABLE public.n8n_workflows ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Admin full access workflows" 
ON public.n8n_workflows 
FOR ALL 
USING (has_role(auth.uid(), 'admin'));

-- RLS Policies : Admins et gestionnaires peuvent voir les logs
ALTER TABLE public.n8n_execution_log ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Admin view execution logs" 
ON public.n8n_execution_log 
FOR SELECT 
USING (has_role(auth.uid(), 'admin'));

CREATE POLICY "Gestionnaire view execution logs" 
ON public.n8n_execution_log 
FOR SELECT 
USING (has_role(auth.uid(), 'gestionnaire'));

-- Trigger pour mettre à jour date_modification automatiquement
CREATE OR REPLACE FUNCTION public.update_n8n_workflow_date_modification()
RETURNS TRIGGER AS $$
BEGIN
  NEW.date_modification = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public;

CREATE TRIGGER update_n8n_workflows_modification
BEFORE UPDATE ON public.n8n_workflows
FOR EACH ROW
EXECUTE FUNCTION public.update_n8n_workflow_date_modification();

-- Trigger pour incrémenter nombre_executions
CREATE OR REPLACE FUNCTION public.increment_workflow_executions()
RETURNS TRIGGER AS $$
BEGIN
  UPDATE public.n8n_workflows
  SET nombre_executions = nombre_executions + 1,
      derniere_execution = NEW.date_execution
  WHERE id = NEW.workflow_id;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public;

CREATE TRIGGER increment_workflow_exec_count
AFTER INSERT ON public.n8n_execution_log
FOR EACH ROW
EXECUTE FUNCTION public.increment_workflow_executions();