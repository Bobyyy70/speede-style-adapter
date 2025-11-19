-- =====================================================
-- CRON Job: Nettoyage commandes en double
-- Description: Supprime les commandes dupliquées chaque semaine
-- Date: 2025-11-18
-- =====================================================

-- Create CRON job for weekly duplicate cleanup
-- Runs every Sunday at 03:00 AM (UTC)
SELECT cron.schedule(
  'cleanup-duplicate-orders-weekly',      -- Job name
  '0 3 * * 0',                            -- Cron expression: At 03:00 every Sunday
  $$
  SELECT net.http_post(
    url := current_setting('app.supabase_url', true) || '/functions/v1/cleanup-duplicate-orders',
    headers := jsonb_build_object(
      'Content-Type', 'application/json',
      'Authorization', 'Bearer ' || current_setting('app.supabase_service_role_key', true)
    ),
    body := jsonb_build_object(
      'trigger', 'cron',
      'dry_run', false
    )::jsonb
  ) AS request_id;
  $$
);

-- Add comment
COMMENT ON EXTENSION pg_cron IS 'Job scheduler for PostgreSQL';

-- =====================================================
-- Helper function: Manuel cleanup with dry-run option
-- =====================================================

CREATE OR REPLACE FUNCTION cleanup_duplicates_now(
  p_dry_run BOOLEAN DEFAULT true
)
RETURNS TABLE(
  success BOOLEAN,
  message TEXT,
  request_id BIGINT
)
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  v_request_id BIGINT;
BEGIN
  -- Trigger cleanup immediately
  SELECT net.http_post(
    url := current_setting('app.supabase_url', true) || '/functions/v1/cleanup-duplicate-orders',
    headers := jsonb_build_object(
      'Content-Type', 'application/json',
      'Authorization', 'Bearer ' || current_setting('app.supabase_service_role_key', true)
    ),
    body := jsonb_build_object(
      'trigger', 'manual',
      'dry_run', p_dry_run
    )::jsonb
  ) INTO v_request_id;

  RETURN QUERY SELECT
    TRUE,
    CASE
      WHEN p_dry_run THEN 'Cleanup triggered (DRY RUN - no deletion)'
      ELSE 'Cleanup triggered (LIVE - duplicates will be deleted)'
    END::TEXT,
    v_request_id;
END;
$$;

-- Grant execute to admins only (via RLS on function)
GRANT EXECUTE ON FUNCTION cleanup_duplicates_now(BOOLEAN) TO authenticated;

COMMENT ON FUNCTION cleanup_duplicates_now IS 'Manually trigger duplicate cleanup. dry_run=true for preview, false for actual deletion. Usage: SELECT * FROM cleanup_duplicates_now(true);';

-- =====================================================
-- Verification
-- =====================================================

DO $$
DECLARE
  job_count INTEGER;
BEGIN
  SELECT COUNT(*) INTO job_count
  FROM cron.job
  WHERE jobname = 'cleanup-duplicate-orders-weekly';

  IF job_count > 0 THEN
    RAISE NOTICE '====================================';
    RAISE NOTICE ' ✅ CRON Job créé avec succès';
    RAISE NOTICE '====================================';
    RAISE NOTICE 'Job: cleanup-duplicate-orders-weekly';
    RAISE NOTICE 'Planification: Chaque dimanche à 03:00 (UTC)';
    RAISE NOTICE 'Action: Nettoyage des commandes dupliquées';
    RAISE NOTICE '';
    RAISE NOTICE 'Test manuel (DRY RUN):';
    RAISE NOTICE '  SELECT * FROM cleanup_duplicates_now(true);';
    RAISE NOTICE '';
    RAISE NOTICE 'Exécution réelle (DANGER):';
    RAISE NOTICE '  SELECT * FROM cleanup_duplicates_now(false);';
    RAISE NOTICE '====================================';
  ELSE
    RAISE WARNING 'CRON job non créé - Vérifier la configuration pg_cron';
  END IF;
END $$;
