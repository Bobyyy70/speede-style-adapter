# 🚨 RÉSUMÉ DES PROBLÈMES SENDCLOUD - WMS Speed E-Log

## ⚠️ PROBLÈME CRITIQUE: Timeout CPU et Rate Limiting

### Symptômes observés
- **Les commandes ne remontent pas correctement** depuis SendCloud vers le WMS
- **Données manquantes**: Transporteurs, produits, expéditeur, retours, étiquettes
- **Erreurs systématiques** dans les logs de synchronisation

---

## 🔍 ANALYSE TECHNIQUE DES LOGS

### 1. Fonction `sendcloud-sync-orders` - ÉCHEC SYSTÉMATIQUE

**Erreurs critiques détectées:**
```
- "CPU Time exceeded" (timeout après ~10 secondes)
- "429 Too Many Requests" (rate limiting SendCloud)
- Tentative de traiter 2500+ parcels en un seul appel
- Batch 252/500 atteint avant timeout
```

**Cause racine:**
La fonction essaie de récupérer et enrichir **trop de commandes en une seule exécution**:
- Fetch de 500 pages de 10 parcels = 5000 parcels potentiels
- Pour chaque parcel: 1 appel API SendCloud pour enrichir les détails
- Rate limit SendCloud atteint rapidement (429 errors)
- CPU timeout Edge Function (limite 10s) dépassé

**Impact:**
- ❌ Les nouvelles commandes ne sont jamais importées
- ❌ Les statuts ne sont pas mis à jour
- ❌ Les données restent dans SendCloud, invisibles dans le WMS

---

### 2. Données manquantes - NON IMPORTÉES

#### 2.1 Transporteurs (`sendcloud-import-carriers`)
**Statut:** ⚠️ Fonction existe mais pas d'exécution visible dans les logs
**Conséquence:** 
- Aucun transporteur disponible dans le WMS
- Impossible de sélectionner un transporteur pour les commandes
- Règles d'expédition non fonctionnelles

#### 2.2 Produits (`sendcloud-import-products`)
**Statut:** ⚠️ Fonction existe mais synchronisation problématique
**Problèmes identifiés:**
- Mapping produit SendCloud ↔ WMS incomplet
- Pas de lien automatique entre produits SendCloud et produits clients
- `sendcloud_product_mapping` table existe mais vide

**Conséquence:**
- Produits SendCloud non visibles dans le WMS
- Lignes de commande (`ligne_commande`) manquantes ou incomplètes
- Stock non synchronisé

#### 2.3 Informations expéditeur
**Statut:** ❌ Non géré dans le code actuel
**Manquant:**
- Table `expediteur` ou `sender_config` non peuplée depuis SendCloud
- Pas de fonction d'import des informations expéditeur
- Configuration expéditeur uniquement manuelle dans le WMS

#### 2.4 Retours (`sendcloud-create-return`)
**Statut:** ⚠️ Fonction existe mais dépendante des commandes
**Problème:**
- Si les commandes ne remontent pas, impossible de créer des retours
- Pas de fonction d'import des retours existants depuis SendCloud
- Workflow retour unidirectionnel (WMS → SendCloud uniquement)

#### 2.5 Étiquettes
**Statut:** ⚠️ Génération possible mais récupération problématique
**Problèmes:**
- `sendcloud-fetch-documents` existe pour télécharger les étiquettes
- Mais si la commande n'est pas dans le WMS, pas d'étiquette associée
- Pas de synchronisation automatique des étiquettes existantes

---

## 🛠️ SOLUTIONS NÉCESSAIRES

### Priorité 1: CORRIGER LA SYNCHRONISATION DES COMMANDES

**Actions requises:**

1. **Réduire le batch size** dans `sendcloud-sync-orders`
   - Passer de 500 pages → 10-20 pages maximum par exécution
   - Ajouter un système de pagination persistant (cursor/offset)
   - Implémenter un job CRON pour exécutions multiples

2. **Gérer le rate limiting SendCloud**
   - Ajouter des délais entre les appels API (100-200ms)
   - Implémenter un exponential backoff sur erreurs 429
   - Limiter les enrichissements à 50 parcels par batch maximum

3. **Optimiser les appels API**
   - Utiliser l'API V3 Orders prioritairement (moins d'appels nécessaires)
   - Ne pas enrichir tous les parcels, utiliser les données de base
   - Mettre en cache les informations transporteur/shipping method

**Code à modifier:**
```typescript
// Dans sendcloud-sync-orders/index.ts
- const TOTAL_PAGES = 500; // ❌ TROP
+ const BATCH_SIZE = 10;   // ✅ Exécutions multiples
+ const MAX_ENRICHMENTS_PER_RUN = 50; // ✅ Rate limit friendly
```

### Priorité 2: IMPORTER LES DONNÉES DE RÉFÉRENCE

**2.1 Transporteurs et services d'expédition**
```bash
# Exécuter ces fonctions AVANT de synchroniser les commandes
1. Appeler sendcloud-import-carriers
2. Appeler sendcloud-import-shipping-methods
3. Vérifier les tables transporteur_configuration et transporteur_service
```

**2.2 Produits SendCloud**
```bash
1. Appeler sendcloud-import-products
2. Créer un mapping manuel SKU SendCloud ↔ SKU WMS si nécessaire
3. Vérifier la table sendcloud_product_mapping
```

**2.3 Informations expéditeur**
```sql
-- CRÉER une fonction sendcloud-import-senders
-- Récupérer depuis GET /api/v2/user/sender-addresses
-- Insérer dans table expediteur_configuration
```

### Priorité 3: SYNCHRONISATION BIDIRECTIONNELLE

**Actuellement:** WMS → SendCloud uniquement (création parcels)
**Requis:** SendCloud ↔ WMS (sync statuts, retours, étiquettes)

**À implémenter:**
1. Webhook handler robuste (`sendcloud-webhook`) avec retry logic
2. Background job pour récupérer les mises à jour manquées
3. Sync des retours existants depuis SendCloud
4. Téléchargement automatique des étiquettes générées

---

## 📊 ÉTAT ACTUEL DES TABLES

### Tables critiques à vérifier:

```sql
-- Commandes importées depuis SendCloud
SELECT COUNT(*) FROM commande WHERE source = 'sendcloud';
-- Attendu: 100-1000+ selon volume
-- Actuel: Probablement 0 ou très peu

-- Transporteurs disponibles
SELECT COUNT(*) FROM transporteur_configuration;
-- Attendu: 20-50 transporteurs
-- Actuel: Probablement 0

-- Services d'expédition
SELECT COUNT(*) FROM transporteur_service;
-- Attendu: 100-500 services
-- Actuel: Probablement 0

-- Produits SendCloud mappés
SELECT COUNT(*) FROM sendcloud_product_mapping;
-- Attendu: Tous les produits clients
-- Actuel: Probablement 0

-- Logs de sync
SELECT * FROM sendcloud_sync_log ORDER BY sync_date DESC LIMIT 10;
-- Vérifier les erreurs et les counts
```

---

## 🎯 CHECKLIST DE RÉSOLUTION

- [ ] **Corriger sendcloud-sync-orders** (timeout + rate limit)
- [ ] **Exécuter sendcloud-import-carriers** (une fois)
- [ ] **Exécuter sendcloud-import-shipping-methods** (une fois)
- [ ] **Exécuter sendcloud-import-products** (une fois)
- [ ] **Créer sendcloud-import-senders** (nouveau)
- [ ] **Configurer CRON job** pour sync régulière (toutes les 15 min)
- [ ] **Tester webhook SendCloud** (réception statuts)
- [ ] **Vérifier sendcloud-fetch-documents** (étiquettes)
- [ ] **Implémenter sync retours** SendCloud → WMS
- [ ] **Créer interface admin** pour vérifier les syncs

---

## 📝 LOGS D'ERREUR À PARTAGER

**Logs critiques observés:**
```
[Batch 252/500] Processing 10 parcels...
[Parcel 570150266] ⚠️ Detail fetch failed (429), using summary data
[Parcel 569468482] ⚠️ Detail fetch failed (429), using summary data
...
CPU Time exceeded
shutdown
```

**Interprétation:**
- La fonction a traité ~2520 parcels avant timeout
- 1551+ erreurs de rate limiting (429)
- Seulement 969 parcels enrichis sur 2520 tentatives
- Pas de commit final des données en base (rollback sur timeout)

---

## 🔗 FICHIERS À EXAMINER

### Edge Functions problématiques:
1. `supabase/functions/sendcloud-sync-orders/index.ts` ⚠️ CRITIQUE
2. `supabase/functions/sendcloud-webhook/index.ts` ⚠️ 
3. `supabase/functions/sendcloud-import-carriers/index.ts` ℹ️
4. `supabase/functions/sendcloud-import-shipping-methods/index.ts` ℹ️
5. `supabase/functions/sendcloud-import-products/index.ts` ℹ️
6. `supabase/functions/sendcloud-orders-batch/index.ts` ℹ️

### Composants UI affectés:
1. `src/pages/SendCloudSync.tsx` - Interface de monitoring
2. `src/components/SendCloudActions.tsx` - Boutons d'action
3. `src/pages/Commandes.tsx` - Liste des commandes vide
4. `src/pages/Transporteurs.tsx` - Aucun transporteur
5. `src/pages/Expedition.tsx` - Configuration impossible

---

## ⏱️ ESTIMATION TEMPS DE CORRECTION

**Quick fix (urgent):**
- Corriger le timeout sendcloud-sync-orders: **2-4 heures**
- Importer les transporteurs/services: **1 heure**
- Tester une sync complète: **1 heure**
- **TOTAL: 1 journée de travail**

**Solution complète:**
- Refactoring complet de la sync: **3-5 jours**
- Tests et validation: **2 jours**
- Documentation: **1 jour**
- **TOTAL: 1-2 semaines**

---

## 🆘 CONTACT SENDCLOUD API

**Documentation à consulter:**
- API V3 Orders: https://developers.sendcloud.com/v3/api-reference/orders
- Rate Limits: https://developers.sendcloud.com/docs/rate-limiting
- Webhooks: https://developers.sendcloud.com/docs/webhooks

**Limites connues SendCloud:**
- Rate limit: ~100 requests/minute
- Parcels API: Pagination max 100 items
- Orders API: Plus efficace mais nécessite SendCloud Shipping

---

**Document généré le:** 2025-01-XX  
**Projet:** WMS Speed E-Log  
**Version:** 1.0  
**Urgence:** 🔴 CRITIQUE
