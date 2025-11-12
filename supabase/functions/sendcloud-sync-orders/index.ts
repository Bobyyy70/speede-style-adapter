import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.38.4';

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
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  const startTime = Date.now();

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

    // Calculate time window
    let dateMin: string;
    if (mode === 'full') {
      const d = new Date(Date.now() - 90 * 24 * 60 * 60 * 1000);
      dateMin = d.toISOString();
      console.log(`[Full] 90 days: ${dateMin}`);
    } else if (customStartDate) {
      dateMin = new Date(customStartDate).toISOString();
      console.log(`[Custom] from: ${dateMin}`);
    } else {
      const d = new Date(Date.now() - 5 * 60 * 1000);
      dateMin = d.toISOString();
      console.log(`[Incremental] 5min: ${dateMin}`);
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
        let page = 1;
        const perPage = 100;
        const maxPages = 50;

        console.log(`[V2 Parcels] Using ${dateParam}=${dateMin}`);

        while (page <= maxPages) {
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

            if (parcels.length === 0) break;

            allParcels.push(...parcels);

            if (parcels.length < perPage) break;

            page++;
          } catch (error: any) {
            const duration = Date.now() - callStart;
            const errMsg = error?.message || String(error);
            await logApiCall(url, null, errMsg, duration, { page, strategy: 'parcels_v2' });
            if (!v2Error) v2Error = errMsg;
            break; // Stop V2 pagination
          }
        }

        // ============================================================
        // ✅ ENRICHMENT: Fetch full details for each parcel
        // ============================================================
        if (allParcels.length > 0) {
          console.log(`✓ V2 Parcels: ${allParcels.length} found, enriching with full details...`);
          
          const enrichedParcels: SendCloudParcel[] = [];
          let enrichedCount = 0;
          let enrichErrors = 0;
          
          for (const parcel of allParcels) {
            try {
              const detailUrl = `${SENDCLOUD_V2_PARCELS_ENDPOINT}/${parcel.id}`;
              const detailCallStart = Date.now();
              
              const detailResponse = await fetch(detailUrl, {
                method: 'GET',
                headers: { 'Authorization': authHeader, 'Accept': 'application/json' }
              });
              
              const detailDuration = Date.now() - detailCallStart;
              
              if (detailResponse.ok) {
                const detailData = await detailResponse.json();
                const fullParcel = detailData.parcel;
                
                // Log detailed info
                console.log(`[Parcel ${parcel.id}] ✓ Enriched:`);
                console.log(`  Carrier: ${fullParcel.carrier?.name || 'N/A'}`);
                console.log(`  Shipment: ${fullParcel.shipment?.name || 'N/A'}`);
                console.log(`  Weight: ${fullParcel.weight || 'N/A'}kg`);
                console.log(`  Items: ${fullParcel.parcel_items?.length || 0}`);
                console.log(`  Sender: ${fullParcel.sender_address?.company_name || fullParcel.sender_address?.name || 'N/A'}`);
                
                await logApiCall(detailUrl, 200, null, detailDuration, { parcel_id: parcel.id, strategy: 'parcel_detail' });
                
                enrichedParcels.push(fullParcel);
                enrichedCount++;
              } else {
                const errorText = await detailResponse.text();
                console.warn(`[Parcel ${parcel.id}] ⚠️ Detail fetch failed (${detailResponse.status}), using summary data`);
                await logApiCall(detailUrl, detailResponse.status, errorText, detailDuration, { parcel_id: parcel.id, strategy: 'parcel_detail' });
                
                enrichedParcels.push(parcel); // Fallback to summary
                enrichErrors++;
              }
            } catch (error: any) {
              console.warn(`[Parcel ${parcel.id}] ⚠️ Detail fetch error: ${error.message}, using summary data`);
              enrichedParcels.push(parcel); // Fallback to summary
              enrichErrors++;
            }
          }
          
          allParcels = enrichedParcels;
          console.log(`✓ Enrichment complete: ${enrichedCount} fully enriched, ${enrichErrors} fallback to summary`);
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
      await supabase.from('sendcloud_sync_log').insert({
        statut: 'success',
        mode_sync: mode,
        nb_commandes_trouvees: itemsForBatch.length,
        nb_commandes_creees: 0,
        nb_commandes_existantes: existingItems.length,
        nb_erreurs: 0,
        date_sync: new Date().toISOString(),
        duree_ms: Date.now() - startTime,
        details: { strategy, date_min: dateMin }
      });

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

      await supabase.from('sendcloud_sync_log').insert({
        statut: 'error',
        mode_sync: mode,
        nb_commandes_trouvees: itemsForBatch.length,
        nb_commandes_creees: 0,
        nb_commandes_existantes: existingItems.length,
        nb_erreurs: 1,
        date_sync: new Date().toISOString(),
        duree_ms: Date.now() - startTime,
        erreur_message: batchResult.error.message || 'Batch processing failed',
        details: { strategy, date_min: dateMin }
      });

      return new Response(
        JSON.stringify({ success: false, error: batchResult.error.message || 'Failed to process batch' }),
        { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    const batchData = batchResult.data || {};

    await supabase.from('sendcloud_sync_log').insert({
      statut: batchData.errors > 0 ? 'partial' : 'success',
      mode_sync: mode,
      nb_commandes_trouvees: itemsForBatch.length,
      nb_commandes_creees: batchData.created || 0,
      nb_commandes_existantes: existingItems.length + (batchData.existing || 0),
      nb_erreurs: batchData.errors || 0,
      date_sync: new Date().toISOString(),
      duree_ms: Date.now() - startTime,
      erreur_message: batchData.errors > 0 ? 'Some items failed to process' : null,
      details: { strategy, date_min: dateMin, mode, batch_summary: batchData }
    });

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

    await supabase.from('sendcloud_sync_log').insert({
      statut: 'error',
      mode_sync: 'unknown',
      nb_commandes_trouvees: 0,
      nb_commandes_creees: 0,
      nb_commandes_existantes: 0,
      nb_erreurs: 1,
      date_sync: new Date().toISOString(),
      duree_ms: duration,
      erreur_message: errorMessage
    });

    return new Response(
      JSON.stringify({ success: false, error: errorMessage }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});
