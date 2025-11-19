# Impression Étiquettes & CN23 - Guide Complet

**Date**: Novembre 2025
**Version**: 2.0

---

## 📋 Table des Matières

1. [Vue d'ensemble](#vue-densemble)
2. [Étiquettes de Transport](#étiquettes-de-transport)
3. [CN23 (Déclarations Douanières)](#cn23-déclarations-douanières)
4. [Workflows Complets](#workflows-complets)
5. [FAQ & Troubleshooting](#faq--troubleshooting)

---

## 🎯 Vue d'ensemble

### Quels documents peut-on générer ?

| Document | Via | Format | Usage |
|----------|-----|--------|-------|
| **Étiquettes de transport** | SendCloud API | PDF | Tous envois (national + international) |
| **CN23** | Fonction interne | HTML/PDF | Douanes (hors UE uniquement) |
| **Facture commerciale** | SendCloud | PDF | International (B2B) |
| **Bordereau de livraison** | Interne | PDF | Picking/Préparation |

---

## 📦 Étiquettes de Transport

### ✅ Comment ça marche actuellement

**IMPORTANT**: Les étiquettes de transport passent **TOUJOURS par l'API SendCloud**.

#### Workflow Standard

```
1. Commande reçue (Amazon/Shopify/etc.)
   ↓
2. Préparation de la commande
   ↓
3. Appel API SendCloud → Création du colis
   ↓
4. SendCloud retourne l'étiquette (PDF)
   ↓
5. Téléchargement automatique de l'étiquette
   ↓
6. Impression (ou stockage dans document_commande)
```

#### Fonctions Backend

**Fichier**: `supabase/functions/sendcloud-create-parcel/index.ts`

**Endpoint**: `POST /functions/v1/sendcloud-create-parcel`

**Payload**:
```json
{
  "commandeId": "uuid-de-la-commande",
  "shipping_method_id": 8,
  "weight": 1.5,
  "auto_print": true
}
```

**Réponse**:
```json
{
  "success": true,
  "parcel_id": 123456,
  "tracking_number": "3SABCD1234567890",
  "label_url": "https://sendcloud.com/labels/ABC123.pdf",
  "carrier": "Colissimo"
}
```

#### Pages UI pour Impression

| Page | Route | Description |
|------|-------|-------------|
| **Préparer Expédition** | `/expedition/preparer` | Interface principale pour créer des colis |
| **Vue Liste Expédition** | `/expedition` | Liste toutes les expéditions + réimpression |
| **Central de Commandes** | `/commandes/central` | Actions en masse (sélection multiple) |
| **SendCloud Documents** | `/integrations/sendcloud-documents` | Accès direct à tous les documents |

### 🖨️ Impression Directe

#### Depuis "Préparer Expédition"

1. Aller sur `/expedition/preparer`
2. Sélectionner la commande
3. Remplir le formulaire de colis:
   - Poids
   - Dimensions (optionnel)
   - Service de transport
4. Cliquer sur **"Créer le Colis"**
5. L'étiquette est générée automatiquement
6. Un lien de téléchargement apparaît immédiatement

#### Impression en Masse (Central de Commandes)

1. Aller sur `/commandes/central`
2. Cocher les commandes à expédier
3. Cliquer sur **"Imprimer Étiquettes"** (barre d'actions)
4. Le système crée tous les colis en batch via SendCloud
5. Téléchargement d'un ZIP contenant toutes les étiquettes

**Code (à implémenter)**:
```typescript
const handlePrintLabels = async (selectedIds: string[]) => {
  const response = await supabase.functions.invoke('sendcloud-create-parcel-batch', {
    body: {
      commande_ids: selectedIds,
      auto_combine_pdfs: true
    }
  });

  // Télécharge le fichier ZIP ou PDF combiné
  const link = document.createElement('a');
  link.href = response.data.combined_label_url;
  link.download = 'etiquettes.pdf';
  link.click();
};
```

### ⚙️ Configuration SendCloud

**Fichier**: `src/pages/expedition/ConfigurationExpedition.tsx`

**Éléments requis**:
- ✅ API Key SendCloud (Public + Secret)
- ✅ Adresse expéditeur par défaut
- ✅ Services de transport activés
- ✅ Webhook configuré pour tracking

**Vérification**:
```bash
# Via l'interface
/expedition/configuration → Vérifier les 4 sections
```

---

## 🌍 CN23 (Déclarations Douanières)

### Quand utiliser le CN23 ?

| Envoi vers | CN23 Requis ? | Alternative |
|------------|---------------|-------------|
| **France** | ❌ Non | Aucune |
| **UE** (Allemagne, Belgique, etc.) | ❌ Non | Aucune |
| **Suisse** | ✅ Oui | Facture commerciale si >1000 CHF |
| **UK** (post-Brexit) | ✅ Oui | Facture commerciale si B2B |
| **USA, Canada, Asie** | ✅ Oui | + Facture commerciale |

### ✅ Génération Automatique

**Fonction Backend**: `supabase/functions/generate-cn23/index.ts`

**Endpoint**: `POST /functions/v1/generate-cn23`

**Payload**:
```json
{
  "commandeId": "uuid-de-la-commande",
  "auto_send_email": false
}
```

**Réponse**:
```json
{
  "success": true,
  "url": "https://votre-bucket.supabase.co/cn23_CMD123_1699876543.html",
  "email_scheduled": false
}
```

### 📄 Format Actuel

**Format**: HTML (peut être imprimé ou converti en PDF par le navigateur)

**Contenu**:
- Expéditeur (votre entreprise)
- Destinataire (client final)
- Liste des articles:
  - Description
  - Quantité
  - Poids unitaire (kg)
  - Valeur unitaire (EUR)
- **Valeur totale déclarée**
- **Poids total**
- Catégorie: "Marchandises commerciales"

**Exemple HTML généré**:
```html
<!DOCTYPE html>
<html>
<head>
  <title>CN23 - Commande CMD-123456</title>
  <style>
    body { font-family: Arial; padding: 20px; }
    table { width: 100%; border-collapse: collapse; }
    th, td { border: 1px solid #000; padding: 8px; }
  </style>
</head>
<body>
  <h1>CN23 - DÉCLARATION EN DOUANE</h1>
  <h3>Commande: CMD-123456</h3>

  <h4>Destinataire</h4>
  <p>John Doe</p>
  <p>123 Main Street</p>
  <p>SW1A 1AA London</p>
  <p>UK</p>

  <table>
    <thead>
      <tr>
        <th>Description</th>
        <th>Quantité</th>
        <th>Poids (kg)</th>
        <th>Valeur (EUR)</th>
      </tr>
    </thead>
    <tbody>
      <tr>
        <td>T-Shirt Cotton Blue</td>
        <td>2</td>
        <td>0.25</td>
        <td>19.99</td>
      </tr>
    </tbody>
  </table>

  <p><strong>Valeur totale:</strong> 39.98 EUR</p>
  <p><strong>Poids total:</strong> 0.50 kg</p>
</body>
</html>
```

### 🖨️ Impression du CN23

#### Méthode 1: Via Central de Commandes

1. Aller sur `/commandes/central`
2. Cocher les commandes internationales (hors UE)
3. Cliquer sur **"Générer CN23"** (barre d'actions)
4. Les CN23 sont générés pour toutes les commandes
5. Téléchargement automatique

#### Méthode 2: Via Détails Commande

1. Aller sur une commande spécifique
2. Section **"Documents"**
3. Cliquer sur **"Générer CN23"**
4. Le fichier HTML s'ouvre dans un nouvel onglet
5. Imprimer avec `Ctrl+P` ou `Cmd+P`

#### Méthode 3: Envoi Automatique Email

```json
{
  "commandeId": "uuid",
  "auto_send_email": true  // ← Active l'envoi automatique
}
```

Le CN23 est envoyé par email au client ET au transporteur automatiquement.

### ⚠️ Validation Pré-génération

Le système vérifie automatiquement:

| Champ | Requis ? | Erreur si manquant |
|-------|----------|--------------------|
| Nom destinataire | ✅ Oui | "Nom du destinataire manquant" |
| Adresse destinataire | ✅ Oui | "Adresse du destinataire manquante" |
| Code postal | ✅ Oui | "Code postal manquant" |
| Ville | ✅ Oui | "Ville manquante" |
| Code pays | ✅ Oui | "Code pays manquant" |
| Valeur totale | ✅ Oui | "Valeur totale manquante ou invalide" |
| Poids total | ✅ Oui | "Poids total manquant ou invalide" |
| Poids unitaire (lignes) | ✅ Oui | "X ligne(s) sans poids unitaire" |
| Prix unitaire (lignes) | ✅ Oui | "X ligne(s) sans prix unitaire" |

**Réponse en cas d'erreur**:
```json
{
  "error": "Informations manquantes pour générer le CN23",
  "details": [
    "Poids total manquant ou invalide",
    "2 ligne(s) sans poids ou prix unitaire"
  ],
  "status": "validation_failed"
}
```

---

## 🔄 Workflows Complets

### Workflow 1: Expédition Nationale (France)

```
1. Commande reçue → Statut: "Stock réservé"
2. Préparation → Statut: "En préparation"
3. Préparation terminée → Statut: "Prête expédition"
4. Aller sur /expedition/preparer
5. Sélectionner la commande
6. Créer le colis SendCloud (Colissimo, Chronopost, etc.)
   → Étiquette générée automatiquement
7. Imprimer l'étiquette
8. Coller sur le colis
9. Statut: "Expédiée" (+ tracking number)
```

**Documents nécessaires**:
- ✅ Étiquette transport (SendCloud)
- ❌ CN23 (pas nécessaire)

### Workflow 2: Expédition UE (Allemagne, Belgique, etc.)

```
1-8. Identique au workflow national
```

**Documents nécessaires**:
- ✅ Étiquette transport (SendCloud)
- ❌ CN23 (pas nécessaire depuis zone UE)

### Workflow 3: Expédition Internationale (UK, Suisse, USA, etc.)

```
1. Commande reçue (vérifier pays = hors UE)
2. Préparation
3. Préparation terminée
4. **GÉNÉRER CN23 D'ABORD** (/commandes/central ou détails commande)
   → Vérifier que toutes les lignes ont:
      - Poids unitaire
      - Prix unitaire
      - Description complète
5. Créer le colis SendCloud
   → Étiquette générée
6. Imprimer étiquette + CN23
7. Coller étiquette sur colis
8. **Glisser CN23 dans pochette transparente** collée sur le colis
9. Expédition
```

**Documents nécessaires**:
- ✅ Étiquette transport (SendCloud)
- ✅ CN23 (généré par fonction interne)
- ⚠️ Facture commerciale si valeur >1000 EUR (via SendCloud ou manuel)

### Workflow 4: Impression en Masse (100+ commandes/jour)

```
1. Aller sur /commandes/central
2. Filtrer par:
   - Statut: "Prête expédition"
   - Date: Aujourd'hui
3. Sélectionner toutes (checkbox en haut)
4. **Séparer national / international**:

   a) Commandes Nationales/UE:
      - Cliquer "Imprimer Étiquettes"
      - Télécharge toutes les étiquettes en batch
      - Imprimer

   b) Commandes Internationales (hors UE):
      - Cliquer "Générer CN23" d'abord
      - Puis "Imprimer Étiquettes"
      - Télécharge étiquettes + CN23
      - Imprimer les deux

5. Statut passe automatiquement à "Expédiée"
6. Tracking envoyé au client par email
```

---

## 🛠️ FAQ & Troubleshooting

### Q1: L'étiquette SendCloud ne se génère pas

**Causes possibles**:
1. ✅ **Configuration SendCloud incomplète**
   - Vérifier `/expedition/configuration`
   - API Key valide ?
   - Adresse expéditeur renseignée ?

2. ✅ **Service de transport non disponible**
   - Vérifier que le service choisi est actif dans SendCloud
   - Vérifier le poids du colis (limites par service)

3. ✅ **Adresse destinataire invalide**
   - Code postal français = 5 chiffres
   - Code postal UK = format "SW1A 1AA"
   - Vérifier que le pays est reconnu par SendCloud

**Solution**:
```bash
# Tester la connexion SendCloud
1. Aller sur /integrations/sendcloud-documents
2. Cliquer sur "Test Connection"
3. Si erreur → Reconfigurer les API Keys
```

### Q2: Le CN23 ne peut pas être généré (erreur validation)

**Erreur**: `"2 ligne(s) sans poids ou prix unitaire"`

**Solution**:
1. Aller sur la commande concernée
2. Section "Lignes de commande"
3. Pour chaque ligne, renseigner:
   - **Poids unitaire** (ex: 0.25 kg)
   - **Prix unitaire** (ex: 19.99 EUR)
4. Sauvegarder
5. Réessayer la génération

**Astuce**: Configurer les poids par défaut dans la fiche produit pour éviter ce problème.

### Q3: Je veux imprimer le CN23 en PDF (pas HTML)

**Solution temporaire**:
1. Générer le CN23 (format HTML)
2. Ouvrir le fichier dans le navigateur
3. Utiliser `Ctrl+P` / `Cmd+P`
4. **Destination**: "Enregistrer en PDF"
5. Sauvegarder

**Solution définitive** (TODO):
- Migrer vers une lib de génération PDF côté backend (PDFKit, Puppeteer, etc.)
- Fichier: `supabase/functions/generate-cn23/index.ts`

### Q4: Peut-on imprimer SANS passer par SendCloud ?

**Réponse**: **NON** pour les étiquettes de transport.

**Raison**:
- Les transporteurs (Colissimo, Chronopost, DHL, UPS, etc.) nécessitent:
  - Un **tracking number** valide généré par leur système
  - Un **code-barres** spécifique
  - Des **informations de routage** (centre de tri, etc.)

- SendCloud gère:
  - La négociation avec les transporteurs
  - La génération des tracking numbers
  - Le format d'étiquette conforme
  - Le tracking en temps réel

**Alternative**: Si vous avez un contrat direct avec un transporteur (ex: Colissimo Pro), vous pouvez:
1. Créer votre propre fonction Edge (ex: `colissimo-create-label`)
2. Appeler l'API Colissimo directement
3. Générer l'étiquette sans SendCloud

### Q5: Comment gérer les retours ?

**Étiquettes Retour**:
1. Aller sur `/expedition/preparer`
2. Cliquer sur "Créer Étiquette Retour"
3. SendCloud génère une étiquette de retour
4. L'étiquette peut être:
   - Envoyée par email au client
   - Imprimée et glissée dans le colis
   - Téléchargeable via un lien

**Fonction**: `supabase/functions/sendcloud-create-return/index.ts`

### Q6: Les tracking numbers ne s'affichent pas

**Causes**:
1. ✅ **Webhook SendCloud non configuré**
   - Aller sur `/integrations/sendcloud-webhook`
   - Vérifier que le webhook est actif
   - URL: `https://votre-projet.supabase.co/functions/v1/sendcloud-webhook`

2. ✅ **Synchronisation désactivée**
   - Aller sur `/integrations/sendcloud/dashboard`
   - Activer "Auto-refresh tracking"

**Solution**:
```typescript
// Forcer une sync manuelle
const { data } = await supabase.functions.invoke('sendcloud-refresh-tracking', {
  body: { commande_id: 'uuid' }
});
```

---

## 📊 Résumé des Capacités

| Fonctionnalité | Disponible ? | Via | Notes |
|----------------|--------------|-----|-------|
| **Étiquettes transport nationales** | ✅ Oui | SendCloud | Colissimo, Chronopost, Mondial Relay |
| **Étiquettes transport internationales** | ✅ Oui | SendCloud | DHL, UPS, FedEx |
| **Étiquettes retour** | ✅ Oui | SendCloud | `sendcloud-create-return` |
| **CN23 (HTML)** | ✅ Oui | Fonction interne | `generate-cn23` |
| **CN23 (PDF)** | ⚠️ Partiel | Manuel (impression navigateur) | TODO: Automatiser |
| **Facture commerciale** | ✅ Oui | SendCloud | Pour B2B international |
| **Impression en masse** | ⚠️ Partiel | Central Commandes | Bouton prêt, backend à finaliser |
| **Envoi email automatique** | ✅ Oui | `auto_send_email: true` | CN23 + Factures |
| **Tracking temps réel** | ✅ Oui | Webhook SendCloud | Statuts: En transit, Livré, Exception |

---

## 🚀 Roadmap Améliorations

### Court Terme (Sprint actuel)
- ✅ Central de Commandes avec filtres avancés
- ⏳ Finaliser impression en masse (batch SendCloud)
- ⏳ Convertir CN23 HTML → PDF automatiquement

### Moyen Terme
- 📋 Templates d'étiquettes personnalisables
- 📋 Génération facture commerciale interne (pas via SendCloud)
- 📋 Intégration directe Colissimo (sans SendCloud)
- 📋 QR Code tracking sur étiquettes

### Long Terme
- 📋 OCR automatique adresses clients
- 📋 Détection automatique besoin CN23 (selon pays)
- 📋 Impression automatique via imprimante réseau (pas de téléchargement)

---

## 📞 Support

**Problèmes SendCloud**:
- Dashboard SendCloud: https://panel.sendcloud.sc/
- Support SendCloud: support@sendcloud.com

**Problèmes Code/Intégration**:
- Fichier de logs: `supabase/functions/sendcloud-create-parcel/index.ts`
- Consulter: `/integrations/sendcloud/dashboard` (logs temps réel)

**Documentation Officielle**:
- SendCloud API: https://docs.sendcloud.sc/api/v2/
- Supabase Edge Functions: https://supabase.com/docs/guides/functions
