-- Table pour le rate limiting du webhook SendCloud
CREATE TABLE IF NOT EXISTS public.webhook_rate_limit (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  ip_address INET NOT NULL,
  endpoint TEXT NOT NULL,
  request_count INTEGER DEFAULT 1,
  first_request_at TIMESTAMPTZ DEFAULT NOW(),
  last_request_at TIMESTAMPTZ DEFAULT NOW(),
  blocked_until TIMESTAMPTZ,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Index pour performance
CREATE INDEX IF NOT EXISTS idx_webhook_rate_limit_ip_endpoint 
ON public.webhook_rate_limit(ip_address, endpoint, last_request_at);

-- Index pour nettoyage des anciennes entrées
CREATE INDEX IF NOT EXISTS idx_webhook_rate_limit_cleanup 
ON public.webhook_rate_limit(created_at);

-- Fonction pour nettoyer les anciennes entrées (> 24h)
CREATE OR REPLACE FUNCTION cleanup_webhook_rate_limit()
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  DELETE FROM public.webhook_rate_limit
  WHERE created_at < NOW() - INTERVAL '24 hours';
END;
$$;

-- RLS pour cette table (accessible uniquement par service role)
ALTER TABLE public.webhook_rate_limit ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Service role only" ON public.webhook_rate_limit
FOR ALL USING (false);

-- Table pour logger les tentatives suspectes
CREATE TABLE IF NOT EXISTS public.webhook_security_log (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  ip_address INET,
  endpoint TEXT NOT NULL,
  event_type TEXT NOT NULL, -- 'invalid_token', 'rate_limit_exceeded', 'missing_header', etc.
  user_agent TEXT,
  details JSONB,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Index pour recherches
CREATE INDEX IF NOT EXISTS idx_webhook_security_log_event 
ON public.webhook_security_log(event_type, created_at DESC);

CREATE INDEX IF NOT EXISTS idx_webhook_security_log_ip 
ON public.webhook_security_log(ip_address, created_at DESC);

-- RLS
ALTER TABLE public.webhook_security_log ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Admin only" ON public.webhook_security_log
FOR SELECT USING (
  EXISTS (
    SELECT 1 FROM public.user_roles
    WHERE user_id = auth.uid()
    AND role = 'admin'
  )
);