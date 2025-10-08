-- Enrichir la table sendcloud_sync_log avec nouveaux champs
ALTER TABLE sendcloud_sync_log 
ADD COLUMN IF NOT EXISTS nb_produits_crees INTEGER DEFAULT 0,
ADD COLUMN IF NOT EXISTS nb_statuts_mis_a_jour INTEGER DEFAULT 0,
ADD COLUMN IF NOT EXISTS mode_sync VARCHAR(20) DEFAULT 'initial';

-- Archiver les commandes avant le 7 octobre 2025 déjà expédiées/livrées
UPDATE commande
SET statut_wms = 'Archivé'
WHERE date_creation < '2025-10-07'
  AND statut_wms IN ('Expédié', 'Livré', 'En cours de livraison')
  AND statut_wms != 'Archivé';

-- Configurer pg_cron pour synchronisation automatique toutes les 5 minutes
SELECT cron.schedule(
  'sendcloud-sync-incremental',
  '*/5 * * * *',
  $$
  SELECT net.http_post(
    url:='https://tggdjeoxvpzbigbikpfy.supabase.co/functions/v1/sendcloud-sync-orders',
    headers:='{"Content-Type": "application/json", "Authorization": "Bearer eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InRnZ2RqZW94dnB6YmlnYmlrcGZ5Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3NTkyMzY3MjYsImV4cCI6MjA3NDgxMjcyNn0.f9yoHVsRDvlUHv14N46qNFphPDBFMf0C0XzEoo26AWA"}'::jsonb,
    body:='{"mode": "incremental"}'::jsonb
  ) as request_id;
  $$
);

-- Configurer pg_cron pour mise à jour des statuts expédiés toutes les 10 minutes
SELECT cron.schedule(
  'sendcloud-update-shipped',
  '*/10 * * * *',
  $$
  SELECT net.http_post(
    url:='https://tggdjeoxvpzbigbikpfy.supabase.co/functions/v1/sendcloud-update-shipped-orders',
    headers:='{"Content-Type": "application/json", "Authorization": "Bearer eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InRnZ2RqZW94dnB6YmlnYmlrcGZ5Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3NTkyMzY3MjYsImV4cCI6MjA3NDgxMjcyNn0.f9yoHVsRDvlUHv14N46qNFphPDBFMf0C0XzEoo26AWA"}'::jsonb
  ) as request_id;
  $$
);

COMMENT ON TABLE sendcloud_sync_log IS 'Logs enrichis de synchronisation SendCloud avec mode, produits créés et statuts mis à jour';