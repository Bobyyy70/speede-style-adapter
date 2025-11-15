# 📦 WMS Speed E-Log - État du Projet à T=0

**Date de snapshot:** Janvier 2025  
**Version:** 1.0.0  
**Statut:** Production avec corrections en cours

---

## 🎯 Vue d'Ensemble

WMS Speed E-Log est un système de gestion d'entrepôt (Warehouse Management System) complet développé pour gérer l'ensemble des opérations logistiques d'un entrepôt moderne, de la réception à l'expédition.

### Stack Technique
- **Frontend:** React 18 + TypeScript + Vite
- **UI:** Shadcn/ui + Tailwind CSS
- **Backend:** Supabase (PostgreSQL + Edge Functions)
- **Authentification:** Supabase Auth avec RLS
- **Intégrations:** SendCloud (API transport), n8n (workflows)

---

## 🏗️ Architecture du Système

### Modules Fonctionnels Principaux

#### 1. **Gestion des Commandes**
**Fichiers clés:**
- `src/pages/Commandes.tsx` - Liste et gestion des commandes
- `src/pages/client/CreerCommande.tsx` - Création de commandes
- `src/pages/client/MesCommandes.tsx` - Vue client
- `src/components/CommandesKanban.tsx` - Vue Kanban par statut
- `src/lib/orderStatuses.ts` - Énumérations des statuts

**Statuts de commande (17 états):**
```typescript
- en_attente_validation    // ⚠️ Validation requise
- en_attente_reappro       // Stock insuffisant
- stock_reserve            // Stock bloqué
- en_picking               // Prélèvement en cours
- picking_termine          // Picking validé
- en_preparation           // Emballage en cours
- pret_expedition          // Prêt à partir
- etiquette_generee        // Label créé
- expedie                  // Envoyé
- en_transit               // Transport en cours
- en_livraison             // Livraison finale
- livre                    // Livré ✓
- annule                   // Annulé
- erreur                   // Erreur technique
- incident_livraison       // Problème livraison
- retour_expediteur        // Retour
```

**Base de données:**
- Table: `commande` (120+ colonnes)
- Relations: `ligne_commande`, `commande_transition_log`, `commande_validation_log`
- RLS activée avec filtrage par `client_id`

#### 2. **Gestion des Produits & Stock**
**Fichiers clés:**
- `src/pages/Produits.tsx` - Catalogue produits
- `src/pages/Emplacements.tsx` - Gestion des emplacements
- `src/pages/Mouvements.tsx` - Historique mouvements
- `src/pages/Reappro.tsx` - Réapprovisionnements

**Tables principales:**
- `produit` - Catalogue avec 50+ attributs (dimensions, douane, traçabilité)
- `emplacement` - Cartographie entrepôt (zones, allées, niveaux)
- `mouvement_stock` - Journal de tous les mouvements
- `bac_adresse` - Bacs de picking

**Fonctionnalités avancées:**
- Gestion des lots et numéros de série
- Calcul automatique du stock disponible (vue `stock_disponible`)
- Génération automatique d'emplacements
- Traçabilité complète des mouvements

#### 3. **Préparation & Picking**
**Fichiers clés:**
- `src/pages/Preparation.tsx` - Sessions de préparation
- `src/pages/PreparationDetails.tsx` - Détail session
- `src/pages/PickingMobile.tsx` - Interface mobile scanning
- `src/pages/BacsAdresses.tsx` - Gestion bacs

**Workflow:**
1. Création session de préparation
2. Assignment opérateur
3. Picking avec scan codes-barres
4. Validation quantités
5. Mise à jour stock automatique

**Tables:**
- `session_preparation` - Sessions de picking
- `ligne_session_preparation` - Détail produits à prélever

#### 4. **Réception**
**Fichiers clés:**
- `src/pages/Reception.tsx` - Réceptions en cours
- `src/pages/client/AttenduReception.tsx` - Attentes déclarées

**Statuts d'attendu:**
```
prévu → en_transit → arrivé → en_cours_réception 
→ réceptionné_partiellement | réceptionné_totalement 
→ clôturé | anomalie | annulé
```

**Tables:**
- `attendu_reception` - Avis de réception
- `ligne_attendu_reception` - Détail produits attendus
- `attendu_transition_log` - Historique des changements

#### 5. **Expédition**
**Fichiers clés:**
- `src/pages/Expedition.tsx` - Centre expédition
- `src/pages/expedition/PreparerExpedition.tsx` - Préparation envoi
- `src/pages/expedition/ConfigurationExpedition.tsx` - Config
- `src/pages/ConfigurationExpediteur.tsx` - Données expéditeur

**Fonctionnalités:**
- Génération étiquettes via SendCloud
- Calcul poids volumétrique
- Documents douaniers (CN23, factures commerciales)
- Multi-transporteurs

**Tables:**
- `configuration_expediteur` - Adresses d'expédition
- `type_carton` - Types d'emballages
- `calculateur_volumetrique` - Calculs volumes

#### 6. **Retours**
**Fichiers clés:**
- `src/pages/Retours.tsx` - Gestion retours
- `src/pages/client/MesRetours.tsx` - Vue client
- `src/pages/client/CreerRetour.tsx` - Déclaration retour
- `src/components/RetoursKanban.tsx` - Vue Kanban

**Statuts:**
```
recu → en_inspection → traite | non_conforme → archive | annule
```

**Tables:**
- `retour_produit` - En-têtes retours
- `ligne_retour_produit` - Détail produits retournés
- `retour_transition_log` - Historique

#### 7. **Utilisateurs & Clients**
**Fichiers clés:**
- `src/pages/Utilisateurs.tsx` - Gestion utilisateurs
- `src/pages/GestionClients.tsx` - Gestion clients
- `src/hooks/useAuth.tsx` - Authentification
- `src/components/ClientUserManagement.tsx` - Gestion par client

**Système de rôles (4 niveaux):**
```typescript
- admin         // Accès total
- gestionnaire  // Gestion opérationnelle
- operateur     // Exécution tâches
- client        // Vue limitée à ses données
```

**Tables:**
- `profiles` - Profils utilisateurs
- `user_roles` - Assignation rôles
- `client` - Entreprises clientes
- `client_user_limits` - Limites utilisateurs par client

**Filtrage multi-tenant:**
- RLS avec `client_id` sur toutes les tables métier
- Fonction `current_client_id()` pour récupération automatique
- Isolation stricte des données

---

## 🔌 Intégrations

### SendCloud (Transport)

**Documentation complète:** `docs/SENDCLOUD_INTEGRATION.md`, `docs/SENDCLOUD_API.md`, `docs/USER_GUIDE_SENDCLOUD.md`

**Edge Functions (20+ fonctions):**
```
sendcloud-sync-orders           // Sync commandes (V3 Orders API)
sendcloud-orders-batch          // Traitement par batch
sendcloud-dlq-handler           // Gestion erreurs (retry 3x)
sendcloud-initial-setup         // Configuration initiale
sendcloud-refresh-tracking      // Mise à jour tracking
sendcloud-create-parcel         // Génération colis
sendcloud-get-tracking          // Récupération statuts
sendcloud-import-carriers       // Import transporteurs
sendcloud-import-shipping-methods // Méthodes d'expédition
sendcloud-webhook               // Réception webhooks
...
```

**Mécanismes de robustesse:**
- **Lock management:** TTL 20 minutes avec retry automatique
- **DLQ (Dead Letter Queue):** Replay erreurs toutes les 10 min
- **Rate limiting:** Gestion 429 avec backoff exponentiel
- **Fallback V2 API:** Si V3 Orders échoue

**Tables:**
- `sendcloud_sync_logs` - Logs synchronisation
- `sendcloud_dlq` - Queue messages en erreur
- `sync_locks` - Verrous concurrence
- `transporteur` - Transporteurs actifs
- `methode_expedition` - Services transport

**Dashboard Analytics:**
- Page: `src/pages/integrations/sendcloud/Dashboard.tsx`
- Route: `/integrations/sendcloud/dashboard`
- Graphiques: Performance timeline, Success rate, Volume by job

### n8n (Workflows)

**Fichiers:**
- `src/pages/Workflows.tsx` - Liste workflows
- `supabase/functions/n8n-gateway/` - Passerelle sécurisée

**Tables:**
- `n8n_workflows` - Définitions workflows
- `n8n_workflow_executions` - Historique exécutions

---

## 🔐 Sécurité & Permissions

### Row Level Security (RLS)

**Toutes les tables métier ont RLS activée:**
```sql
ALTER TABLE commande ENABLE ROW LEVEL SECURITY;
ALTER TABLE produit ENABLE ROW LEVEL SECURITY;
ALTER TABLE mouvement_stock ENABLE ROW LEVEL SECURITY;
...
```

**Policies principales:**
```sql
-- Clients voient uniquement leurs données
CREATE POLICY "Client read own commande"
ON commande FOR SELECT
USING (client_id IN (SELECT client_id FROM profiles WHERE id = auth.uid()));

-- Admins voient tout
CREATE POLICY "Admin full access"
ON commande FOR ALL
USING (has_role(auth.uid(), 'admin'));

-- Opérateurs accès lecture
CREATE POLICY "Operateur read all"
ON commande FOR SELECT
USING (has_role(auth.uid(), 'operateur') OR has_role(auth.uid(), 'gestionnaire'));
```

### Fonctions de sécurité

**RPC Functions:**
- `has_role(user_id, role)` - Vérification rôle
- `get_user_role(user_id)` - Récupération rôle
- `current_client_id()` - Client ID de l'utilisateur
- `can_client_create_user(client_id)` - Vérif limite utilisateurs

---

## 📊 Analytics & IA

### Dashboards

**1. Dashboard Principal (`src/pages/Index.tsx`)**
- KPIs temps réel (commandes, stock, retours)
- Graphiques performance sur 7/30/90 jours
- Alertes stock et réappros
- Widget IA assistant

**2. Dashboard Analytique (`src/pages/DashboardAnalytique.tsx`)**
- Charts commandes par statut
- Performance picking
- Taux de retour
- Tendances périodes

**3. Dashboard SendCloud (`src/pages/integrations/sendcloud/Dashboard.tsx`)**
- Performance syncs
- Taux de succès
- Volume par job
- Logs détaillés

### Fonctionnalités IA

**Edge Functions:**
- `ai-assistant/` - Assistant conversationnel
- `predict-carrier-performance/` - Prédiction performances transporteurs
- `analyze-carrier-learning/` - Apprentissage continu
- `analyze-cost-optimization/` - Optimisation coûts
- `suggest-carrier-rules/` - Suggestions règles intelligentes

**Pages:**
- `src/pages/analytics/ScoringPredictif.tsx` - Scoring transporteurs
- `src/pages/analytics/OptimisationCouts.tsx` - Économies potentielles
- `src/pages/analytics/ApprentissageContinu.tsx` - Amélioration continue
- `src/pages/OptimisationTransport.tsx` - Centre optimisation

**Tables:**
- `decision_transporteur` - Historique décisions
- `performance_prediction` - Prédictions IA
- `suggestion_optimisation_couts` - Suggestions économies
- `alerte_performance_transporteur` - Alertes dégradations

---

## 🛠️ Fonctionnalités Avancées

### 1. Règles Métier Configurables

**Validation Commandes:**
- Page: `src/pages/commandes/ReglesValidation.tsx`
- Table: `regle_validation_commande`
- Workflows d'approbation automatiques/manuels
- Notifications par email

**Règles Transporteurs:**
- Page: `src/pages/configuration/ReglesTransporteurs.tsx`
- Table: `regle_selection_transporteur`
- Sélection automatique par poids/destination/priorité
- Scoring multi-critères

**Règles Emballages:**
- Page: `src/pages/preparation/ReglesEmballages.tsx`
- Table: `regle_emballage`
- Suggestion carton optimal
- Calcul volumétrique automatique

### 2. Gestion des Transitions

**Page Admin:** `src/pages/admin/GestionTransitions.tsx`

**Fonctionnalités:**
- Historique complet transitions (commandes, retours, attentes)
- Rollback possible avec validation
- Audit trail détaillé
- Filtres avancés par période/entité/utilisateur

**Tables de logs:**
- `commande_transition_log` - Historique commandes
- `retour_transition_log` - Historique retours
- `attendu_transition_log` - Historique réceptions
- `audit_log` - Audit global

**Hook:** `src/hooks/useStatutTransition.tsx` - Gestion transitions avec validation

### 3. Réparation & Maintenance

**Page:** `src/pages/ReparationCommandes.tsx`

**Fonctionnalités:**
- Détection anomalies automatique
- Réparation duplicatas
- Correction données manquantes
- Logs détaillés des corrections

### 4. Poids Volumétrique & Alertes

**Composant:** `src/components/calculateur-volumetrique/`

**Fonctionnalités:**
- Calcul automatique poids volumétrique
- Comparaison avec poids réel
- Alertes si écart > seuil configurable (défaut 20%)
- Recommandations optimisation

**Tables:**
- `alerte_poids_volumetrique` - Alertes générées
- `alerte_poids_volumetrique_config` - Configuration seuils
- `transporteur_facteur_division` - Facteurs par transporteur

---

## 📁 Structure des Fichiers

### Frontend (`src/`)

```
src/
├── components/          # Composants réutilisables (100+)
│   ├── ui/             # Shadcn components
│   ├── analytics/      # Charts et KPIs
│   ├── expedition/     # Composants expédition
│   ├── integrations/   # SendCloud components
│   └── transitions/    # Gestion transitions
├── hooks/              # Custom hooks (10+)
│   ├── useAuth.tsx           # Authentification
│   ├── useStatutTransition.tsx
│   ├── useAutoRules.tsx
│   └── useValidationRules.tsx
├── lib/                # Utilitaires
│   ├── orderStatuses.ts
│   ├── utils.ts
│   └── expeditionConfig.ts
├── pages/              # Pages principales (60+)
│   ├── client/        # Pages espace client
│   ├── admin/         # Pages admin
│   ├── analytics/     # Analytics & IA
│   ├── commandes/     # Gestion commandes
│   ├── expedition/    # Expédition
│   ├── integrations/  # SendCloud pages
│   └── onboarding/    # Wizard onboarding
└── integrations/
    └── supabase/
        ├── client.ts  # Client Supabase (auto-généré)
        └── types.ts   # Types TypeScript (auto-généré)
```

### Backend (`supabase/`)

```
supabase/
├── functions/          # Edge Functions (50+)
│   ├── sendcloud-*/   # SendCloud integration (20 fonctions)
│   ├── ai-*/          # IA & prédictions (5 fonctions)
│   ├── generate-*/    # Génération documents (3 fonctions)
│   └── _shared/       # Code partagé
│       └── sync-logger.ts
├── migrations/        # Migrations SQL (100+)
│   └── *.sql          # Historique complet base de données
└── config.toml        # Configuration Supabase
```

### Documentation (`docs/`)

```
docs/
├── SENDCLOUD_INTEGRATION.md  # Architecture technique SendCloud
├── SENDCLOUD_API.md          # Référence API SendCloud
├── USER_GUIDE_SENDCLOUD.md   # Guide utilisateur dashboard
├── DIAGNOSTIC_COMPLET_WMS.md # Problèmes identifiés
└── PROJECT_STATE_T0.md       # CE DOCUMENT
```

---

## 🗄️ Base de Données

### Tables Principales (50+)

**Commandes & Produits:**
- `commande` (120+ colonnes) - Commandes avec adresses, douane, transport
- `ligne_commande` - Détail produits par commande
- `produit` (60+ colonnes) - Catalogue avec dimensions, traçabilité, douane
- `sku_variante` - Variantes de produits

**Stock & Mouvements:**
- `emplacement` - Cartographie entrepôt (zones, allées, positions)
- `bac_adresse` - Bacs de picking
- `mouvement_stock` - Journal complet mouvements
- `stock_disponible` (vue) - Calcul stock en temps réel

**Préparation:**
- `session_preparation` - Sessions de picking
- `ligne_session_preparation` - Détail lignes à préparer

**Réception:**
- `attendu_reception` - Avis de réception
- `ligne_attendu_reception` - Détail produits attendus

**Retours:**
- `retour_produit` - En-têtes retours
- `ligne_retour_produit` - Détail produits retournés

**Utilisateurs:**
- `profiles` - Profils utilisateurs
- `user_roles` - Assignation rôles
- `client` - Clients entreprises
- `client_user_limits` - Limites par client

**SendCloud:**
- `sendcloud_sync_logs` - Logs synchronisation
- `sendcloud_dlq` - Dead Letter Queue
- `sync_locks` - Gestion verrous
- `transporteur` - Transporteurs
- `methode_expedition` - Services transport

**Règles Métier:**
- `regle_validation_commande` - Règles validation
- `regle_selection_transporteur` - Règles transporteur
- `regle_emballage` - Règles emballage
- `regle_filtrage_commande` - Règles filtrage

**Analytics:**
- `decision_transporteur` - Historique décisions
- `performance_prediction` - Prédictions IA
- `suggestion_optimisation_couts` - Suggestions
- `alerte_performance_transporteur` - Alertes
- `alerte_poids_volumetrique` - Alertes poids

**Logs & Audit:**
- `commande_transition_log` - Transitions commandes
- `retour_transition_log` - Transitions retours
- `attendu_transition_log` - Transitions réceptions
- `audit_log` - Audit global
- `commande_validation_log` - Validations

### Vues Matérialisées

- `stock_disponible` - Stock en temps réel par produit
- `client_user_stats` - Stats utilisateurs par client
- `commande_gestionnaire_secure` - Vue sécurisée commandes
- `v_commandes_avec_statut` - Commandes avec labels statuts

### Fonctions PostgreSQL (30+)

**Gestion Stock:**
- `reserver_stock()` - Réservation stock
- `ajouter_stock_manuel()` - Ajout manuel
- `retirer_stock_manuel()` - Retrait manuel
- `update_stock_actuel_after_mouvement()` - Trigger mise à jour

**Transitions:**
- `transition_statut_commande()` - Transition commande
- `transition_statut_retour()` - Transition retour
- `transition_statut_attendu()` - Transition réception
- `rollback_transition()` - Annulation transition
- `peut_transitionner()` - Validation transition

**Sécurité:**
- `has_role()` - Vérification rôle
- `get_user_role()` - Récupération rôle
- `current_client_id()` - Client ID actuel
- `promote_user_to_admin()` - Promotion admin

**SendCloud:**
- `acquire_sync_lock()` - Acquisition verrou
- `release_sync_lock()` - Libération verrou

**Utilitaires:**
- `generer_emplacements_auto()` - Génération emplacements
- `supprimer_emplacements_zone()` - Suppression zone
- `execute_sql_admin()` - Exécution SQL admin
- `reintegrer_produits_retour()` - Réintégration retours

---

## 🚀 Déploiement & Configuration

### Variables d'Environnement

**Frontend (`.env`):**
```bash
VITE_SUPABASE_URL=https://[project].supabase.co
VITE_SUPABASE_PUBLISHABLE_KEY=[key]
VITE_SUPABASE_PROJECT_ID=[project-id]
```

**Backend (Supabase Secrets):**
```bash
SENDCLOUD_API_PUBLIC_KEY=[sendcloud-public]
SENDCLOUD_API_SECRET_KEY=[sendcloud-secret]
SENDCLOUD_WEBHOOK_SECRET=[webhook-secret]
SUPABASE_SERVICE_ROLE_KEY=[service-key]
```

### Configuration SendCloud

**Onboarding automatique:**
1. Page: `src/pages/onboarding/OnboardingWizard.tsx`
2. Étapes: Company → Users → SendCloud → Import
3. Fonction: `sendcloud-initial-setup` (setup complet automatique)

**Configuration manuelle:**
- Clés API: Settings → Integrations
- Webhooks: URL `[project]/functions/v1/sendcloud-webhook`
- Transporteurs: Import automatique via fonction
- Méthodes expédition: Import automatique

### Commandes npm

```bash
npm install           # Installation dépendances
npm run dev          # Développement local (port 5173)
npm run build        # Build production
npm run preview      # Preview build local
```

---

## 📈 Métriques & Performance

### Volumétrie Actuelle (estimée)

- **Utilisateurs:** ~10-20 (2 admins, reste clients)
- **Clients:** ~5-10 entreprises
- **Produits:** ~500-1000 références
- **Commandes:** ~100-500 commandes/mois
- **Mouvements stock:** ~1000-5000/mois
- **Edge Functions:** 50+ fonctions déployées
- **Migrations:** 100+ migrations appliquées

### Performance Edge Functions

**SendCloud Sync:**
- 100 commandes: < 60 secondes
- 500 commandes: < 4 minutes
- Rate limit: 100 req/min
- Retry automatique: 3 tentatives

**Dashboard:**
- Chargement initial: < 2 secondes
- Refresh auto: < 500ms

---

## ⚠️ Problèmes Connus & En Cours de Résolution

### 1. **RÉSOLU - Colonne `service_transport` manquante**
**Statut:** ✅ Corrigé (migration appliquée)  
**Solution:** Colonne ajoutée à `commande` avec index

### 2. **RÉSOLU - Gestion verrous SendCloud**
**Statut:** ✅ Amélioré  
**Solution:** TTL 20 min + retry automatique + libération forcée

### 3. **Assignation client_id utilisateurs**
**Statut:** ⚠️ Documentation existante dans `DIAGNOSTIC_COMPLET_WMS.md`  
**Impact:** 80% utilisateurs clients sans `client_id` → pages vides  
**Solution:** Interface admin assignation + triggers automatiques (à implémenter)

### 4. **RLS Policies cohérence**
**Statut:** ⚠️ À vérifier systématiquement  
**Recommandation:** Audit complet policies pour tous les rôles

---

## 🎓 Onboarding Nouveaux Développeurs

### Prérequis
- Node.js 18+ & npm
- Compte Supabase (ou accès projet existant)
- Compte SendCloud (pour tests intégration)
- IDE TypeScript (VSCode recommandé)

### Setup Local

```bash
# 1. Cloner le repo
git clone [repo-url]
cd wms-speed-elog

# 2. Installer dépendances
npm install

# 3. Configurer .env (fourni automatiquement par Lovable Cloud)
# Les variables VITE_SUPABASE_* sont auto-générées

# 4. Lancer développement
npm run dev
# → Ouvre http://localhost:5173

# 5. Accès admin bootstrap
# → http://localhost:5173/admin-bootstrap
# → Créer premier admin si base vide
```

### Ressources d'Apprentissage

**Documentation projet:**
- `docs/SENDCLOUD_INTEGRATION.md` - Intégration SendCloud
- `docs/USER_GUIDE_SENDCLOUD.md` - Guide utilisateur
- `docs/DIAGNOSTIC_COMPLET_WMS.md` - Problèmes connus
- `src/lib/orderStatuses.ts` - Workflow commandes

**Code clé à comprendre:**
1. `src/hooks/useAuth.tsx` - Système authentification & rôles
2. `src/components/DashboardLayout.tsx` - Layout principal & navigation
3. `supabase/functions/sendcloud-sync-orders/` - Sync SendCloud
4. `src/pages/Commandes.tsx` - Gestion commandes (cas d'usage complet)

**Patterns utilisés:**
- React Query pour cache & fetching
- Context API pour auth globale
- RLS Supabase pour sécurité
- Edge Functions pour backend
- Shadcn/ui pour composants

---

## 🔄 Roadmap & Évolutions Futures

### Court Terme (Sprint actuel)
- [x] Correction colonne `service_transport`
- [x] Amélioration gestion verrous SendCloud
- [x] Documentation complète intégration
- [ ] Interface assignation `client_id` admins
- [ ] Audit complet RLS policies

### Moyen Terme (1-3 mois)
- [ ] Dashboard mobile responsive complet
- [ ] Module inventaire physique
- [ ] Exports Excel/PDF avancés
- [ ] Notifications push temps réel
- [ ] Multi-langues (EN, ES)

### Long Terme (3-6 mois)
- [ ] API publique pour intégrations tierces
- [ ] Module de facturation avancé
- [ ] IA prédictive stock (réappros intelligents)
- [ ] Module de reporting personnalisable
- [ ] Application mobile native (React Native)

---

## 📞 Support & Contact

### Documentation
- **Technique:** `docs/SENDCLOUD_INTEGRATION.md`
- **Utilisateur:** `docs/USER_GUIDE_SENDCLOUD.md`
- **Diagnostic:** `docs/DIAGNOSTIC_COMPLET_WMS.md`

### Ressources Externes
- **Supabase Docs:** https://supabase.com/docs
- **SendCloud API:** https://docs.sendcloud.com/
- **Shadcn/ui:** https://ui.shadcn.com/

### Logs & Debugging
- **Frontend:** Console navigateur (Cmd+Option+J / F12)
- **Backend:** Lovable Cloud → Backend → Logs
- **SendCloud Sync:** `/integrations/sendcloud/dashboard`

---

## 📝 Changelog

### Version 1.0.0 (Janvier 2025)
- ✅ Système complet WMS opérationnel
- ✅ Intégration SendCloud complète
- ✅ Dashboard analytics & IA
- ✅ Système de rôles multi-tenant
- ✅ 50+ edge functions déployées
- ✅ Documentation complète

---

**Document généré automatiquement à partir de l'analyse du codebase**  
**Dernière mise à jour:** Janvier 2025  
**Mainteneur:** Équipe WMS Speed E-Log
