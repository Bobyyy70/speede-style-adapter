-- =====================================================
-- SendCloud Stock Sync Implementation
-- Description: Tables, triggers, and CRON for syncing stock to SendCloud
-- Date: 2025-11-18
-- =====================================================

-- =====================================================
-- Table 1: SendCloud Product Mapping
-- =====================================================
CREATE TABLE IF NOT EXISTS sendcloud_product_mapping (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  produit_id UUID NOT NULL REFERENCES produit(id) ON DELETE CASCADE,
  sendcloud_sku TEXT NOT NULL UNIQUE,
  sendcloud_product_id TEXT,
  last_sync_at TIMESTAMPTZ,
  sync_status TEXT DEFAULT 'pending' CHECK (sync_status IN ('pending', 'synced', 'error')),
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(produit_id, sendcloud_sku)
);

CREATE INDEX idx_sendcloud_product_mapping_produit ON sendcloud_product_mapping(produit_id);
CREATE INDEX idx_sendcloud_product_mapping_sku ON sendcloud_product_mapping(sendcloud_sku);
CREATE INDEX idx_sendcloud_product_mapping_status ON sendcloud_product_mapping(sync_status);

COMMENT ON TABLE sendcloud_product_mapping IS 'Mapping between WMS products and SendCloud SKUs for stock synchronization';

-- =====================================================
-- Table 2: SendCloud Stock Queue
-- =====================================================
CREATE TABLE IF NOT EXISTS sendcloud_stock_queue (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  produit_id UUID NOT NULL REFERENCES produit(id) ON DELETE CASCADE,
  sendcloud_sku TEXT NOT NULL,
  stock_actuel INTEGER NOT NULL,
  queued_at TIMESTAMPTZ DEFAULT NOW(),
  processed BOOLEAN DEFAULT FALSE,
  processed_at TIMESTAMPTZ,
  retry_count INTEGER DEFAULT 0,
  error_message TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX idx_sendcloud_stock_queue_processed ON sendcloud_stock_queue(processed, queued_at);
CREATE INDEX idx_sendcloud_stock_queue_sku ON sendcloud_stock_queue(sendcloud_sku);

COMMENT ON TABLE sendcloud_stock_queue IS 'Queue for batched stock updates to SendCloud API';

-- =====================================================
-- Table 3: SendCloud Sync Errors
-- =====================================================
CREATE TABLE IF NOT EXISTS sendcloud_sync_errors (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  entity_type TEXT NOT NULL CHECK (entity_type IN ('stock', 'product', 'order')),
  entity_id UUID,
  operation TEXT NOT NULL CHECK (operation IN ('create', 'update', 'delete')),
  error_code TEXT,
  error_message TEXT NOT NULL,
  error_details JSONB,
  request_payload JSONB,
  response_payload JSONB,
  retry_count INTEGER DEFAULT 0,
  resolved BOOLEAN DEFAULT FALSE,
  resolved_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX idx_sendcloud_sync_errors_entity ON sendcloud_sync_errors(entity_type, entity_id);
CREATE INDEX idx_sendcloud_sync_errors_resolved ON sendcloud_sync_errors(resolved);
CREATE INDEX idx_sendcloud_sync_errors_created ON sendcloud_sync_errors(created_at DESC);

COMMENT ON TABLE sendcloud_sync_errors IS 'Error log for SendCloud API synchronization failures';

-- =====================================================
-- Function: Queue stock update when inventory changes
-- =====================================================
CREATE OR REPLACE FUNCTION queue_sendcloud_stock_update()
RETURNS TRIGGER
LANGUAGE plpgsql
AS $$
DECLARE
  v_sendcloud_sku TEXT;
  v_stock_actuel INTEGER;
BEGIN
  -- Get SendCloud SKU mapping
  SELECT sendcloud_sku INTO v_sendcloud_sku
  FROM sendcloud_product_mapping
  WHERE produit_id = NEW.produit_id
  AND sync_status = 'synced'
  LIMIT 1;

  -- Only queue if mapping exists
  IF v_sendcloud_sku IS NOT NULL THEN
    -- Get current stock level
    SELECT stock_disponible INTO v_stock_actuel
    FROM produit
    WHERE id = NEW.produit_id;

    -- Insert or update queue entry
    INSERT INTO sendcloud_stock_queue (
      produit_id,
      sendcloud_sku,
      stock_actuel,
      queued_at,
      processed
    )
    VALUES (
      NEW.produit_id,
      v_sendcloud_sku,
      COALESCE(v_stock_actuel, 0),
      NOW(),
      FALSE
    )
    ON CONFLICT (produit_id, sendcloud_sku)
    WHERE processed = FALSE
    DO UPDATE SET
      stock_actuel = COALESCE(v_stock_actuel, 0),
      queued_at = NOW(),
      retry_count = 0;

    RAISE NOTICE '[SendCloud] Stock update queued for SKU %: % units', v_sendcloud_sku, v_stock_actuel;
  END IF;

  RETURN NEW;
END;
$$;

-- Add unique constraint on sendcloud_stock_queue to prevent duplicates
ALTER TABLE sendcloud_stock_queue
DROP CONSTRAINT IF EXISTS sendcloud_stock_queue_unique_unprocessed;

ALTER TABLE sendcloud_stock_queue
ADD CONSTRAINT sendcloud_stock_queue_unique_unprocessed
UNIQUE (produit_id, sendcloud_sku) WHERE processed = FALSE;

-- =====================================================
-- Trigger: Auto-queue stock updates on inventory changes
-- =====================================================
DROP TRIGGER IF EXISTS trigger_queue_sendcloud_stock ON mouvement_stock;

CREATE TRIGGER trigger_queue_sendcloud_stock
  AFTER INSERT OR UPDATE ON mouvement_stock
  FOR EACH ROW
  EXECUTE FUNCTION queue_sendcloud_stock_update();

COMMENT ON TRIGGER trigger_queue_sendcloud_stock ON mouvement_stock IS 'Automatically queue stock updates to SendCloud when inventory changes';

-- =====================================================
-- CRON Job: Process stock queue every 2 minutes
-- =====================================================
SELECT cron.schedule(
  'sendcloud-update-stock-batch',        -- Job name
  '*/2 * * * *',                          -- Every 2 minutes
  $$
  SELECT net.http_post(
    url := current_setting('app.supabase_url', true) || '/functions/v1/sendcloud-update-stock',
    headers := jsonb_build_object(
      'Content-Type', 'application/json',
      'Authorization', 'Bearer ' || current_setting('app.supabase_service_role_key', true)
    ),
    body := jsonb_build_object('trigger', 'cron')::jsonb
  ) AS request_id;
  $$
);

-- =====================================================
-- Helper function: Manually trigger stock sync
-- =====================================================
CREATE OR REPLACE FUNCTION sync_sendcloud_stock_now()
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
  -- Trigger stock sync immediately
  SELECT net.http_post(
    url := current_setting('app.supabase_url', true) || '/functions/v1/sendcloud-update-stock',
    headers := jsonb_build_object(
      'Content-Type', 'application/json',
      'Authorization', 'Bearer ' || current_setting('app.supabase_service_role_key', true)
    ),
    body := jsonb_build_object('trigger', 'manual')::jsonb
  ) INTO v_request_id;

  RETURN QUERY SELECT
    TRUE,
    'Stock sync vers SendCloud déclenché avec succès'::TEXT,
    v_request_id;
END;
$$;

GRANT EXECUTE ON FUNCTION sync_sendcloud_stock_now() TO authenticated;

COMMENT ON FUNCTION sync_sendcloud_stock_now() IS 'Manually trigger SendCloud stock sync. Usage: SELECT * FROM sync_sendcloud_stock_now();';

-- =====================================================
-- RLS Policies
-- =====================================================

ALTER TABLE sendcloud_product_mapping ENABLE ROW LEVEL SECURITY;
ALTER TABLE sendcloud_stock_queue ENABLE ROW LEVEL SECURITY;
ALTER TABLE sendcloud_sync_errors ENABLE ROW LEVEL SECURITY;

-- Admin full access
CREATE POLICY "admin_full_sendcloud_product_mapping" ON sendcloud_product_mapping
  FOR ALL USING (is_admin());

CREATE POLICY "admin_full_sendcloud_stock_queue" ON sendcloud_stock_queue
  FOR ALL USING (is_admin());

CREATE POLICY "admin_full_sendcloud_sync_errors" ON sendcloud_sync_errors
  FOR ALL USING (is_admin());

-- Gestionnaire read access
CREATE POLICY "gestionnaire_read_sendcloud_product_mapping" ON sendcloud_product_mapping
  FOR SELECT USING (is_gestionnaire());

CREATE POLICY "gestionnaire_read_sendcloud_stock_queue" ON sendcloud_stock_queue
  FOR SELECT USING (is_gestionnaire());

CREATE POLICY "gestionnaire_read_sendcloud_sync_errors" ON sendcloud_sync_errors
  FOR SELECT USING (is_gestionnaire());

-- =====================================================
-- Verification
-- =====================================================
DO $$
DECLARE
  trigger_exists BOOLEAN;
  cron_exists BOOLEAN;
  tables_count INTEGER;
BEGIN
  -- Check trigger
  SELECT EXISTS (
    SELECT 1 FROM pg_trigger
    WHERE tgname = 'trigger_queue_sendcloud_stock'
  ) INTO trigger_exists;

  -- Check CRON
  SELECT EXISTS (
    SELECT 1 FROM cron.job
    WHERE jobname = 'sendcloud-update-stock-batch'
  ) INTO cron_exists;

  -- Check tables
  SELECT COUNT(*) INTO tables_count
  FROM information_schema.tables
  WHERE table_name IN ('sendcloud_product_mapping', 'sendcloud_stock_queue', 'sendcloud_sync_errors');

  RAISE NOTICE '====================================';
  RAISE NOTICE ' ✅ SendCloud Stock Sync Activé';
  RAISE NOTICE '====================================';
  RAISE NOTICE 'Tables créées: %/3', tables_count;
  RAISE NOTICE 'Trigger activé: %', trigger_exists;
  RAISE NOTICE 'CRON activé: %', cron_exists;
  RAISE NOTICE '';
  RAISE NOTICE 'Fonctionnalités:';
  RAISE NOTICE '  - Détection automatique changements stock';
  RAISE NOTICE '  - Queue batched toutes les 2 minutes';
  RAISE NOTICE '  - Retry automatique (max 3 fois)';
  RAISE NOTICE '  - Logging des erreurs';
  RAISE NOTICE '';
  RAISE NOTICE 'Test manuel: SELECT * FROM sync_sendcloud_stock_now();';
  RAISE NOTICE 'Voir la queue: SELECT * FROM sendcloud_stock_queue;';
  RAISE NOTICE 'Voir les erreurs: SELECT * FROM sendcloud_sync_errors;';
  RAISE NOTICE '====================================';
END $$;
