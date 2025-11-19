-- =====================================================
-- CRON Job: Synchronisation quotidienne des retours SendCloud
-- Description: Synchronise automatiquement les retours depuis SendCloud chaque jour à 2h du matin
-- Date: 2025-11-18
-- =====================================================

-- Enable pg_cron extension if not already enabled
CREATE EXTENSION IF NOT EXISTS pg_cron;

-- Create CRON job for daily returns synchronization
-- Runs every day at 02:00 AM (UTC)
SELECT cron.schedule(
  'sendcloud-sync-returns-daily',          -- Job name
  '0 2 * * *',                             -- Cron expression: At 02:00 every day
  $$
  SELECT net.http_post(
    url := current_setting('app.supabase_url') || '/functions/v1/sendcloud-sync-returns',
    headers := jsonb_build_object(
      'Content-Type', 'application/json',
      'Authorization', 'Bearer ' || current_setting('app.supabase_service_role_key')
    ),
    body := '{}'::jsonb
  ) AS request_id;
  $$
);

-- Add comment
COMMENT ON EXTENSION pg_cron IS 'Job scheduler for PostgreSQL';

-- =====================================================
-- Configuration settings (à définir dans Supabase Dashboard)
-- =====================================================
--
-- Ces settings doivent être configurés dans Supabase Dashboard > Settings > Vault:
-- 1. app.supabase_url = votre URL Supabase
-- 2. app.supabase_service_role_key = votre clé service role
--
-- Exemple via SQL (à exécuter depuis Supabase Dashboard):
-- ALTER DATABASE postgres SET app.supabase_url TO 'https://your-project.supabase.co';
-- ALTER DATABASE postgres SET app.supabase_service_role_key TO 'your-service-role-key';
--
-- =====================================================

-- View all scheduled jobs
-- SELECT * FROM cron.job;

-- View job run history
-- SELECT * FROM cron.job_run_details ORDER BY start_time DESC LIMIT 10;

-- To manually unschedule (if needed):
-- SELECT cron.unschedule('sendcloud-sync-returns-daily');

-- =====================================================
-- Verification
-- =====================================================

DO $$
DECLARE
  job_count INTEGER;
BEGIN
  SELECT COUNT(*) INTO job_count
  FROM cron.job
  WHERE jobname = 'sendcloud-sync-returns-daily';

  IF job_count > 0 THEN
    RAISE NOTICE '====================================';
    RAISE NOTICE ' ✅ CRON Job créé avec succès';
    RAISE NOTICE '====================================';
    RAISE NOTICE 'Job: sendcloud-sync-returns-daily';
    RAISE NOTICE 'Planification: Tous les jours à 02:00 (UTC)';
    RAISE NOTICE 'Action: Synchronise les retours depuis SendCloud';
    RAISE NOTICE '====================================';
    RAISE NOTICE 'Pour voir les jobs: SELECT * FROM cron.job;';
    RAISE NOTICE 'Pour voir l''historique: SELECT * FROM cron.job_run_details ORDER BY start_time DESC;';
    RAISE NOTICE '====================================';
  ELSE
    RAISE WARNING 'CRON job non créé - Vérifier la configuration pg_cron';
  END IF;
END $$;
