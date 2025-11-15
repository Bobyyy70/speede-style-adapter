# 📦 Guide Utilisateur - Dashboard SendCloud

## 🎯 Objectif
Ce guide vous permet de superviser et gérer les synchronisations avec SendCloud via le Dashboard d'intégration.

---

## 🔐 Accès au Dashboard

### Navigation
1. Connectez-vous à votre compte WMS Speed E-Log
2. Dans le menu principal, cliquez sur **Intégrations**
3. Sélectionnez **SendCloud Dashboard**

### Permissions Requises
- **Administrateur** : Accès complet
- **Gestionnaire** : Accès complet
- **Client** : Pas d'accès

---

## 📊 Sections du Dashboard

### 1. Vue d'Ensemble

#### Badge de Connexion
En haut à droite, vous verrez un badge indiquant l'état de la connexion :
- 🟢 **Connecté** : L'intégration fonctionne normalement
- 🔴 **Non connecté** : Problème de configuration (contacter l'admin)

#### Statistiques Rapides
Trois cartes affichent les métriques clés :
- **Total Syncs** : Nombre total de synchronisations effectuées
- **Taux de Succès** : Pourcentage de syncs réussies (objectif > 95%)
- **Dernière Sync** : Temps écoulé depuis la dernière synchronisation

---

### 2. Actions Principales

#### Synchroniser Maintenant
**Bouton** : `Synchroniser Maintenant` (en haut à droite)

**Utilisation** :
1. Cliquez sur le bouton
2. Un loader apparaît pendant le traitement
3. La table des jobs se met à jour automatiquement

**Quand l'utiliser** :
- Pour forcer une synchronisation immédiate des commandes
- Après avoir ajouté des commandes manuellement dans SendCloud
- Pour tester après une modification de configuration

**Délai** :
- Syncs incrémentielles (dernières 24h) : 30-60 secondes
- Syncs complètes : 2-5 minutes selon le volume

---

### 3. Table des Jobs de Synchronisation

#### Colonnes Affichées
| Colonne | Description | Valeurs Possibles |
|---------|-------------|-------------------|
| **Type** | Nature de la sync | Orders, Products, Carriers |
| **Statut** | Résultat | Success, Partial, Error, Running |
| **Items** | Nombre d'éléments traités | Nombre entier |
| **Durée** | Temps d'exécution | En secondes |
| **Date de Début** | Horodatage du lancement | Format date/heure |

#### Interprétation des Statuts

**🟢 Success** : Tout s'est bien passé
- Toutes les commandes ont été importées
- Aucune erreur détectée
- Rien à faire

**🟡 Partial** : Succès partiel avec quelques échecs
- La majorité des commandes importées
- Quelques items en erreur (voir DLQ)
- Vérifier les détails du job
- Les items en erreur seront rejoués automatiquement

**🔴 Error** : La sync a échoué
- Problème de connexion API SendCloud
- Erreur de configuration
- Contacter l'administrateur

**🔵 Running** : Synchronisation en cours
- Attendre la fin du traitement
- Ne pas relancer de sync

---

### 4. Actions sur les Jobs

#### Voir les Détails
1. Cliquez sur une ligne du tableau
2. Un panneau latéral s'ouvre avec :
   - ID du job
   - Logs détaillés
   - Messages d'erreur (si applicable)
   - Métadonnées techniques

#### Retry un Job Échoué
Si un job est en statut `error` :
1. Ouvrir les détails du job
2. Cliquer sur **"Retry"**
3. Le système relance automatiquement la synchronisation

---

### 5. Graphiques de Performance

#### Performance Timeline
**Graphique en ligne** : Évolution sur 7 jours

**Axes** :
- Axe X : Date
- Axe Y gauche : Durée (secondes)
- Axe Y droit : Items traités

**Interprétation** :
- **Pic de durée** : Augmentation du volume ou ralentissement API
- **Chute d'items** : Moins de commandes reçues
- **Tendance stable** : Fonctionnement normal

#### Success Rate
**Graphique en camembert** : Répartition des statuts

**Couleurs** :
- 🟢 Vert : Success
- 🟡 Jaune : Partial
- 🔴 Rouge : Error

**Objectif** : > 95% de success

#### Volume by Job
**Graphique en barres** : Comparaison par type de job

**Utilité** :
- Identifier quel type de sync consomme le plus de ressources
- Vérifier la fréquence de chaque type

---

## 🛠️ Actions Rapides

### Cas d'Usage Courants

#### 1. "Mes commandes ne s'affichent pas"
**Solution** :
1. Aller sur `/integrations/sendcloud/dashboard`
2. Vérifier la dernière sync
3. Si > 1 heure, cliquer sur "Synchroniser Maintenant"
4. Attendre 30-60 secondes
5. Aller sur `/commandes` → F5 pour rafraîchir

#### 2. "J'ai beaucoup de syncs en erreur"
**Solution** :
1. Vérifier le badge de connexion (doit être 🟢)
2. Si 🔴, contacter l'administrateur
3. Si 🟢, ouvrir les détails d'un job en erreur
4. Lire le message d'erreur
5. Si erreur temporaire, cliquer sur "Retry"

#### 3. "La sync est bloquée depuis longtemps"
**Solution** :
1. Vérifier le statut du job : doit être "Running"
2. Si "Running" depuis > 20 minutes, contacter l'admin
3. L'admin libérera le verrou manuellement si nécessaire

---

## ❓ FAQ

### Q1 : À quelle fréquence les syncs se lancent automatiquement ?
**R** : Les syncs automatiques sont configurées via CRON (généralement toutes les heures). Vous pouvez aussi lancer une sync manuelle à tout moment.

### Q2 : Que signifie "Verrou déjà pris" ?
**R** : Une autre synchronisation est en cours. Le système attend automatiquement 30 secondes puis réessaie. Si l'erreur persiste après 2 tentatives, attendez que la sync en cours se termine.

### Q3 : Les commandes sont-elles importées en temps réel ?
**R** : Non, les commandes sont synchronisées par batch (toutes les X heures ou manuellement). Pour un besoin urgent, utilisez "Synchroniser Maintenant".

### Q4 : Puis-je supprimer un job de sync ?
**R** : Non, les jobs sont conservés pour l'audit. Les anciens jobs sont automatiquement archivés après 90 jours.

### Q5 : Comment savoir si une commande spécifique a été importée ?
**R** : 
1. Aller sur `/commandes`
2. Rechercher par numéro de commande
3. Si trouvée, vérifier le champ `source` = "SendCloud"

### Q6 : Que faire si le taux de succès < 90% ?
**R** : 
1. Investiguer les jobs en erreur (détails)
2. Si erreurs répétées sur même type, contacter l'admin
3. Vérifier que l'API SendCloud est accessible (https://status.sendcloud.com)

---

## 🎓 Bonnes Pratiques

### Routine Quotidienne
1. **Matin** : Vérifier le dashboard (1 min)
   - Badge de connexion : 🟢
   - Dernière sync < 2 heures
   - Taux de succès > 95%

2. **Après-midi** : Si besoin, lancer une sync manuelle
   - Surtout si pic de commandes le matin

3. **Soir** : Vérifier les stats
   - Nombre d'items traités cohérent avec l'activité
   - Pas d'erreurs en attente

### Alertes à Surveiller
🚨 **Critique** : 5 erreurs consécutives → Contacter l'admin immédiatement
⚠️ **Important** : Statut "Partial" récurrent → Investiguer les détails
ℹ️ **Info** : Durée de sync > 5 minutes → Vérifier le volume

---

## 📞 Support

### Problèmes Techniques
Si vous rencontrez un problème que vous ne pouvez pas résoudre :
1. **Capturer l'écran** : Screenshot du dashboard montrant l'erreur
2. **Noter les détails** :
   - Type de job en erreur
   - Message d'erreur exact
   - Heure de l'incident
3. **Contacter l'administrateur système**

### Demandes d'Évolution
Pour suggérer des améliorations du dashboard :
- Envoyer un email à l'équipe technique
- Décrire clairement le besoin métier

---

## 📚 Ressources Complémentaires

- **Documentation Technique** : `docs/SENDCLOUD_INTEGRATION.md`
- **API Reference** : `docs/SENDCLOUD_API.md`
- **Documentation SendCloud** : https://docs.sendcloud.com/
