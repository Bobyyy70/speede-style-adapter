import { createClient } from 'npm:@supabase/supabase-js@2';
import { startSyncLog, finalizeSyncLog, updateSyncProgress, pushToDLQ } from '../_shared/sync-logger.ts';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

// V2 Parcels interface (official SendCloud API v2) - ENRICHED
interface SendCloudParcel {
  id: number;
  order_number?: string;
  tracking_number?: string;
  tracking_url?: string;
  status?: {
    id?: number;
    message?: string;
  };
  created_at?: string;
  updated_at?: string;
  
  // ✅ Carrier (transporteur)
  carrier?: {
    code?: string;
    name?: string;
  };
  
  // ✅ Shipment method (service transport)
  shipment?: {
    id?: number;
    name?: string;
  };
  
  // ✅ Sender address (expéditeur)
  sender_address?: {
    name?: string;
    company_name?: string;
    address?: string;
    address_2?: string;
    city?: string;
    postal_code?: string;
    country?: string;
    email?: string;
    telephone?: string;
  };
  
  // ✅ Label URLs
  label?: {
    label_printer?: string;
    normal_printer?: string[];
  };
  
  // Recipient address
  name?: string;
  company_name?: string;
  address?: string;
  address_2?: string;
  city?: string;
  postal_code?: string;
  country?: string;
  email?: string;
  telephone?: string;
  weight?: string;
  
  // ✅ Enriched parcel items
  parcel_items?: Array<{
    sku?: string;
    description?: string;
    quantity?: number;
    weight?: string;
    value?: string;
    hs_code?: string;        // Code douanier
    origin_country?: string; // Pays origine
    properties?: {
      ean?: string;
    };
  }>;
  
  external_reference?: string;
  external_shipment_id?: string;
}

// V3 Orders interface (legacy, mainly for imports)
interface SendCloudOrder {
  id: number | string;
  order_number?: string;
  name?: string;
  email?: string;
  telephone?: string;
  address?: string;
  address_2?: string;
  city?: string;
  postal_code?: string;
  country?: string;
  shipment?: { id?: number; status?: { id?: number; message?: string } };
  order_products?: Array<{
    sku: string;
    name: string;
    quantity: number;
    price?: string;
    weight?: string;
  }>;
  created_at?: string;
  updated_at?: string;
  external_order_id?: string;
  external_shipment_id?: string;
}

const SENDCLOUD_V2_PARCELS_ENDPOINT = 'https://panel.sendcloud.sc/api/v2/parcels';
const SENDCLOUD_V3_ORDERS_ENDPOINTS = [
  'https://panel.sendcloud.sc/api/v3/orders',
  'https://api.sendcloud.dev/api/v3/orders'
];
const V3_DATE_PARAM_VARIANTS = ['updated_at__gte', 'updated_at_min', 'from'];

Deno.serve(async (req) => {
  console.log('[SendCloud Sync] Function started');
  
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  const startTime = Date.now();
  const lockOwner = crypto.randomUUID(); // Identifiant unique pour cette exécution
  let lockAcquired = false;
  let runId: string | null = null;
  let totalBatches = 0;
  let totalItems = 0;

  try {
    const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
    const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
    const publicKey = Deno.env.get('SENDCLOUD_API_PUBLIC_KEY');
    const secretKey = Deno.env.get('SENDCLOUD_API_SECRET_KEY');

    if (!publicKey || !secretKey) {
      throw new Error('SENDCLOUD_API_PUBLIC_KEY ou SENDCLOUD_API_SECRET_KEY manquant');
    }

    const supabase = createClient(supabaseUrl, supabaseServiceKey);
    const body = req.method === 'POST' ? await req.json().catch(() => ({})) : {};
    const mode = body.mode || 'incremental';
    const customStartDate = body.startDate;

    console.log(`[SendCloud Sync] Mode: ${mode}`);

    // 🔒 ACQUISITION DU VERROU DE SYNCHRONISATION
    console.log(`[SendCloud Sync] Tentative d'acquisition du verrou (owner: ${lockOwner})...`);
    const { data: lockResult, error: lockError } = await supabase.rpc('acquire_sync_lock', {
      p_lock_key: 'sendcloud-sync',
      p_owner: lockOwner,
      p_ttl_minutes: 20 // ✅ Augmenté à 20 minutes pour les syncs volumineuses
    });

    if (lockError) {
      console.error('[SendCloud Sync] Erreur lors de l\'acquisition du verrou:', lockError);
      throw new Error(`Impossible d'acquérir le verrou: ${lockError.message}`);
    }

    if (!lockResult) {
      console.warn('[SendCloud Sync] ⚠️ Verrou déjà pris - Tentative de retry dans 30s');
      
      // ✅ Retry une seule fois après 30 secondes
      if (!body.isRetry) {
        await new Promise(resolve => setTimeout(resolve, 30000));
        
        const { data: retryLock, error: retryError } = await supabase.rpc('acquire_sync_lock', {
          p_lock_key: 'sendcloud-sync',
          p_owner: lockOwner,
          p_ttl_minutes: 20
        });
        
        if (retryError || !retryLock) {
          console.error('[SendCloud Sync] ❌ Verrou toujours occupé après retry');
          return new Response(
            JSON.stringify({
              success: false,
              error: 'Synchronisation déjà en cours. Merci de réessayer plus tard.',
              lock_status: 'busy',
              retry_attempted: true
            }),
            { status: 409, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
          );
        }
        
        lockAcquired = true;
        console.log('[SendCloud Sync] ✅ Verrou acquis après retry');
      } else {
        // Si déjà un retry, ne pas boucler
        return new Response(
          JSON.stringify({
            success: false,
            error: 'Une synchronisation SendCloud est déjà en cours.',
            lock_status: 'busy'
          }),
          { status: 409, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
      }
    } else {
      lockAcquired = true;
      console.log('[SendCloud Sync] ✅ Verrou acquis avec succès');
    }

    // Démarrer le log de synchronisation
    runId = await startSyncLog(supabase, 'orders', undefined);
    console.log(`[SendCloud Sync] Sync log started with runId: ${runId}`);

    // ============================================================
    // GET OR CREATE SYNC CURSOR
    // ============================================================
    const { data: cursor, error: cursorError } = await supabase.rpc(
      'get_or_create_sync_cursor',
      { p_sync_type: 'orders' }
    );

    if (cursorError) {
      console.error('[Cursor] Error getting cursor:', cursorError);
      throw new Error(`Failed to get sync cursor: ${cursorError.message}`);
    }

    console.log(`[Cursor] Retrieved cursor:`, {
      page_cursor: cursor.page_cursor,
      last_synced_at: cursor.last_synced_at,
      status: cursor.status
    });

    // Calculate time window
    let dateMin: string;
    if (mode === 'full') {
      const d = new Date(Date.now() - 90 * 24 * 60 * 60 * 1000);
      dateMin = d.toISOString();
      console.log(`[Full] 90 days: ${dateMin}`);
      // Reset cursor for full sync
      await supabase.rpc('reset_sync_cursor', { p_sync_type: 'orders' });
      console.log('[Cursor] Reset for full sync');
    } else if (customStartDate) {
      dateMin = new Date(customStartDate).toISOString();
      console.log(`[Custom] from: ${dateMin}`);
      // Reset cursor for custom date sync
      await supabase.rpc('reset_sync_cursor', { p_sync_type: 'orders' });
      console.log('[Cursor] Reset for custom date sync');
    } else {
      const d = new Date(Date.now() - 5 * 60 * 1000);
      dateMin = d.toISOString();
      console.log(`[Incremental] 5min: ${dateMin}`);
      // For incremental, continue from cursor if available
      if (cursor.last_synced_at) {
        console.log(`[Cursor] Continuing from last sync: ${cursor.last_synced_at}`);
      }
    }

    const authHeader = 'Basic ' + btoa(`${publicKey}:${secretKey}`);

    // Helper to log API calls
    async function logApiCall(
      endpoint: string,
      statusCode: number | null,
      errorMsg: string | null,
      duration: number,
      details?: any
    ) {
      try {
        await supabase.from('sendcloud_api_log').insert({
          endpoint,
          methode: 'GET',
          statut_http: statusCode,
          error_message: errorMsg,
          duree_ms: duration,
          date_appel: new Date().toISOString(),
          details: details || {}
        });
      } catch (e) {
        console.error('[Log API] Failed:', e);
      }
    }

    // ============================================================
    // STRATEGY 1: Try V3 Orders API first (for imports/exports)
    // ============================================================
    console.log('=== STRATEGY 1: Trying V3 Orders API ===');
    let allOrders: SendCloudOrder[] = [];
    let v3Error: string | null = null;

    for (const endpoint of SENDCLOUD_V3_ORDERS_ENDPOINTS) {
      console.log(`[V3] Trying: ${endpoint}`);
      
      for (const dateParam of V3_DATE_PARAM_VARIANTS) {
        let page = 1;
        const limit = 100;
        const maxPages = 50;
        let foundValidParam = false;

        while (page <= maxPages) {
          const url = `${endpoint}?${dateParam}=${dateMin}&page=${page}&limit=${limit}`;
          const callStart = Date.now();

          try {
            const response = await fetch(url, {
              method: 'GET',
              headers: { 'Authorization': authHeader, 'Accept': 'application/json' }
            });

            const duration = Date.now() - callStart;
            const status = response.status;

            if (!response.ok) {
              const errorText = await response.text();
              await logApiCall(url, status, errorText, duration, { page, dateParam, strategy: 'orders_v3' });

              if (status === 400 || status === 422) {
                console.log(`[V3] ${dateParam} not accepted (${status}), trying next param`);
                break;
              }

              if (status === 401 || status === 403) {
                v3Error = `V3 Orders ${status}: ${errorText}`;
                console.error(`[V3] Auth error: ${v3Error}`);
                break; // Try V2 fallback
              }

              break;
            }

            const data = await response.json();
            await logApiCall(url, status, null, duration, { page, count: data.orders?.length || 0, dateParam, strategy: 'orders_v3' });

            foundValidParam = true;
            const orders = data.orders || [];
            console.log(`[V3] Page ${page} with ${dateParam}: ${orders.length} orders`);

            if (orders.length === 0) break;

            allOrders.push(...orders);

            if (orders.length < limit) break;

            page++;
          } catch (error: any) {
            const duration = Date.now() - callStart;
            const errMsg = error?.message || String(error);
            await logApiCall(url, null, errMsg, duration, { page, dateParam, strategy: 'orders_v3' });
            if (!v3Error) v3Error = errMsg;
            break; // Stop this endpoint, try V2
          }
        }

        if (foundValidParam) break;
      }

      if (allOrders.length > 0) {
        console.log(`✓ V3 Orders: ${allOrders.length} found`);
        break;
      }
    }

    // ============================================================
    // STRATEGY 2: Fallback to V2 Parcels API (official documented method)
    // ============================================================
    let allParcels: SendCloudParcel[] = [];
    let v2Error: string | null = null;

    if (allOrders.length === 0) {
      console.log('=== STRATEGY 2: Fallback to V2 Parcels API (official) ===');

      try {
        const dateParam = mode === 'full' ? 'created_at_min' : 'updated_at_min';
        
        // ============================================================
        // CURSOR-BASED PAGINATION
        // Start from cursor position (or 1 if reset/new)
        // Process pages in batches to avoid timeout, save progress after each batch
        // ============================================================
        let page = cursor.page_cursor || 1;
        const perPage = 100;
        const maxPagesPerExecution = 50; // Process up to 50 pages (5000 parcels) per execution
        const startPage = page;
        const endPage = page + maxPagesPerExecution - 1;

        console.log(`[V2 Parcels] Using ${dateParam}=${dateMin}`);
        console.log(`[V2 Parcels] Cursor-based pagination: starting at page ${startPage}, will process up to page ${endPage}`);

        // Update cursor status to 'syncing'
        await supabase.rpc('update_sync_cursor', {
          p_sync_type: 'orders',
          p_status: 'syncing',
          p_metadata: { 
            mode, 
            dateParam, 
            dateMin,
            startPage,
            maxPagesPerExecution 
          }
        });

        while (page <= endPage) {
          const url = `${SENDCLOUD_V2_PARCELS_ENDPOINT}?${dateParam}=${dateMin}&page=${page}&per_page=${perPage}`;
          const callStart = Date.now();

          try {
            const response = await fetch(url, {
              method: 'GET',
              headers: { 'Authorization': authHeader, 'Accept': 'application/json' }
            });

            const duration = Date.now() - callStart;
            const status = response.status;

            if (!response.ok) {
              const errorText = await response.text();
              await logApiCall(url, status, errorText, duration, { page, strategy: 'parcels_v2' });

              if (status === 401 || status === 403) {
                v2Error = `V2 Parcels ${status}: ${errorText}`;
                console.error(`[V2] Auth error: ${v2Error}`);
                break; // Stop trying V2
              }

              console.warn(`[V2 Parcels] Page ${page} returned ${status}, stopping`);
              break;
            }

            const data = await response.json();
            await logApiCall(url, status, null, duration, { page, count: data.parcels?.length || 0, strategy: 'parcels_v2' });

            const parcels = data.parcels || [];
            console.log(`[V2 Parcels] Page ${page}: ${parcels.length} parcels`);

            if (parcels.length === 0) {
              console.log(`[V2 Parcels] No more parcels found at page ${page}, sync complete`);
              // Update cursor to mark completion
              await supabase.rpc('update_sync_cursor', {
                p_sync_type: 'orders',
                p_last_synced_at: new Date().toISOString(),
                p_page_cursor: 1, // Reset to 1 since we've completed
                p_status: 'completed',
                p_metadata: {
                  last_completed_at: new Date().toISOString(),
                  total_pages_processed: page - startPage,
                  mode
                }
              });
              break;
            }

            allParcels.push(...parcels);

            // Update cursor after each successful page
            await supabase.rpc('update_sync_cursor', {
              p_sync_type: 'orders',
              p_page_cursor: page + 1, // Save next page to process
              p_last_synced_at: new Date().toISOString(),
              p_status: 'syncing',
              p_metadata: {
                current_page: page,
                parcels_count: allParcels.length,
                mode
              }
            });

            if (parcels.length < perPage) {
              console.log(`[V2 Parcels] Received fewer than ${perPage} parcels, assuming end of data`);
              // Update cursor to mark completion
              await supabase.rpc('update_sync_cursor', {
                p_sync_type: 'orders',
                p_last_synced_at: new Date().toISOString(),
                p_page_cursor: 1, // Reset to 1 since we've completed
                p_status: 'completed',
                p_metadata: {
                  last_completed_at: new Date().toISOString(),
                  total_pages_processed: page - startPage + 1,
                  mode
                }
              });
              break;
            }

            page++;
          } catch (error: any) {
            const duration = Date.now() - callStart;
            const errMsg = error?.message || String(error);
            await logApiCall(url, null, errMsg, duration, { page, strategy: 'parcels_v2' });
            if (!v2Error) v2Error = errMsg;
            
            // Mark cursor as error
            await supabase.rpc('mark_sync_cursor_error', {
              p_sync_type: 'orders',
              p_error_message: `Error at page ${page}: ${errMsg}`,
              p_retry_delay_minutes: 15
            });
            
            break; // Stop V2 pagination
          }
        }

        // ============================================================
        // CURSOR UPDATE: Mark completion or continuation status
        // ============================================================
        if (page > endPage && allParcels.length > 0) {
          // Reached the max pages for this execution, but there may be more data
          console.log(`[V2 Parcels] Processed ${endPage - startPage + 1} pages, cursor saved at page ${page} for next execution`);
          await supabase.rpc('update_sync_cursor', {
            p_sync_type: 'orders',
            p_last_synced_at: new Date().toISOString(),
            p_page_cursor: page, // Next page to continue from
            p_status: 'idle', // Ready for next execution
            p_metadata: {
              last_batch_completed_at: new Date().toISOString(),
              pages_processed_this_batch: endPage - startPage + 1,
              total_parcels_this_batch: allParcels.length,
              mode,
              more_pages_available: true
            }
          });
        } else if (allParcels.length === 0 && !v2Error) {
          // No parcels found, mark as completed
          console.log('[V2 Parcels] No parcels found in this sync window');
          await supabase.rpc('update_sync_cursor', {
            p_sync_type: 'orders',
            p_last_synced_at: new Date().toISOString(),
            p_page_cursor: 1,
            p_status: 'completed',
            p_metadata: {
              last_completed_at: new Date().toISOString(),
              mode
            }
          });
        }

        // ============================================================
        // ✅ ENRICHMENT: Fetch full details for each parcel
        // ============================================================
        if (allParcels.length > 0) {
          const MAX_ENRICHMENTS = 50; // ✅ LIMITE à 50 enrichissements max pour éviter rate limit
          const parcelsToEnrich = allParcels.slice(0, MAX_ENRICHMENTS);
          const parcelsSkipped = allParcels.length - parcelsToEnrich.length;

          console.log(`✓ V2 Parcels: ${allParcels.length} found`);
          console.log(`  → Enriching ${parcelsToEnrich.length} parcels (max ${MAX_ENRICHMENTS})`);
          if (parcelsSkipped > 0) {
            console.log(`  → Skipping enrichment for ${parcelsSkipped} parcels (using summary data)`);
          }

          const enrichedParcels: SendCloudParcel[] = [];
          let enrichedCount = 0;
          let enrichErrors = 0;

          // Process in smaller batches of 5 to avoid overwhelming API
          const BATCH_SIZE = 5; // ✅ RÉDUIT de 10 à 5
          const batches = [];
          for (let i = 0; i < parcelsToEnrich.length; i += BATCH_SIZE) {
            batches.push(parcelsToEnrich.slice(i, i + BATCH_SIZE));
          }

          console.log(`Processing ${batches.length} batches of up to ${BATCH_SIZE} parcels`);
          
          for (let batchIndex = 0; batchIndex < batches.length; batchIndex++) {
            const batch = batches[batchIndex];
            console.log(`[Batch ${batchIndex + 1}/${batches.length}] Processing ${batch.length} parcels...`);

            // ✅ Ajouter délai entre les batches pour éviter rate limit
            if (batchIndex > 0) {
              await new Promise(resolve => setTimeout(resolve, 200)); // 200ms entre chaque batch
            }

            const batchPromises = batch.map(async (parcel, indexInBatch) => {
              try {
                // ✅ Ajouter délai entre chaque appel dans le batch
                if (indexInBatch > 0) {
                  await new Promise(resolve => setTimeout(resolve, 150)); // 150ms entre appels
                }

                const detailUrl = `${SENDCLOUD_V2_PARCELS_ENDPOINT}/${parcel.id}`;
                const detailCallStart = Date.now();

                // ✅ Retry logic avec exponential backoff pour gérer les 429
                let retries = 0;
                const maxRetries = 3;
                let detailResponse: Response | null = null;

                while (retries < maxRetries) {
                  detailResponse = await fetch(detailUrl, {
                    method: 'GET',
                    headers: { 'Authorization': authHeader, 'Accept': 'application/json' }
                  });

                  // Si 429 (rate limit), attendre et réessayer
                  if (detailResponse.status === 429) {
                    const retryAfter = detailResponse.headers.get('Retry-After');
                    const waitTime = retryAfter ? parseInt(retryAfter) * 1000 : Math.pow(2, retries) * 1000;
                    console.warn(`[Parcel ${parcel.id}] Rate limited (429), waiting ${waitTime}ms before retry ${retries + 1}/${maxRetries}`);
                    await new Promise(resolve => setTimeout(resolve, waitTime));
                    retries++;
                    continue;
                  }

                  break; // Sortir de la boucle si pas 429
                }

                const detailDuration = Date.now() - detailCallStart;

                if (detailResponse && detailResponse.ok) {
                  const detailData = await detailResponse.json();
                  const fullParcel = detailData.parcel;

                  console.log(`[Parcel ${parcel.id}] ✓ Enriched:`);
                  console.log(`  Carrier: ${fullParcel.carrier?.name || 'N/A'}`);
                  console.log(`  Shipment: ${fullParcel.shipment?.name || 'N/A'}`);
                  console.log(`  Weight: ${fullParcel.weight || 'N/A'}kg`);
                  console.log(`  Items: ${fullParcel.parcel_items?.length || 0}`);
                  console.log(`  Sender: ${fullParcel.sender_address?.company_name || fullParcel.sender_address?.name || 'N/A'}`);

                  await logApiCall(detailUrl, 200, null, detailDuration, { parcel_id: parcel.id, strategy: 'parcel_detail' });

                  return { success: true, parcel: fullParcel };
                } else {
                  const errorText = detailResponse ? await detailResponse.text() : 'No response';
                  console.warn(`[Parcel ${parcel.id}] ⚠️ Detail fetch failed (${detailResponse?.status}), using summary data`);
                  await logApiCall(detailUrl, detailResponse?.status || null, errorText, detailDuration, { parcel_id: parcel.id, strategy: 'parcel_detail' });

                  return { success: false, parcel }; // Fallback to summary
                }
              } catch (error: any) {
                console.warn(`[Parcel ${parcel.id}] ⚠️ Detail fetch error: ${error.message}, using summary data`);
                return { success: false, parcel }; // Fallback to summary
              }
            });
            
            const batchResults = await Promise.all(batchPromises);
            
            batchResults.forEach(result => {
              if (result.success) {
                enrichedCount++;
              } else {
                enrichErrors++;
              }
              enrichedParcels.push(result.parcel);
            });
            
            console.log(`[Batch ${batchIndex + 1}/${batches.length}] Complete: ${enrichedCount} enriched, ${enrichErrors} errors so far`);
          }

          // ✅ Ajouter les parcels non enrichis (utilisant les données summary)
          const nonEnrichedParcels = allParcels.slice(MAX_ENRICHMENTS);
          allParcels = [...enrichedParcels, ...nonEnrichedParcels];

          console.log(`✓ Enrichment complete:`);
          console.log(`  → ${enrichedCount} parcels fully enriched`);
          console.log(`  → ${enrichErrors} parcels using summary data (errors)`);
          console.log(`  → ${nonEnrichedParcels.length} parcels using summary data (not enriched)`);
          console.log(`  → ${allParcels.length} total parcels to process`);
        }
      } catch (error: any) {
        const errMsg = error?.message || String(error);
        console.error('[V2 Parcels] Error:', errMsg);
        if (!v2Error) v2Error = errMsg;
      }
    }

    // ============================================================
    // ERROR HANDLING: Both strategies failed
    // ============================================================
    if (allOrders.length === 0 && allParcels.length === 0) {
      // Both strategies failed with auth errors
      const v3HasAuthError = v3Error && (v3Error.includes('401') || v3Error.includes('403'));
      const v2HasAuthError = v2Error && (v2Error.includes('401') || v2Error.includes('403'));
      
      if (v3HasAuthError && v2HasAuthError) {
        const errorMsg = 'SendCloud API Error: 401/403 Unauthorized on both Orders (V3) and Parcels (V2). Vérifiez SENDCLOUD_API_PUBLIC_KEY/SECRET et les droits API dans votre compte SendCloud.';

        await supabase.from('sendcloud_sync_log').insert({
          statut: 'error',
          mode_sync: mode,
          nb_commandes_trouvees: 0,
          nb_commandes_creees: 0,
          nb_commandes_existantes: 0,
          nb_erreurs: 1,
          date_sync: new Date().toISOString(),
          duree_ms: Date.now() - startTime,
          erreur_message: errorMsg,
          details: { v3_error: v3Error, v2_error: v2Error, date_min: dateMin }
        });

        return new Response(
          JSON.stringify({ success: false, error: errorMsg }),
          { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
      }

      // No results but no auth error
      const message = v3Error
        ? `Aucune commande trouvée. V3: ${v3Error}. V2 Parcels: 0 résultats.`
        : 'Aucune commande trouvée dans V3 Orders ni V2 Parcels pour la période spécifiée.';

      console.log(message);

      await supabase.from('sendcloud_sync_log').insert({
        statut: 'success',
        mode_sync: mode,
        nb_commandes_trouvees: 0,
        nb_commandes_creees: 0,
        nb_commandes_existantes: 0,
        nb_erreurs: 0,
        date_sync: new Date().toISOString(),
        duree_ms: Date.now() - startTime,
        details: {
          strategy_v3: 'no_results',
          strategy_v2: 'no_results',
          v3_error: v3Error,
          date_min: dateMin,
          mode: mode,
          message: 'Vérifiez que des commandes/parcels existent dans SendCloud pour cette période'
        }
      });

      return new Response(
        JSON.stringify({
          success: true,
          message: message,
          found: 0,
          created: 0,
          existing: 0,
          errors: 0,
          mode: mode,
          strategy: null
        }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // ============================================================
    // PROCESSING: Convert to unified format & deduplicate
    // ============================================================
    let strategy: 'orders_v3' | 'parcels_v2';
    let itemsForBatch: any[] = [];

    if (allOrders.length > 0) {
      strategy = 'orders_v3';
      const uniqueOrders = Array.from(
        new Map(allOrders.map(o => [o.id, o])).values()
      );
      itemsForBatch = uniqueOrders;
      console.log(`[V3] ${itemsForBatch.length} unique orders after dedup`);
    } else {
      strategy = 'parcels_v2';
      const uniqueParcels = Array.from(
        new Map(allParcels.map(p => [p.id, p])).values()
      );
      
      // Convert parcels to order format - ENRICHED WITH ALL DATA
      itemsForBatch = uniqueParcels.map((parcel: SendCloudParcel) => {
        const enrichedOrder = {
          id: parcel.id,
          order_number: parcel.order_number || `PARCEL-${parcel.id}`,
          created_at: parcel.created_at,
          updated_at: parcel.updated_at,
          
          // Recipient address
          email: parcel.email,
          name: parcel.name || parcel.company_name,
          address: parcel.address,
          address_2: parcel.address_2,
          city: parcel.city,
          postal_code: parcel.postal_code,
          country: parcel.country,
          telephone: parcel.telephone,
          
          // Status
          shipment: { status: parcel.status },
          
          // ✅ Carrier & Tracking
          carrier: parcel.carrier,
          tracking_number: parcel.tracking_number,
          tracking_url: parcel.tracking_url,
          label_url: parcel.label?.label_printer,
          
          // ✅ Shipping method
          shipping_method: parcel.shipment,
          
          // ✅ Sender address
          sender_address: parcel.sender_address,
          
          // ✅ POIDS RÉEL ET VOLUMÉTRIQUE
          weight: parcel.weight,
          
          // ✅ Enriched products with customs data
          order_products: (parcel.parcel_items || []).map((item: any) => ({
            sku: item.sku || '',
            name: item.description || 'Produit SendCloud',
            quantity: item.quantity || 1,
            weight: item.weight,
            price: item.value,
            hs_code: item.hs_code,
            origin_country: item.origin_country,
            ean: item.properties?.ean
          })),
          
          external_order_id: parcel.external_reference,
          external_shipment_id: parcel.external_shipment_id,
          _source: 'sendcloud_parcels_v2'
        };
        
        // Log enriched data
        console.log(`[Parcel ${parcel.id}] Carrier: ${parcel.carrier?.name || 'N/A'}, Method: ${parcel.shipment?.name || 'N/A'}`);
        console.log(`[Parcel ${parcel.id}] Tracking: ${parcel.tracking_number || 'N/A'}, Items: ${parcel.parcel_items?.length || 0}`);
        if (parcel.sender_address) {
          console.log(`[Parcel ${parcel.id}] Sender: ${parcel.sender_address.company_name || parcel.sender_address.name || 'N/A'}`);
        }
        
        return enrichedOrder;
      });
      
      console.log(`[V2] ${itemsForBatch.length} unique parcels converted to orders`);
    }

    // ============================================================
    // CHECK EXISTING ORDERS
    // ============================================================
    const itemIds = itemsForBatch.map(item => String(item.id));
    const itemNumbers = itemsForBatch.map(item => item.order_number).filter(Boolean);

    let existingQuery = supabase
      .from('commande')
      .select('sendcloud_id, numero_commande, statut_wms');

    if (itemIds.length > 0 && itemNumbers.length > 0) {
      existingQuery = existingQuery.or(`sendcloud_id.in.(${itemIds.join(',')}),numero_commande.in.(${itemNumbers.join(',')})`);
    } else if (itemIds.length > 0) {
      existingQuery = existingQuery.in('sendcloud_id', itemIds);
    } else if (itemNumbers.length > 0) {
      existingQuery = existingQuery.in('numero_commande', itemNumbers);
    }

    const existingResult = await existingQuery;
    const existingItems = existingResult.data || [];
    const existingIds = new Set(existingItems.map(o => o.sendcloud_id));
    const existingNumbers = new Set(existingItems.map(o => o.numero_commande));

    const finalStatuses = ['Livré', 'Annulé', 'Archivé'];
    const itemsToProcess = itemsForBatch.filter(item => {
      const itemId = String(item.id);
      const itemNumber = item.order_number;

      const exists = existingIds.has(itemId) || (itemNumber && existingNumbers.has(itemNumber));

      if (exists) {
        const existingItem = existingItems.find(
          ei => ei.sendcloud_id === itemId || ei.numero_commande === itemNumber
        );

        if (existingItem && finalStatuses.includes(existingItem.statut_wms)) {
          return false;
        }
      }

      return !exists;
    });

    console.log(`${itemsToProcess.length} new items to process (${existingItems.length} already exist)`);

    if (itemsToProcess.length === 0) {
      // Finaliser avec succès sans nouvelles commandes
      if (runId) {
        await finalizeSyncLog(supabase, runId, 'success', {
          batchCount: 0,
          itemCount: 0,
          metadata: {
            strategy,
            mode,
            found: itemsForBatch.length,
            existing: existingItems.length,
            date_min: dateMin,
            duration_ms: Date.now() - startTime,
          },
        });
      }

      return new Response(
        JSON.stringify({
          success: true,
          message: `All ${strategy === 'orders_v3' ? 'orders' : 'parcels'} already exist`,
          found: itemsForBatch.length,
          created: 0,
          existing: existingItems.length,
          errors: 0,
          strategy
        }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // ============================================================
    // BATCH CREATE
    // ============================================================
    const batchResult = await supabase.functions.invoke('sendcloud-orders-batch', {
      body: { orders: itemsToProcess }
    });

    if (batchResult.error) {
      console.error('Batch error:', batchResult.error);

      // Pousser dans la DLQ pour retry
      for (const item of itemsToProcess) {
        await pushToDLQ(
          supabase,
          'order_sync',
          { order: item, source: 'sendcloud-sync-orders', strategy },
          batchResult.error.message || 'Batch processing failed'
        );
      }

      // Finaliser en erreur
      if (runId) {
        await finalizeSyncLog(supabase, runId, 'error', {
          batchCount: 0,
          itemCount: 0,
          errorMessage: batchResult.error.message || 'Batch processing failed',
          metadata: { strategy, date_min: dateMin, mode },
        });
      }

      return new Response(
        JSON.stringify({ success: false, error: batchResult.error.message || 'Failed to process batch' }),
        { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    const batchData = batchResult.data || {};
    
    totalBatches = 1;
    totalItems = batchData.created || 0;

    // Finaliser avec succès
    if (runId) {
      await finalizeSyncLog(supabase, runId, batchData.errors > 0 ? 'partial' : 'success', {
        batchCount: totalBatches,
        itemCount: totalItems,
        errorMessage: batchData.errors > 0 ? 'Some items failed to process' : undefined,
        metadata: {
          strategy,
          mode,
          found: itemsForBatch.length,
          created: batchData.created || 0,
          existing: existingItems.length + (batchData.existing || 0),
          errors: batchData.errors || 0,
          date_min: dateMin,
          duration_ms: Date.now() - startTime,
          batch_summary: batchData,
        },
      });
    }

    return new Response(
      JSON.stringify({
        success: true,
        message: `Sync completed via ${strategy}: ${batchData.created} created, ${batchData.existing} existing, ${batchData.errors} errors`,
        found: itemsForBatch.length,
        created: batchData.created || 0,
        existing: existingItems.length + (batchData.existing || 0),
        errors: batchData.errors || 0,
        mode,
        strategy
      }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );

  } catch (error) {
    const duration = Date.now() - startTime;
    const errorMessage = error instanceof Error ? error.message : String(error);
    console.error('[SendCloud Sync] Fatal error:', errorMessage);

    const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
    const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
    const supabase = createClient(supabaseUrl, supabaseServiceKey);

    // Finaliser en erreur
    if (runId) {
      await finalizeSyncLog(supabase, runId, 'error', {
        batchCount: totalBatches,
        itemCount: totalItems,
        errorMessage,
        metadata: { duration_ms: duration },
      });
    }

    return new Response(
      JSON.stringify({ success: false, error: errorMessage }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  } finally {
    // 🔓 LIBÉRATION DU VERROU DE SYNCHRONISATION
    if (lockAcquired) {
      console.log(`[SendCloud Sync] Libération du verrou (owner: ${lockOwner})...`);
      try {
        const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
        const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
        const supabase = createClient(supabaseUrl, supabaseServiceKey);
        
        const { data: released, error: releaseError } = await supabase.rpc('release_sync_lock', {
          p_lock_key: 'sendcloud-sync',
          p_owner: lockOwner
        });

        if (releaseError) {
          console.error('[SendCloud Sync] ⚠️ Erreur lors de la libération du verrou:', releaseError);
          // ✅ Forcer la suppression en cas d'erreur
          await supabase
            .from('sync_locks')
            .delete()
            .eq('lock_key', 'sendcloud-sync')
            .eq('owner', lockOwner);
        } else if (released) {
          console.log('[SendCloud Sync] ✅ Verrou libéré avec succès');
        } else {
          console.warn('[SendCloud Sync] ⚠️ Verrou non trouvé lors de la libération (probablement expiré)');
        }
      } catch (releaseError) {
        console.error('[SendCloud Sync] ⚠️ Exception lors de la libération du verrou:', releaseError);
      }
    }
  }
});
