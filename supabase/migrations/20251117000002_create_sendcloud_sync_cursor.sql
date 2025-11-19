-- ============================================================
-- TABLE: sendcloud_sync_cursor
-- ============================================================
-- Cette table permet de tracker la progression de la synchronisation
-- SendCloud et de reprendre là où on s'est arrêté en cas de timeout
-- ou d'interruption.
--
-- Utilisation:
-- - Lors de chaque sync, on lit le curseur pour savoir où reprendre
-- - Après traitement d'un batch, on met à jour le curseur
-- - La prochaine sync reprendra automatiquement à partir du curseur
-- ============================================================

CREATE TABLE IF NOT EXISTS public.sendcloud_sync_cursor (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),

  -- Type de synchronisation (orders, carriers, products, etc.)
  sync_type TEXT NOT NULL,

  -- Dernière date de synchronisation réussie
  last_synced_at TIMESTAMP WITH TIME ZONE,

  -- Dernier ID traité (pour les API qui supportent l'ID-based pagination)
  last_entity_id TEXT,

  -- Numéro de page atteint (pour les API avec pagination classique)
  page_cursor INTEGER DEFAULT 0,

  -- Offset pour pagination (alternative à page_cursor)
  offset_cursor INTEGER DEFAULT 0,

  -- Métadonnées supplémentaires (JSON)
  -- Peut contenir: last_order_number, batch_size, errors_count, etc.
  metadata JSONB DEFAULT '{}'::jsonb,

  -- Statut du curseur
  status TEXT DEFAULT 'idle' CHECK (status IN ('idle', 'syncing', 'error', 'completed')),

  -- Message d'erreur si statut = error
  error_message TEXT,

  -- Nombre de tentatives en cas d'erreur
  retry_count INTEGER DEFAULT 0,

  -- Prochaine tentative (en cas d'erreur avec backoff)
  next_retry_at TIMESTAMP WITH TIME ZONE,

  -- Horodatages
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW() NOT NULL,
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW() NOT NULL,

  -- Contrainte d'unicité par type de sync
  UNIQUE(sync_type)
);

-- ============================================================
-- INDEX POUR PERFORMANCE
-- ============================================================
CREATE INDEX IF NOT EXISTS idx_sendcloud_sync_cursor_sync_type
  ON public.sendcloud_sync_cursor(sync_type);

CREATE INDEX IF NOT EXISTS idx_sendcloud_sync_cursor_status
  ON public.sendcloud_sync_cursor(status);

CREATE INDEX IF NOT EXISTS idx_sendcloud_sync_cursor_updated_at
  ON public.sendcloud_sync_cursor(updated_at DESC);

-- ============================================================
-- TRIGGER POUR MISE À JOUR AUTO DE updated_at
-- ============================================================
CREATE OR REPLACE FUNCTION public.update_sendcloud_sync_cursor_updated_at()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trigger_update_sendcloud_sync_cursor_updated_at
  ON public.sendcloud_sync_cursor;

CREATE TRIGGER trigger_update_sendcloud_sync_cursor_updated_at
  BEFORE UPDATE ON public.sendcloud_sync_cursor
  FOR EACH ROW
  EXECUTE FUNCTION public.update_sendcloud_sync_cursor_updated_at();

-- ============================================================
-- RLS POLICIES
-- ============================================================
ALTER TABLE public.sendcloud_sync_cursor ENABLE ROW LEVEL SECURITY;

-- Admins ont accès complet
CREATE POLICY "Admin full access on sendcloud_sync_cursor"
  ON public.sendcloud_sync_cursor
  FOR ALL
  TO authenticated
  USING (has_role(auth.uid(), 'admin'))
  WITH CHECK (has_role(auth.uid(), 'admin'));

-- Service role a accès complet (pour les edge functions)
CREATE POLICY "Service role full access on sendcloud_sync_cursor"
  ON public.sendcloud_sync_cursor
  FOR ALL
  TO service_role
  USING (true)
  WITH CHECK (true);

-- ============================================================
-- FONCTIONS UTILITAIRES
-- ============================================================

-- Fonction pour obtenir ou créer un curseur
CREATE OR REPLACE FUNCTION public.get_or_create_sync_cursor(
  p_sync_type TEXT
)
RETURNS public.sendcloud_sync_cursor
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_cursor sendcloud_sync_cursor;
BEGIN
  -- Essayer de récupérer le curseur existant
  SELECT * INTO v_cursor
  FROM public.sendcloud_sync_cursor
  WHERE sync_type = p_sync_type;

  -- Si n'existe pas, le créer
  IF NOT FOUND THEN
    INSERT INTO public.sendcloud_sync_cursor (sync_type, status)
    VALUES (p_sync_type, 'idle')
    RETURNING * INTO v_cursor;

    RAISE NOTICE 'Curseur créé pour sync_type: %', p_sync_type;
  END IF;

  RETURN v_cursor;
END;
$$;

-- Fonction pour mettre à jour le curseur après un batch réussi
CREATE OR REPLACE FUNCTION public.update_sync_cursor(
  p_sync_type TEXT,
  p_last_synced_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  p_last_entity_id TEXT DEFAULT NULL,
  p_page_cursor INTEGER DEFAULT NULL,
  p_offset_cursor INTEGER DEFAULT NULL,
  p_metadata JSONB DEFAULT NULL,
  p_status TEXT DEFAULT 'idle'
)
RETURNS public.sendcloud_sync_cursor
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_cursor sendcloud_sync_cursor;
BEGIN
  UPDATE public.sendcloud_sync_cursor
  SET
    last_synced_at = COALESCE(p_last_synced_at, last_synced_at),
    last_entity_id = COALESCE(p_last_entity_id, last_entity_id),
    page_cursor = COALESCE(p_page_cursor, page_cursor),
    offset_cursor = COALESCE(p_offset_cursor, offset_cursor),
    metadata = COALESCE(p_metadata, metadata),
    status = p_status,
    error_message = CASE WHEN p_status != 'error' THEN NULL ELSE error_message END,
    retry_count = CASE WHEN p_status = 'idle' THEN 0 ELSE retry_count END
  WHERE sync_type = p_sync_type
  RETURNING * INTO v_cursor;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'Curseur non trouvé pour sync_type: %', p_sync_type;
  END IF;

  RETURN v_cursor;
END;
$$;

-- Fonction pour réinitialiser un curseur (force full sync)
CREATE OR REPLACE FUNCTION public.reset_sync_cursor(
  p_sync_type TEXT
)
RETURNS public.sendcloud_sync_cursor
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_cursor sendcloud_sync_cursor;
BEGIN
  UPDATE public.sendcloud_sync_cursor
  SET
    last_synced_at = NULL,
    last_entity_id = NULL,
    page_cursor = 0,
    offset_cursor = 0,
    metadata = '{}'::jsonb,
    status = 'idle',
    error_message = NULL,
    retry_count = 0,
    next_retry_at = NULL
  WHERE sync_type = p_sync_type
  RETURNING * INTO v_cursor;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'Curseur non trouvé pour sync_type: %', p_sync_type;
  END IF;

  RAISE NOTICE 'Curseur réinitialisé pour sync_type: %', p_sync_type;
  RETURN v_cursor;
END;
$$;

-- Fonction pour marquer un curseur en erreur
CREATE OR REPLACE FUNCTION public.mark_sync_cursor_error(
  p_sync_type TEXT,
  p_error_message TEXT,
  p_retry_delay_minutes INTEGER DEFAULT 15
)
RETURNS public.sendcloud_sync_cursor
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_cursor sendcloud_sync_cursor;
BEGIN
  UPDATE public.sendcloud_sync_cursor
  SET
    status = 'error',
    error_message = p_error_message,
    retry_count = retry_count + 1,
    next_retry_at = NOW() + (p_retry_delay_minutes || ' minutes')::INTERVAL
  WHERE sync_type = p_sync_type
  RETURNING * INTO v_cursor;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'Curseur non trouvé pour sync_type: %', p_sync_type;
  END IF;

  RAISE WARNING 'Curseur marqué en erreur pour sync_type: % (retry %)', p_sync_type, v_cursor.retry_count;
  RETURN v_cursor;
END;
$$;

-- ============================================================
-- INITIALISATION DES CURSEURS PAR DÉFAUT
-- ============================================================
DO $$
BEGIN
  -- Créer les curseurs par défaut pour chaque type de sync
  PERFORM public.get_or_create_sync_cursor('orders');
  PERFORM public.get_or_create_sync_cursor('carriers');
  PERFORM public.get_or_create_sync_cursor('shipping_methods');
  PERFORM public.get_or_create_sync_cursor('products');
  PERFORM public.get_or_create_sync_cursor('senders');
  PERFORM public.get_or_create_sync_cursor('returns');

  RAISE NOTICE 'Curseurs par défaut initialisés avec succès';
END $$;

-- ============================================================
-- VUE POUR MONITORING
-- ============================================================
CREATE OR REPLACE VIEW public.v_sendcloud_sync_status AS
SELECT
  sync_type,
  status,
  last_synced_at,
  CASE
    WHEN last_synced_at IS NULL THEN 'Jamais synchronisé'
    WHEN NOW() - last_synced_at < INTERVAL '1 hour' THEN 'Sync récente (< 1h)'
    WHEN NOW() - last_synced_at < INTERVAL '24 hours' THEN 'Sync aujourd''hui'
    WHEN NOW() - last_synced_at < INTERVAL '7 days' THEN 'Sync cette semaine'
    ELSE 'Sync obsolète (> 7 jours)'
  END as sync_freshness,
  page_cursor,
  offset_cursor,
  retry_count,
  error_message,
  next_retry_at,
  updated_at
FROM public.sendcloud_sync_cursor
ORDER BY sync_type;

COMMENT ON VIEW public.v_sendcloud_sync_status IS
  'Vue pour monitorer l''état de toutes les synchronisations SendCloud';

-- ============================================================
-- COMMENTAIRES
-- ============================================================
COMMENT ON TABLE public.sendcloud_sync_cursor IS
  'Table de tracking de la progression des synchronisations SendCloud. '
  'Permet de reprendre une sync interrompue et d''éviter les timeouts.';

COMMENT ON COLUMN public.sendcloud_sync_cursor.sync_type IS
  'Type de synchronisation: orders, carriers, shipping_methods, products, senders, returns';

COMMENT ON COLUMN public.sendcloud_sync_cursor.last_synced_at IS
  'Date de la dernière synchronisation réussie';

COMMENT ON COLUMN public.sendcloud_sync_cursor.page_cursor IS
  'Numéro de page atteint pour la pagination API';

COMMENT ON COLUMN public.sendcloud_sync_cursor.metadata IS
  'Métadonnées supplémentaires (JSON): last_order_number, batch_size, total_processed, etc.';

-- ============================================================
-- RÉSUMÉ
-- ============================================================
DO $$
BEGIN
  RAISE NOTICE '';
  RAISE NOTICE '========================================';
  RAISE NOTICE '   TABLE sendcloud_sync_cursor CRÉÉE';
  RAISE NOTICE '========================================';
  RAISE NOTICE 'Fonctions disponibles:';
  RAISE NOTICE '  - get_or_create_sync_cursor(type)';
  RAISE NOTICE '  - update_sync_cursor(...)';
  RAISE NOTICE '  - reset_sync_cursor(type)';
  RAISE NOTICE '  - mark_sync_cursor_error(type, msg)';
  RAISE NOTICE '';
  RAISE NOTICE 'Vue monitoring:';
  RAISE NOTICE '  - v_sendcloud_sync_status';
  RAISE NOTICE '';
  RAISE NOTICE 'Curseurs initialisés:';
  RAISE NOTICE '  - orders, carriers, shipping_methods';
  RAISE NOTICE '  - products, senders, returns';
  RAISE NOTICE '========================================';
  RAISE NOTICE '';
END $$;
