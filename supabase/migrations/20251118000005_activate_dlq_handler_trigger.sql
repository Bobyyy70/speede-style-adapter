-- =====================================================
-- Trigger: Auto-activation DLQ Handler
-- Description: Déclenche automatiquement le retry des messages DLQ
-- Date: 2025-11-18
-- =====================================================

-- Create function to trigger DLQ handler via HTTP
CREATE OR REPLACE FUNCTION trigger_dlq_handler()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  v_request_id BIGINT;
BEGIN
  -- Only trigger for new pending messages
  IF NEW.status = 'pending' AND (OLD IS NULL OR OLD.status != 'pending') THEN

    RAISE NOTICE '[DLQ Trigger] New pending message detected: % (type: %)', NEW.id, NEW.event_type;

    -- Schedule retry check (non-blocking)
    -- Uses pg_net to call edge function asynchronously
    SELECT net.http_post(
      url := current_setting('app.supabase_url', true) || '/functions/v1/sendcloud-dlq-handler',
      headers := jsonb_build_object(
        'Content-Type', 'application/json',
        'Authorization', 'Bearer ' || current_setting('app.supabase_service_role_key', true)
      ),
      body := jsonb_build_object(
        'trigger', 'auto',
        'dlq_id', NEW.id::text,
        'event_type', NEW.event_type
      )
    ) INTO v_request_id;

    RAISE NOTICE '[DLQ Trigger] Scheduled retry check for message % (request_id: %)', NEW.id, v_request_id;

  END IF;

  RETURN NEW;
END;
$$;

-- Create trigger on INSERT and UPDATE
DROP TRIGGER IF EXISTS auto_trigger_dlq_handler ON sendcloud_dlq;

CREATE TRIGGER auto_trigger_dlq_handler
  AFTER INSERT OR UPDATE ON sendcloud_dlq
  FOR EACH ROW
  WHEN (NEW.status = 'pending')
  EXECUTE FUNCTION trigger_dlq_handler();

-- Add comment
COMMENT ON FUNCTION trigger_dlq_handler() IS 'Automatically triggers DLQ handler when new pending messages are inserted';
COMMENT ON TRIGGER auto_trigger_dlq_handler ON sendcloud_dlq IS 'Auto-triggers DLQ retry processing for pending messages';

-- =====================================================
-- CRON Job for periodic DLQ processing (backup)
-- =====================================================
-- In case trigger fails, also run DLQ handler every 5 minutes

SELECT cron.schedule(
  'sendcloud-dlq-handler-periodic',       -- Job name
  '*/5 * * * *',                          -- Every 5 minutes
  $$
  SELECT net.http_post(
    url := current_setting('app.supabase_url', true) || '/functions/v1/sendcloud-dlq-handler',
    headers := jsonb_build_object(
      'Content-Type', 'application/json',
      'Authorization', 'Bearer ' || current_setting('app.supabase_service_role_key', true)
    ),
    body := jsonb_build_object('trigger', 'cron')::jsonb
  ) AS request_id;
  $$
);

-- =====================================================
-- Helper function: Manually trigger DLQ processing
-- =====================================================

CREATE OR REPLACE FUNCTION process_dlq_now()
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
  -- Trigger DLQ handler immediately
  SELECT net.http_post(
    url := current_setting('app.supabase_url', true) || '/functions/v1/sendcloud-dlq-handler',
    headers := jsonb_build_object(
      'Content-Type', 'application/json',
      'Authorization', 'Bearer ' || current_setting('app.supabase_service_role_key', true)
    ),
    body := jsonb_build_object('trigger', 'manual')::jsonb
  ) INTO v_request_id;

  RETURN QUERY SELECT
    TRUE,
    'DLQ Handler triggered successfully'::TEXT,
    v_request_id;
END;
$$;

-- Grant execute to authenticated users
GRANT EXECUTE ON FUNCTION process_dlq_now() TO authenticated;

COMMENT ON FUNCTION process_dlq_now() IS 'Manually trigger DLQ processing immediately. Usage: SELECT * FROM process_dlq_now();';

-- =====================================================
-- Verification
-- =====================================================

DO $$
DECLARE
  trigger_exists BOOLEAN;
  cron_exists BOOLEAN;
BEGIN
  -- Check trigger
  SELECT EXISTS (
    SELECT 1 FROM pg_trigger
    WHERE tgname = 'auto_trigger_dlq_handler'
  ) INTO trigger_exists;

  -- Check CRON
  SELECT EXISTS (
    SELECT 1 FROM cron.job
    WHERE jobname = 'sendcloud-dlq-handler-periodic'
  ) INTO cron_exists;

  RAISE NOTICE '====================================';
  RAISE NOTICE ' ✅ DLQ Handler Auto-Activation';
  RAISE NOTICE '====================================';
  RAISE NOTICE 'Trigger activé: %', trigger_exists;
  RAISE NOTICE 'CRON activé: %', cron_exists;
  RAISE NOTICE '';
  RAISE NOTICE 'Déclenchement automatique:';
  RAISE NOTICE '  - INSERT dans sendcloud_dlq (status=pending)';
  RAISE NOTICE '  - UPDATE vers status=pending';
  RAISE NOTICE '  - CRON toutes les 5 minutes (backup)';
  RAISE NOTICE '';
  RAISE NOTICE 'Test manuel: SELECT * FROM process_dlq_now();';
  RAISE NOTICE '====================================';
END $$;
