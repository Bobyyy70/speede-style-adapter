-- =====================================================
-- HOTFIX: Correction contrainte unique sendcloud_stock_queue
-- Description: Remplace ALTER TABLE + UNIQUE par CREATE UNIQUE INDEX partiel
-- Date: 2025-11-18
-- =====================================================

-- =====================================================
-- Supprimer la contrainte si elle existe (elle ne devrait pas)
-- =====================================================
ALTER TABLE sendcloud_stock_queue
DROP CONSTRAINT IF EXISTS sendcloud_stock_queue_unique_unprocessed;

-- =====================================================
-- Créer un INDEX unique partiel (WHERE clause supportée)
-- =====================================================
CREATE UNIQUE INDEX IF NOT EXISTS idx_sendcloud_stock_queue_unique_unprocessed
  ON sendcloud_stock_queue(produit_id, sendcloud_sku)
  WHERE processed = FALSE;

COMMENT ON INDEX idx_sendcloud_stock_queue_unique_unprocessed IS 'Ensure only one unprocessed stock update per product/SKU combination';

-- =====================================================
-- Vérification
-- =====================================================
DO $$
DECLARE
  index_exists BOOLEAN;
BEGIN
  SELECT EXISTS (
    SELECT 1 FROM pg_indexes
    WHERE schemaname = 'public'
    AND tablename = 'sendcloud_stock_queue'
    AND indexname = 'idx_sendcloud_stock_queue_unique_unprocessed'
  ) INTO index_exists;

  RAISE NOTICE '========================================';
  RAISE NOTICE ' ✅ HOTFIX Stock Queue Index Créé';
  RAISE NOTICE '========================================';
  RAISE NOTICE 'Index unique partiel: %', index_exists;
  RAISE NOTICE 'Prévient les doublons dans la queue';
  RAISE NOTICE '========================================';
END $$;
