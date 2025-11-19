-- ============================================================
-- MIGRATION: Jobs CRON pour synchronisation automatique SendCloud
-- ============================================================
-- Cette migration configure des jobs CRON pour automatiser :
-- 1. Synchronisation des commandes (toutes les 15 minutes)
-- 2. Synchronisation des retours (toutes les heures)
-- 3. Mise à jour des tracking (toutes les 30 minutes)
-- 4. Nettoyage des logs anciens (quotidien)
-- 5. Refresh des vues matérialisées (toutes les heures)
-- ============================================================

-- Activer les extensions nécessaires
CREATE EXTENSION IF NOT EXISTS pg_cron;
CREATE EXTENSION IF NOT EXISTS pg_net;

-- ============================================================
-- JOB 1: Synchronisation des commandes SendCloud
-- Fréquence: Toutes les 15 minutes
-- ============================================================

SELECT cron.schedule(
  'sendcloud-sync-orders-auto',
  '*/15 * * * *',  -- Toutes les 15 minutes
  $$
  SELECT net.http_post(
    url := current_setting('app.supabase_url') || '/functions/v1/sendcloud-sync-orders',
    headers := jsonb_build_object(
      'Content-Type', 'application/json',
      'Authorization', 'Bearer ' || current_setting('app.supabase_service_role_key')
    ),
    body := jsonb_build_object(
      'mode', 'incremental',
      'auto', true
    )
  );
  $$
);

COMMENT ON EXTENSION pg_cron IS 'Job sendcloud-sync-orders-auto: Sync incrémentale des commandes toutes les 15 minutes';

-- ============================================================
-- JOB 2: Synchronisation des retours SendCloud
-- Fréquence: Toutes les heures
-- ============================================================

SELECT cron.schedule(
  'sendcloud-sync-returns-auto',
  '0 * * * *',  -- Toutes les heures (à H:00)
  $$
  SELECT net.http_post(
    url := current_setting('app.supabase_url') || '/functions/v1/sendcloud-sync-returns',
    headers := jsonb_build_object(
      'Content-Type', 'application/json',
      'Authorization', 'Bearer ' || current_setting('app.supabase_service_role_key')
    ),
    body := jsonb_build_object(
      'mode', 'incremental',
      'auto', true
    )
  );
  $$
);

-- ============================================================
-- JOB 3: Refresh des tracking numbers
-- Fréquence: Toutes les 30 minutes
-- ============================================================

SELECT cron.schedule(
  'sendcloud-refresh-tracking-auto',
  '*/30 * * * *',  -- Toutes les 30 minutes
  $$
  SELECT net.http_post(
    url := current_setting('app.supabase_url') || '/functions/v1/sendcloud-refresh-tracking',
    headers := jsonb_build_object(
      'Content-Type', 'application/json',
      'Authorization', 'Bearer ' || current_setting('app.supabase_service_role_key')
    ),
    body := jsonb_build_object(
      'auto', true
    )
  );
  $$
);

-- ============================================================
-- JOB 4: Nettoyage des logs anciens
-- Fréquence: Quotidien à 3h du matin
-- ============================================================

SELECT cron.schedule(
  'cleanup-old-logs',
  '0 3 * * *',  -- Tous les jours à 3h du matin
  $$
  -- Supprimer les logs de webhook > 90 jours
  DELETE FROM public.webhook_sendcloud_log
  WHERE date_reception < NOW() - INTERVAL '90 days';

  -- Supprimer les logs de sync > 90 jours
  DELETE FROM public.sendcloud_sync_log
  WHERE sync_date < NOW() - INTERVAL '90 days';

  -- Supprimer les logs d'API > 30 jours
  DELETE FROM public.sendcloud_api_log
  WHERE date_appel < NOW() - INTERVAL '30 days';

  -- Supprimer les événements de tracking > 180 jours
  DELETE FROM public.sendcloud_tracking_events
  WHERE event_timestamp < NOW() - INTERVAL '180 days';

  -- Supprimer les rate limit logs > 7 jours
  DELETE FROM public.webhook_rate_limit
  WHERE created_at < NOW() - INTERVAL '7 days';

  -- Vacuum pour récupérer l'espace
  VACUUM ANALYZE public.webhook_sendcloud_log;
  VACUUM ANALYZE public.sendcloud_sync_log;
  VACUUM ANALYZE public.sendcloud_api_log;
  VACUUM ANALYZE public.sendcloud_tracking_events;
  VACUUM ANALYZE public.webhook_rate_limit;
  $$
);

-- ============================================================
-- JOB 5: Import des données de référence (hebdomadaire)
-- Fréquence: Tous les lundis à 2h du matin
-- ============================================================

SELECT cron.schedule(
  'sendcloud-import-reference-data',
  '0 2 * * 1',  -- Tous les lundis à 2h
  $$
  -- Import carriers
  SELECT net.http_post(
    url := current_setting('app.supabase_url') || '/functions/v1/sendcloud-import-carriers',
    headers := jsonb_build_object(
      'Content-Type', 'application/json',
      'Authorization', 'Bearer ' || current_setting('app.supabase_service_role_key')
    ),
    body := '{}'::jsonb
  );

  -- Import shipping methods
  SELECT net.http_post(
    url := current_setting('app.supabase_url') || '/functions/v1/sendcloud-import-shipping-methods',
    headers := jsonb_build_object(
      'Content-Type', 'application/json',
      'Authorization', 'Bearer ' || current_setting('app.supabase_service_role_key')
    ),
    body := '{}'::jsonb
  );

  -- Import senders
  SELECT net.http_post(
    url := current_setting('app.supabase_url') || '/functions/v1/sendcloud-import-senders',
    headers := jsonb_build_object(
      'Content-Type', 'application/json',
      'Authorization', 'Bearer ' || current_setting('app.supabase_service_role_key')
    ),
    body := '{}'::jsonb
  );
  $$
);

-- ============================================================
-- JOB 6: Monitoring et alertes
-- Fréquence: Toutes les heures
-- ============================================================

SELECT cron.schedule(
  'sendcloud-monitoring-alerts',
  '15 * * * *',  -- Toutes les heures à H:15
  $$
  -- Détecter les syncs en échec
  WITH recent_syncs AS (
    SELECT
      statut,
      nb_erreurs,
      sync_date
    FROM public.sendcloud_sync_log
    WHERE sync_date > NOW() - INTERVAL '2 hours'
    ORDER BY sync_date DESC
    LIMIT 10
  ),
  failed_syncs AS (
    SELECT COUNT(*) as failure_count
    FROM recent_syncs
    WHERE statut = 'error' OR nb_erreurs > 5
  )
  INSERT INTO public.system_alerts (
    alert_type,
    severity,
    message,
    metadata,
    created_at
  )
  SELECT
    'sendcloud_sync_failure',
    CASE
      WHEN failure_count > 5 THEN 'critical'
      WHEN failure_count > 2 THEN 'warning'
      ELSE 'info'
    END,
    format('SendCloud sync failures detected: %s failures in last 2 hours', failure_count),
    jsonb_build_object('failure_count', failure_count),
    NOW()
  FROM failed_syncs
  WHERE failure_count > 0;

  -- Détecter les commandes bloquées
  WITH stuck_orders AS (
    SELECT COUNT(*) as stuck_count
    FROM public.commande
    WHERE statut_wms IN ('stock_reserve', 'en_preparation')
      AND date_creation < NOW() - INTERVAL '24 hours'
  )
  INSERT INTO public.system_alerts (
    alert_type,
    severity,
    message,
    metadata,
    created_at
  )
  SELECT
    'stuck_orders',
    CASE
      WHEN stuck_count > 50 THEN 'critical'
      WHEN stuck_count > 20 THEN 'warning'
      ELSE 'info'
    END,
    format('Orders stuck in processing: %s orders older than 24h', stuck_count),
    jsonb_build_object('stuck_count', stuck_count),
    NOW()
  FROM stuck_orders
  WHERE stuck_count > 0;
  $$
);

-- ============================================================
-- JOB 7: Retry des webhooks en échec
-- Fréquence: Toutes les 30 minutes
-- ============================================================

SELECT cron.schedule(
  'sendcloud-retry-failed-webhooks',
  '5,35 * * * *',  -- À H:05 et H:35
  $$
  SELECT net.http_post(
    url := current_setting('app.supabase_url') || '/functions/v1/sendcloud-retry-webhooks',
    headers := jsonb_build_object(
      'Content-Type', 'application/json',
      'Authorization', 'Bearer ' || current_setting('app.supabase_service_role_key')
    ),
    body := jsonb_build_object(
      'max_retries', 5,
      'auto', true
    )
  );
  $$
);

-- ============================================================
-- FONCTION UTILITAIRE: Vérifier l'état des jobs CRON
-- ============================================================

CREATE OR REPLACE FUNCTION public.get_cron_job_status()
RETURNS TABLE (
  jobid bigint,
  jobname text,
  schedule text,
  active boolean,
  last_run timestamptz,
  next_run timestamptz
)
LANGUAGE sql
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT
    jobid,
    jobname,
    schedule,
    active,
    (SELECT max(end_time) FROM cron.job_run_details WHERE jobid = j.jobid) as last_run,
    -- Calculer le prochain run (approximatif)
    NOW() + (schedule::interval) as next_run
  FROM cron.job j
  WHERE jobname LIKE 'sendcloud-%'
     OR jobname LIKE 'cleanup-%'
  ORDER BY jobname;
$$;

COMMENT ON FUNCTION public.get_cron_job_status() IS
  'Retourne l''état de tous les jobs CRON SendCloud actifs';

-- ============================================================
-- VUE: Historique des exécutions des jobs
-- ============================================================

CREATE OR REPLACE VIEW public.v_cron_job_history AS
SELECT
  j.jobname,
  jr.runid,
  jr.job_pid,
  jr.database,
  jr.username,
  jr.command,
  jr.status,
  jr.return_message,
  jr.start_time,
  jr.end_time,
  EXTRACT(EPOCH FROM (jr.end_time - jr.start_time)) as duration_seconds
FROM cron.job j
JOIN cron.job_run_details jr ON jr.jobid = j.jobid
WHERE j.jobname LIKE 'sendcloud-%'
   OR j.jobname LIKE 'cleanup-%'
ORDER BY jr.start_time DESC
LIMIT 100;

COMMENT ON VIEW public.v_cron_job_history IS
  'Historique des 100 dernières exécutions des jobs CRON SendCloud';

-- ============================================================
-- TABLE: System alerts (si n'existe pas déjà)
-- ============================================================

CREATE TABLE IF NOT EXISTS public.system_alerts (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  alert_type TEXT NOT NULL,
  severity TEXT NOT NULL CHECK (severity IN ('info', 'warning', 'critical')),
  message TEXT NOT NULL,
  metadata JSONB DEFAULT '{}'::jsonb,
  acknowledged BOOLEAN DEFAULT false,
  acknowledged_by UUID REFERENCES auth.users(id),
  acknowledged_at TIMESTAMP WITH TIME ZONE,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW() NOT NULL
);

CREATE INDEX IF NOT EXISTS idx_system_alerts_created_at
  ON public.system_alerts(created_at DESC);

CREATE INDEX IF NOT EXISTS idx_system_alerts_severity
  ON public.system_alerts(severity) WHERE NOT acknowledged;

-- RLS pour system_alerts
ALTER TABLE public.system_alerts ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Admins full access on system_alerts"
  ON public.system_alerts
  FOR ALL
  TO authenticated
  USING (has_role(auth.uid(), 'admin'))
  WITH CHECK (has_role(auth.uid(), 'admin'));

-- ============================================================
-- CONFIGURATION: Settings par défaut
-- ============================================================

-- Créer une table de configuration si elle n'existe pas
CREATE TABLE IF NOT EXISTS public.sendcloud_config (
  key TEXT PRIMARY KEY,
  value TEXT NOT NULL,
  description TEXT,
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_by UUID REFERENCES auth.users(id)
);

-- Insérer les configs par défaut
INSERT INTO public.sendcloud_config (key, value, description) VALUES
  ('sync_orders_enabled', 'true', 'Activer la synchronisation automatique des commandes'),
  ('sync_returns_enabled', 'true', 'Activer la synchronisation automatique des retours'),
  ('sync_tracking_enabled', 'true', 'Activer la mise à jour automatique des tracking'),
  ('alert_threshold_failures', '5', 'Nombre d''échecs avant alerte critique'),
  ('alert_threshold_stuck_orders', '50', 'Nombre de commandes bloquées avant alerte critique'),
  ('log_retention_days', '90', 'Nombre de jours de rétention des logs')
ON CONFLICT (key) DO NOTHING;

-- ============================================================
-- PERMISSIONS
-- ============================================================

GRANT SELECT ON public.v_cron_job_history TO authenticated;
GRANT EXECUTE ON FUNCTION public.get_cron_job_status() TO authenticated;
GRANT SELECT ON public.sendcloud_config TO authenticated;
GRANT UPDATE ON public.sendcloud_config TO authenticated;

-- ============================================================
-- COMMENTAIRES
-- ============================================================

COMMENT ON EXTENSION pg_cron IS
  'Extension pg_cron pour planifier des jobs automatiques dans PostgreSQL';

COMMENT ON TABLE public.sendcloud_config IS
  'Configuration centralisée pour les synchronisations SendCloud';

COMMENT ON TABLE public.system_alerts IS
  'Table des alertes système pour monitoring et notifications';

-- ============================================================
-- RÉSUMÉ
-- ============================================================

DO $$
DECLARE
  v_job_count INTEGER;
BEGIN
  SELECT COUNT(*) INTO v_job_count
  FROM cron.job
  WHERE jobname LIKE 'sendcloud-%' OR jobname LIKE 'cleanup-%';

  RAISE NOTICE '';
  RAISE NOTICE '========================================';
  RAISE NOTICE '   JOBS CRON SENDCLOUD CONFIGURÉS';
  RAISE NOTICE '========================================';
  RAISE NOTICE 'Jobs créés: %', v_job_count;
  RAISE NOTICE '';
  RAISE NOTICE '1. sendcloud-sync-orders-auto';
  RAISE NOTICE '   └─ */15 * * * * (toutes les 15 min)';
  RAISE NOTICE '';
  RAISE NOTICE '2. sendcloud-sync-returns-auto';
  RAISE NOTICE '   └─ 0 * * * * (toutes les heures)';
  RAISE NOTICE '';
  RAISE NOTICE '3. sendcloud-refresh-tracking-auto';
  RAISE NOTICE '   └─ */30 * * * * (toutes les 30 min)';
  RAISE NOTICE '';
  RAISE NOTICE '4. cleanup-old-logs';
  RAISE NOTICE '   └─ 0 3 * * * (quotidien à 3h)';
  RAISE NOTICE '';
  RAISE NOTICE '5. sendcloud-import-reference-data';
  RAISE NOTICE '   └─ 0 2 * * 1 (lundi à 2h)';
  RAISE NOTICE '';
  RAISE NOTICE '6. sendcloud-monitoring-alerts';
  RAISE NOTICE '   └─ 15 * * * * (toutes les heures)';
  RAISE NOTICE '';
  RAISE NOTICE '7. sendcloud-retry-failed-webhooks';
  RAISE NOTICE '   └─ 5,35 * * * * (2x/heure)';
  RAISE NOTICE '';
  RAISE NOTICE 'Fonctions utilitaires:';
  RAISE NOTICE '  ✅ get_cron_job_status()';
  RAISE NOTICE '';
  RAISE NOTICE 'Vues:';
  RAISE NOTICE '  ✅ v_cron_job_history';
  RAISE NOTICE '';
  RAISE NOTICE 'Tables:';
  RAISE NOTICE '  ✅ system_alerts';
  RAISE NOTICE '  ✅ sendcloud_config';
  RAISE NOTICE '========================================';
  RAISE NOTICE '';
  RAISE NOTICE 'Pour vérifier l''état des jobs:';
  RAISE NOTICE '  SELECT * FROM public.get_cron_job_status();';
  RAISE NOTICE '';
  RAISE NOTICE 'Pour voir l''historique:';
  RAISE NOTICE '  SELECT * FROM public.v_cron_job_history;';
  RAISE NOTICE '========================================';
  RAISE NOTICE '';
END $$;
