# 📡 API SendCloud - Guide Complet

## Authentification

### Basic Auth
Toutes les requêtes utilisent l'authentification Basic :
```typescript
const basicAuth = btoa(`${publicKey}:${secretKey}`);

const headers = {
  'Authorization': `Basic ${basicAuth}`,
  'Content-Type': 'application/json'
};
```

### Clés API
Obtenir vos clés : SendCloud Dashboard → Settings → API

---

## Endpoints Principaux

### 1. Orders API (V3)
**Base URL** : `https://panel.sendcloud.sc/api/v3`

#### GET /orders
Récupérer les commandes

**Paramètres** :
| Param | Type | Description |
|-------|------|-------------|
| `created_at__gte` | ISO 8601 | Filtre création >= date |
| `created_at__lte` | ISO 8601 | Filtre création <= date |
| `updated_at__gte` | ISO 8601 | Filtre mise à jour >= date |
| `limit` | integer | Max 100 par page |
| `offset` | integer | Pagination |

**Exemple** :
```bash
GET /api/v3/orders?created_at__gte=2025-01-01T00:00:00Z&limit=100
```

**Réponse** :
```json
{
  "results": [
    {
      "id": "12345",
      "order_number": "ORD-2025-001",
      "email": "client@example.com",
      "name": "Jean Dupont",
      "address": "123 Rue de Paris",
      "city": "Paris",
      "postal_code": "75001",
      "country": "FR",
      "total_order_value": 99.90,
      "currency": "EUR",
      "created_at": "2025-01-10T14:30:00Z",
      "updated_at": "2025-01-10T15:00:00Z"
    }
  ],
  "next": "https://panel.sendcloud.sc/api/v3/orders?offset=100",
  "count": 250
}
```

---

### 2. Parcels API (V2)
**Base URL** : `https://panel.sendcloud.sc/api/v2`

#### GET /parcels
Récupérer les colis

**Paramètres** :
| Param | Type | Description |
|-------|------|-------------|
| `created_date_from` | ISO 8601 | Filtre création >= date |
| `updated_after` | ISO 8601 | Filtre mise à jour >= date |
| `limit` | integer | Max 100 par page |

**Exemple** :
```bash
GET /api/v2/parcels?created_date_from=2025-01-01T00:00:00Z&limit=100
```

**Réponse** :
```json
{
  "parcels": [
    {
      "id": 67890,
      "name": "Jean Dupont",
      "address": "123 Rue de Paris",
      "city": "Paris",
      "postal_code": "75001",
      "country": "FR",
      "order_number": "ORD-2025-001",
      "tracking_number": "3SDEVC123456789",
      "tracking_url": "https://track.sendcloud.com/3SDEVC123456789",
      "carrier": {
        "code": "dpd",
        "name": "DPD France"
      },
      "status": {
        "id": 1000,
        "message": "Ready to send"
      }
    }
  ],
  "next": "https://panel.sendcloud.sc/api/v2/parcels?offset=100"
}
```

---

#### GET /parcels/{id}
Détail d'un colis spécifique

**Exemple** :
```bash
GET /api/v2/parcels/67890
```

**Réponse** : Objet parcel complet avec tous les détails

---

### 3. Shipping Methods API
**Endpoint** : `/api/v2/shipping_methods`

Récupérer les méthodes d'expédition disponibles

**Réponse** :
```json
{
  "shipping_methods": [
    {
      "id": 123,
      "name": "DPD Classic",
      "carrier": "dpd",
      "service_point_input": "none",
      "price": 6.50
    }
  ]
}
```

---

### 4. Carriers API
**Endpoint** : `/api/v2/carriers`

Liste des transporteurs actifs

**Réponse** :
```json
{
  "carriers": [
    {
      "code": "dpd",
      "name": "DPD France",
      "countries": ["FR", "BE", "NL"]
    }
  ]
}
```

---

## Rate Limits

| Endpoint | Limite | Fenêtre |
|----------|--------|---------|
| Orders API | 100 req/min | 60s |
| Parcels API | 100 req/min | 60s |
| Webhooks | 1000/min | 60s |

**Gestion du rate limit** :
```typescript
if (response.status === 429) {
  const retryAfter = response.headers.get('Retry-After') || 60;
  await new Promise(resolve => setTimeout(resolve, retryAfter * 1000));
  // Retry request
}
```

---

## Webhooks SendCloud

### Configuration
1. Aller dans SendCloud Dashboard → Settings → Integrations → Webhooks
2. URL webhook : `https://[project].supabase.co/functions/v1/sendcloud-webhook`
3. Secret : Configurer `SENDCLOUD_WEBHOOK_SECRET` dans les secrets

### Events Supportés
- `parcel_status_changed` : Changement de statut colis
- `shipment_created` : Nouvelle expédition créée
- `label_created` : Étiquette générée
- `return_parcel_created` : Retour créé

**Payload exemple** :
```json
{
  "action": "parcel_status_changed",
  "timestamp": 1704985200,
  "parcel": {
    "id": 67890,
    "tracking_number": "3SDEVC123456789",
    "status": {
      "id": 2000,
      "message": "En cours de livraison"
    }
  }
}
```

---

## Mapping des Statuts

| SendCloud Status ID | Message | Statut WMS |
|---------------------|---------|------------|
| 1 | Announced | `etiquette_generee` |
| 1000 | Ready to send | `pret_expedition` |
| 1999 | Collected | `expedie` |
| 2000 | Being sorted | `expedie` |
| 3 | Delivered | `livre` |
| 6 | Exception | `erreur` |
| 99 | Cancelled | `annule` |

---

## Erreurs Courantes

### 401 Unauthorized
**Cause** : Clés API invalides
**Solution** : Vérifier `SENDCLOUD_API_PUBLIC_KEY` et `SENDCLOUD_API_SECRET_KEY`

### 404 Not Found
**Cause** : Parcel ID inexistant
**Solution** : Vérifier l'ID ou utiliser l'endpoint de recherche

### 429 Too Many Requests
**Cause** : Rate limit dépassé
**Solution** : Implémenter un backoff exponentiel

### 500 Internal Server Error
**Cause** : Erreur côté SendCloud
**Solution** : Réessayer après 5 minutes

---

## Exemples de Code

### Fetch Orders avec Pagination
```typescript
async function fetchAllOrders(startDate: string) {
  const orders = [];
  let offset = 0;
  const limit = 100;
  
  while (true) {
    const response = await fetch(
      `https://panel.sendcloud.sc/api/v3/orders?created_at__gte=${startDate}&limit=${limit}&offset=${offset}`,
      {
        headers: {
          'Authorization': `Basic ${basicAuth}`,
          'Content-Type': 'application/json'
        }
      }
    );
    
    const data = await response.json();
    orders.push(...data.results);
    
    if (!data.next) break;
    offset += limit;
  }
  
  return orders;
}
```

### Créer un Parcel
```typescript
async function createParcel(orderData: any) {
  const response = await fetch(
    'https://panel.sendcloud.sc/api/v2/parcels',
    {
      method: 'POST',
      headers: {
        'Authorization': `Basic ${basicAuth}`,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        name: orderData.name,
        address: orderData.address,
        city: orderData.city,
        postal_code: orderData.postal_code,
        country: orderData.country,
        order_number: orderData.order_number,
        shipment: {
          id: orderData.shipping_method_id
        }
      })
    }
  );
  
  return response.json();
}
```

---

## Ressources

- **Documentation officielle** : https://docs.sendcloud.com/
- **Status page** : https://status.sendcloud.com/
- **Support** : support@sendcloud.com
