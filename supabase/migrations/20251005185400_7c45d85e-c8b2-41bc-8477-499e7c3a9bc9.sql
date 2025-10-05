-- Table pour tracker les appels API SendCloud
CREATE TABLE IF NOT EXISTS public.sendcloud_api_log (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  commande_id UUID REFERENCES public.commande(id) ON DELETE SET NULL,
  endpoint TEXT NOT NULL,
  methode TEXT NOT NULL,
  statut_http INTEGER,
  payload JSONB,
  reponse JSONB,
  error_message TEXT,
  duree_ms INTEGER,
  date_appel TIMESTAMP WITH TIME ZONE DEFAULT now(),
  created_by UUID REFERENCES auth.users(id) ON DELETE SET NULL
);

-- Index pour optimiser les requêtes
CREATE INDEX IF NOT EXISTS idx_sendcloud_api_log_commande ON public.sendcloud_api_log(commande_id);
CREATE INDEX IF NOT EXISTS idx_sendcloud_api_log_date ON public.sendcloud_api_log(date_appel DESC);
CREATE INDEX IF NOT EXISTS idx_sendcloud_api_log_endpoint ON public.sendcloud_api_log(endpoint);

-- RLS policies
ALTER TABLE public.sendcloud_api_log ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Admin full access on sendcloud_api_log"
  ON public.sendcloud_api_log
  FOR ALL
  USING (has_role(auth.uid(), 'admin'::app_role))
  WITH CHECK (has_role(auth.uid(), 'admin'::app_role));

CREATE POLICY "Gestionnaire read sendcloud_api_log"
  ON public.sendcloud_api_log
  FOR SELECT
  USING (has_role(auth.uid(), 'gestionnaire'::app_role));