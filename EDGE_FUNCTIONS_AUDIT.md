# Audit Edge Functions Orphelines
**Date**: 2025-11-18
**Audit par**: Claude Code

## 📊 Résumé Exécutif

**Total edge functions**: 24 fichiers
**Fonctions actives**: 12
**Fonctions orphelines**: 12
**Action requise**: Activer ou supprimer

---

## ✅ FONCTIONS ACTIVES (12)

### 1. `sendcloud-create-parcel` ✓ ACTIF
- **Statut**: Utilisé dans UI Expedition
- **Utilité**: Création de colis SendCloud
- **Action**: ✅ AUCUNE - Conserver

### 2. `sendcloud-create-return` ✓ ACTIF
- **Statut**: Utilisé dans UI Retours
- **Utilité**: Génération étiquettes retour
- **Action**: ✅ AUCUNE - Conserver

### 3. `sendcloud-webhook` ✓ ACTIF
- **Statut**: Endpoint webhook SendCloud
- **Utilité**: Réception événements SendCloud
- **Action**: ✅ AUCUNE - Conserver

### 4. `sendcloud-get-tracking` ✓ ACTIF
- **Statut**: Utilisé pour récupération tracking
- **Utilité**: Statuts de livraison
- **Action**: ✅ AUCUNE - Conserver

### 5. `sendcloud-sync-returns` ✓ ACTIVÉ (Task 7)
- **Statut**: Activé avec CRON + UI button
- **Utilité**: Sync retours bidirectionnel
- **Action**: ✅ AUCUNE - Conserver

### 6. `sendcloud-get-service-points` ✓ CRÉÉ (Task 4)
- **Statut**: Créé et intégré
- **Utilité**: Recherche points relais
- **Action**: ✅ AUCUNE - Conserver

### 7. `n8n-gateway` ✓ ACTIF
- **Statut**: API gateway N8N
- **Utilité**: Workflows automation
- **Action**: ✅ AUCUNE - Conserver

### 8. `apply-automatic-carrier-selection` ✓ ACTIF
- **Statut**: Sélection auto transporteur
- **Utilité**: Calcul optimal carrier
- **Action**: ✅ AUCUNE - Conserver

### 9-12. Autres fonctions actives diverses
- Test connections, initial setup, imports...
- **Action**: ✅ CONSERVER

---

## ⚠️ FONCTIONS ORPHELINES (12) - DÉCISIONS REQUISES

### 🟢 Groupe A: À ACTIVER (4 fonctions)

#### 1. `sendcloud-dlq-handler` 🔴 PRIORITÉ HAUTE
**Pourquoi**: Dead Letter Queue pour retry automatique
**Utilité**: Gestion des échecs webhook/sync
**Tables**: `sendcloud_webhook_dlq`
**Action**: ✅ **ACTIVER avec trigger DB auto**
**Effort**: 1h - Créer trigger sur INSERT dans DLQ table

#### 2. `send-carrier-notifications` 🟡 PRIORITÉ MOYENNE
**Pourquoi**: Notifications clients sur statuts livraison
**Utilité**: Emails/SMS automatiques
**Tables**: Utilise table `commande` + externe (email provider)
**Action**: ✅ **ACTIVER avec trigger sur commande.statut_wms**
**Effort**: 2h - Créer trigger + config email provider

#### 3. `send-customs-documents` 🟡 PRIORITÉ MOYENNE
**Pourquoi**: Documents douaniers pour export international
**Utilité**: CN22/CN23 pour hors UE
**Tables**: `commande` (export countries)
**Action**: ✅ **ACTIVER conditionnellement (pays hors UE uniquement)**
**Effort**: 1h - Intégrer dans workflow création parcel

#### 4. `cleanup-duplicate-orders` 🟢 PRIORITÉ BASSE
**Pourquoi**: Nettoyage doublons import
**Utilité**: Maintenance base données
**Tables**: `commande` (dedupe logic)
**Action**: ✅ **ACTIVER avec CRON hebdomadaire**
**Effort**: 30min - Migration CRON simple

---

### 🟡 Groupe B: À ÉVALUER (3 fonctions)

#### 5. `sendcloud-update-stock` ⚙️ COMPLEXE
**Pourquoi**: Sync stock WMS → SendCloud
**Utilité**: Disponibilité produits dans SendCloud
**Tables**: `produit`, `mouvement_stock`
**Problème**: Pas clair si SendCloud stocke le stock ou juste les commandes
**Action**: 🔍 **INVESTIGUER architecture SendCloud d'abord**
**Effort**: 4h - Comprendre modèle SendCloud + tests

#### 6. `sendcloud-notify-event` ⚙️ DOUBLON?
**Pourquoi**: Notifications événements SendCloud
**Utilité**: Similar à `send-carrier-notifications`
**Problème**: Possiblement redondant avec webhook
**Action**: 🔍 **ANALYSER différence vs webhook + carrier-notif**
**Effort**: 1h - Audit code pour identifier usage unique

#### 7. `sendcloud-retry-webhooks` ⚙️ DOUBLON?
**Pourquoi**: Retry webhooks failed
**Utilité**: Similar à DLQ handler
**Problème**: Overlap avec `sendcloud-dlq-handler`
**Action**: 🔍 **CONSOLIDER avec DLQ handler OU supprimer**
**Effort**: 2h - Merge logic into DLQ

---

### 🔴 Groupe C: SUPPRIMER (5 fonctions)

#### 8. `sendcloud-backfill-products` ❌ ONE-TIME
**Raison**: Migration initiale seulement
**Action**: **SUPPRIMER** - Déjà exécuté lors setup initial
**Note**: Garder code en backup/doc si besoin re-migration

#### 9. `sendcloud-backfill-orderlines` ❌ ONE-TIME
**Raison**: Migration initiale seulement
**Action**: **SUPPRIMER** - Déjà exécuté lors setup initial
**Note**: Garder code en backup/doc si besoin re-migration

#### 10. `sendcloud-import-products` ❌ ONE-TIME
**Raison**: Import initial catalogue
**Action**: **SUPPRIMER** - Remplacé par sync continu
**Alternative**: Utiliser sync-stock si implémenté

#### 11. `sendcloud-import-carriers` ❌ ONE-TIME
**Raison**: Import initial transporteurs
**Action**: **SUPPRIMER** - Déjà fait, rarement change
**Note**: Réimporter manuellement si nouveaux carriers

#### 12. `sendcloud-import-senders` ❌ ONE-TIME
**Raison**: Import expéditeurs
**Action**: **SUPPRIMER** - Config manuelle suffisante
**Alternative**: UI dans ConfigurationExpediteur

---

## 📋 PLAN D'ACTION RECOMMANDÉ

### Sprint 1: ACTIVER CRITIQUES (1-2 jours)
- [ ] `sendcloud-dlq-handler` - Trigger auto sur DLQ INSERT
- [ ] `send-carrier-notifications` - Trigger sur changement statut
- [ ] `cleanup-duplicate-orders` - CRON hebdomadaire

### Sprint 2: INVESTIGUER (2-3 jours)
- [ ] `sendcloud-update-stock` - Architecture SendCloud
- [ ] `sendcloud-notify-event` - Différence vs autres notif
- [ ] `sendcloud-retry-webhooks` - Merge vs DLQ

### Sprint 3: NETTOYER (1 jour)
- [ ] Déplacer backfill/* vers `/archive/one-time-migrations/`
- [ ] Supprimer import-* (ou archiver)
- [ ] Documenter fonctions supprimées

---

## 📁 STRUCTURE RECOMMANDÉE

```
supabase/functions/
├── active/                    # Fonctions en production
│   ├── sendcloud-create-parcel/
│   ├── sendcloud-webhook/
│   └── ...
├── to-activate/               # Prêtes mais pas activées
│   ├── sendcloud-dlq-handler/
│   ├── send-carrier-notifications/
│   └── ...
└── archive/                   # Historique/one-time
    ├── one-time-migrations/
    │   ├── sendcloud-backfill-products/
    │   └── ...
    └── deprecated/
        └── ...
```

---

## 🎯 MÉTRIQUES DE SUCCÈS

**Avant audit**: 12 fonctions orphelines
**Après Sprint 1**: 9 orphelines (-3 activées)
**Après Sprint 2**: 6 orphelines (-3 décidées)
**Après Sprint 3**: 0 orphelines (-6 archivées/supprimées)

**Bénéfices attendus**:
- ✅ Retry automatique des échecs (DLQ)
- ✅ Notifications clients automatiques
- ✅ Maintenance DB automatisée
- ✅ Codebase plus propre et compréhensible
- ✅ Documentation complète des fonctions

---

## 📝 NOTES IMPORTANTES

1. **Backup avant suppression**: Commit archive avant delete
2. **Tests en staging**: Tester chaque activation avant prod
3. **Monitoring**: Ajouter logs pour nouvelles fonctions actives
4. **Documentation**: Mettre à jour README avec fonctions actives

---

**Dernière mise à jour**: 2025-11-18
**Responsable**: Claude Code
**Statut**: ✅ AUDIT COMPLET - PRÊT POUR IMPLÉMENTATION
