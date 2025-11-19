# 📱 Interface PDA - WMS Speed E-Log

**Date:** Novembre 2025
**Version:** 1.0.0
**Statut:** ✅ Production Ready

---

## 🎯 Vue d'Ensemble

L'interface PDA (Personal Digital Assistant) est une suite complète de modules mobiles optimisés pour les opérations d'entrepôt sur terminaux portables. Elle permet aux opérateurs de réaliser toutes les opérations critiques directement sur le terrain avec des terminaux PDA ou smartphones.

### Caractéristiques principales

- ✅ Interface mobile-first optimisée pour petits écrans
- ✅ Scan de codes-barres (hardware + caméra)
- ✅ Reconnaissance vocale pour saisie mains-libres
- ✅ Impression d'étiquettes et documents
- ✅ Gestion complète des lots et numéros de série
- ✅ Synchronisation temps réel avec la base de données
- ✅ Mode hors-ligne (à implémenter - roadmap)

---

## 🏗️ Architecture

### Structure des fichiers

```
src/
├── components/pda/
│   ├── ScannerInput.tsx      # Composant de scan codes-barres
│   ├── VoiceInput.tsx         # Composant de reconnaissance vocale
│   ├── PrintButton.tsx        # Composant d'impression
│   └── PDALayout.tsx          # Layout commun pour tous les modules
└── pages/pda/
    ├── PDAHome.tsx            # Page d'accueil - sélection modules
    ├── PDAReception.tsx       # Module réception marchandises
    ├── PDAInventaire.tsx      # Module inventaire physique
    ├── PDAMouvements.tsx      # Module mouvements de stock
    ├── PDAControleQualite.tsx # Module contrôle qualité
    └── PDARetours.tsx         # Module gestion retours
```

### Routes

| Route | Module | Rôles autorisés |
|-------|--------|-----------------|
| `/pda` | Page d'accueil | admin, operateur, gestionnaire |
| `/pda/reception` | Réception | admin, operateur, gestionnaire |
| `/pda/inventaire` | Inventaire | admin, operateur, gestionnaire |
| `/pda/mouvements` | Mouvements | admin, operateur, gestionnaire |
| `/pda/controle-qualite` | Contrôle qualité | admin, operateur, gestionnaire |
| `/pda/retours` | Retours | admin, operateur, gestionnaire |

---

## 📦 Modules

### 1. Réception de Marchandises (`/pda/reception`)

**Fonctionnalités :**
- Scanner l'attendu de réception
- Scanner les produits reçus
- Saisir quantités et lots
- Gérer dates de fabrication et péremption
- Imprimer étiquettes produits

**Workflow :**
1. Scanner le numéro d'attendu
2. Scanner le code produit
3. Saisir la quantité (clavier ou vocal)
4. Optionnel : numéro de lot, dates
5. Valider → création mouvement de stock
6. Imprimer étiquette si besoin

**Tables utilisées :**
- `attendu_reception`
- `ligne_attendu_reception`
- `mouvement_stock`

---

### 2. Inventaire Physique (`/pda/inventaire`)

**Fonctionnalités :**
- Scanner l'emplacement à inventorier
- Scanner les produits présents
- Compter les quantités physiques
- Détecter les écarts avec le théorique
- Générer les ajustements de stock

**Workflow :**
1. Scanner l'emplacement
2. Scanner chaque produit présent
3. Saisir la quantité comptée (+ ou - selon écart)
4. Optionnel : numéro de lot
5. Répéter pour tous les produits
6. Valider → créer les mouvements d'ajustement

**Statistiques affichées :**
- Nombre de comptages
- Nombre d'écarts détectés
- Total des écarts (valeur absolue)

**Tables utilisées :**
- `emplacement`
- `produit`
- `stock_disponible` (vue)
- `mouvement_stock`

---

### 3. Mouvements de Stock (`/pda/mouvements`)

**Fonctionnalités :**
- Déplacer du stock entre emplacements
- Scanner source et destination
- Gérer les lots
- Validation des quantités disponibles

**Workflow :**
1. Scanner l'emplacement source
2. Scanner l'emplacement destination
3. Scanner le produit à déplacer
4. Saisir la quantité (validation stock disponible)
5. Optionnel : numéro de lot
6. Valider → créer mouvement de type "deplacement"

**Sécurités :**
- Vérification stock disponible source
- Emplacements source ≠ destination
- Validation existence emplacements

**Tables utilisées :**
- `emplacement`
- `produit`
- `stock_disponible` (vue)
- `mouvement_stock`

---

### 4. Contrôle Qualité (`/pda/controle-qualite`)

**Fonctionnalités :**
- Inspecter des produits
- Classifier conformité (conforme, non-conforme, conditionnel)
- Lister les défauts détectés
- Prendre des photos (prévu)
- Imprimer fiches de non-conformité

**Workflow :**
1. Scanner le produit à contrôler
2. Sélectionner le résultat : conforme / non-conforme / conditionnel
3. Si non-conforme : sélectionner les défauts
4. Optionnel : photo, lot, commentaires
5. Valider → si non-conforme, créer mouvement quarantaine
6. Imprimer fiche si besoin

**Types de défauts :**
- Emballage endommagé
- Produit cassé
- Produit sale
- Date de péremption proche
- Étiquetage incorrect
- Quantité incorrecte
- Défaut de fabrication
- Autre

**Actions automatiques :**
- Non-conforme → mouvement vers zone de quarantaine
- Historique conservé localement (à synchroniser)

**Tables utilisées :**
- `produit`
- `mouvement_stock` (type "quarantaine")

**Note :** Une table `controle_qualite` devrait être créée pour persister l'historique complet.

---

### 5. Gestion des Retours (`/pda/retours`)

**Fonctionnalités :**
- Réceptionner les retours clients
- Inspecter l'état des produits
- Définir l'action à effectuer
- Réintégrer au stock si bon état
- Imprimer fiches de retour

**Workflow :**
1. Scanner le numéro de retour
2. Scanner le produit retourné
3. Saisir la quantité reçue
4. Sélectionner l'état du produit (neuf, bon état, endommagé...)
5. Sélectionner l'action (réintégrer, réparer, détruire...)
6. Optionnel : commentaires
7. Valider → si réintégration, créer mouvement de stock
8. Imprimer fiche si besoin

**États possibles :**
- Neuf
- Bon état
- Usage normal
- Endommagé
- Défectueux
- Incomplet

**Actions possibles :**
- Réintégrer au stock
- Réparation
- Destruction
- Retour fournisseur
- Avoir client

**Tables utilisées :**
- `retour_produit`
- `ligne_retour_produit`
- `mouvement_stock`

---

## 🧩 Composants Communs

### ScannerInput

**Localisation :** `src/components/pda/ScannerInput.tsx`

**Props :**
```typescript
interface ScannerInputProps {
  onScan: (value: string) => void;
  placeholder?: string;
  autoFocus?: boolean;
  disabled?: boolean;
  label?: string;
}
```

**Fonctionnalités :**
- Saisie manuelle ou scan hardware
- Bouton caméra (API Barcode Detection - support limité)
- Validation sur Enter
- Auto-focus après scan
- Feedback visuel pendant scan

**Utilisation :**
```tsx
<ScannerInput
  onScan={handleScan}
  placeholder="Scanner le code produit..."
  autoFocus
/>
```

---

### VoiceInput

**Localisation :** `src/components/pda/VoiceInput.tsx`

**Props :**
```typescript
interface VoiceInputProps {
  onVoiceInput: (text: string) => void;
  language?: string;
  disabled?: boolean;
}
```

**Fonctionnalités :**
- Reconnaissance vocale (Web Speech API)
- Support français par défaut
- Feedback visuel pendant écoute
- Extraction automatique des nombres

**Compatibilité :**
- Chrome/Edge : ✅
- Firefox : ❌
- Safari : ⚠️ (partiel)

**Utilisation :**
```tsx
<VoiceInput onVoiceInput={handleVoiceInput} />
```

---

### PrintButton

**Localisation :** `src/components/pda/PrintButton.tsx`

**Props :**
```typescript
interface PrintButtonProps {
  label: string;
  data: any;
  templateType: "etiquette" | "document" | "rapport";
  disabled?: boolean;
  variant?: "default" | "outline" | "secondary";
}
```

**Fonctionnalités :**
- Génération de templates simples
- Impression via fenêtre navigateur
- Format monospace pour codes-barres
- Données dynamiques

**Utilisation :**
```tsx
<PrintButton
  label="Imprimer étiquette"
  templateType="etiquette"
  data={{
    Produit: "Widget Pro",
    Référence: "WID-001",
    Lot: "LOT-2025-001"
  }}
/>
```

---

### PDALayout

**Localisation :** `src/components/pda/PDALayout.tsx`

**Props :**
```typescript
interface PDALayoutProps {
  title: string;
  children: ReactNode;
  showBack?: boolean;
  showHome?: boolean;
  backUrl?: string;
  badge?: string;
  badgeVariant?: "default" | "secondary" | "destructive" | "outline";
}
```

**Fonctionnalités :**
- Header fixe avec titre
- Boutons retour et accueil
- Badge optionnel
- Contenu scrollable
- Padding optimisé mobile

**Utilisation :**
```tsx
<PDALayout title="Réception" badge={numeroAttendu}>
  {/* Contenu du module */}
</PDALayout>
```

---

## 🚀 Utilisation

### Accès à l'interface PDA

1. Se connecter avec un compte **admin**, **operateur** ou **gestionnaire**
2. Naviguer vers `/pda`
3. Sélectionner le module souhaité

### Scan de codes-barres

**Méthode 1 : Scanner hardware (recommandé)**
- Utiliser un terminal PDA avec scanner intégré
- Le scanner se comporte comme un clavier
- Le code est automatiquement saisi dans le champ actif

**Méthode 2 : Saisie manuelle**
- Taper le code dans le champ
- Appuyer sur Enter ou bouton scan

**Méthode 3 : Caméra (expérimental)**
- Cliquer sur le bouton caméra
- Nécessite API Barcode Detection (Chrome/Edge uniquement)

### Mode vocal

1. Cliquer sur "Mode vocal"
2. Autoriser le microphone
3. Parler clairement
4. Le nombre sera extrait automatiquement

---

## 🔧 Configuration

### Prérequis

**Navigateur :**
- Chrome/Edge : ✅ Recommandé (support complet)
- Firefox : ⚠️ Pas de vocal
- Safari : ⚠️ Support partiel

**Matériel recommandé :**
- Terminal PDA avec scanner 1D/2D
- Ou smartphone avec appareil photo (mode caméra)
- Écran minimum 4"
- Connexion réseau stable

**Permissions :**
- Caméra (pour scan visuel)
- Microphone (pour mode vocal)

---

## 📊 Tables de base de données

### Tables existantes utilisées

```sql
-- Réception
attendu_reception
ligne_attendu_reception

-- Stock
produit
emplacement
mouvement_stock
stock_disponible (vue)

-- Retours
retour_produit
ligne_retour_produit
```

### Tables à créer (recommandé)

```sql
-- Historique contrôle qualité
CREATE TABLE controle_qualite (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  produit_id UUID REFERENCES produit(id),
  operateur_id UUID REFERENCES profiles(id),
  resultat VARCHAR(50) NOT NULL, -- conforme, non_conforme, conditionnellement_conforme
  defauts JSONB,
  commentaires TEXT,
  numero_lot VARCHAR(100),
  photo_url VARCHAR(500),
  date_controle TIMESTAMP DEFAULT NOW(),
  client_id UUID REFERENCES client(id)
);

-- Synchronisation PDA (pour mode offline futur)
CREATE TABLE pda_sync_queue (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  module VARCHAR(50) NOT NULL,
  action VARCHAR(50) NOT NULL,
  data JSONB NOT NULL,
  status VARCHAR(20) DEFAULT 'pending',
  created_at TIMESTAMP DEFAULT NOW(),
  synced_at TIMESTAMP,
  error TEXT
);
```

---

## 🔐 Sécurité

### Permissions par rôle

| Module | Admin | Gestionnaire | Opérateur | Client |
|--------|-------|--------------|-----------|--------|
| Réception | ✅ | ✅ | ✅ | ❌ |
| Inventaire | ✅ | ✅ | ✅ | ❌ |
| Mouvements | ✅ | ✅ | ✅ | ❌ |
| Contrôle qualité | ✅ | ✅ | ✅ | ❌ |
| Retours | ✅ | ✅ | ✅ | ❌ |

### Row Level Security (RLS)

Toutes les opérations respectent les policies RLS existantes :
- Filtrage par `client_id`
- Vérification des rôles via `has_role()`
- Isolation des données multi-tenant

---

## 📈 Roadmap

### Version 1.1 (Prévue Q1 2026)

- [ ] Mode hors-ligne avec synchronisation
- [ ] Prise de photos pour contrôle qualité
- [ ] Support Bluetooth pour imprimantes étiquettes
- [ ] Raccourcis clavier pour opérations rapides
- [ ] Historique des dernières opérations
- [ ] Statistiques opérateur en temps réel

### Version 1.2 (Prévue Q2 2026)

- [ ] Module picking intégré au PDA
- [ ] Gestion des zones de quarantaine
- [ ] Calcul automatique d'emplacements optimaux
- [ ] Alertes sonores personnalisables
- [ ] Export des comptages d'inventaire
- [ ] Dashboard opérateur avec KPIs

### Version 2.0 (Long terme)

- [ ] Application mobile native (React Native)
- [ ] Support scan RFID
- [ ] Intégration balances connectées
- [ ] Mode guidé avec réalité augmentée
- [ ] IA pour détection défauts par photo

---

## 🐛 Problèmes connus

### ⚠️ Limitations actuelles

1. **API Barcode Detection**
   - Supportée uniquement sur Chrome/Edge
   - Non disponible sur Firefox et Safari
   - Utiliser scanner hardware en alternative

2. **Web Speech API**
   - Reconnaissance vocale limitée à Chrome/Edge
   - Nécessite connexion internet
   - Précision variable selon environnement sonore

3. **Impression**
   - Utilise fenêtre navigateur standard
   - Pas de connexion directe imprimantes Bluetooth
   - Templates simples (à améliorer)

4. **Mode hors-ligne**
   - Non implémenté dans v1.0
   - Nécessite connexion réseau permanente

---

## 🎓 Guide de démarrage rapide

### Pour les développeurs

```bash
# 1. Cloner et installer
git clone <repo-url>
cd wms-speed-elog
npm install --legacy-peer-deps

# 2. Lancer en dev
npm run dev

# 3. Accéder à l'interface PDA
# → http://localhost:5173/pda
```

### Pour les opérateurs

1. **Se connecter** avec identifiants opérateur
2. **Naviguer** vers `/pda` ou cliquer sur icône PDA
3. **Sélectionner** le module souhaité
4. **Scanner** les codes-barres selon workflow
5. **Valider** chaque opération

### Bonnes pratiques

✅ **À faire :**
- Toujours scanner l'emplacement en premier
- Vérifier les quantités avant validation
- Utiliser le mode vocal dans les environnements bruyants
- Imprimer les étiquettes immédiatement après réception

❌ **À éviter :**
- Ne pas valider sans vérification visuelle
- Ne pas scanner plusieurs fois le même produit
- Ne pas ignorer les alertes d'écart
- Ne pas fermer l'app pendant une opération

---

## 📞 Support

### Documentation
- **Technique :** `docs/PDA_INTERFACE.md` (ce document)
- **Utilisateur :** À créer
- **API :** `docs/PROJECT_STATE_T0.md`

### Contact
- **Issues :** GitHub Issues
- **Support :** support@speed-elog.com (à définir)

---

**Document généré automatiquement**
**Dernière mise à jour :** Novembre 2025
**Mainteneur :** Équipe WMS Speed E-Log
