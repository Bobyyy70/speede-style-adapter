-- Supprimer les anciennes fonctions si elles existent
DROP FUNCTION IF EXISTS acquire_sync_lock(TEXT, TEXT, INTEGER);
DROP FUNCTION IF EXISTS release_sync_lock(TEXT, TEXT);

-- Supprimer l'ancienne politique si elle existe
DROP POLICY IF EXISTS "Service role only sync_locks" ON sync_locks;

-- Table pour gérer les verrous de synchronisation
CREATE TABLE IF NOT EXISTS sync_locks (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  lock_key TEXT NOT NULL UNIQUE,
  owner TEXT NOT NULL,
  started_at TIMESTAMPTZ DEFAULT NOW(),
  expires_at TIMESTAMPTZ DEFAULT NOW() + INTERVAL '10 minutes'
);

-- Index pour nettoyer les verrous expirés
CREATE INDEX IF NOT EXISTS idx_sync_locks_expires_at ON sync_locks(expires_at);

-- Fonction pour acquérir un verrou
CREATE OR REPLACE FUNCTION acquire_sync_lock(
  p_lock_key TEXT,
  p_owner TEXT,
  p_ttl_minutes INTEGER DEFAULT 10
) RETURNS BOOLEAN AS $$
DECLARE
  v_acquired BOOLEAN;
BEGIN
  -- Nettoyer les verrous expirés
  DELETE FROM sync_locks WHERE expires_at < NOW();
  
  -- Tenter d'insérer le verrou
  INSERT INTO sync_locks (lock_key, owner, expires_at)
  VALUES (p_lock_key, p_owner, NOW() + (p_ttl_minutes || ' minutes')::INTERVAL)
  ON CONFLICT (lock_key) DO NOTHING
  RETURNING TRUE INTO v_acquired;
  
  RETURN COALESCE(v_acquired, FALSE);
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Fonction pour libérer un verrou
CREATE OR REPLACE FUNCTION release_sync_lock(
  p_lock_key TEXT,
  p_owner TEXT
) RETURNS BOOLEAN AS $$
DECLARE
  v_released BOOLEAN;
BEGIN
  DELETE FROM sync_locks 
  WHERE lock_key = p_lock_key AND owner = p_owner
  RETURNING TRUE INTO v_released;
  
  RETURN COALESCE(v_released, FALSE);
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- RLS pour la table sync_locks (service role only)
ALTER TABLE sync_locks ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Service role only sync_locks" ON sync_locks
  FOR ALL
  USING (false);