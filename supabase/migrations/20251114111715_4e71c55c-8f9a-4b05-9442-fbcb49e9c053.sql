-- Table pour logger le nettoyage des doublons
CREATE TABLE IF NOT EXISTS public.dedup_log (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  numero_commande TEXT,
  sendcloud_id TEXT,
  kept_id UUID,
  deleted_ids UUID[],
  raison TEXT,
  date_nettoyage TIMESTAMP WITH TIME ZONE DEFAULT now()
);

-- Table pour les verrous de synchronisation
CREATE TABLE IF NOT EXISTS public.sync_locks (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  lock_key TEXT UNIQUE NOT NULL,
  owner TEXT NOT NULL,
  started_at TIMESTAMP WITH TIME ZONE DEFAULT now(),
  expires_at TIMESTAMP WITH TIME ZONE DEFAULT (now() + interval '10 minutes')
);

-- Index pour nettoyer les verrous expirés
CREATE INDEX IF NOT EXISTS idx_sync_locks_expires ON public.sync_locks(expires_at);

-- Fonction pour acquérir un verrou
CREATE OR REPLACE FUNCTION acquire_sync_lock(p_lock_key TEXT, p_owner TEXT, p_duration_minutes INTEGER DEFAULT 10)
RETURNS BOOLEAN
LANGUAGE plpgsql
AS $$
BEGIN
  -- Nettoyer les verrous expirés
  DELETE FROM sync_locks WHERE expires_at < now();
  
  -- Essayer d'acquérir le verrou
  INSERT INTO sync_locks (lock_key, owner, expires_at)
  VALUES (p_lock_key, p_owner, now() + (p_duration_minutes || ' minutes')::interval)
  ON CONFLICT (lock_key) DO NOTHING;
  
  -- Vérifier si on a le verrou
  RETURN EXISTS (
    SELECT 1 FROM sync_locks 
    WHERE lock_key = p_lock_key AND owner = p_owner
  );
END;
$$;

-- Fonction pour libérer un verrou
CREATE OR REPLACE FUNCTION release_sync_lock(p_lock_key TEXT, p_owner TEXT)
RETURNS VOID
LANGUAGE plpgsql
AS $$
BEGIN
  DELETE FROM sync_locks 
  WHERE lock_key = p_lock_key AND owner = p_owner;
END;
$$;

-- Ajouter les colonnes pour les index partiels si elles n'existent pas
-- (Normalement elles existent déjà)

-- Index uniques partiels pour éviter les doublons SendCloud
-- Note: On ne les crée pas encore, on les créera après le nettoyage des doublons existants

-- RLS pour dedup_log
ALTER TABLE public.dedup_log ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Admin can view dedup_log" ON public.dedup_log
  FOR SELECT USING (
    EXISTS (
      SELECT 1 FROM user_roles 
      WHERE user_id = auth.uid() AND role = 'admin'
    )
  );

-- RLS pour sync_locks (accessible en service role uniquement)
ALTER TABLE public.sync_locks ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Service role only sync_locks" ON public.sync_locks
  FOR ALL USING (false);

COMMENT ON TABLE public.dedup_log IS 'Journal des opérations de nettoyage des doublons';
COMMENT ON TABLE public.sync_locks IS 'Verrous pour éviter les synchronisations concurrentes';
COMMENT ON FUNCTION acquire_sync_lock IS 'Acquérir un verrou de synchronisation avec expiration automatique';
COMMENT ON FUNCTION release_sync_lock IS 'Libérer un verrou de synchronisation';