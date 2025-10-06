-- Table pour logger les webhooks SendCloud
CREATE TABLE public.webhook_sendcloud_log (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  date_reception TIMESTAMP WITH TIME ZONE DEFAULT now(),
  payload JSONB NOT NULL,
  statut VARCHAR(20) DEFAULT 'recu',
  commande_id UUID REFERENCES public.commande(id),
  erreur TEXT,
  traite_a TIMESTAMP WITH TIME ZONE
);

-- Index pour recherches rapides
CREATE INDEX idx_webhook_sendcloud_log_date ON public.webhook_sendcloud_log(date_reception DESC);
CREATE INDEX idx_webhook_sendcloud_log_statut ON public.webhook_sendcloud_log(statut);

-- RLS
ALTER TABLE public.webhook_sendcloud_log ENABLE ROW LEVEL SECURITY;

-- Admin full access
CREATE POLICY "Admin full access on webhook_sendcloud_log"
ON public.webhook_sendcloud_log
FOR ALL
TO authenticated
USING (has_role(auth.uid(), 'admin'::app_role))
WITH CHECK (has_role(auth.uid(), 'admin'::app_role));

-- Gestionnaire read
CREATE POLICY "Gestionnaire read webhook_sendcloud_log"
ON public.webhook_sendcloud_log
FOR SELECT
TO authenticated
USING (has_role(auth.uid(), 'gestionnaire'::app_role));