-- Activer les extensions nécessaires pour les cron jobs
CREATE EXTENSION IF NOT EXISTS pg_cron;
CREATE EXTENSION IF NOT EXISTS pg_net;

-- Créer la table de logs de synchronisation SendCloud
CREATE TABLE IF NOT EXISTS public.sendcloud_sync_log (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  date_sync TIMESTAMPTZ NOT NULL DEFAULT now(),
  statut VARCHAR(20) NOT NULL CHECK (statut IN ('success', 'partial', 'error')),
  nb_commandes_trouvees INTEGER DEFAULT 0,
  nb_commandes_creees INTEGER DEFAULT 0,
  nb_commandes_existantes INTEGER DEFAULT 0,
  nb_erreurs INTEGER DEFAULT 0,
  duree_ms INTEGER,
  erreur_message TEXT,
  details JSONB
);

-- RLS pour sendcloud_sync_log
ALTER TABLE public.sendcloud_sync_log ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Admin read sendcloud_sync_log"
  ON public.sendcloud_sync_log
  FOR SELECT
  USING (has_role(auth.uid(), 'admin'::app_role));

CREATE POLICY "Gestionnaire read sendcloud_sync_log"
  ON public.sendcloud_sync_log
  FOR SELECT
  USING (has_role(auth.uid(), 'gestionnaire'::app_role));

-- Configurer le cron job pour synchronisation automatique toutes les 5 minutes
SELECT cron.schedule(
  'sendcloud-sync-every-5min',
  '*/5 * * * *',
  $$
  SELECT net.http_post(
    url := 'https://tggdjeoxvpzbigbikpfy.supabase.co/functions/v1/sendcloud-sync-orders',
    headers := jsonb_build_object(
      'Content-Type', 'application/json',
      'Authorization', 'Bearer eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InRnZ2RqZW94dnB6YmlnYmlrcGZ5Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3NTkyMzY3MjYsImV4cCI6MjA3NDgxMjcyNn0.f9yoHVsRDvlUHv14N46qNFphPDBFMf0C0XzEoo26AWA'
    ),
    body := '{}'::jsonb
  ) as request_id;
  $$
);