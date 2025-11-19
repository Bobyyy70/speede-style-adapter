# Guide Intégrations - Amazon Seller Central, Shopify & Marketplaces

**Public cible** : Petits clients e-commerce, vendeurs marketplaces, boutiques Shopify
**Date** : Novembre 2025

---

## 🎯 Pour Qui ?

Ce guide s'adresse spécifiquement aux :
- ✅ Vendeurs Amazon Seller Central (PME/TPE)
- ✅ Boutiques Shopify (de 10 à 1000+ commandes/mois)
- ✅ Multi-vendeurs marketplaces (Amazon + eBay + Cdiscount)
- ✅ Petits clients qui débutent dans le e-commerce
- ✅ Dropshippers et revendeurs

**Notre promesse** : Connectez votre boutique en **moins de 15 minutes** et automatisez tout.

---

## 🛒 Amazon Seller Central - Intégration Complète

### Qu'est-ce qu'Amazon Seller Central ?

Amazon Seller Central est la plateforme où les vendeurs tiers gèrent leurs ventes sur Amazon.
**Problème** : La gestion manuelle devient vite ingérable avec le volume de commandes.

### Notre Solution Intégrée

#### ✅ Ce qui est synchronisé automatiquement

1. **Vos Produits** (Amazon → Notre OMS)
   - Catalogue produits complet
   - Prix et descriptions
   - Images
   - Variations (tailles, couleurs)
   - Stock disponible

2. **Vos Commandes** (Amazon → Notre OMS)
   - Import automatique **toutes les 15 minutes**
   - Détails client (adresse, téléphone)
   - Articles commandés
   - Statut paiement
   - Type de livraison (Standard, Prime, etc.)

3. **Votre Stock** (Notre OMS → Amazon)
   - Mise à jour temps réel du stock
   - Évite les surventes (client commande alors que stock = 0)
   - Sync multi-canaux (Amazon + votre site = même stock)

4. **Tracking Livraison** (Notre OMS → Amazon)
   - Numéro de tracking automatique
   - Statut expédition
   - Date de livraison estimée
   - Infos transporteur

#### 🚀 Configuration en 5 Étapes

**Étape 1** : Récupérer vos clés API Amazon
1. Connectez-vous à [Seller Central](https://sellercentral.amazon.fr)
2. Allez dans `Paramètres` > `Informations sur le compte d'utilisateur`
3. Section `Identifiants du développeur`
4. Copiez votre `Seller ID` et `MWS Auth Token`

**Étape 2** : Dans notre OMS
1. Allez dans `Intégrations` > `Marketplace (40+ apps)`
2. Cherchez "Amazon"
3. Cliquez sur "Configurer"

**Étape 3** : Collez vos clés
```
Seller ID:          [Votre ID vendeur]
MWS Auth Token:     [Votre token]
Marketplace:        [Choisir: Amazon.fr, .co.uk, .de, etc.]
```

**Étape 4** : Choisissez la fréquence de sync
- ⚡ **Temps réel** (webhooks) - Recommandé pour >100 cmd/jour
- 🔄 **Toutes les 15 min** (polling) - PME standard
- 🕐 **Toutes les heures** - Faible volume

**Étape 5** : Testez !
- Cliquez sur "Tester la connexion"
- Vérifiez que vos produits s'importent
- Passez une commande test

✅ **C'est fait !** Vos commandes Amazon arrivent désormais automatiquement dans notre OMS.

#### 💡 Cas d'Usage Réels

**Cas #1 : Petit vendeur qui débute** (10-50 commandes/jour)
```
Avant:
- Copier-coller manuel des commandes Amazon
- Risque d'oublis
- 2h/jour de saisie

Après:
- Import automatique
- 0 erreur
- 0 minute de saisie manuelle
→ Gain: 2h/jour = 60h/mois
```

**Cas #2 : Vendeur multi-pays** (Amazon FR + UK + DE)
```
Avant:
- Se connecter à 3 Seller Central différents
- Gérer 3 stocks séparés
- Confusion totale

Après:
- 1 seul OMS pour tout
- Stock centralisé
- Visibilité complète
→ Gain: Gestion unifiée
```

**Cas #3 : Gestion FBA (Fulfillment by Amazon)**
```
Notre OMS détecte automatiquement:
- Commandes FBA (Amazon expédie)
- Commandes FBM (vous expédiez)

Actions automatiques:
- FBA → Marqué comme "expédié par Amazon"
- FBM → Workflow préparation standard
```

#### ⚠️ Problèmes Courants & Solutions

**Problème** : "Mes commandes ne s'importent pas"
- ✅ Vérifiez que le MWS Auth Token est valide
- ✅ Vérifiez le marketplace (FR vs UK vs DE)
- ✅ Attendez 15 min (délai sync)

**Problème** : "Le stock ne se met pas à jour sur Amazon"
- ✅ Activez "Sync stock automatique"
- ✅ Vérifiez que le SKU correspond (même code produit)
- ✅ Amazon peut mettre 10 min à rafraîchir

**Problème** : "J'ai des commandes en double"
- ✅ Ne jamais importer manuellement + auto en même temps
- ✅ Notre système détecte les doublons (via Order ID Amazon)

---

## 🏪 Shopify - Sync Temps Réel

### Pourquoi Shopify + Notre OMS ?

Shopify est parfait pour vendre, mais **limité pour la logistique avancée** :
- ❌ Pas de gestion multi-entrepôts
- ❌ Pas de picking optimisé
- ❌ Pas de règles de routage avancées
- ❌ Analytics limitées

**Notre OMS complète Shopify** pour la partie logistique.

### ✅ Ce qui est synchronisé

1. **Produits** (Shopify ↔ Notre OMS)
   - Sync bi-directionnelle
   - Créer un produit dans Shopify → apparaît dans OMS
   - Mettre à jour stock dans OMS → mis à jour sur Shopify

2. **Commandes** (Shopify → Notre OMS)
   - **Temps réel via webhooks** (instantané !)
   - Dès qu'un client commande → commande dans OMS
   - Détails complets (client, produits, paiement)

3. **Stock** (Notre OMS → Shopify)
   - Temps réel aussi
   - Vous préparez une commande → stock Shopify mis à jour
   - Évite les surventes

4. **Tracking** (Notre OMS → Shopify)
   - Numéro de suivi auto-envoyé à Shopify
   - Client reçoit email Shopify avec tracking
   - Statut "Expédié" mis à jour

### 🚀 Configuration Shopify (3 minutes)

**Étape 1** : Installer notre App Shopify
1. Dans notre OMS : `Intégrations` > `Shopify`
2. Cliquez "Installer"
3. Vous êtes redirigé vers Shopify

**Étape 2** : Autoriser l'application
- Shopify demande les permissions
- Cliquez "Installer l'application"
- C'est tout !

**Étape 3** : Vérification
- Retour automatique dans notre OMS
- Status "✅ Connecté"
- Vos produits Shopify s'importent

✅ **Terminé !** Sync temps réel activée.

### 💡 Cas d'Usage Shopify

**Cas #1 : Boutique qui grandit** (de 10 à 100+ cmd/jour)
```
Avant:
- Shopify basique OK pour 10 commandes
- Chaos à 50+ commandes/jour
- Erreurs de préparation
- Pas de tracking précis

Après:
- Workflow picking professionnel
- Scan codes-barres
- 0 erreur
- Tracking auto
→ Passage à l'échelle fluide
```

**Cas #2 : Multi-canaux** (Shopify + Amazon)
```
Avant:
- Stock Shopify séparé du stock Amazon
- Surventes fréquentes
- Gestion manuelle cauchemardesque

Après:
- 1 stock centralisé
- Shopify + Amazon sync sur même stock
- Impossible de survendre
→ Stock unifié magique
```

**Cas #3 : Dropshipping**
```
Notre OMS détecte:
- Produits en stock local (vous expédiez)
- Produits dropshipping (fournisseur expédie)

Routage automatique:
- Stock local → workflow picking
- Dropshipping → notification fournisseur
```

### 🎁 Bonus Shopify

**Feature 1** : Multi-boutiques Shopify
- Gérez 5 boutiques Shopify différentes
- 1 seul OMS pour tout
- Stock partagé ou séparé (au choix)

**Feature 2** : Shopify POS (Point de Vente)
- Les ventes en magasin Shopify POS
- Arrivent aussi dans notre OMS
- Stock sync magasin ↔ online

**Feature 3** : Shopify Markets (International)
```
Shopify Markets = vendez à l'international
Notre OMS gère:
- Commandes multi-devises
- Adresses internationales
- Douanes (si besoin)
```

---

## 🔄 Multi-Marketplaces (Petits Clients)

### Pourquoi Vendre sur Plusieurs Marketplaces ?

**Réalité des petits clients** :
- Amazon seul = trop de concurrence
- eBay = niche intéressante
- Cdiscount = marché français
- Rakuten = complément

**Objectif** : Être présent partout où sont vos clients.

### Notre Solution Multi-Marketplaces

#### Configuration Recommandée pour Petits Clients

**Pack Starter** (Gratuit)
```
✅ Shopify (votre site)
✅ Amazon Seller Central (FR)
✅ SendCloud (transporteurs)

Commandes attendues: 50-200/mois
Temps setup: 30 minutes
```

**Pack Croissance** (Recommandé)
```
✅ Shopify
✅ Amazon FR + UK
✅ eBay
✅ Cdiscount
✅ SendCloud

Commandes attendues: 200-1000/mois
Temps setup: 1-2 heures
```

**Pack Pro**
```
✅ Shopify + WooCommerce (2 sites)
✅ Amazon FR + UK + DE
✅ eBay
✅ Cdiscount
✅ Rakuten
✅ SendCloud + DHL

Commandes attendues: 1000+/mois
Temps setup: 1 journée
```

### 💰 Pricing Transparent pour Petits Clients

**Notre OMS** : Gratuit jusqu'à 100 commandes/mois

**Amazon Seller Central** :
- Abonnement Pro : 39€/mois
- Commission : 8-15% par vente

**Shopify** :
- Plan Basic : 29€/mois
- Plan Shopify : 79€/mois (recommandé)

**SendCloud** :
- À partir de 20€/mois
- Ou inclus dans notre OMS (selon plan)

**Total exemple** (Boutique 200 cmd/mois)
```
Shopify Basic:              29€/mois
Amazon Pro:                 39€/mois
SendCloud:                  20€/mois
Notre OMS:                  GRATUIT (< 100) ou 49€/mois
────────────────────────────────────
TOTAL:                      88-137€/mois

ROI si vous faites 200 cmd/mois:
→ Gain temps: 40h/mois
→ Gain productivité: 500€/mois
→ ROI positif dès le 1er mois
```

---

## 📊 Tableau Comparatif Marketplaces

| Marketplace | Commission | Volume Clients | Concurrence | Nos Conseils |
|-------------|-----------|----------------|-------------|--------------|
| **Amazon FR** | 8-15% | ⭐⭐⭐⭐⭐ Énorme | Très haute | Must-have mais difficile seul |
| **Shopify** | 0% (votre site) | Dépend de vous | Nulle | Contrôle total, recommandé |
| **eBay** | 10-12% | ⭐⭐⭐⭐ Grand | Moyenne | Bon complément Amazon |
| **Cdiscount** | 5-15% | ⭐⭐⭐ Moyen FR | Moyenne | Marketplace française |
| **Rakuten** | 10-15% | ⭐⭐ Petit FR | Faible | Niche intéressante |
| **Fnac** | 12-18% | ⭐⭐⭐ Moyen | Faible | Produits culturels/tech |

**Notre recommandation pour débuter** :
1. **Shopify** (votre site) → Contrôle total
2. **Amazon FR** → Volume
3. **Un seul autre** (eBay OU Cdiscount) → Test

Après 6 mois, si ça marche : ajoutez les autres.

---

## 🎓 Guide Pas-à-Pas : Petit Client Qui Débute

### Jour 1 : Setup Shopify
```
Matin:
✅ Créer compte Shopify (essai 14 jours gratuit)
✅ Ajouter 10 produits tests
✅ Configurer paiement (Stripe/PayPal)

Après-midi:
✅ Connecter Shopify à notre OMS (3 min)
✅ Vérifier sync produits
✅ Passer commande test
```

### Jour 2 : Setup Amazon Seller Central
```
Matin:
✅ Créer compte Amazon Seller (Plan Pro 39€)
✅ Uploader produits (import CSV ou 1 par 1)
✅ Attendre validation Amazon (1-24h)

Après-midi:
✅ Récupérer clés API Amazon
✅ Connecter Amazon à notre OMS
✅ Vérifier import commandes
```

### Jour 3 : Setup Expédition
```
Matin:
✅ Créer compte SendCloud (gratuit)
✅ Connecter SendCloud à notre OMS
✅ Configurer transporteurs (Colissimo, Chronopost)

Après-midi:
✅ Tester workflow complet:
   1. Client commande sur Shopify
   2. Commande arrive dans OMS
   3. Vous préparez
   4. Étiquette auto-générée
   5. Tracking envoyé client
```

### Jour 4-5 : Test & Optimisation
```
✅ Inviter 3-5 amis à commander
✅ Traiter vraies commandes
✅ Chronométrer temps de préparation
✅ Identifier blocages
✅ Optimiser workflow
```

### Jour 6-7 : Lancement !
```
✅ Activer publicités (Facebook, Google)
✅ Promouvoir sur réseaux sociaux
✅ Gérer vraies commandes clients
✅ Support client si questions
```

**Après 1 mois** : Analyser chiffres
- Combien de commandes ? (Shopify vs Amazon)
- Quel panier moyen ?
- Taux de retour ?
- Temps moyen préparation ?

→ **Décider** : ajouter eBay/Cdiscount ou pas ?

---

## 🆘 Support Petits Clients

### Problèmes Fréquents & Solutions

**Problème #1** : "Je ne vends rien sur Amazon"
```
Causes possibles:
❌ Prix trop haut vs concurrence
❌ Photos de mauvaise qualité
❌ Pas d'avis clients
❌ Description non optimisée

Solutions:
✅ Benchmarker prix concurrents
✅ Investir dans photos pro
✅ Programme "Vine" Amazon (avis gratuits)
✅ Optimiser titres produits (SEO Amazon)
```

**Problème #2** : "Je ne sais pas quel prix mettre"
```
Formule simple:
Prix de vente = (Coût achat × 2,5) + Frais fixes

Exemple:
- Coût achat produit: 10€
- Frais Amazon (15%): 3,75€
- Frais SendCloud: 4€
- Marge souhaitée: 30%

→ Prix de vente: 25€
→ Marge nette: ~7€
```

**Problème #3** : "Trop de retours clients"
```
Analyse:
✅ Quel type de retour ? (insatisfaction vs erreur taille)
✅ Quel marketplace ? (Amazon vs Shopify)
✅ Quel produit ?

Solutions selon cause:
- Photos trompeuses → Refaire photos
- Mauvaise qualité → Changer fournisseur
- Problème tailles → Guide des tailles détaillé
```

**Problème #4** : "Je perds de l'argent"
```
Dashboard notre OMS → Analytics
→ Voir rentabilité par:
  - Marketplace
  - Produit
  - Client

Action:
✅ Couper produits non rentables
✅ Augmenter prix si possible
✅ Négocier coûts fournisseurs
✅ Optimiser frais transport (SendCloud)
```

---

## 📞 Ressources & Aide

### Documentation Officielle

**Amazon Seller Central**
- [Guide du vendeur](https://sellercentral.amazon.fr/gp/help/external/help-page.html)
- [Formation gratuite](https://sell.amazon.fr/learn)

**Shopify**
- [Centre d'aide](https://help.shopify.com/fr)
- [Shopify Academy](https://www.shopify.com/fr/academy) (vidéos gratuites)

**Notre OMS**
- Documentation : `/help`
- Vidéos tutoriels : [YouTube](#)
- Support chat : 9h-18h du lun-ven

### Communauté

**Forums recommandés** :
- r/AmazonSeller (Reddit)
- Groupe Facebook "Vendeurs Amazon France"
- Forum Shopify FR

**Nos webinaires gratuits** :
- "Débuter sur Amazon Seller Central" - Chaque lundi 14h
- "Optimiser Shopify pour PME" - Chaque mercredi 14h
- "Multi-marketplaces sans stress" - Chaque vendredi 14h

---

## ✅ Checklist Succès Petit Client

**Avant de lancer** :
- [ ] Compte Shopify créé et configuré
- [ ] 10+ produits uploadés avec belles photos
- [ ] Compte Amazon Seller Central validé
- [ ] Produits sur Amazon (min 5 pour tester)
- [ ] Compte SendCloud + transporteurs configurés
- [ ] Notre OMS connecté à tout
- [ ] Workflow testé avec commande factice
- [ ] Politique retours définie
- [ ] CGV rédigées (obligatoire)
- [ ] Mentions légales OK

**Premiers 30 jours** :
- [ ] Traiter min 10 commandes
- [ ] Répondre à tous avis/questions <24h
- [ ] Analyser d'où viennent commandes (Shopify vs Amazon)
- [ ] Calculer rentabilité réelle
- [ ] Optimiser 2-3 choses bloquantes
- [ ] Demander avis aux clients satisfaits

**Après 3 mois** :
- [ ] Décision : ajouter marketplace supplémentaire ?
- [ ] Élargir catalogue produits
- [ ] Investir marketing (si rentable)
- [ ] Automatiser davantage (notre OMS features avancées)

---

**🎉 Vous êtes prêt à lancer votre business e-commerce !**

Questions ? Contactez notre support débutants : `support@votreoms.com`

---

*Mis à jour : Novembre 2025*
*Version : 1.0 pour Petits Clients*
