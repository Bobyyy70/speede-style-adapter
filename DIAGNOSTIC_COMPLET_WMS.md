# 🔥 DIAGNOSTIC COMPLET - WMS Speed E-Log
## Tous les problèmes critiques identifiés

**Date:** Janvier 2025  
**Version:** 1.0 - Compilation complète  
**Urgence globale:** 🔴 CRITIQUE

---

## 📋 RÉSUMÉ EXÉCUTIF

Le système WMS Speed E-Log présente **trois catégories de problèmes critiques** qui rendent le système **PARTIELLEMENT OU TOTALEMENT INUTILISABLE** pour la majorité des utilisateurs:

### Impact global
- **80% des utilisateurs clients** ne peuvent voir AUCUNE donnée (commandes, produits, mouvements)
- **0% de synchronisation** réussie avec SendCloud (commandes, transporteurs, produits)
- **Fonctionnalités bloquées:** Commandes, Expédition, Retours, Étiquettes

### Catégories de problèmes
1. 🔴 **CRITIQUE:** Assignation client_id manquante → 80% utilisateurs bloqués
2. 🔴 **CRITIQUE:** API SendCloud timeout/rate limit → 0% sync réussie
3. ⚠️ **IMPORTANT:** RLS policies potentiellement mal configurées

---

# PARTIE 1: PROBLÈME ASSIGNATION CLIENT_ID

## 🚨 Problème critique: Utilisateurs clients sans client_id

### Symptômes
- Les utilisateurs clients se connectent mais voient des pages vides
- Message toast "Erreur lors du chargement" systématique
- Aucune commande, produit, mouvement visible dans l'interface
- Le système semble fonctionner pour les admins mais pas pour les clients

### Analyse technique

#### État actuel de la base de données
```sql
-- 80% des profils utilisateurs n'ont PAS de client_id
SELECT 
  COUNT(*) as total_users,
  COUNT(client_id) as users_with_client,
  COUNT(*) - COUNT(client_id) as users_without_client,
  ROUND(100.0 * COUNT(client_id) / COUNT(*), 2) as percentage_with_client
FROM profiles;

-- Résultat observé:
-- total_users: 10
-- users_with_client: 2
-- users_without_client: 8
-- percentage_with_client: 20%
```

#### Pourquoi c'est bloquant

**Tous les composants clients filtrent par client_id:**

1. **MesCommandes.tsx** (ligne 20):
```typescript
const { data: commandes } = useQuery({
  queryKey: ['commandes', profile?.client_id],
  queryFn: async () => {
    const { data, error } = await supabase
      .from('commande')
      .select('*')
      .eq('client_id', profile?.client_id)  // ❌ NULL = aucun résultat
  }
})
```

2. **MesProduits.tsx** (ligne 18):
```typescript
const { data: produits } = useQuery({
  queryKey: ['produits', profile?.client_id],
  queryFn: async () => {
    const { data, error } = await supabase
      .from('produit')
      .select('*')
      .eq('client_id', profile?.client_id)  // ❌ NULL = aucun résultat
  }
})
```

3. **MesMouvements.tsx** (ligne 16):
```typescript
const { data: mouvements } = useQuery({
  queryKey: ['mouvements', profile?.client_id],
  queryFn: async () => {
    const { data, error } = await supabase
      .from('mouvement_stock')
      .select('*')
      .eq('client_id', profile?.client_id)  // ❌ NULL = aucun résultat
  }
})
```

**RLS Policies bloquent également l'accès:**
```sql
-- Exemple de policy qui échoue si client_id est NULL
CREATE POLICY "Client read own commande"
ON commande FOR SELECT
USING (
  has_role(auth.uid(), 'client') 
  AND client_id IN (
    SELECT client_id FROM profiles WHERE id = auth.uid()
  )
);
-- Si profile.client_id = NULL, la sous-requête retourne NULL
-- Donc AUCUNE commande n'est accessible
```

### Cause racine

**Aucun mécanisme d'assignation automatique:**
- ❌ Pas de trigger sur `auth.users` pour assigner un client_id
- ❌ Pas de fonction lors de la création du profil
- ❌ Pas d'interface admin pour assigner manuellement
- ❌ Pas de workflow d'onboarding pour les nouveaux utilisateurs

**Le système attend que client_id soit rempli, mais ne le remplit jamais.**

### Impact utilisateurs

**Pour un utilisateur client type:**
1. ✅ Peut se connecter au système
2. ✅ Voit la navigation et l'interface
3. ❌ Voit "0 commandes", "0 produits", "0 mouvements"
4. ❌ Reçoit des erreurs toast constamment
5. ❌ Ne peut pas créer de commande (RLS bloque)
6. ❌ Ne peut pas créer d'attendu (RLS bloque)
7. ❌ Le WMS est complètement inutilisable

**Exemple concret:**
```
Utilisateur: Jean Dupont
Email: jean@exemple.fr
Rôle: client ✅
Client ID: NULL ❌
Entreprise cliente: Acme Corp

Résultat:
- Jean ne voit aucune commande d'Acme Corp
- Jean ne peut pas créer de commande pour Acme Corp
- Jean ne voit aucun produit d'Acme Corp
- Jean ne voit aucun mouvement de stock d'Acme Corp
- Le système est inutilisable pour Jean
```

### Solutions requises

#### Solution 1: Interface admin (URGENT - 2-4h)
Créer `src/pages/admin/AssignClientToUser.tsx`:
```typescript
// Interface pour lister tous les utilisateurs
// Afficher leur client_id actuel (ou "Non assigné")
// Permettre de sélectionner un client dans une liste
// Bouton "Assigner" qui update profiles.client_id
// Afficher un récapitulatif des assignations
```

**Fonctionnalités:**
- Liste tous les profils avec statut client_id
- Dropdown pour sélectionner un client existant
- Bouton "Assigner" avec confirmation
- Filtre par rôle (client/admin/operateur)
- Recherche par email/nom
- Indicateur visuel des utilisateurs sans client_id

#### Solution 2: Trigger automatique (IMPORTANT - 1-2h)
```sql
-- Option A: Assigner au premier client créé (pour tests)
CREATE OR REPLACE FUNCTION assign_default_client_id()
RETURNS TRIGGER AS $$
DECLARE
  default_client_id UUID;
BEGIN
  -- Si le profil a déjà un client_id, ne rien faire
  IF NEW.client_id IS NOT NULL THEN
    RETURN NEW;
  END IF;
  
  -- Si l'utilisateur a le rôle client, assigner un client
  IF EXISTS (
    SELECT 1 FROM user_roles 
    WHERE user_id = NEW.id AND role = 'client'
  ) THEN
    -- Récupérer le premier client disponible (à adapter selon logique métier)
    SELECT id INTO default_client_id 
    FROM client 
    WHERE actif = true 
    ORDER BY date_creation ASC 
    LIMIT 1;
    
    IF default_client_id IS NOT NULL THEN
      NEW.client_id := default_client_id;
    END IF;
  END IF;
  
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

CREATE TRIGGER assign_client_on_profile_create
  BEFORE INSERT ON profiles
  FOR EACH ROW
  EXECUTE FUNCTION assign_default_client_id();
```

**Note:** Cette solution nécessite une logique métier pour déterminer QUEL client assigner. Options:
- Assigner selon le domaine email (ex: @acme.com → Acme Corp)
- Assigner selon un code d'invitation
- Assigner manuellement via l'interface admin
- Créer un client automatiquement pour chaque nouvel utilisateur

#### Solution 3: Workflow d'onboarding (MOYEN TERME - 1-2 jours)
Créer un processus guidé pour les nouveaux utilisateurs:
```typescript
// Après signup, rediriger vers /onboarding
// Étape 1: Sélectionner une entreprise existante OU créer une nouvelle
// Étape 2: Valider les informations
// Étape 3: Admin valide et assigne le client_id
// Redirection vers le dashboard
```

#### Solution 4: Migration des utilisateurs existants (URGENT - 30min)
```sql
-- Script de migration pour les 8 utilisateurs sans client_id
-- À exécuter APRÈS avoir déterminé la logique d'assignation

-- Exemple: Assigner tous les utilisateurs client au même client pour tests
UPDATE profiles
SET client_id = (SELECT id FROM client WHERE nom_entreprise = 'Client Test' LIMIT 1)
WHERE client_id IS NULL
  AND id IN (SELECT user_id FROM user_roles WHERE role = 'client');

-- OU: Créer un client par utilisateur
DO $$
DECLARE
  profile_record RECORD;
  new_client_id UUID;
BEGIN
  FOR profile_record IN 
    SELECT * FROM profiles WHERE client_id IS NULL
  LOOP
    -- Créer un client
    INSERT INTO client (nom_entreprise, email, actif)
    VALUES (
      COALESCE(profile_record.nom_complet, profile_record.email),
      profile_record.email,
      true
    )
    RETURNING id INTO new_client_id;
    
    -- Assigner le client_id
    UPDATE profiles
    SET client_id = new_client_id
    WHERE id = profile_record.id;
  END LOOP;
END $$;
```

---

# PARTIE 2: PROBLÈME API SENDCLOUD

## 🚨 Problème critique: Timeout et Rate Limiting

### Symptômes observés
- **Les commandes ne remontent pas correctement** depuis SendCloud vers le WMS
- **Données manquantes**: Transporteurs, produits, expéditeur, retours, étiquettes
- **Erreurs systématiques** dans les logs de synchronisation

### Analyse technique des logs

#### Fonction `sendcloud-sync-orders` - ÉCHEC SYSTÉMATIQUE

**Erreurs critiques détectées:**
```
- "CPU Time exceeded" (timeout après ~10 secondes)
- "429 Too Many Requests" (rate limiting SendCloud)
- Tentative de traiter 2500+ parcels en un seul appel
- Batch 252/500 atteint avant timeout
```

**Logs observés:**
```
[Batch 252/500] Processing 10 parcels...
[Parcel 570150266] ⚠️ Detail fetch failed (429), using summary data
[Parcel 569468482] ⚠️ Detail fetch failed (429), using summary data
...
CPU Time exceeded
shutdown
```

**Statistiques d'échec:**
- Parcels traités avant timeout: ~2520
- Erreurs de rate limiting (429): 1551+
- Parcels enrichis avec succès: 969 / 2520 (38%)
- Données commitées en base: **0** (rollback sur timeout)

**Cause racine:**
```typescript
// Dans sendcloud-sync-orders/index.ts (ACTUEL)
const TOTAL_PAGES = 500; // ❌ TROP - essaie de fetch 5000 parcels
const BATCH_SIZE = 10;

// Pour chaque parcel, un appel API pour enrichir:
for (const parcel of parcels) {
  const detailedParcel = await fetch(`/api/v2/parcels/${parcel.id}`);
  // Rate limit SendCloud dépassé rapidement
}

// Edge Function Supabase timeout à 10 secondes
// Impossible de traiter 2500+ parcels + 2500+ API calls en 10s
```

**Impact:**
- ❌ Les nouvelles commandes ne sont jamais importées
- ❌ Les statuts ne sont pas mis à jour
- ❌ Les données restent dans SendCloud, invisibles dans le WMS
- ❌ Synchronisation complètement cassée

### Données manquantes - NON IMPORTÉES

#### 2.1 Transporteurs (`sendcloud-import-carriers`)
**Statut:** ⚠️ Fonction existe mais jamais exécutée
**Conséquence:**
```sql
SELECT COUNT(*) FROM transporteur_configuration;
-- Attendu: 20-50 transporteurs
-- Actuel: Probablement 0
```
- Aucun transporteur disponible dans le WMS
- Impossible de sélectionner un transporteur pour les commandes
- Règles d'expédition non fonctionnelles
- Page `/transporteurs` vide

#### 2.2 Services de transport (`sendcloud-import-shipping-methods`)
**Statut:** ⚠️ Fonction existe mais jamais exécutée
**Conséquence:**
```sql
SELECT COUNT(*) FROM transporteur_service;
-- Attendu: 100-500 services
-- Actuel: Probablement 0
```
- Aucun service d'expédition disponible
- Impossible de choisir "DHL Express", "Colissimo", etc.
- Calcul des coûts impossible

#### 2.3 Produits (`sendcloud-import-products`)
**Statut:** ⚠️ Fonction existe mais synchronisation problématique
**Problèmes identifiés:**
```sql
SELECT COUNT(*) FROM sendcloud_product_mapping;
-- Attendu: Tous les produits clients mappés
-- Actuel: Probablement 0
```
- Mapping produit SendCloud ↔ WMS incomplet
- Pas de lien automatique entre produits SendCloud et produits clients
- Lignes de commande (`ligne_commande`) manquantes ou incomplètes
- Stock non synchronisé

**Conséquence sur les commandes:**
```typescript
// Lors de l'import d'une commande SendCloud
{
  order_number: "SC-12345",
  parcel_items: [
    { sku: "PROD-001", quantity: 2 },
    { sku: "PROD-002", quantity: 1 }
  ]
}

// Le système cherche PROD-001 et PROD-002 dans la table produit
// Si pas trouvé → ligne_commande.produit_id = NULL
// Impossible de réserver le stock
// Impossible de faire le picking
// Commande bloquée en "erreur"
```

#### 2.4 Informations expéditeur
**Statut:** ❌ **NON GÉRÉ** dans le code actuel
**Manquant:**
- Table `configuration_expediteur` existe mais pas de fonction d'import
- Pas de sync des sender addresses depuis SendCloud
- API SendCloud disponible: `GET /api/v2/user/sender-addresses`

**Impact:**
- Configuration expéditeur uniquement manuelle
- Pas de synchronisation des adresses expéditeur SendCloud
- Données potentiellement incohérentes entre SendCloud et WMS

#### 2.5 Retours (`sendcloud-create-return`)
**Statut:** ⚠️ Fonction existe mais workflow unidirectionnel
**Problème:**
- Fonction actuelle: WMS → SendCloud (créer un retour)
- Manquant: SendCloud → WMS (importer les retours existants)
- Pas de sync des retours créés directement dans SendCloud
- Pas de webhook handler pour les événements de retour

**Workflow actuel (incomplet):**
```
Client demande retour → WMS crée retour → SendCloud génère étiquette
                                           ↓
                                    (FIN - pas de sync retour)
```

**Workflow requis:**
```
Client demande retour → WMS crée retour → SendCloud génère étiquette
                           ↑                       ↓
                     Sync bidirectionnelle   Webhook statut retour
                           ↑                       ↓
                     WMS met à jour statut ← SendCloud reçoit colis
```

#### 2.6 Étiquettes
**Statut:** ⚠️ Génération possible mais récupération problématique
**Problèmes:**
- `sendcloud-fetch-documents` existe pour télécharger
- **Mais:** Si la commande n'est pas dans le WMS, pas d'étiquette associée
- Pas de synchronisation automatique des étiquettes existantes
- Pas de téléchargement automatique après génération

**Impact:**
- Étiquettes générées dans SendCloud mais pas dans le WMS
- Impossible de ré-imprimer une étiquette depuis le WMS
- Obligation d'aller dans SendCloud pour récupérer les étiquettes

### État actuel des tables

```sql
-- Vérifier l'état actuel du système

-- 1. Commandes importées depuis SendCloud
SELECT 
  COUNT(*) as total,
  COUNT(sendcloud_id) as with_sendcloud_id,
  statut_wms,
  COUNT(*) as count_by_status
FROM commande 
WHERE source = 'sendcloud'
GROUP BY statut_wms;
-- Attendu: 100-1000+ commandes selon volume
-- Actuel: Probablement 0 ou très peu

-- 2. Transporteurs disponibles
SELECT 
  COUNT(*) as total_carriers,
  COUNT(*) FILTER (WHERE actif = true) as active_carriers
FROM transporteur_configuration;
-- Attendu: 20-50 transporteurs
-- Actuel: Probablement 0

-- 3. Services d'expédition
SELECT 
  COUNT(*) as total_services,
  COUNT(*) FILTER (WHERE actif = true) as active_services,
  transporteur_id,
  COUNT(*) as services_per_carrier
FROM transporteur_service
GROUP BY transporteur_id;
-- Attendu: 100-500 services
-- Actuel: Probablement 0

-- 4. Produits SendCloud mappés
SELECT 
  COUNT(*) as total_mappings,
  COUNT(DISTINCT wms_product_id) as unique_wms_products,
  COUNT(DISTINCT sendcloud_product_id) as unique_sendcloud_products
FROM sendcloud_product_mapping;
-- Attendu: Tous les produits clients mappés
-- Actuel: Probablement 0

-- 5. Logs de synchronisation
SELECT 
  sync_date,
  nb_orders_fetched,
  nb_orders_created,
  nb_errors,
  error_details
FROM sendcloud_sync_log 
ORDER BY sync_date DESC 
LIMIT 10;
-- Vérifier les erreurs et les counts
```

### Solutions requises

#### Priorité 1: CORRIGER LA SYNCHRONISATION DES COMMANDES (URGENT - 2-4h)

**Actions requises:**

1. **Réduire drastiquement le batch size**
```typescript
// Modification dans sendcloud-sync-orders/index.ts

// AVANT (ACTUEL - CASSÉ)
const TOTAL_PAGES = 500;  // Tente de fetch 5000 parcels
const enrichAllParcels = true;  // Appel API pour chaque parcel

// APRÈS (FIXÉ)
const BATCH_SIZE = 10;  // Fetch seulement 10 pages = 100 parcels max
const MAX_ENRICHMENTS_PER_RUN = 50;  // Limite les enrichissements
const DELAY_BETWEEN_CALLS_MS = 150;  // Délai entre appels API
```

2. **Implémenter la pagination persistante**
```typescript
// Créer une table pour tracker la progression
CREATE TABLE sendcloud_sync_cursor (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  last_synced_at TIMESTAMP WITH TIME ZONE NOT NULL,
  last_parcel_id TEXT,
  page_cursor INTEGER DEFAULT 0,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

// Dans la fonction sync
const cursor = await getCursor();
const parcels = await fetchParcels({
  page: cursor.page_cursor,
  limit: 100,
  updated_after: cursor.last_synced_at
});

// Après traitement réussi
await updateCursor({
  page_cursor: cursor.page_cursor + 1,
  last_synced_at: now(),
  last_parcel_id: lastParcel.id
});
```

3. **Gérer le rate limiting avec exponential backoff**
```typescript
async function fetchWithRetry(url, options, maxRetries = 3) {
  for (let i = 0; i < maxRetries; i++) {
    try {
      const response = await fetch(url, options);
      
      if (response.status === 429) {
        const retryAfter = response.headers.get('Retry-After');
        const delay = retryAfter ? parseInt(retryAfter) * 1000 : Math.pow(2, i) * 1000;
        console.warn(`Rate limited, waiting ${delay}ms before retry ${i + 1}/${maxRetries}`);
        await sleep(delay);
        continue;
      }
      
      return response;
    } catch (error) {
      if (i === maxRetries - 1) throw error;
      await sleep(Math.pow(2, i) * 1000);
    }
  }
}

// Ajouter des délais entre les appels
for (const parcel of parcels) {
  await fetchParcelDetails(parcel.id);
  await sleep(150); // 150ms entre chaque appel = max ~400 req/min
}
```

4. **Créer un job CRON pour exécutions multiples**
```sql
-- Activer pg_cron et pg_net
CREATE EXTENSION IF NOT EXISTS pg_cron;
CREATE EXTENSION IF NOT EXISTS pg_net;

-- Scheduler la sync toutes les 15 minutes
SELECT cron.schedule(
  'sendcloud-sync-orders-cron',
  '*/15 * * * *',  -- Toutes les 15 minutes
  $$
  SELECT net.http_post(
    url := 'https://tggdjeoxvpzbigbikpfy.supabase.co/functions/v1/sendcloud-sync-orders',
    headers := '{"Content-Type": "application/json", "Authorization": "Bearer [ANON_KEY]"}'::jsonb,
    body := '{"batch_mode": true}'::jsonb
  );
  $$
);
```

5. **Optimiser l'utilisation de l'API V3**
```typescript
// Préférer l'API V3 Orders qui est plus efficace
// Au lieu de V2 Parcels qui nécessite beaucoup d'enrichissement

// API V3 retourne plus d'infos de base
const ordersV3 = await fetch(
  'https://panel.sendcloud.sc/api/v3/orders?status=announced',
  { headers: { Authorization: `Bearer ${apiKey}` } }
);

// Moins besoin d'appels supplémentaires pour détails
```

#### Priorité 2: IMPORTER LES DONNÉES DE RÉFÉRENCE (URGENT - 1h)

**2.1 Exécuter l'import des transporteurs**
```bash
# Via interface SendCloudSync.tsx ou directement
POST /functions/v1/sendcloud-import-carriers
# Devrait importer 20-50 transporteurs

# Vérifier le résultat
SELECT * FROM transporteur_configuration ORDER BY date_creation DESC;
```

**2.2 Exécuter l'import des services**
```bash
POST /functions/v1/sendcloud-import-shipping-methods
# Devrait importer 100-500 services

# Vérifier le résultat
SELECT 
  ts.nom_affichage,
  tc.nom_transporteur,
  ts.actif
FROM transporteur_service ts
JOIN transporteur_configuration tc ON tc.id = ts.transporteur_id
WHERE ts.actif = true;
```

**2.3 Exécuter l'import des produits**
```bash
POST /functions/v1/sendcloud-import-products
# Créer le mapping SKU SendCloud ↔ SKU WMS

# Vérifier le résultat
SELECT 
  spm.*,
  p.reference as wms_sku,
  p.nom as wms_name
FROM sendcloud_product_mapping spm
JOIN produit p ON p.id = spm.wms_product_id;
```

**2.4 Créer l'import des expéditeurs (NOUVEAU)**
```typescript
// Créer supabase/functions/sendcloud-import-senders/index.ts

import { createClient } from '@supabase/supabase-js'

Deno.serve(async (req) => {
  const supabase = createClient(
    Deno.env.get('SUPABASE_URL')!,
    Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!
  )

  const sendcloudApiKey = Deno.env.get('SENDCLOUD_API_KEY')
  const sendcloudApiSecret = Deno.env.get('SENDCLOUD_API_SECRET')
  const authHeader = btoa(`${sendcloudApiKey}:${sendcloudApiSecret}`)

  // Fetch sender addresses from SendCloud
  const response = await fetch(
    'https://panel.sendcloud.sc/api/v2/user/sender-addresses',
    {
      headers: {
        'Authorization': `Basic ${authHeader}`,
        'Content-Type': 'application/json'
      }
    }
  )

  const { sender_addresses } = await response.json()

  let imported = 0
  let updated = 0

  for (const sender of sender_addresses) {
    // Upsert dans configuration_expediteur
    const { error } = await supabase
      .from('configuration_expediteur')
      .upsert({
        nom: `${sender.first_name} ${sender.last_name}`,
        entreprise: sender.company_name,
        email: sender.email,
        telephone: sender.telephone,
        adresse_ligne_1: sender.street,
        adresse_ligne_2: sender.street_number,
        code_postal: sender.postal_code,
        ville: sender.city,
        pays_code: sender.country,
        vat_number: sender.vat_number,
        eori_number: sender.eori_number,
        actif: sender.is_active,
        est_defaut: sender.is_default
      }, {
        onConflict: 'email',  // Assuming email is unique
        ignoreDuplicates: false
      })

    if (error) {
      console.error('Error importing sender:', error)
      continue
    }

    imported++
  }

  return new Response(JSON.stringify({
    success: true,
    imported,
    updated,
    total: sender_addresses.length
  }), {
    headers: { 'Content-Type': 'application/json' }
  })
})
```

#### Priorité 3: SYNCHRONISATION BIDIRECTIONNELLE (MOYEN TERME - 3-5 jours)

**Actuellement:** WMS → SendCloud uniquement (création parcels)  
**Requis:** SendCloud ↔ WMS (sync statuts, retours, étiquettes)

**À implémenter:**

1. **Webhook handler robuste avec retry logic**
```typescript
// Améliorer sendcloud-webhook/index.ts

// Ajouter un système de queue pour les webhooks
CREATE TABLE webhook_queue (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  event_type TEXT NOT NULL,
  payload JSONB NOT NULL,
  retry_count INTEGER DEFAULT 0,
  max_retries INTEGER DEFAULT 5,
  next_retry_at TIMESTAMP WITH TIME ZONE,
  status TEXT DEFAULT 'pending',
  error_message TEXT,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

// Si le webhook processing échoue, ajouter à la queue
// Un job CRON retente les webhooks en échec
```

2. **Background job pour récupérer les mises à jour manquées**
```typescript
// Créer sendcloud-sync-updates/index.ts
// Exécuté toutes les heures
// Fetch les parcels updated dans les dernières 2h
// Sync les statuts, tracking, labels
// Compare avec la base WMS
// Met à jour les différences
```

3. **Sync des retours existants**
```typescript
// Créer sendcloud-import-returns/index.ts
// Fetch GET /api/v2/returns
// Import dans table retour_produit
// Créer les lignes retour automatiquement
// Générer les mouvements de stock
```

4. **Téléchargement automatique des étiquettes**
```typescript
// Améliorer sendcloud-fetch-documents/index.ts
// Après génération d'étiquette dans SendCloud
// Télécharger automatiquement le PDF
// Stocker dans Supabase Storage
// Updater commande.label_url
// Permettre réimpression depuis WMS
```

---

# PARTIE 3: RLS POLICIES À VÉRIFIER

## ⚠️ Problème: Policies potentiellement bloquantes

### Observation initiale
```sql
SELECT * FROM pg_policies WHERE schemaname = 'public';
-- Retourne 0 résultats
```

**Note:** Cela ne signifie PAS qu'il n'y a pas de policies, mais que la vue `pg_policies` peut ne pas fonctionner correctement dans Supabase Cloud.

### Tables critiques à auditer

#### 1. Table `commande`
**Policies existantes (selon documentation):**
- ✅ Admin full access
- ✅ Client read own commande (filtré par client_id)
- ✅ Operateur read/update
- ⚠️ **PROBLÈME:** Policy client nécessite client_id non NULL

**Policy à vérifier:**
```sql
-- Vérifier si la policy fonctionne pour les clients sans client_id
CREATE POLICY "Client read own commande"
ON commande FOR SELECT
USING (
  has_role(auth.uid(), 'client') 
  AND client_id IN (
    SELECT client_id FROM profiles WHERE id = auth.uid()
  )
);

-- Si profiles.client_id = NULL, cette sous-requête retourne NULL
-- Donc même avec le bon rôle, aucune commande n'est accessible
```

**Solution proposée:**
```sql
-- Option 1: Autoriser NULL temporairement (pour debug)
CREATE POLICY "Client read commande including null"
ON commande FOR SELECT
USING (
  has_role(auth.uid(), 'client') 
  AND (
    client_id IN (SELECT client_id FROM profiles WHERE id = auth.uid())
    OR (SELECT client_id FROM profiles WHERE id = auth.uid()) IS NULL
  )
);

-- Option 2: Fix le client_id PUIS garder la policy stricte
-- Préférable car plus sécurisé
```

#### 2. Table `produit`
**Même problème que commande:**
```sql
-- Policy actuelle qui échoue si client_id = NULL
CREATE POLICY "Client read own produit"
ON produit FOR SELECT
USING (
  has_role(auth.uid(), 'client') 
  AND client_id = (SELECT client_id FROM profiles WHERE id = auth.uid())
);
```

#### 3. Table `mouvement_stock`
**Filtrage par client_id:**
```sql
-- Vérifier que la policy existe et fonctionne
SELECT * FROM mouvement_stock WHERE client_id IS NULL;
-- Si beaucoup de résultats → problème de données
-- Les mouvements devraient toujours avoir un client_id
```

#### 4. Table `ligne_commande`
**Pas de RLS direct mais filtré via commande:**
```sql
-- Vérifier que les lignes sont accessibles
SELECT lc.*
FROM ligne_commande lc
JOIN commande c ON c.id = lc.commande_id
WHERE c.client_id = (SELECT client_id FROM profiles WHERE id = auth.uid());
```

#### 5. Tables SendCloud
**Vérifier l'accès aux données de sync:**
```sql
-- Tables qui devraient être accessibles aux admins
- sendcloud_sync_log
- sendcloud_api_log
- sendcloud_event_history
- webhook_sendcloud_log

-- Vérifier les policies admin
SELECT tablename, policyname, permissive, roles, cmd, qual
FROM pg_policies
WHERE tablename LIKE '%sendcloud%';
```

### Audit complet RLS recommandé

**Script d'audit à exécuter:**
```sql
-- 1. Lister toutes les tables sans RLS activé
SELECT schemaname, tablename
FROM pg_tables
WHERE schemaname = 'public'
  AND tablename NOT IN (
    SELECT tablename FROM pg_tables t
    WHERE rowsecurity = true
  );

-- 2. Lister toutes les policies par table
SELECT 
  schemaname,
  tablename,
  policyname,
  permissive,
  roles,
  cmd,
  qual
FROM pg_policies
WHERE schemaname = 'public'
ORDER BY tablename, policyname;

-- 3. Vérifier les tables avec RLS mais sans policies
SELECT t.schemaname, t.tablename
FROM pg_tables t
WHERE t.schemaname = 'public'
  AND t.rowsecurity = true
  AND NOT EXISTS (
    SELECT 1 FROM pg_policies p
    WHERE p.schemaname = t.schemaname
      AND p.tablename = t.tablename
  );

-- 4. Tester l'accès utilisateur client
-- Se connecter avec un utilisateur client puis:
SELECT COUNT(*) FROM commande;  -- Devrait retourner SES commandes
SELECT COUNT(*) FROM produit;   -- Devrait retourner SES produits
SELECT COUNT(*) FROM mouvement_stock;  -- Devrait retourner SES mouvements

-- Si COUNT(*) = 0 pour toutes les tables → Problème RLS ou client_id
```

### Actions correctives RLS

**Si policies trop restrictives:**
```sql
-- Temporairement assouplir pour debug (DEVELOPMENT UNIQUEMENT)
ALTER TABLE commande DISABLE ROW LEVEL SECURITY;
-- Tester l'accès
-- Puis RÉACTIVER avec policies corrigées
ALTER TABLE commande ENABLE ROW LEVEL SECURITY;
```

**Si policies manquantes:**
```sql
-- Créer les policies manquantes
-- Exemple pour une table oubliée
CREATE POLICY "Admin full access"
ON ma_table
FOR ALL
USING (has_role(auth.uid(), 'admin'))
WITH CHECK (has_role(auth.uid(), 'admin'));

CREATE POLICY "Client read own data"
ON ma_table
FOR SELECT
USING (
  has_role(auth.uid(), 'client')
  AND client_id = (SELECT client_id FROM profiles WHERE id = auth.uid())
);
```

---

# ROADMAP DE CORRECTION PRIORISÉE

## 🔥 PHASE 1: URGENT (1-2 JOURS) - DÉBLOCAGE UTILISATEURS

### Étape 1.1: Fix client_id (2-4 heures)
**Objectif:** Permettre aux 80% d'utilisateurs de voir leurs données

**Actions:**
1. ✅ Créer interface admin `AssignClientToUser.tsx` (2h)
   - Liste tous les utilisateurs
   - Permet d'assigner un client_id manuellement
   - Affiche le statut actuel de chaque utilisateur

2. ✅ Migrer les 8 utilisateurs existants sans client_id (30min)
   ```sql
   -- Script de migration à exécuter
   -- Décision métier nécessaire: QUEL client assigner ?
   ```

3. ✅ Tester l'accès utilisateur (30min)
   - Se connecter avec un utilisateur client
   - Vérifier que les commandes/produits/mouvements sont visibles
   - Confirmer que les pages ne sont plus vides

**Critère de succès:** Les utilisateurs clients voient leurs données

### Étape 1.2: Fix SendCloud sync commandes (2-4 heures)
**Objectif:** Permettre l'import des commandes SendCloud

**Actions:**
1. ✅ Modifier `sendcloud-sync-orders` (2h)
   - Réduire BATCH_SIZE à 10 pages
   - Ajouter délais entre appels (150ms)
   - Implémenter exponential backoff sur 429
   - Limiter enrichissements à 50 par run

2. ✅ Créer table `sendcloud_sync_cursor` (30min)
   - Tracker la progression de la sync
   - Permet de reprendre là où on s'est arrêté

3. ✅ Tester la sync manuelle (30min)
   - Via interface SendCloudSync.tsx
   - Vérifier qu'au moins 50-100 commandes sont importées
   - Confirmer qu'aucun timeout ne se produit

**Critère de succès:** Au moins 100 commandes importées sans erreur

### Étape 1.3: Importer données référence (1 heure)
**Objectif:** Avoir les transporteurs et services disponibles

**Actions:**
1. ✅ Exécuter `sendcloud-import-carriers` (15min)
   - Via interface ou curl direct
   - Vérifier que 20-50 transporteurs sont créés

2. ✅ Exécuter `sendcloud-import-shipping-methods` (15min)
   - Via interface ou curl direct
   - Vérifier que 100-500 services sont créés

3. ✅ Exécuter `sendcloud-import-products` (15min)
   - Créer le mapping SKU SendCloud ↔ WMS
   - Vérifier le nombre de produits mappés

4. ✅ Créer et exécuter `sendcloud-import-senders` (15min)
   - Nouvelle fonction à coder
   - Importer les adresses expéditeur

**Critère de succès:** Pages Transporteurs et Services non vides

---

## ⚠️ PHASE 2: IMPORTANT (3-5 JOURS) - STABILISATION

### Étape 2.1: CRON job synchronisation (1 jour)
**Objectif:** Automatiser la sync SendCloud toutes les 15 min

**Actions:**
1. Activer pg_cron et pg_net
2. Créer le schedule CRON
3. Tester exécution automatique
4. Monitorer les logs pendant 24h

**Critère de succès:** Sync automatique toutes les 15 min sans erreur

### Étape 2.2: Workflow d'onboarding (1-2 jours)
**Objectif:** Automatiser l'assignation client_id pour nouveaux users

**Actions:**
1. Créer page `/onboarding`
2. Implémenter sélection/création client
3. Workflow de validation admin
4. Tests E2E du parcours complet

**Critère de succès:** Nouveaux utilisateurs assignés automatiquement

### Étape 2.3: Sync bidirectionnelle (2 jours)
**Objectif:** SendCloud ↔ WMS dans les deux sens

**Actions:**
1. Améliorer `sendcloud-webhook` avec retry logic
2. Créer `sendcloud-sync-updates` (background job)
3. Créer `sendcloud-import-returns`
4. Améliorer `sendcloud-fetch-documents`

**Critère de succès:** Statuts, retours et étiquettes synchronisés

### Étape 2.4: Audit et correction RLS (1 jour)
**Objectif:** Vérifier toutes les policies de sécurité

**Actions:**
1. Exécuter script d'audit complet
2. Identifier les policies manquantes ou trop strictes
3. Corriger les policies problématiques
4. Tester avec différents rôles utilisateurs

**Critère de succès:** Aucune table sans RLS, tous les rôles fonctionnels

---

## 📈 PHASE 3: AMÉLIORATIONS (1-2 SEMAINES) - OPTIMISATION

### Étape 3.1: Monitoring et alertes
- Dashboard temps réel des syncs SendCloud
- Alertes email/SMS sur échecs
- Métriques de performance (sync duration, success rate)

### Étape 3.2: Optimisation performances
- Indexation avancée des tables
- Caching des requêtes fréquentes
- Optimisation des queries N+1

### Étape 3.3: Documentation
- Guide utilisateur pour assignation client
- Documentation technique API SendCloud
- Procédures de dépannage

---

## 📊 INDICATEURS DE SUCCÈS

### Métriques critiques à suivre:

**1. Utilisateurs clients actifs**
```sql
SELECT 
  COUNT(*) as total_users,
  COUNT(client_id) as users_with_client,
  ROUND(100.0 * COUNT(client_id) / COUNT(*), 2) as percentage_with_client
FROM profiles
WHERE id IN (SELECT user_id FROM user_roles WHERE role = 'client');

-- Target: 100% (vs actuel 20%)
```

**2. Taux de réussite sync SendCloud**
```sql
SELECT 
  COUNT(*) as total_syncs,
  COUNT(*) FILTER (WHERE nb_errors = 0) as successful_syncs,
  ROUND(100.0 * COUNT(*) FILTER (WHERE nb_errors = 0) / COUNT(*), 2) as success_rate
FROM sendcloud_sync_log
WHERE sync_date > NOW() - INTERVAL '7 days';

-- Target: > 95% (vs actuel 0%)
```

**3. Commandes importées par jour**
```sql
SELECT 
  DATE(date_creation) as jour,
  COUNT(*) as nb_commandes_importees
FROM commande
WHERE source = 'sendcloud'
  AND date_creation > NOW() - INTERVAL '7 days'
GROUP BY DATE(date_creation)
ORDER BY jour DESC;

-- Target: > 50 commandes/jour (vs actuel 0)
```

**4. Transporteurs et services disponibles**
```sql
SELECT 
  (SELECT COUNT(*) FROM transporteur_configuration WHERE actif = true) as transporteurs,
  (SELECT COUNT(*) FROM transporteur_service WHERE actif = true) as services;

-- Target: > 20 transporteurs, > 100 services (vs actuel 0)
```

**5. Produits mappés SendCloud**
```sql
SELECT 
  COUNT(*) as total_mappings,
  COUNT(DISTINCT wms_product_id) as unique_wms_products
FROM sendcloud_product_mapping;

-- Target: > 100 mappings (vs actuel 0)
```

---

## 🔗 FICHIERS À MODIFIER/CRÉER

### Fichiers à modifier:

1. ✏️ `supabase/functions/sendcloud-sync-orders/index.ts` - **CRITIQUE**
   - Réduire batch size
   - Ajouter rate limiting
   - Implémenter pagination persistante

2. ✏️ `supabase/functions/sendcloud-webhook/index.ts`
   - Ajouter retry logic
   - Améliorer error handling

3. ✏️ `src/pages/SendCloudSync.tsx`
   - Ajouter boutons pour imports manuels
   - Afficher stats détaillées

### Fichiers à créer:

1. ➕ `src/pages/admin/AssignClientToUser.tsx` - **URGENT**
   - Interface d'assignation client_id

2. ➕ `supabase/functions/sendcloud-import-senders/index.ts` - **IMPORTANT**
   - Import adresses expéditeur

3. ➕ `supabase/functions/sendcloud-sync-updates/index.ts`
   - Background sync des updates

4. ➕ `supabase/functions/sendcloud-import-returns/index.ts`
   - Import des retours existants

5. ➕ Migration SQL pour `sendcloud_sync_cursor`
   - Table de tracking progression

---

## ⏱️ ESTIMATION TEMPS TOTAL

### Quick Fix (Phase 1)
- Fix client_id: **2-4 heures**
- Fix SendCloud sync: **2-4 heures**
- Import données référence: **1 heure**
- Tests et validation: **1 heure**
- **TOTAL PHASE 1: 1-2 jours de travail**

### Solution complète (Phases 1+2+3)
- Phase 1 (Urgent): **1-2 jours**
- Phase 2 (Important): **3-5 jours**
- Phase 3 (Amélioration): **1-2 semaines**
- **TOTAL COMPLET: 2-3 semaines de travail**

---

## 📞 CONTACTS ET RESSOURCES

### Documentation SendCloud
- API V3 Orders: https://developers.sendcloud.com/v3/api-reference/orders
- API V2 Parcels: https://developers.sendcloud.com/v2/api-reference/parcels
- Rate Limits: https://developers.sendcloud.com/docs/rate-limiting
- Webhooks: https://developers.sendcloud.com/docs/webhooks

### Limites SendCloud connues
- Rate limit: ~100 requests/minute
- Parcels API: Pagination max 100 items
- Orders API: Plus efficace, requiert SendCloud Shipping
- Webhook retry: 3 tentatives sur 24h

### Support technique
- SendCloud Support: support@sendcloud.com
- Documentation Supabase Edge Functions: https://supabase.com/docs/guides/functions
- Documentation PostgreSQL RLS: https://www.postgresql.org/docs/current/ddl-rowsecurity.html

---

**Document créé le:** Janvier 2025  
**Dernière mise à jour:** Janvier 2025  
**Version:** 1.0  
**Statut:** 🔴 CRITIQUE - Action immédiate requise

---

## 🎯 ACTIONS IMMÉDIATES RECOMMANDÉES

### Pour débloquer rapidement (Aujourd'hui):

1. ⚡ **Créer l'interface admin assignation client_id** (2h)
   - Permet de débloquer les 8 utilisateurs manuellement
   - Interface simple: liste users + dropdown clients + bouton assign

2. ⚡ **Exécuter les imports SendCloud manuellement** (30min)
   - `sendcloud-import-carriers`
   - `sendcloud-import-shipping-methods`
   - `sendcloud-import-products`
   - Vérifie que les données apparaissent

3. ⚡ **Fixer le timeout sendcloud-sync-orders** (2h)
   - Modifier le batch size
   - Tester avec import manuel de 100 commandes

**Résultat attendu fin de journée:**
- ✅ 80% des utilisateurs peuvent voir leurs données
- ✅ Transporteurs et services disponibles
- ✅ Au moins 100 commandes importées depuis SendCloud

### Pour consolider (Cette semaine):

1. 📅 **Setup CRON job** (4h)
   - Automatise la sync toutes les 15 min
   - Plus besoin d'import manuel

2. 📅 **Créer workflow onboarding** (1-2 jours)
   - Plus de problème client_id pour nouveaux users

3. 📅 **Audit RLS complet** (1 jour)
   - S'assurer qu'il n'y a pas d'autres problèmes de sécurité

---

**FIN DU DOCUMENT**
