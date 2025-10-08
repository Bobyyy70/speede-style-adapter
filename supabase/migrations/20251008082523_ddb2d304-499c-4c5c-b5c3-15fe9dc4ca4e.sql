-- Ajouter contraintes d'unicité pour éliminer les doublons
-- Note: La contrainte partielle nécessite une condition WHERE
CREATE UNIQUE INDEX IF NOT EXISTS idx_commande_sendcloud_id_unique 
ON commande(sendcloud_id) 
WHERE source = 'sendcloud' AND sendcloud_id IS NOT NULL;

CREATE UNIQUE INDEX IF NOT EXISTS idx_commande_source_numero_unique 
ON commande(source, numero_commande);

-- Ajouter index pour améliorer les performances des queries
CREATE INDEX IF NOT EXISTS idx_commande_date_creation ON commande(date_creation DESC);
CREATE INDEX IF NOT EXISTS idx_commande_statut_wms ON commande(statut_wms);

-- Script de nettoyage doux des doublons historiques (OPTIONNEL - ne sera pas exécuté)
-- Ce script identifie les doublons et marque les plus anciens comme "Archivé"
-- À exécuter manuellement uniquement sur demande explicite de l'utilisateur

-- COMMENTÉ: Ne pas exécuter automatiquement
/*
WITH doublons_sendcloud AS (
  SELECT 
    sendcloud_id,
    ARRAY_AGG(id ORDER BY date_creation DESC) as ids
  FROM commande
  WHERE sendcloud_id IS NOT NULL AND source = 'sendcloud'
  GROUP BY sendcloud_id
  HAVING COUNT(*) > 1
),
doublons_numero AS (
  SELECT 
    source,
    numero_commande,
    ARRAY_AGG(id ORDER BY date_creation DESC) as ids
  FROM commande
  GROUP BY source, numero_commande
  HAVING COUNT(*) > 1
),
ids_a_archiver AS (
  SELECT UNNEST(ids[2:]) as id FROM doublons_sendcloud
  UNION
  SELECT UNNEST(ids[2:]) as id FROM doublons_numero
)
UPDATE commande
SET 
  statut_wms = 'Archivé',
  remarques = COALESCE(remarques || E'\n', '') || 'Doublon archivé automatiquement le ' || NOW()::date
WHERE id IN (SELECT id FROM ids_a_archiver);
*/