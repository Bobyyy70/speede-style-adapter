# 🚀 Intégration SendCloud - Architecture Technique

## Vue d'Ensemble

Le WMS Speed E-Log intègre SendCloud pour automatiser la gestion des expéditions via :
- **Import automatique** des commandes SendCloud → Supabase
- **Synchronisation bidirectionnelle** des produits
- **Génération d'étiquettes** via API SendCloud
- **Tracking en temps réel** des colis

---

## Architecture des Edge Functions

### 1. Synchronisation des Commandes
**Fonction** : `sendcloud-sync-orders`
- **Rôle** : Import périodique des commandes SendCloud
- **Mode** : `incremental` (dernières 24h) ou `full` (tout l'historique)
- **Verrou** : TTL 20 minutes pour éviter les doublons
- **Output** : Crée/met à jour les entrées dans `commande`

**Flow** :
1. Acquisition du verrou de sync
2. Appel API SendCloud V3 Orders (ou V2 Parcels en fallback)
3. Déduplication par `sendcloud_id` et `numero_commande`
4. Batch processing via `sendcloud-orders-batch`
5. Logging dans `sendcloud_sync_logs`
6. Libération du verrou

**Code simplifié** :
```typescript
const { data: lockResult } = await supabase.rpc('acquire_sync_lock', {
  p_lock_key: 'sendcloud-sync',
  p_owner: crypto.randomUUID(),
  p_ttl_minutes: 20
});

if (!lockResult) {
  return { error: 'Sync already running' };
}

// Fetch orders from SendCloud API
const orders = await fetchSendCloudOrders(mode, startDate);

// Process in batches
await supabase.functions.invoke('sendcloud-orders-batch', {
  body: { orders }
});
```

---

### 2. Dead Letter Queue (DLQ)
**Fonction** : `sendcloud-dlq-handler`
- **Rôle** : Rejouer les messages en erreur
- **Trigger** : CRON toutes les 10 minutes
- **Retry** : Max 3 tentatives avec backoff exponentiel (5min, 10min, 20min)

**Flux DLQ** :
```
┌───────────────┐
│ Sync échoue   │
└───────┬───────┘
        │
        v
┌───────────────────┐
│ Push to DLQ       │
│ status: pending   │
└───────┬───────────┘
        │
        │ (CRON 10min)
        v
┌───────────────────┐
│ DLQ Handler       │
│ retry_count++     │
└───────┬───────────┘
        │
    ┌───┴───┐
    │       │
    v       v
┌───────┐ ┌────────┐
│Success│ │Failure │
│(done) │ │(retry) │
└───────┘ └────────┘
```

---

### 3. Setup Initial
**Fonction** : `sendcloud-initial-setup`
- **Rôle** : Orchestration de l'import initial complet
- **Étapes** :
  1. Test de connexion SendCloud
  2. Import des transporteurs
  3. Import des méthodes d'expédition
  4. Sync des produits (tous)
  5. Import des 100 dernières commandes

**Utilisation** :
- Appelé depuis l'onboarding wizard (étape SendCloud)
- Durée estimée : 2-5 minutes selon le volume
- Logs détaillés dans `sendcloud_sync_logs`

---

## Configuration Requise

### Variables d'environnement
```bash
SENDCLOUD_API_PUBLIC_KEY=your_public_key
SENDCLOUD_API_SECRET_KEY=your_secret_key
SUPABASE_URL=https://[project].supabase.co
SUPABASE_SERVICE_ROLE_KEY=your_service_key
```

### Tables Supabase

#### `commande`
Colonnes clés :
- `sendcloud_id` : ID du parcel SendCloud
- `numero_commande` : Numéro de commande client
- `statut_wms` : Statut interne (enum)
- `tracking_number` : Numéro de suivi transporteur
- `service_transport` : Nom du service transport SendCloud
- `methode_expedition` : Méthode d'expédition
- `transporteur_choisi` : Code transporteur

#### `sendcloud_sync_logs`
Logs de synchronisation :
- `run_id` : UUID unique du run
- `job` : Type de sync (orders, products, etc.)
- `status` : running | success | partial | error
- `batch_count` / `item_count` : Volumétrie
- `started_at` / `finished_at` : Timestamps

#### `sendcloud_dlq`
Dead Letter Queue :
- `event_type` : order_sync | product_sync
- `payload` : JSON du message original
- `retry_count` : Nombre de tentatives
- `status` : pending | retrying | success | failed

---

## Résolution de Problèmes

### ❌ Erreur : "Verrou déjà pris"
**Cause** : Une sync est déjà en cours
**Solution** :
1. Attendre la fin de la sync en cours (max 20 min)
2. Le système tente automatiquement un retry après 30 secondes
3. Si bloqué, libérer manuellement :
```sql
DELETE FROM sync_locks WHERE lock_key = 'sendcloud-sync';
```

### ❌ Erreur : "Column 'service_transport' does not exist"
**Cause** : Migration manquante (normalement déjà appliquée)
**Solution** :
```sql
ALTER TABLE commande ADD COLUMN IF NOT EXISTS service_transport TEXT;
CREATE INDEX IF NOT EXISTS idx_commande_service_transport ON commande(service_transport);
```

### ❌ DLQ handler ne rejoue pas les messages
**Cause** : CRON pas activé
**Solution** : Vérifier dans le backend → Database → Cron Jobs

---

## API SendCloud Utilisées

### V3 Orders API
- **Endpoint** : `https://panel.sendcloud.sc/api/v3/orders`
- **Paramètres** : `created_at__gte`, `created_at__lte`, `updated_at__gte`
- **Limite** : 100 résultats/page

### V2 Parcels API (fallback)
- **Endpoint** : `https://panel.sendcloud.sc/api/v2/parcels`
- **Paramètres** : `created_date_from`, `updated_after`
- **Limite** : 100 résultats/page

### V2 Parcel Detail
- **Endpoint** : `https://panel.sendcloud.sc/api/v2/parcels/{id}`
- **Usage** : Enrichissement des parcels pour mapping complet

---

## Monitoring

### Métriques Clés
- **Taux de succès** : % de syncs réussies vs erreurs
- **Durée moyenne** : Temps de traitement par sync
- **Volumétrie** : Items traités par jour

### Dashboard Analytics
Accès : `/integrations/sendcloud/dashboard`

Graphiques disponibles :
1. **Performance Timeline** : Évolution sur 7 jours
2. **Success Rate** : Répartition success/partial/error
3. **Volume by Job** : Comparaison par type de job

---

## Maintenance

### Nettoyage des logs (recommandé mensuel)
```sql
-- Supprimer les logs > 90 jours
DELETE FROM sendcloud_sync_logs 
WHERE finished_at < NOW() - INTERVAL '90 days';

-- Archiver les DLQ résolues > 30 jours
DELETE FROM sendcloud_dlq 
WHERE status IN ('success', 'failed') 
  AND processed_at < NOW() - INTERVAL '30 days';
```

### Optimisation des index
```sql
-- Index sur les colonnes de recherche fréquentes
CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_commande_sendcloud_lookup
ON commande(sendcloud_id, statut_wms, date_creation DESC);

CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_sync_logs_recent
ON sendcloud_sync_logs(job, status, started_at DESC);
```

---

## Contact Support
- **Docs SendCloud** : https://docs.sendcloud.com/
- **Support Technique** : Contact administrateur système
