-- Script de nettoyage des doublons existants
-- À exécuter AVANT de créer les index uniques

DO $$
DECLARE
  v_group RECORD;
  v_to_keep UUID;
  v_to_delete UUID[];
  v_deleted_count INTEGER := 0;
BEGIN
  RAISE NOTICE '🧹 Début du nettoyage des doublons...';

  -- 1. Dédoublonner par numero_commande (source sendcloud)
  FOR v_group IN 
    SELECT numero_commande, array_agg(id ORDER BY date_creation DESC, COALESCE((SELECT COUNT(*) FROM ligne_commande WHERE commande_id = commande.id), 0) DESC) as ids
    FROM commande
    WHERE source = 'sendcloud' AND numero_commande IS NOT NULL
    GROUP BY numero_commande
    HAVING COUNT(*) > 1
  LOOP
    v_to_keep := v_group.ids[1];
    v_to_delete := v_group.ids[2:array_length(v_group.ids, 1)];
    
    RAISE NOTICE 'Groupe %: garde %, supprime % commandes', v_group.numero_commande, v_to_keep, array_length(v_to_delete, 1);
    
    -- Logger dans dedup_log
    INSERT INTO dedup_log (numero_commande, kept_id, deleted_ids, raison)
    VALUES (v_group.numero_commande, v_to_keep, v_to_delete, 'Nettoyage automatique par numero_commande');
    
    -- Supprimer les lignes de commande des doublons
    DELETE FROM ligne_commande WHERE commande_id = ANY(v_to_delete);
    
    -- Supprimer les commandes en doublon
    DELETE FROM commande WHERE id = ANY(v_to_delete);
    
    v_deleted_count := v_deleted_count + array_length(v_to_delete, 1);
  END LOOP;

  -- 2. Dédoublonner par sendcloud_id (source sendcloud)
  FOR v_group IN 
    SELECT sendcloud_id, array_agg(id ORDER BY date_creation DESC, COALESCE((SELECT COUNT(*) FROM ligne_commande WHERE commande_id = commande.id), 0) DESC) as ids
    FROM commande
    WHERE source = 'sendcloud' AND sendcloud_id IS NOT NULL
    GROUP BY sendcloud_id
    HAVING COUNT(*) > 1
  LOOP
    v_to_keep := v_group.ids[1];
    v_to_delete := v_group.ids[2:array_length(v_group.ids, 1)];
    
    RAISE NOTICE 'Groupe SendCloud %: garde %, supprime % commandes', v_group.sendcloud_id, v_to_keep, array_length(v_to_delete, 1);
    
    INSERT INTO dedup_log (sendcloud_id, kept_id, deleted_ids, raison)
    VALUES (v_group.sendcloud_id, v_to_keep, v_to_delete, 'Nettoyage automatique par sendcloud_id');
    
    DELETE FROM ligne_commande WHERE commande_id = ANY(v_to_delete);
    DELETE FROM commande WHERE id = ANY(v_to_delete);
    
    v_deleted_count := v_deleted_count + array_length(v_to_delete, 1);
  END LOOP;

  RAISE NOTICE '✅ Nettoyage terminé: % commandes supprimées', v_deleted_count;
END $$;

-- Maintenant créer les index uniques partiels pour éviter les futurs doublons
CREATE UNIQUE INDEX IF NOT EXISTS idx_commande_numero_unique_sendcloud 
  ON commande(numero_commande) 
  WHERE source = 'sendcloud';

CREATE UNIQUE INDEX IF NOT EXISTS idx_commande_sendcloud_id_unique 
  ON commande(sendcloud_id) 
  WHERE source = 'sendcloud' AND sendcloud_id IS NOT NULL;

CREATE UNIQUE INDEX IF NOT EXISTS idx_commande_sendcloud_shipment_id_unique 
  ON commande(sendcloud_shipment_id) 
  WHERE source = 'sendcloud' AND sendcloud_shipment_id IS NOT NULL;

COMMENT ON INDEX idx_commande_numero_unique_sendcloud IS 'Empêche les doublons de numero_commande pour les commandes SendCloud';
COMMENT ON INDEX idx_commande_sendcloud_id_unique IS 'Empêche les doublons de sendcloud_id';
COMMENT ON INDEX idx_commande_sendcloud_shipment_id_unique IS 'Empêche les doublons de sendcloud_shipment_id';

-- Logs de résultat
DO $$
DECLARE
  v_log_count INTEGER;
BEGIN
  SELECT COUNT(*) INTO v_log_count FROM dedup_log;
  RAISE NOTICE '📊 Total groupes de doublons nettoyés: %', v_log_count;
END $$;