-- Reset to zero : supprimer toutes les commandes existantes
-- Préparation pour une re-sync propre depuis le 2025-10-07

-- Log du reset avant suppression
INSERT INTO audit_log (user_id, action, table_name, record_id, new_data)
VALUES (
  NULL,
  'RESET_TO_ZERO',
  'commande',
  NULL,
  jsonb_build_object(
    'timestamp', NOW(),
    'commandes_supprimees', (SELECT COUNT(*) FROM commande),
    'raison', 'Reset complet pour re-sync propre depuis 2025-10-07'
  )
);

-- Supprimer toutes les lignes de commande
DELETE FROM ligne_commande;

-- Supprimer toutes les commandes
DELETE FROM commande;

-- Supprimer tous les mouvements de stock de type "reserve"
DELETE FROM mouvement_stock WHERE statut_mouvement = 'reserve';