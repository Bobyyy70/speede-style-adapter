-- =====================================================
-- HOTFIX: Correction CRON jobs - current_setting avec fallback
-- Description: Ajoute le paramètre 'true' aux current_setting() pour éviter erreurs
-- Date: 2025-11-18
-- =====================================================

-- =====================================================
-- Supprimer et recréer le CRON avec les bons paramètres
-- =====================================================

-- Désactiver le job existant
SELECT cron.unschedule('sendcloud-sync-returns-daily');

-- Recréer avec current_setting(..., true)
SELECT cron.schedule(
  'sendcloud-sync-returns-daily',          -- Job name
  '0 2 * * *',                             -- Cron expression: At 02:00 every day
  $$
  SELECT net.http_post(
    url := current_setting('app.supabase_url', true) || '/functions/v1/sendcloud-sync-returns',
    headers := jsonb_build_object(
      'Content-Type', 'application/json',
      'Authorization', 'Bearer ' || current_setting('app.supabase_service_role_key', true)
    ),
    body := '{}'::jsonb
  ) AS request_id;
  $$
);

-- =====================================================
-- Vérification
-- =====================================================
DO $$
DECLARE
  job_count INTEGER;
BEGIN
  SELECT COUNT(*) INTO job_count
  FROM cron.job
  WHERE jobname = 'sendcloud-sync-returns-daily';

  IF job_count > 0 THEN
    RAISE NOTICE '========================================';
    RAISE NOTICE ' ✅ HOTFIX CRON Sync Returns Appliqué';
    RAISE NOTICE '========================================';
    RAISE NOTICE 'current_setting() avec paramètre true';
    RAISE NOTICE 'Évite les erreurs si settings non définis';
    RAISE NOTICE '========================================';
  ELSE
    RAISE WARNING 'CRON job non créé - Vérifier la configuration pg_cron';
  END IF;
END $$;
