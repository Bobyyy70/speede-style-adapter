-- =====================================================
-- CRON Job: Notifications transporteurs (performances & alertes)
-- Description: Envoie quotidiennement les notifications sur performances transporteurs, suggestions IA, et alertes critiques
-- Date: 2025-11-18
-- =====================================================

-- Create CRON job for daily carrier notifications
-- Runs every day at 09:00 AM (UTC)
SELECT cron.schedule(
  'send-carrier-notifications-daily',       -- Job name
  '0 9 * * *',                               -- Every day at 09:00 AM
  $$
  SELECT net.http_post(
    url := current_setting('app.supabase_url', true) || '/functions/v1/send-carrier-notifications',
    headers := jsonb_build_object(
      'Content-Type', 'application/json',
      'Authorization', 'Bearer ' || current_setting('app.supabase_service_role_key', true)
    ),
    body := jsonb_build_object('trigger', 'cron')::jsonb
  ) AS request_id;
  $$
);

-- =====================================================
-- Helper function: Manuel trigger des notifications
-- =====================================================

CREATE OR REPLACE FUNCTION send_carrier_notifications_now()
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
  -- Trigger carrier notifications immediately
  SELECT net.http_post(
    url := current_setting('app.supabase_url', true) || '/functions/v1/send-carrier-notifications',
    headers := jsonb_build_object(
      'Content-Type', 'application/json',
      'Authorization', 'Bearer ' || current_setting('app.supabase_service_role_key', true)
    ),
    body := jsonb_build_object('trigger', 'manual')::jsonb
  ) INTO v_request_id;

  RETURN QUERY SELECT
    TRUE,
    'Notifications transporteurs déclenchées avec succès'::TEXT,
    v_request_id;
END;
$$;

-- Grant execute to authenticated users (admins/gestionnaires)
GRANT EXECUTE ON FUNCTION send_carrier_notifications_now() TO authenticated;

COMMENT ON FUNCTION send_carrier_notifications_now() IS 'Manually trigger carrier performance notifications. Usage: SELECT * FROM send_carrier_notifications_now();';

-- =====================================================
-- Verification
-- =====================================================

DO $$
DECLARE
  job_count INTEGER;
BEGIN
  SELECT COUNT(*) INTO job_count
  FROM cron.job
  WHERE jobname = 'send-carrier-notifications-daily';

  IF job_count > 0 THEN
    RAISE NOTICE '====================================';
    RAISE NOTICE ' ✅ CRON Job créé avec succès';
    RAISE NOTICE '====================================';
    RAISE NOTICE 'Job: send-carrier-notifications-daily';
    RAISE NOTICE 'Planification: Tous les jours à 09:00 (UTC)';
    RAISE NOTICE 'Action: Notifications IA/alertes transporteurs';
    RAISE NOTICE '';
    RAISE NOTICE 'Notifications envoyées pour:';
    RAISE NOTICE '  - Suggestions IA haute confiance (>80%%)';
    RAISE NOTICE '  - Patterns répétitifs détectés';
    RAISE NOTICE '  - Alertes critiques transporteurs';
    RAISE NOTICE '';
    RAISE NOTICE 'Test manuel: SELECT * FROM send_carrier_notifications_now();';
    RAISE NOTICE '====================================';
  ELSE
    RAISE WARNING 'CRON job non créé - Vérifier la configuration pg_cron';
  END IF;
END $$;
