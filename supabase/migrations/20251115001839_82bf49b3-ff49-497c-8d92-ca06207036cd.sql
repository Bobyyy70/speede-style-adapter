-- Table de logs de synchronisation SendCloud
CREATE TABLE IF NOT EXISTS public.sendcloud_sync_logs (
  id BIGSERIAL PRIMARY KEY,
  run_id UUID NOT NULL DEFAULT gen_random_uuid(),
  job TEXT NOT NULL CHECK (job IN ('orders', 'products', 'parcels', 'carriers', 'shipping_methods', 'senders')),
  client_id UUID REFERENCES public.client(id),
  status TEXT NOT NULL CHECK (status IN ('running', 'success', 'partial', 'error')),
  started_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  finished_at TIMESTAMPTZ,
  batch_count INTEGER NOT NULL DEFAULT 0,
  item_count INTEGER NOT NULL DEFAULT 0,
  error_message TEXT,
  metadata JSONB DEFAULT '{}'::jsonb
);

CREATE INDEX idx_sendcloud_sync_logs_run_id ON public.sendcloud_sync_logs(run_id);
CREATE INDEX idx_sendcloud_sync_logs_client_id ON public.sendcloud_sync_logs(client_id);
CREATE INDEX idx_sendcloud_sync_logs_status ON public.sendcloud_sync_logs(status);
CREATE INDEX idx_sendcloud_sync_logs_started_at ON public.sendcloud_sync_logs(started_at DESC);

-- Table Dead Letter Queue pour retry des messages échoués
CREATE TABLE IF NOT EXISTS public.sendcloud_dlq (
  id BIGSERIAL PRIMARY KEY,
  event_type TEXT NOT NULL,
  payload JSONB NOT NULL,
  error_message TEXT NOT NULL,
  retry_count INTEGER NOT NULL DEFAULT 0,
  max_retries INTEGER NOT NULL DEFAULT 3,
  next_retry_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  processed_at TIMESTAMPTZ,
  status TEXT NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'retrying', 'success', 'failed'))
);

CREATE INDEX idx_sendcloud_dlq_status ON public.sendcloud_dlq(status);
CREATE INDEX idx_sendcloud_dlq_next_retry ON public.sendcloud_dlq(next_retry_at) WHERE status = 'pending';
CREATE INDEX idx_sendcloud_dlq_event_type ON public.sendcloud_dlq(event_type);

-- RLS pour ces tables (admin et gestionnaire en lecture, système en écriture)
ALTER TABLE public.sendcloud_sync_logs ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.sendcloud_dlq ENABLE ROW LEVEL SECURITY;

-- Admin/Gestionnaire peuvent lire les logs
DROP POLICY IF EXISTS "admin_read_sync_logs" ON public.sendcloud_sync_logs;
CREATE POLICY "admin_read_sync_logs" ON public.sendcloud_sync_logs
  FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM public.user_roles 
      WHERE user_id = auth.uid() AND role IN ('admin', 'gestionnaire')
    )
  );

-- Admin peut tout faire sur DLQ
DROP POLICY IF EXISTS "admin_full_dlq" ON public.sendcloud_dlq;
CREATE POLICY "admin_full_dlq" ON public.sendcloud_dlq
  FOR ALL
  USING (
    EXISTS (
      SELECT 1 FROM public.user_roles 
      WHERE user_id = auth.uid() AND role = 'admin'
    )
  );

-- Gestionnaire peut lire DLQ
DROP POLICY IF EXISTS "gestionnaire_read_dlq" ON public.sendcloud_dlq;
CREATE POLICY "gestionnaire_read_dlq" ON public.sendcloud_dlq
  FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM public.user_roles 
      WHERE user_id = auth.uid() AND role = 'gestionnaire'
    )
  );