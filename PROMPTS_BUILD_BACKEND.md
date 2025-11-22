# 🎯 PROMPTS POUR CONSTRUIRE LE BACKEND WMS

**BUT** : Instructions ultra-précises à donner à un AI pour construire le backend complet du WMS pour Lovable.

**ARCHITECTURE** : Supabase (PostgreSQL + Edge Functions) + Lovable Frontend

---

## 📋 PROMPT 1 : SCHEMA BASE DE DONNÉES CORE

```
Crée le schéma de base de données PostgreSQL pour un WMS (Warehouse Management System) complet.

TABLES ESSENTIELLES À CRÉER :

1. **client** (entreprises clientes)
   - id (uuid primary key)
   - nom (text)
   - siret (text)
   - adresse (text)
   - email (text)
   - telephone (text)
   - created_at (timestamp)

2. **profiles** (utilisateurs étendus de Supabase Auth)
   - id (uuid primary key, FK vers auth.users)
   - client_id (uuid FK vers client) -- CRITIQUE
   - nom (text)
   - prenom (text)
   - role (text) -- 'admin', 'gestionnaire', 'operateur', 'client'
   - created_at (timestamp)

3. **produit** (catalogue produits)
   - id (uuid primary key)
   - client_id (uuid FK vers client)
   - sku (text unique)
   - nom (text)
   - description (text)
   - poids (decimal)
   - longueur (decimal)
   - largeur (decimal)
   - hauteur (decimal)
   - prix_unitaire (decimal)
   - stock_disponible (integer default 0)
   - stock_reserve (integer default 0)
   - seuil_alerte (integer default 10)
   - code_barre (text)
   - created_at (timestamp)

4. **emplacement** (zones/emplacements entrepôt)
   - id (uuid primary key)
   - client_id (uuid FK vers client)
   - code (text unique) -- ex: "A-05-3" (Allée-Rack-Niveau)
   - allee (text) -- A-Z
   - rack (text) -- 01-99
   - niveau (integer) -- 1-10
   - type (text) -- 'picking', 'stockage', 'quarantaine'
   - capacite_max (integer)
   - occupe (boolean default false)
   - created_at (timestamp)

5. **mouvement_stock** (traçabilité complète)
   - id (uuid primary key)
   - client_id (uuid FK vers client)
   - produit_id (uuid FK vers produit)
   - emplacement_source_id (uuid FK vers emplacement nullable)
   - emplacement_destination_id (uuid FK vers emplacement nullable)
   - type_mouvement (text) -- 'RECEPTION', 'SORTIE', 'TRANSFERT', 'AJUSTEMENT', 'RESERVATION', 'RETOUR', 'REBUT'
   - quantite (integer)
   - user_id (uuid FK vers profiles)
   - reference_document (text) -- n° commande, BL, etc.
   - commentaire (text)
   - created_at (timestamp)

6. **commande** (commandes clients)
   - id (uuid primary key)
   - client_id (uuid FK vers client)
   - numero_commande (text unique)
   - statut_wms (text) -- 'nouveau', 'validé', 'préparé', 'expédié', 'livré', 'annulé'
   - date_commande (timestamp)
   - priorite (text) -- 'standard', 'express', 'urgent'
   - nom_client (text)
   - prenom_client (text)
   - email_client (text)
   - telephone_client (text)
   - adresse_livraison (text)
   - code_postal (text)
   - ville (text)
   - pays (text)
   - montant_total (decimal)
   - transporteur_id (uuid FK vers transporteur_configuration nullable)
   - service_transport_id (uuid FK vers transporteur_service nullable)
   - tracking_number (text)
   - label_url (text)
   - created_at (timestamp)
   - updated_at (timestamp)

7. **ligne_commande** (détails produits par commande)
   - id (uuid primary key)
   - commande_id (uuid FK vers commande)
   - produit_id (uuid FK vers produit)
   - sku (text)
   - nom_produit (text)
   - quantite (integer)
   - prix_unitaire (decimal)
   - created_at (timestamp)

8. **session_preparation** (sessions de picking)
   - id (uuid primary key)
   - client_id (uuid FK vers client)
   - operateur_id (uuid FK vers profiles)
   - statut (text) -- 'en_cours', 'terminée', 'annulée'
   - type (text) -- 'mono_commande', 'wave_picking'
   - date_debut (timestamp)
   - date_fin (timestamp nullable)
   - created_at (timestamp)

9. **session_ligne** (lignes à picker par session)
   - id (uuid primary key)
   - session_id (uuid FK vers session_preparation)
   - commande_id (uuid FK vers commande)
   - ligne_commande_id (uuid FK vers ligne_commande)
   - produit_id (uuid FK vers produit)
   - emplacement_id (uuid FK vers emplacement)
   - quantite_demandee (integer)
   - quantite_pickee (integer default 0)
   - statut (text) -- 'en_attente', 'en_cours', 'terminé', 'problème'
   - ordre_picking (integer) -- ordre optimisé de passage
   - created_at (timestamp)

10. **transporteur_configuration** (transporteurs disponibles)
    - id (uuid primary key)
    - nom (text) -- 'Colissimo', 'Chronopost', 'DPD', etc.
    - code (text unique)
    - logo_url (text)
    - actif (boolean default true)
    - sendcloud_id (integer nullable)
    - created_at (timestamp)

11. **transporteur_service** (services par transporteur)
    - id (uuid primary key)
    - transporteur_id (uuid FK vers transporteur_configuration)
    - nom (text) -- 'Domicile', 'Point Relais', 'Express'
    - code (text)
    - delai_min (integer) -- heures
    - delai_max (integer) -- heures
    - poids_min (decimal) -- kg
    - poids_max (decimal) -- kg
    - prix_base (decimal nullable)
    - sendcloud_service_id (integer nullable)
    - actif (boolean default true)
    - created_at (timestamp)

12. **retour_produit** (retours clients)
    - id (uuid primary key)
    - client_id (uuid FK vers client)
    - commande_id (uuid FK vers commande)
    - numero_retour (text unique)
    - statut (text) -- 'demandé', 'approuvé', 'refusé', 'en_transit', 'reçu', 'traité'
    - motif (text) -- 'défaut', 'taille', 'changement_avis', 'erreur_commande'
    - commentaire_client (text)
    - decision (text) -- 'remise_stock', 'rebut', 'reparation'
    - label_url (text)
    - created_at (timestamp)
    - updated_at (timestamp)

13. **ligne_retour** (détails produits retournés)
    - id (uuid primary key)
    - retour_id (uuid FK vers retour_produit)
    - ligne_commande_id (uuid FK vers ligne_commande)
    - produit_id (uuid FK vers produit)
    - quantite (integer)
    - etat_produit (text) -- 'neuf', 'bon', 'abime', 'casse'
    - created_at (timestamp)

GÉNÈRE LE CODE SQL COMPLET avec :
- CREATE TABLE pour chaque table
- PRIMARY KEY, FOREIGN KEY, constraints
- INDEX sur les colonnes fréquemment utilisées (client_id, statut, created_at)
- DEFAULT values appropriés
- NOT NULL où nécessaire

Format de sortie : SQL prêt à exécuter dans Supabase.
```

---

## 📋 PROMPT 2 : ROW LEVEL SECURITY (RLS)

```
Crée les politiques RLS (Row Level Security) pour sécuriser l'accès aux données du WMS.

RÈGLES DE SÉCURITÉ :

1. **ADMINS** (role = 'admin')
   - Accès TOTAL à toutes les tables
   - Pas de filtre client_id

2. **GESTIONNAIRES** (role = 'gestionnaire')
   - Accès TOTAL mais filtré par leur client_id
   - Peuvent voir/modifier toutes les données de leur client

3. **OPÉRATEURS** (role = 'operateur')
   - LECTURE sur : produit, emplacement, commande, session_preparation
   - ÉCRITURE sur : mouvement_stock, session_ligne
   - Filtré par client_id

4. **CLIENTS** (role = 'client')
   - LECTURE UNIQUEMENT sur : commande, ligne_commande, produit, mouvement_stock, retour_produit
   - ÉCRITURE sur : retour_produit (leurs propres retours)
   - Strictement filtré par leur client_id

POUR CHAQUE TABLE, GÉNÈRE :

1. ALTER TABLE [table] ENABLE ROW LEVEL SECURITY;

2. CREATE POLICY "admin_all_access" ON [table]
   FOR ALL
   TO authenticated
   USING (
     EXISTS (
       SELECT 1 FROM profiles
       WHERE profiles.id = auth.uid()
       AND profiles.role = 'admin'
     )
   );

3. CREATE POLICY "gestionnaire_client_access" ON [table]
   FOR ALL
   TO authenticated
   USING (
     EXISTS (
       SELECT 1 FROM profiles
       WHERE profiles.id = auth.uid()
       AND profiles.role = 'gestionnaire'
       AND profiles.client_id = [table].client_id
     )
   );

4. CREATE POLICY "operateur_read" ON [table]
   FOR SELECT
   TO authenticated
   USING (
     EXISTS (
       SELECT 1 FROM profiles
       WHERE profiles.id = auth.uid()
       AND profiles.role = 'operateur'
       AND profiles.client_id = [table].client_id
     )
   );

5. CREATE POLICY "client_read_own" ON [table]
   FOR SELECT
   TO authenticated
   USING (
     EXISTS (
       SELECT 1 FROM profiles
       WHERE profiles.id = auth.uid()
       AND profiles.role = 'client'
       AND profiles.client_id = [table].client_id
     )
   );

Adapte ces policies pour CHAQUE table en fonction des règles métier.

Format de sortie : SQL RLS complet prêt à exécuter.
```

---

## 📋 PROMPT 3 : EDGE FUNCTION - CRÉATION COMMANDE

```
Crée une Edge Function Supabase (Deno/TypeScript) pour créer une commande dans le WMS.

NOM FONCTION : create-commande

ENDPOINT : POST /functions/v1/create-commande

INPUT (JSON) :
{
  "numero_commande": "CMD-12345",
  "priorite": "standard",
  "client_infos": {
    "nom": "Dupont",
    "prenom": "Jean",
    "email": "jean.dupont@email.com",
    "telephone": "+33612345678",
    "adresse": "10 rue de la Paix",
    "code_postal": "75001",
    "ville": "Paris",
    "pays": "FR"
  },
  "lignes": [
    {
      "sku": "PROD-001",
      "quantite": 2,
      "prix_unitaire": 29.99
    },
    {
      "sku": "PROD-002",
      "quantite": 1,
      "prix_unitaire": 49.99
    }
  ]
}

LOGIQUE MÉTIER :

1. Vérifier authentification (JWT)
2. Récupérer client_id du user authentifié (depuis profiles)
3. Valider données input (Zod schema)
4. Pour chaque ligne :
   - Vérifier que le produit existe (SELECT produit WHERE sku = ?)
   - Vérifier stock disponible >= quantite
   - Si stock insuffisant : retourner erreur 400
5. Calculer montant_total (sum de quantite * prix_unitaire)
6. INSERT INTO commande avec statut_wms = 'nouveau'
7. Pour chaque ligne : INSERT INTO ligne_commande
8. Pour chaque ligne : UPDATE produit SET stock_reserve = stock_reserve + quantite
9. Retourner { success: true, commande_id, numero_commande }

GESTION ERREURS :
- 401 si non authentifié
- 400 si données invalides
- 400 si stock insuffisant (avec détail SKU manquant)
- 500 si erreur DB

CODE :
- Utilise Deno
- Import @supabase/supabase-js
- Utilise Zod pour validation
- Transaction DB pour atomicité
- Logging avec console.log/error

Format de sortie : Code TypeScript complet de l'Edge Function.
```

---

## 📋 PROMPT 4 : EDGE FUNCTION - VALIDATION COMMANDE

```
Crée une Edge Function Supabase pour valider automatiquement une commande.

NOM FONCTION : validate-commande

ENDPOINT : POST /functions/v1/validate-commande

INPUT (JSON) :
{
  "commande_id": "uuid-123"
}

LOGIQUE MÉTIER :

1. Vérifier authentification (rôle gestionnaire ou admin uniquement)
2. SELECT commande WHERE id = commande_id
3. Vérifier statut actuel = 'nouveau' (sinon erreur 400 "Commande déjà traitée")
4. Appliquer règles de validation :
   - Si montant_total > 500€ → Nécessite validation manuelle (créer entrée dans validation_commande_en_attente)
   - Si pays NOT IN ('FR', 'BE', 'DE', 'ES', 'IT') → Nécessite validation manuelle
   - Si adresse_livraison incomplète → Nécessite validation manuelle
5. Si validation OK :
   - UPDATE commande SET statut_wms = 'validé', updated_at = NOW()
   - Retourner { success: true, statut: 'validé' }
6. Si validation manuelle nécessaire :
   - INSERT INTO validation_commande_en_attente (commande_id, motif, date_demande)
   - UPDATE commande SET statut_wms = 'en_attente_validation'
   - Retourner { success: true, statut: 'en_attente_validation', motif }

TABLE À CRÉER : validation_commande_en_attente
- id (uuid primary key)
- commande_id (uuid FK vers commande)
- motif (text) -- 'montant_eleve', 'pays_risque', 'adresse_incomplete'
- date_demande (timestamp)
- date_traitement (timestamp nullable)
- decision (text nullable) -- 'approuvé', 'refusé'
- user_validateur_id (uuid FK vers profiles nullable)

GESTION ERREURS :
- 401 si non authentifié ou rôle insuffisant
- 404 si commande introuvable
- 400 si commande déjà traitée

Format de sortie : Code TypeScript complet de l'Edge Function + SQL pour table validation_commande_en_attente.
```

---

## 📋 PROMPT 5 : EDGE FUNCTION - SESSION PICKING

```
Crée une Edge Function pour créer une session de picking (préparation commandes).

NOM FONCTION : create-picking-session

ENDPOINT : POST /functions/v1/create-picking-session

INPUT (JSON) :
{
  "commande_ids": ["uuid-1", "uuid-2", "uuid-3"],
  "type": "wave_picking",
  "operateur_id": "uuid-operateur"
}

LOGIQUE MÉTIER :

1. Vérifier authentification (gestionnaire ou admin)
2. Vérifier que toutes les commandes existent et sont statut 'validé'
3. Récupérer toutes les lignes_commande pour ces commandes
4. Pour chaque ligne :
   - SELECT produit pour obtenir emplacement principal
   - Si produit sans emplacement → erreur 400
   - Vérifier stock_disponible >= quantite (sinon erreur)
5. Créer session_preparation :
   - INSERT INTO session_preparation (client_id, operateur_id, statut='en_cours', type, date_debut=NOW())
6. Optimiser ordre de picking :
   - Trier par (allee ASC, rack ASC, niveau ASC) pour parcours optimal
   - Assigner ordre_picking = 1, 2, 3, etc.
7. Pour chaque ligne :
   - INSERT INTO session_ligne (session_id, commande_id, ligne_commande_id, produit_id, emplacement_id, quantite_demandee, statut='en_attente', ordre_picking)
8. UPDATE commande SET statut_wms = 'en_preparation' pour toutes les commandes
9. Retourner { success: true, session_id, nb_lignes, ordre_picking: [...] }

OPTIMISATION PARCOURS :
- Regrouper par zone (Allée A → B → C)
- Dans chaque allée, aller du rack 01 au 99
- Dans chaque rack, niveau 1 au 10
- Minimiser distance totale parcourue

GESTION ERREURS :
- 400 si commandes pas au bon statut
- 400 si stock insuffisant (détailler quel produit)
- 400 si produit sans emplacement

Format de sortie : Code TypeScript complet de l'Edge Function avec algorithme d'optimisation.
```

---

## 📋 PROMPT 6 : EDGE FUNCTION - ENVOI SENDCLOUD

```
Crée une Edge Function pour créer un colis via l'API SendCloud.

NOM FONCTION : sendcloud-create-parcel

ENDPOINT : POST /functions/v1/sendcloud-create-parcel

INPUT (JSON) :
{
  "commande_id": "uuid-123",
  "poids": 2.5,
  "longueur": 30,
  "largeur": 20,
  "hauteur": 10,
  "service_id": 8
}

LOGIQUE MÉTIER :

1. Vérifier authentification
2. SELECT commande WHERE id = commande_id
3. Vérifier statut = 'préparé' (sinon erreur 400)
4. Récupérer lignes_commande pour parcel_items
5. Récupérer configuration_expediteur (adresse expéditeur)
6. Appeler API SendCloud :
   - Endpoint : POST https://panel.sendcloud.sc/api/v2/parcels
   - Headers :
     - Authorization: Basic {base64(public_key:secret_key)}
     - Content-Type: application/json
   - Body :
     {
       "parcel": {
         "name": "{nom_client} {prenom_client}",
         "company_name": "",
         "address": "{adresse_livraison}",
         "city": "{ville}",
         "postal_code": "{code_postal}",
         "country": "{pays}",
         "email": "{email_client}",
         "telephone": "{telephone_client}",
         "weight": "{poids}",
         "length": "{longueur}",
         "width": "{largeur}",
         "height": "{hauteur}",
         "order_number": "{numero_commande}",
         "shipment": {
           "id": {service_id}
         },
         "sender_address": 1,
         "parcel_items": [
           {
             "description": "{nom_produit}",
             "quantity": {quantite},
             "weight": "{poids_unitaire}",
             "value": "{prix_unitaire}"
           }
         ]
       }
     }
7. Récupérer réponse SendCloud :
   - parcel.id
   - parcel.tracking_number
   - parcel.label.label_printer (URL PDF étiquette)
8. INSERT INTO parcel_sendcloud (commande_id, sendcloud_parcel_id, tracking_number, label_url, poids, created_at)
9. UPDATE commande SET tracking_number, label_url, statut_wms='avec_étiquette', updated_at=NOW()
10. Retourner { success: true, tracking_number, label_url }

TABLE À CRÉER : parcel_sendcloud
- id (uuid primary key)
- commande_id (uuid FK vers commande)
- sendcloud_parcel_id (integer)
- tracking_number (text)
- label_url (text)
- poids (decimal)
- created_at (timestamp)

CONFIGURATION :
- Clés API SendCloud stockées dans Supabase secrets :
  - SENDCLOUD_PUBLIC_KEY
  - SENDCLOUD_SECRET_KEY

GESTION ERREURS :
- 401 si clés API SendCloud invalides
- 400 si commande pas au bon statut
- 500 si API SendCloud timeout
- Retry 3 fois en cas d'erreur réseau

Format de sortie : Code TypeScript complet de l'Edge Function avec gestion API SendCloud.
```

---

## 📋 PROMPT 7 : WEBHOOK SENDCLOUD

```
Crée une Edge Function pour recevoir les webhooks SendCloud (événements tracking).

NOM FONCTION : sendcloud-webhook

ENDPOINT : POST /functions/v1/sendcloud-webhook

SÉCURITÉ : verify_jwt = false (webhook public)

INPUT (JSON de SendCloud) :
{
  "action": "parcel_status_changed",
  "timestamp": 1234567890,
  "parcel": {
    "id": 12345,
    "tracking_number": "3SABCD123456789",
    "order_number": "CMD-12345",
    "status": {
      "id": 11,
      "message": "Delivered"
    }
  }
}

LOGIQUE MÉTIER :

1. PAS de vérification JWT (webhook public SendCloud)
2. Rate limiting : Max 100 requêtes/minute par IP (stockage Redis ou table rate_limit)
3. Validation payload (Zod schema)
4. SELECT commande WHERE numero_commande = parcel.order_number
5. Si commande introuvable → Log warning et retourner 200 (éviter retry infini)
6. Mapper statut SendCloud → statut WMS :
   - SendCloud status 11 (Delivered) → 'livré'
   - SendCloud status 6 (In transit) → 'en_transit'
   - SendCloud status 22 (Exception) → 'exception'
   - Autres → 'en_transit'
7. UPDATE commande SET statut_wms = {nouveau_statut}, updated_at = NOW()
8. INSERT INTO sendcloud_event_history (commande_id, sendcloud_status_id, sendcloud_status_message, payload_json, created_at)
9. Si statut = 'exception' :
   - TODO : Créer notification admin
10. Retourner 200 OK { success: true }

TABLE À CRÉER : sendcloud_event_history
- id (uuid primary key)
- commande_id (uuid FK vers commande nullable)
- sendcloud_parcel_id (integer)
- sendcloud_status_id (integer)
- sendcloud_status_message (text)
- payload_json (jsonb) -- payload brut SendCloud
- created_at (timestamp)

GESTION ERREURS :
- Si payload invalide → Log erreur mais retourner 200 (éviter retry SendCloud)
- Si erreur DB → Retourner 500 pour que SendCloud retry
- Créer DLQ (Dead Letter Queue) pour webhooks échoués :
  - INSERT INTO sendcloud_webhook_dlq si erreur

TABLE DLQ : sendcloud_webhook_dlq
- id (uuid primary key)
- payload (jsonb)
- error_message (text)
- retry_count (integer default 0)
- next_retry_at (timestamp)
- created_at (timestamp)

Format de sortie : Code TypeScript complet de l'Edge Function avec gestion webhooks.
```

---

## 📋 PROMPT 8 : TRIGGERS & AUTOMATISATIONS

```
Crée les triggers PostgreSQL pour automatiser les actions du WMS.

TRIGGERS À CRÉER :

1. **auto_update_stock_on_mouvement**
   - TRIGGER : AFTER INSERT ON mouvement_stock
   - ACTION :
     - Si type_mouvement = 'RECEPTION' → UPDATE produit SET stock_disponible = stock_disponible + quantite
     - Si type_mouvement = 'SORTIE' → UPDATE produit SET stock_disponible = stock_disponible - quantite, stock_reserve = stock_reserve - quantite
     - Si type_mouvement = 'RESERVATION' → UPDATE produit SET stock_reserve = stock_reserve + quantite
     - Si type_mouvement = 'AJUSTEMENT' → UPDATE produit SET stock_disponible = quantite (SET absolu, pas incrémentiel)
     - Si type_mouvement = 'RETOUR' → UPDATE produit SET stock_disponible = stock_disponible + quantite
     - Si type_mouvement = 'REBUT' → UPDATE produit SET stock_disponible = stock_disponible - quantite

2. **alerte_stock_faible**
   - TRIGGER : AFTER UPDATE ON produit
   - CONDITION : NEW.stock_disponible <= NEW.seuil_alerte AND OLD.stock_disponible > OLD.seuil_alerte
   - ACTION : INSERT INTO alerte_stock (produit_id, type='stock_faible', message='Stock en dessous du seuil', created_at)

3. **auto_timestamp_updated_at**
   - TRIGGER : BEFORE UPDATE ON commande
   - ACTION : NEW.updated_at = NOW()

4. **verif_stock_avant_sortie**
   - TRIGGER : BEFORE INSERT ON mouvement_stock
   - CONDITION : NEW.type_mouvement = 'SORTIE'
   - ACTION :
     - SELECT stock_disponible FROM produit WHERE id = NEW.produit_id
     - Si stock_disponible < NEW.quantite → RAISE EXCEPTION 'Stock insuffisant'

5. **update_statut_commande_on_picking_complete**
   - TRIGGER : AFTER UPDATE ON session_ligne
   - CONDITION : NEW.statut = 'terminé' AND OLD.statut != 'terminé'
   - ACTION :
     - SELECT COUNT(*) FROM session_ligne WHERE session_id = NEW.session_id AND statut != 'terminé'
     - Si count = 0 (toutes les lignes terminées) :
       - UPDATE session_preparation SET statut = 'terminée', date_fin = NOW()
       - UPDATE commande SET statut_wms = 'préparé' WHERE id IN (SELECT DISTINCT commande_id FROM session_ligne WHERE session_id = NEW.session_id)

TABLE À CRÉER : alerte_stock
- id (uuid primary key)
- produit_id (uuid FK vers produit)
- type (text) -- 'stock_faible', 'rupture_stock'
- message (text)
- lu (boolean default false)
- created_at (timestamp)

FONCTIONS POSTGRESQL :
- Crée les FUNCTION trigger_update_stock() RETURNS TRIGGER
- Crée les FUNCTION trigger_alerte_stock() RETURNS TRIGGER
- etc.

Format de sortie : SQL complet avec CREATE FUNCTION + CREATE TRIGGER.
```

---

## 📋 PROMPT 9 : VUES MATÉRIALISÉES ANALYTICS

```
Crée des vues matérialisées PostgreSQL pour les KPIs et analytics du WMS.

VUES À CRÉER :

1. **mv_kpi_commandes** (KPIs commandes en temps réel)
   - total_commandes_jour (count commandes WHERE created_at >= CURRENT_DATE)
   - total_commandes_semaine
   - total_commandes_mois
   - commandes_nouveau (count WHERE statut = 'nouveau')
   - commandes_en_preparation (count WHERE statut IN ('validé', 'en_preparation'))
   - commandes_expedie (count WHERE statut = 'expédié')
   - commandes_livre (count WHERE statut = 'livré')
   - ca_jour (sum montant_total WHERE created_at >= CURRENT_DATE)
   - ca_semaine
   - ca_mois
   - taux_service (% livré à l'heure)
   - delai_moyen_preparation (avg heures entre 'validé' et 'préparé')
   - GROUP BY client_id, date (pour historique)

2. **mv_stock_valorise** (valorisation stock par client)
   - client_id
   - nb_produits_total (count distinct produit_id)
   - stock_total_disponible (sum stock_disponible)
   - stock_total_reserve (sum stock_reserve)
   - valeur_stock (sum stock_disponible * prix_unitaire)
   - nb_produits_alerte (count WHERE stock_disponible <= seuil_alerte)
   - nb_produits_rupture (count WHERE stock_disponible = 0)

3. **mv_performance_picking** (performance opérateurs)
   - operateur_id
   - nom_operateur (JOIN profiles)
   - nb_sessions_jour
   - nb_sessions_semaine
   - nb_lignes_pickees_jour (sum quantite_pickee)
   - temps_moyen_session (avg durée)
   - productivite (lignes_pickees / heure)
   - taux_erreur (% lignes avec problème)

4. **mv_top_produits** (produits les + vendus)
   - produit_id
   - sku
   - nom
   - nb_ventes_mois (count lignes_commande)
   - quantite_vendue_mois (sum quantite)
   - ca_mois (sum quantite * prix_unitaire)
   - rotation_stock (quantite_vendue / stock_moyen)
   - ORDER BY ca_mois DESC LIMIT 100

5. **mv_analytics_retours** (analytics retours)
   - taux_retour_global (count retours / count commandes livrées)
   - taux_retour_par_motif (GROUP BY motif)
   - produits_plus_retournes (TOP 20)
   - cout_retours_mois (estimation frais)

REFRESH :
- Créer FUNCTION refresh_materialized_views()
- Appeler toutes les heures via pg_cron :
  SELECT cron.schedule('refresh-analytics', '0 * * * *', 'SELECT refresh_materialized_views()');

INDEXES :
- Créer index sur toutes les colonnes de filtrage/tri

Format de sortie : SQL complet CREATE MATERIALIZED VIEW + REFRESH FUNCTION + CRON.
```

---

## 📋 PROMPT 10 : FONCTION RESET CLIENT_ID (CRITIQUE)

```
Crée un script SQL pour assigner en masse les client_id manquants aux utilisateurs.

PROBLÈME IDENTIFIÉ : 80% des utilisateurs ont client_id = NULL → RLS bloque accès.

SOLUTION : Script d'assignation automatique

SQL À GÉNÉRER :

1. **Analyser la situation actuelle**
   SELECT
     COUNT(*) as total_users,
     COUNT(client_id) as users_with_client,
     COUNT(*) - COUNT(client_id) as users_without_client,
     ROUND(100.0 * COUNT(client_id) / COUNT(*), 2) as percentage_with_client
   FROM profiles;

2. **Identifier le client par défaut** (ou créer si inexistant)
   INSERT INTO client (id, nom, siret, adresse, email, telephone, created_at)
   VALUES (
     '00000000-0000-0000-0000-000000000001',
     'Client Par Défaut',
     'N/A',
     'N/A',
     'default@wms.com',
     'N/A',
     NOW()
   )
   ON CONFLICT (id) DO NOTHING;

3. **Assigner client_id par défaut à tous les users sans client_id**
   UPDATE profiles
   SET client_id = '00000000-0000-0000-0000-000000000001'
   WHERE client_id IS NULL;

4. **Vérifier résultat**
   SELECT
     role,
     COUNT(*) as nb_users,
     COUNT(client_id) as with_client_id
   FROM profiles
   GROUP BY role;

5. **Créer fonction pour auto-assignation des nouveaux users**
   CREATE OR REPLACE FUNCTION auto_assign_client_id()
   RETURNS TRIGGER AS $$
   BEGIN
     IF NEW.client_id IS NULL THEN
       NEW.client_id := '00000000-0000-0000-0000-000000000001';
     END IF;
     RETURN NEW;
   END;
   $$ LANGUAGE plpgsql;

   CREATE TRIGGER trigger_auto_assign_client_id
   BEFORE INSERT ON profiles
   FOR EACH ROW
   EXECUTE FUNCTION auto_assign_client_id();

6. **Migration pour Supabase Auth**
   CREATE OR REPLACE FUNCTION handle_new_user()
   RETURNS TRIGGER AS $$
   BEGIN
     INSERT INTO profiles (id, client_id, email, created_at)
     VALUES (
       NEW.id,
       '00000000-0000-0000-0000-000000000001',
       NEW.email,
       NOW()
     );
     RETURN NEW;
   END;
   $$ LANGUAGE plpgsql SECURITY DEFINER;

   CREATE TRIGGER on_auth_user_created
   AFTER INSERT ON auth.users
   FOR EACH ROW
   EXECUTE FUNCTION handle_new_user();

Format de sortie : SQL complet exécutable pour résoudre le problème client_id.
```

---

## 🚀 ORDRE D'EXÉCUTION

**À donner à l'IA dans cet ordre :**

1. PROMPT 1 → Schéma base de données
2. PROMPT 10 → Fix client_id (CRITIQUE)
3. PROMPT 2 → RLS policies
4. PROMPT 8 → Triggers & automatisations
5. PROMPT 9 → Vues matérialisées
6. PROMPT 3 → Edge Function création commande
7. PROMPT 4 → Edge Function validation
8. PROMPT 5 → Edge Function session picking
9. PROMPT 6 → Edge Function SendCloud create parcel
10. PROMPT 7 → Edge Function webhook SendCloud

---

## ✅ VALIDATION

Après chaque prompt, demande à l'IA :
- "Génère le code SQL/TypeScript complet"
- "Prêt à exécuter dans Supabase"
- "Avec gestion d'erreurs complète"
- "Sans dépendances externes non mentionnées"

---

## 🎯 RÉSULTAT FINAL

Tu auras :
- ✅ Base de données complète (13+ tables)
- ✅ RLS sécurisé (4 rôles)
- ✅ 6 Edge Functions opérationnelles
- ✅ Triggers automatiques
- ✅ Analytics en temps réel
- ✅ Fix client_id (80% users débloqués)
- ✅ Intégration SendCloud complète

**TEMPS ESTIMÉ** : 2-3h si tu donnes tous les prompts séquentiellement à un bon LLM (GPT-4, Claude, etc.)

---

## 📌 N8N - À METTRE DE CÔTÉ POUR LE MOMENT

**Recommandation** : N8N n'est PAS nécessaire pour le MVP.

**Utilité future** : Automatisation workflows custom, mais pas critique maintenant.

**Si vraiment nécessaire plus tard** :
- Installer N8N self-hosted ou cloud
- Créer Edge Function `n8n-gateway` comme proxy
- Stocker clé API N8N dans Supabase Vault (PAS hardcodé !)

**Pour MVP : IGNORE N8N.**
