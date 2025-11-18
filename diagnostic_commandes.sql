-- ============================================================
-- SCRIPT DE DIAGNOSTIC - Erreur récupération commandes
-- ============================================================
-- Exécutez ce script dans Supabase SQL Editor pour identifier
-- la cause exacte de l'erreur
-- ============================================================

\echo '========================================'
\echo '  DIAGNOSTIC COMPLET COMMANDES'
\echo '========================================'
\echo ''

-- ============================================================
-- 1. VÉRIFIER LA STRUCTURE DE LA TABLE
-- ============================================================
\echo '1. Structure de la table commande:'
SELECT
  column_name,
  data_type,
  is_nullable,
  column_default
FROM information_schema.columns
WHERE table_schema = 'public'
  AND table_name = 'commande'
ORDER BY ordinal_position;

\echo ''
\echo '2. Colonnes critiques manquantes:'
SELECT
  CASE
    WHEN EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'commande' AND column_name = 'client_id')
    THEN '✅ client_id existe'
    ELSE '❌ client_id MANQUANT'
  END as col_client_id,
  CASE
    WHEN EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'commande' AND column_name = 'sendcloud_shipment_id')
    THEN '✅ sendcloud_shipment_id existe'
    ELSE '⚠️ sendcloud_shipment_id manquant'
  END as col_sendcloud_shipment_id,
  CASE
    WHEN EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'commande' AND column_name = 'tracking_number')
    THEN '✅ tracking_number existe'
    ELSE '⚠️ tracking_number manquant'
  END as col_tracking_number,
  CASE
    WHEN EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'commande' AND column_name = 'label_url')
    THEN '✅ label_url existe'
    ELSE '⚠️ label_url manquant'
  END as col_label_url;

-- ============================================================
-- 2. VÉRIFIER LA CONTRAINTE CHECK DES STATUTS
-- ============================================================
\echo ''
\echo '3. Contrainte CHECK statut_wms:'
SELECT
  conname,
  pg_get_constraintdef(oid) as definition
FROM pg_constraint
WHERE conname = 'commande_statut_wms_check';

-- ============================================================
-- 3. VÉRIFIER LES RLS POLICIES
-- ============================================================
\echo ''
\echo '4. RLS activé sur commande:'
SELECT
  tablename,
  rowsecurity as rls_enabled
FROM pg_tables
WHERE schemaname = 'public' AND tablename = 'commande';

\echo ''
\echo '5. Policies RLS sur commande:'
SELECT
  schemaname,
  tablename,
  policyname,
  permissive,
  roles,
  cmd,
  qual
FROM pg_policies
WHERE schemaname = 'public' AND tablename = 'commande'
ORDER BY policyname;

-- ============================================================
-- 4. COMPTER LES COMMANDES
-- ============================================================
\echo ''
\echo '6. Nombre de commandes par statut (sans RLS):'
SET LOCAL ROLE postgres; -- Bypass RLS temporairement
SELECT
  statut_wms,
  COUNT(*) as count
FROM commande
GROUP BY statut_wms
ORDER BY count DESC;

\echo ''
\echo '7. Nombre de commandes par source:'
SELECT
  source,
  COUNT(*) as count
FROM commande
GROUP BY source;

\echo ''
\echo '8. Commandes avec client_id NULL:'
SELECT
  COUNT(*) as total_commandes,
  COUNT(client_id) as avec_client_id,
  COUNT(*) - COUNT(client_id) as sans_client_id,
  ROUND(100.0 * (COUNT(*) - COUNT(client_id)) / NULLIF(COUNT(*), 0), 2) as pct_sans_client_id
FROM commande;

-- ============================================================
-- 5. TESTER LA RÉCUPÉRATION
-- ============================================================
\echo ''
\echo '9. Test SELECT basique (5 commandes):'
SELECT
  id,
  numero_commande,
  statut_wms,
  client_id,
  source,
  date_creation
FROM commande
ORDER BY date_creation DESC
LIMIT 5;

-- ============================================================
-- 6. VÉRIFIER LES TRIGGERS
-- ============================================================
\echo ''
\echo '10. Triggers actifs sur commande:'
SELECT
  trigger_name,
  event_manipulation,
  action_timing,
  action_statement
FROM information_schema.triggers
WHERE event_object_table = 'commande'
ORDER BY trigger_name;

-- ============================================================
-- 7. VÉRIFIER LES FONCTIONS PROBLÉMATIQUES
-- ============================================================
\echo ''
\echo '11. Fonction has_role existe:'
SELECT
  CASE
    WHEN EXISTS (SELECT 1 FROM pg_proc WHERE proname = 'has_role')
    THEN '✅ has_role() existe'
    ELSE '❌ has_role() MANQUANTE'
  END as func_has_role;

-- ============================================================
-- 8. TEST RLS AVEC UTILISATEUR ACTUEL
-- ============================================================
\echo ''
\echo '12. Utilisateur actuel:'
SELECT
  current_user as user_name,
  session_user,
  current_database();

\echo ''
\echo '13. Test accès avec RLS (as authenticated user):'
SET LOCAL ROLE authenticated;
SELECT COUNT(*) as commandes_visibles_avec_rls FROM commande;

\echo ''
\echo '========================================'
\echo '  FIN DU DIAGNOSTIC'
\echo '========================================'

-- Reset role
RESET ROLE;
