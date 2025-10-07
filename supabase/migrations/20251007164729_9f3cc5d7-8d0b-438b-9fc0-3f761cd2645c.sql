-- Supprimer les policies "block_public_*" et "block_anon_*" qui bloquent même les admins
-- Ces policies sont trop restrictives et empêchent les admins d'insérer des données

-- Table client
DROP POLICY IF EXISTS "block_anon_delete_client" ON client;
DROP POLICY IF EXISTS "block_anon_insert_client" ON client;
DROP POLICY IF EXISTS "block_anon_select_client" ON client;
DROP POLICY IF EXISTS "block_anon_update_client" ON client;
DROP POLICY IF EXISTS "block_public_delete_client" ON client;
DROP POLICY IF EXISTS "block_public_insert_client" ON client;
DROP POLICY IF EXISTS "block_public_select_client" ON client;
DROP POLICY IF EXISTS "block_public_update_client" ON client;

-- Table commande
DROP POLICY IF EXISTS "block_anon_delete_commande" ON commande;
DROP POLICY IF EXISTS "block_anon_insert_commande" ON commande;
DROP POLICY IF EXISTS "block_anon_select_commande" ON commande;
DROP POLICY IF EXISTS "block_anon_update_commande" ON commande;
DROP POLICY IF EXISTS "block_public_delete_commande" ON commande;
DROP POLICY IF EXISTS "block_public_insert_commande" ON commande;
DROP POLICY IF EXISTS "block_public_select_commande" ON commande;
DROP POLICY IF EXISTS "block_public_update_commande" ON commande;

-- Table ligne_commande
DROP POLICY IF EXISTS "block_anon_ligne_commande_restrictive" ON ligne_commande;

-- Table produit
DROP POLICY IF EXISTS "block_anon_produit_restrictive" ON produit;

-- Table mouvement_stock
DROP POLICY IF EXISTS "block_anon_mouvement_stock_restrictive" ON mouvement_stock;

-- La sécurité est toujours assurée par:
-- 1. Les policies spécifiques par rôle (admin, client, operateur, gestionnaire)
-- 2. La policy "require_authentication_*" qui force l'authentification