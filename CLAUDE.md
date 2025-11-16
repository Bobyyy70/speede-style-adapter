# CLAUDE.md - Guide for AI Assistants

> **Last Updated:** 2025-11-16
> **Project:** WMS Speed E-Log - Warehouse Management System
> **Status:** Production - Active Development

---

## 🎯 Quick Start - What You Need to Know

This is a **full-featured Warehouse Management System (WMS)** for logistics operations. The system handles inventory management, order processing, picking, packing, shipping, and returns with deep integration to SendCloud for shipping automation.

### Critical Information for AI Assistants

**🔴 BEFORE MAKING CHANGES, READ:**
1. **Multi-tenant architecture** - Every data query MUST filter by `client_id`
2. **Known critical issues** - See `/DIAGNOSTIC_COMPLET_WMS.md` before modifying SendCloud integration
3. **RLS is enabled** - All queries are automatically filtered by Row Level Security policies
4. **State transitions required** - Use `useStatutTransition` hook for status changes
5. **No breaking changes** - System is in production with active users

---

## 📚 Tech Stack

- **Frontend:** React 18 + TypeScript + Vite
- **UI Framework:** Shadcn/ui + Tailwind CSS + Radix UI
- **Backend:** Supabase (PostgreSQL + Edge Functions)
- **State Management:** React Query (@tanstack/react-query)
- **Authentication:** Supabase Auth with RLS
- **Forms:** react-hook-form + zod validation
- **Primary Integration:** SendCloud API (V2 & V3)

---

## 🏗️ Project Structure

```
/
├── src/                              # Frontend application
│   ├── components/                   # React components (100+)
│   │   ├── ui/                      # Shadcn UI base components
│   │   ├── analytics/               # Charts and analytics
│   │   ├── expedition/              # Shipping components
│   │   ├── integrations/            # SendCloud components
│   │   └── transitions/             # State transition components
│   ├── pages/                       # Route pages (60+)
│   │   ├── admin/                  # Admin-only pages
│   │   ├── client/                 # Client portal
│   │   ├── commandes/              # Order management
│   │   ├── integrations/           # Integration pages
│   │   └── [others]/               # Stock, shipping, returns, etc.
│   ├── hooks/                       # Custom React hooks
│   │   ├── useAuth.tsx             # Authentication & authorization
│   │   ├── useStatutTransition.tsx # State transitions (IMPORTANT!)
│   │   ├── useAutoRules.tsx        # Business rules engine
│   │   └── useValidationRules.tsx  # Validation rules
│   ├── lib/                         # Utilities
│   │   ├── orderStatuses.ts        # Order status enum
│   │   └── utils.ts                # General utilities
│   ├── integrations/supabase/       # Supabase client
│   │   ├── client.ts               # Supabase instance
│   │   └── types.ts                # Auto-generated DB types
│   └── types/                       # TypeScript definitions
├── supabase/
│   ├── functions/                   # Edge Functions (50+)
│   │   ├── sendcloud-*/            # SendCloud integration (20+)
│   │   ├── _shared/                # Shared utilities
│   │   └── [others]/               # AI, documents, etc.
│   └── migrations/                  # SQL migrations (100+)
├── docs/                            # Documentation
│   ├── PROJECT_STATE_T0.md         # Complete project doc
│   ├── SENDCLOUD_INTEGRATION.md    # SendCloud architecture
│   └── [others]
├── DIAGNOSTIC_COMPLET_WMS.md       # ⚠️ KNOWN ISSUES - READ THIS!
├── PROBLEME_SENDCLOUD_RESUME.md    # SendCloud problems summary
└── .env                             # Environment variables
```

---

## 🗄️ Database Schema - Critical Tables

### Multi-Tenancy (CRITICAL)

**`client`** - Client companies
```sql
- id: UUID PRIMARY KEY
- nom_entreprise: TEXT NOT NULL
- siret: TEXT UNIQUE
- actif: BOOLEAN DEFAULT true
```

**`profiles`** - User profiles
```sql
- id: UUID (FK to auth.users)
- email: TEXT
- nom_complet: TEXT
- client_id: UUID (FK to client)  -- ⚠️ CRITICAL: 80% of users missing this!
- tabs_access: TEXT[]
```

**`user_roles`** - Role assignments
```sql
- user_id: UUID (FK to auth.users)
- role: app_role ('admin', 'operateur', 'gestionnaire', 'client')
```

### Core Business Tables

**`commande`** - Orders (120+ columns)
```sql
- id: UUID
- numero_commande: TEXT UNIQUE NOT NULL
- sendcloud_id: TEXT UNIQUE
- client_id: UUID -- Multi-tenant key
- statut_wms: statut_commande_enum (17 possible states)
- source: TEXT ('sendcloud' | 'manuel')
- nom_client, email_client, telephone_client: TEXT
- adresse_ligne_1, code_postal, ville, pays_code: TEXT
- transporteur, tracking_number, label_url: TEXT
- [many more fields...]
```

**Order Status Flow (17 states):**
```
en_attente_validation → en_attente_reappro → stock_reserve
→ en_picking → picking_termine → en_preparation
→ pret_expedition → etiquette_generee → expedie
→ en_transit → en_livraison → livre
(+ annule, erreur, incident_livraison, retour_expediteur)
```

**`ligne_commande`** - Order lines
```sql
- commande_id: UUID (FK)
- produit_id: UUID (FK)
- quantite_commandee, quantite_preparee: INTEGER
- statut_ligne: TEXT
```

**`produit`** - Products (60+ columns)
```sql
- id: UUID
- client_id: UUID -- Multi-tenant key
- reference: TEXT UNIQUE NOT NULL
- nom: TEXT NOT NULL
- code_barre_ean: TEXT
- stock_actuel, stock_minimum: INTEGER
- poids_unitaire, prix_unitaire: NUMERIC
- dimensions: NUMERIC (L x l x h)
- hs_code: TEXT -- Customs
```

**`mouvement_stock`** - Stock movements (complete audit trail)
```sql
- numero_mouvement: TEXT UNIQUE (auto: MVT-YYYYMMDD-XXXXXX)
- client_id: UUID
- type_mouvement: TEXT ('entrée' | 'sortie' | 'transfert' | 'ajustement' | 'réservation')
- produit_id: UUID
- quantite: INTEGER
- emplacement_source_id, emplacement_destination_id: UUID
```

**`emplacement`** - Storage locations
```sql
- code_emplacement: TEXT UNIQUE
- zone: TEXT
- type_emplacement: TEXT ('picking' | 'stock' | 'réception' | 'expédition')
- statut_actuel: TEXT ('disponible' | 'occupé' | 'réservé' | 'bloqué')
```

### SendCloud Integration Tables

**`sendcloud_sync_logs`** - Sync job history
```sql
- job_name: TEXT
- status: TEXT ('success' | 'error' | 'partial')
- started_at, completed_at: TIMESTAMP
- orders_fetched, orders_created, orders_updated: INTEGER
```

**`sendcloud_dlq`** - Dead Letter Queue (failed messages)
```sql
- message_type: TEXT
- payload: JSONB
- error_message: TEXT
- retry_count: INTEGER
- status: TEXT ('pending' | 'processing' | 'failed' | 'done')
```

**`sync_locks`** - Concurrency control
```sql
- lock_key: TEXT PRIMARY KEY
- owner: TEXT
- acquired_at, expires_at: TIMESTAMP
```

**`transporteur_configuration`** - Carriers
```sql
- sendcloud_carrier_code: TEXT UNIQUE
- nom_transporteur: TEXT
- actif: BOOLEAN
```

**`transporteur_service`** - Shipping methods
```sql
- transporteur_id: UUID (FK)
- sendcloud_shipping_method_id: INTEGER
- nom_affichage: TEXT
- pays_destination: TEXT[]
```

---

## 🔐 Row Level Security (RLS)

### Security Model

**ALL major tables have RLS enabled.** Data access is controlled by:
1. **User role** (via `has_role()` function)
2. **Client ownership** (via `client_id` column)

### Key RLS Functions

```sql
-- Check if user has specific role
has_role(_user_id UUID, _role app_role) RETURNS BOOLEAN

-- Get user's primary role
get_user_role(_user_id UUID) RETURNS app_role

-- Get user's client_id
current_client_id() RETURNS UUID
```

### Example RLS Policies

```sql
-- Admins see everything
CREATE POLICY "Admin full access" ON commande FOR ALL
USING (has_role(auth.uid(), 'admin'))
WITH CHECK (has_role(auth.uid(), 'admin'));

-- Clients see only their data
CREATE POLICY "Client read own data" ON commande FOR SELECT
USING (
  has_role(auth.uid(), 'client')
  AND client_id = (SELECT client_id FROM profiles WHERE id = auth.uid())
);

-- ⚠️ IMPORTANT: If profiles.client_id IS NULL, this returns NO data!
-- See DIAGNOSTIC_COMPLET_WMS.md for details
```

---

## 🎨 Frontend Development Patterns

### Authentication Hook

```typescript
import { useAuth } from '@/hooks/useAuth';

const {
  user,                    // Supabase user
  userRole,                // 'admin' | 'operateur' | 'gestionnaire' | 'client'
  viewingClientId,         // When admin views as client
  hasRole,
  signOut
} = useAuth();
```

### Data Fetching Pattern (React Query)

```typescript
const { data: commandes, isLoading, refetch } = useQuery({
  queryKey: ['commandes', clientId],
  queryFn: async () => {
    const { data, error } = await supabase
      .from('commande')
      .select('*, ligne_commande(*), client:client_id(nom_entreprise)')
      .eq('client_id', clientId)
      .order('date_creation', { ascending: false });

    if (error) throw error;
    return data;
  }
});
```

### State Transition Pattern (MANDATORY)

**⚠️ ALWAYS use this hook for status changes:**

```typescript
import { useStatutTransition } from '@/hooks/useStatutTransition';

const { transition } = useStatutTransition();

const handleExpedier = async () => {
  await transition({
    entityType: 'commande',
    entityId: commandeId,
    nouveauStatut: 'expedie',
    raison: 'Colis remis au transporteur',
    metadata: { tracking_number: '123456789' }
  });

  // This ensures:
  // - Validation of allowed transitions
  // - Audit trail in commande_transition_log
  // - Trigger execution for side effects
};
```

### Form Handling Pattern

```typescript
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import * as z from 'zod';

const formSchema = z.object({
  nom: z.string().min(1, "Requis"),
  quantite: z.number().min(1, "Min: 1")
});

const form = useForm<z.infer<typeof formSchema>>({
  resolver: zodResolver(formSchema),
  defaultValues: { nom: '', quantite: 1 }
});

const onSubmit = async (values: z.infer<typeof formSchema>) => {
  const { error } = await supabase.from('table').insert(values);
  if (error) throw error;
  toast.success('Créé avec succès');
};
```

### Error Handling Pattern

```typescript
try {
  const { data, error } = await supabase.from('table').select();
  if (error) throw error;

  // Process data...

} catch (error: any) {
  console.error('[ComponentName] Error:', error);
  toast.error('Erreur', {
    description: error.message || 'Une erreur est survenue'
  });
}
```

### Real-time Subscriptions

```typescript
useEffect(() => {
  const channel = supabase
    .channel('commandes-realtime')
    .on('postgres_changes', {
      event: 'INSERT',
      schema: 'public',
      table: 'commande',
      filter: `client_id=eq.${clientId}`
    }, (payload) => {
      toast.success('Nouvelle commande reçue !');
      refetch();
    })
    .subscribe();

  return () => supabase.removeChannel(channel);
}, [clientId]);
```

---

## ⚙️ Backend Development - Edge Functions

### SendCloud Integration Functions

**⚠️ CRITICAL - Known Issue:**
`sendcloud-sync-orders` currently times out. See `/DIAGNOSTIC_COMPLET_WMS.md` before modifying.

**Primary Functions:**

- **`sendcloud-sync-orders`** - Main sync (⚠️ needs fixing - see diagnostics)
- **`sendcloud-webhook`** - Receive SendCloud webhooks
- **`sendcloud-dlq-handler`** - CRON: retry failed messages every 10 min
- **`sendcloud-import-carriers`** - Import transporteurs
- **`sendcloud-import-shipping-methods`** - Import services
- **`sendcloud-import-products`** - Sync products
- **`sendcloud-create-parcel`** - Create parcel in SendCloud
- **`sendcloud-get-tracking`** - Get tracking info
- **`sendcloud-fetch-documents`** - Download labels/documents

### Edge Function Pattern

```typescript
import { createClient } from '@supabase/supabase-js'
import { corsHeaders } from '../_shared/cors.ts'

Deno.serve(async (req) => {
  // Handle CORS preflight
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders })
  }

  try {
    const supabase = createClient(
      Deno.env.get('SUPABASE_URL')!,
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!
    )

    // Parse request
    const { param1, param2 } = await req.json()

    // Your logic here...

    return new Response(
      JSON.stringify({ success: true, data }),
      {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        status: 200
      }
    )

  } catch (error: any) {
    console.error('[FunctionName] Error:', error)

    return new Response(
      JSON.stringify({ success: false, error: error.message }),
      {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        status: 500
      }
    )
  }
})
```

### Shared Utilities

Located in `/supabase/functions/_shared/`:

```typescript
// sync-logger.ts
export async function startSyncLog(supabase, jobName, metadata = {})
export async function updateSyncProgress(supabase, logId, progress)
export async function finalizeSyncLog(supabase, logId, status, stats)
export async function pushToDLQ(supabase, messageType, payload, error)
```

---

## ⚠️ Known Issues - MUST READ Before Changes

**📖 Full details:** `/DIAGNOSTIC_COMPLET_WMS.md` and `/PROBLEME_SENDCLOUD_RESUME.md`

### 🔴 CRITICAL Issue #1: Missing client_id

**Problem:** 80% of users don't have `client_id` assigned in `profiles` table.

**Impact:**
- Users can log in but see empty pages
- All RLS policies block data access
- Queries return 0 results

**Root Cause:**
- No automatic assignment when user created
- No admin interface to assign manually
- No onboarding workflow

**Solution Required:**
1. **URGENT**: Create admin UI at `/src/pages/admin/AssignClientToUser.tsx`
2. Add trigger for auto-assignment
3. Implement onboarding wizard

**DO NOT modify RLS policies as a workaround!**

### 🔴 CRITICAL Issue #2: SendCloud Sync Timeout

**Problem:** `sendcloud-sync-orders` times out when processing large batches.

**Symptoms:**
```
[Batch 252/500] Processing 10 parcels...
[Parcel 570150266] ⚠️ Detail fetch failed (429), using summary data
CPU Time exceeded
shutdown
```

**Root Cause:**
```typescript
// Current code (BROKEN):
const TOTAL_PAGES = 500; // ❌ Tries to fetch 5000 parcels in 10 seconds
```

**Required Fix:**
```typescript
// Required changes:
const BATCH_SIZE = 10;              // ✅ Max 10 pages per run
const MAX_ENRICHMENTS_PER_RUN = 50; // ✅ Limit enrichments
const DELAY_BETWEEN_CALLS_MS = 150; // ✅ Rate limit friendly

// + Implement cursor-based pagination
// + Store progress in sendcloud_sync_cursor table
// + Set up CRON job every 15 minutes
```

**File:** `/supabase/functions/sendcloud-sync-orders/index.ts`

### ⚠️ IMPORTANT: Missing Reference Data

**Issue:** Reference tables likely empty:
1. `transporteur_configuration` - No carriers imported
2. `transporteur_service` - No shipping methods imported
3. `sendcloud_product_mapping` - Incomplete product mapping

**Solution:** Execute these BEFORE syncing orders:
```bash
POST /functions/v1/sendcloud-import-carriers
POST /functions/v1/sendcloud-import-shipping-methods
POST /functions/v1/sendcloud-import-products
```

### Other Technical Debt

- No automated tests (unit, integration, E2E)
- Some Edge Functions lack documentation
- Incomplete bidirectional sync (SendCloud ↔ WMS)
- No automatic label download after generation

---

## 🚀 Common Development Tasks

### Add a New Page

1. Create `/src/pages/MyNewPage.tsx`
2. Add route in `/src/App.tsx`:
   ```typescript
   <Route path="/my-page" element={
     <ProtectedRoute allowedRoles={['admin', 'operateur']}>
       <MyNewPage />
     </ProtectedRoute>
   } />
   ```
3. Add navigation in `/src/components/DashboardLayout.tsx`

### Add a New Database Table

1. Create migration: `/supabase/migrations/[timestamp]_description.sql`
   ```sql
   CREATE TABLE my_table (
     id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
     client_id UUID REFERENCES client(id) NOT NULL,
     -- other fields...
     created_at TIMESTAMP DEFAULT NOW()
   );

   -- Enable RLS
   ALTER TABLE my_table ENABLE ROW LEVEL SECURITY;

   -- Add policies
   CREATE POLICY "Admin full access" ON my_table FOR ALL
   USING (has_role(auth.uid(), 'admin'))
   WITH CHECK (has_role(auth.uid(), 'admin'));

   CREATE POLICY "Client read own" ON my_table FOR SELECT
   USING (
     has_role(auth.uid(), 'client')
     AND client_id = current_client_id()
   );
   ```
2. Apply migration via Supabase Dashboard or CLI
3. Types auto-regenerate in `/src/integrations/supabase/types.ts`

### Add a New Edge Function

1. Create `/supabase/functions/my-function/index.ts`
2. Use Edge Function pattern (see above)
3. Deploy via Supabase CLI or Lovable Cloud
4. Call from frontend:
   ```typescript
   const { data, error } = await supabase.functions.invoke('my-function', {
     body: { param1: 'value' }
   });
   ```

### Query Data with Multi-tenant Awareness

**✅ GOOD:**
```typescript
const { data } = await supabase
  .from('commande')
  .select('*')
  .eq('client_id', clientId); // RLS enforces this anyway
```

**❌ BAD:**
```typescript
const { data } = await supabase
  .from('commande')
  .select('*'); // May return data from other clients if admin
```

---

## 🔧 Environment & Configuration

### Environment Variables

**Frontend (`.env`):**
```bash
VITE_SUPABASE_URL=https://[project].supabase.co
VITE_SUPABASE_PUBLISHABLE_KEY=eyJ...
VITE_SUPABASE_PROJECT_ID=[project-id]
```

**Backend (Supabase Secrets):**
```bash
SENDCLOUD_API_PUBLIC_KEY=[per-client, in DB]
SENDCLOUD_API_SECRET_KEY=[per-client, in DB]
SENDCLOUD_WEBHOOK_SECRET=[global]
SUPABASE_SERVICE_ROLE_KEY=[from dashboard]
```

### NPM Scripts

```bash
npm run dev              # Dev server (port 8080)
npm run build           # Production build
npm run build:dev       # Development build
npm run preview         # Preview prod build
npm run lint            # Lint code
```

---

## 📊 Debugging & Monitoring

### Frontend Logs
- Browser console (F12)
- Look for `[ComponentName]` prefixed logs

### Backend Logs
- Lovable Cloud → Backend → Logs
- Supabase Dashboard → Edge Functions → Logs

### Database Queries
- Supabase Dashboard → SQL Editor

### SendCloud Sync Status
- Visit `/integrations/sendcloud/dashboard`
- Check `sendcloud_sync_logs` table
- Check `sendcloud_dlq` for failed messages

### Useful Diagnostic Queries

**Check client_id assignment:**
```sql
SELECT
  COUNT(*) as total,
  COUNT(client_id) as with_client,
  COUNT(*) - COUNT(client_id) as without_client
FROM profiles;
```

**Check sync status:**
```sql
SELECT *
FROM sendcloud_sync_logs
ORDER BY started_at DESC
LIMIT 10;
```

**Orders by status:**
```sql
SELECT statut_wms, COUNT(*) as count
FROM commande
GROUP BY statut_wms
ORDER BY count DESC;
```

**Users without roles:**
```sql
SELECT p.email, p.nom_complet
FROM profiles p
LEFT JOIN user_roles ur ON ur.user_id = p.id
WHERE ur.id IS NULL;
```

---

## 📞 Getting Help

### Documentation Priority

1. **This CLAUDE.md** - Architecture overview
2. **DIAGNOSTIC_COMPLET_WMS.md** - Known issues & solutions
3. **PROJECT_STATE_T0.md** - Complete functional documentation
4. **SENDCLOUD_INTEGRATION.md** - SendCloud technical details
5. Inline code comments

### Key File Locations

**Entry Points:**
- `/src/main.tsx` - React entry
- `/src/App.tsx` - Routing
- `/index.html` - HTML entry

**Core Infrastructure:**
- `/src/integrations/supabase/client.ts` - Supabase client
- `/src/integrations/supabase/types.ts` - DB types (auto-generated)
- `/src/hooks/useAuth.tsx` - Authentication
- `/src/components/DashboardLayout.tsx` - Main layout

**Critical Backend:**
- `/supabase/functions/sendcloud-sync-orders/index.ts` - Main sync (⚠️)
- `/supabase/functions/sendcloud-webhook/index.ts` - Webhook handler
- `/supabase/functions/_shared/sync-logger.ts` - Logging utils

---

## ✅ Best Practices Checklist

When working on this codebase:

- [ ] Check user role and `client_id` before querying data
- [ ] Use RLS-aware queries (data auto-filtered)
- [ ] Follow state transition patterns with `useStatutTransition`
- [ ] Handle SendCloud rate limits (150ms delay, exponential backoff)
- [ ] Always filter by `client_id` in multi-tenant queries
- [ ] Use React Query for caching
- [ ] Show toast feedback for user actions
- [ ] Use Shadcn/ui components for consistency
- [ ] Read `/DIAGNOSTIC_COMPLET_WMS.md` before SendCloud changes
- [ ] Test with different user roles (admin, client, operateur)

---

## 🚨 Critical Warnings

1. **DO NOT disable RLS** on any table without approval
2. **DO NOT modify SendCloud sync** without reading diagnostics
3. **DO NOT remove `client_id` filters** - breaks multi-tenancy
4. **DO NOT bypass state transitions** - breaks audit trail
5. **DO NOT commit sensitive data** (.env, API keys)

---

## 📈 Project Metrics

- **Database Tables:** 50+
- **Edge Functions:** 50+
- **React Pages:** 60+
- **React Components:** 100+
- **Database Migrations:** 100+
- **User Roles:** 4 (admin, gestionnaire, operateur, client)
- **Order Statuses:** 17
- **Tech Stack Age:** Modern (2024-2025)

---

**Document Version:** 1.0
**Last Updated:** 2025-11-16
**Codebase Status:** Production - Active Development
**Critical Issues:** 2 (see DIAGNOSTIC_COMPLET_WMS.md)

---

## 🎯 TL;DR for AI Assistants

This is a production WMS with:
- **Multi-tenant** architecture (filter by `client_id`)
- **RLS enabled** on all tables (data auto-filtered)
- **Known critical issues** (80% users missing client_id, SendCloud sync timeout)
- **State transitions required** (use `useStatutTransition` hook)
- **SendCloud integration** (handle rate limits carefully)
- **React Query** for state management
- **Supabase** backend (PostgreSQL + Edge Functions)

**Before making changes:**
1. Read `/DIAGNOSTIC_COMPLET_WMS.md`
2. Check RLS policies
3. Test with different user roles
4. Consider multi-tenancy implications

**For SendCloud changes:**
1. Read `/DIAGNOSTIC_COMPLET_WMS.md` section on SendCloud
2. Respect rate limits (150ms delays)
3. Use DLQ for error handling
4. Test with small batches first
