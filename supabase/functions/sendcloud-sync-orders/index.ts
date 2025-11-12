import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.38.4';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

interface SendCloudOrder {
  id: number;
  order_number: string;
  name: string;
  email: string;
  telephone: string;
  address: string;
  address_2?: string;
  house_number?: string;
  city: string;
  postal_code: string;
  country: string;
  shipment?: {
    id?: number;
  };
  order_products: Array<{
    sku: string;
    name: string;
    quantity: number;
    price: string;
    weight: string;
  }>;
  created_at: string;
}

// Liste des endpoints à tester
const SENDCLOUD_ENDPOINTS = [
  'https://panel.sendcloud.sc/api/v3/orders',
  'https://api.sendcloud.dev/api/v3/orders',
];

// Liste des syntaxes de paramètre de date à tester
const DATE_PARAM_VARIANTS = ['updated_at__gte', 'updated_at_min', 'from'];

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  const startTime = Date.now();

  try {
    const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
    const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
    const sendcloudPublicKey = Deno.env.get('SENDCLOUD_API_PUBLIC_KEY');
    const sendcloudSecretKey = Deno.env.get('SENDCLOUD_API_SECRET_KEY');

    if (!sendcloudPublicKey || !sendcloudSecretKey) {
      throw new Error('SENDCLOUD_API_PUBLIC_KEY ou SENDCLOUD_API_SECRET_KEY manquant dans les variables d\'environnement');
    }

    const supabase = createClient(supabaseUrl, supabaseServiceKey);

    // Récupérer le mode et la date de début depuis le body
    const body = req.method === 'POST' ? await req.json().catch(() => ({})) : {};
    const mode = body.mode || 'incremental';
    const customStartDate = body.startDate; // Format YYYY-MM-DD

    console.log(`[SendCloud Sync] Mode: ${mode}`);

    // Calculer la fenêtre temporelle selon le mode
    let dateMin: Date | null = null;
    if (mode === 'full') {
      dateMin = new Date(Date.now() - 90 * 24 * 60 * 60 * 1000);
      console.log(`[SendCloud Sync] Full scan mode: fetching orders from last 90 days`);
    } else if (customStartDate) {
      dateMin = new Date(customStartDate);
      console.log(`[SendCloud Sync] Using custom start date: ${customStartDate}`);
    } else if (mode === 'incremental') {
      dateMin = new Date(Date.now() - 5 * 60 * 1000);
    } else {
      dateMin = new Date(Date.now() - 24 * 60 * 60 * 1000);
    }
    const dateMinISO = dateMin ? dateMin.toISOString() : null;

    const authHeader = 'Basic ' + btoa(`${sendcloudPublicKey}:${sendcloudSecretKey}`);
    
    console.log(`[SendCloud Sync] Fetching orders${dateMinISO ? ` since ${dateMinISO}` : ' (no date filter)'}...`);

    // Helper pour logger les appels API
    const logApiCall = async (endpoint: string, statusCode: number | null, errorMsg: string | null, duration: number) => {
      try {
        await supabase.from('sendcloud_api_log').insert({
          endpoint,
          methode: 'GET',
          statut_http: statusCode,
          error_message: errorMsg,
          duree_ms: duration,
          date_appel: new Date().toISOString(),
        });
      } catch (e) {
        console.error('[SendCloud Sync] Failed to log API call:', e);
      }
    };

    // Fonction pour tester un endpoint avec différents paramètres de date
    const fetchFromEndpoint = async (baseUrl: string, criteria: string, page: number): Promise<{
      orders: SendCloudOrder[];
      success: boolean;
      statusCode: number | null;
      error: string | null;
    }> => {
      // D'abord essayer sans filtre de date pour le critère "all"
      if (criteria === '') {
        const url = `${baseUrl}?page=${page}&page_size=100`;
        const callStart = Date.now();
        
        try {
          console.log(`[SendCloud Sync] API Call [all] page ${page}: ${url}`);
          const response = await fetch(url, {
            method: 'GET',
            headers: {
              'Authorization': authHeader,
              'Content-Type': 'application/json',
            },
          });

          const callDuration = Date.now() - callStart;
          
          if (!response.ok) {
            const errorText = await response.text();
            await logApiCall(url, response.status, errorText, callDuration);
            return { orders: [], success: false, statusCode: response.status, error: errorText };
          }

          const data = await response.json();
          const orders = data.orders || data.data?.orders || data.results || [];
          
          await logApiCall(url, response.status, null, callDuration);
          console.log(`[SendCloud Sync] [all] page ${page}: ${orders.length} orders received`);
          
          return { orders, success: true, statusCode: response.status, error: null };
        } catch (err) {
          const callDuration = Date.now() - callStart;
          const errorMsg = err instanceof Error ? err.message : String(err);
          await logApiCall(url, null, errorMsg, callDuration);
          return { orders: [], success: false, statusCode: null, error: errorMsg };
        }
      }

      // Pour les critères avec filtres, essayer différentes syntaxes de date
      for (const dateParam of DATE_PARAM_VARIANTS) {
        const dateFilter = dateMinISO ? `&${dateParam}=${dateMinISO}` : '';
        const url = `${baseUrl}?${criteria}${dateFilter}&page=${page}&page_size=100`;
        const callStart = Date.now();
        
        try {
          console.log(`[SendCloud Sync] API Call [${criteria.split('=')[0]}] page ${page} (${dateParam}): ${url}`);
          const response = await fetch(url, {
            method: 'GET',
            headers: {
              'Authorization': authHeader,
              'Content-Type': 'application/json',
            },
          });

          const callDuration = Date.now() - callStart;
          
          if (!response.ok) {
            const errorText = await response.text();
            await logApiCall(url, response.status, errorText, callDuration);
            
            // Si 400/422, essayer la prochaine syntaxe de date
            if (response.status === 400 || response.status === 422) {
              console.log(`[SendCloud Sync] ${dateParam} not accepted, trying next variant...`);
              continue;
            }
            
            return { orders: [], success: false, statusCode: response.status, error: errorText };
          }

          const data = await response.json();
          const orders = data.orders || data.data?.orders || data.results || [];
          
          await logApiCall(url, response.status, null, callDuration);
          console.log(`[SendCloud Sync] [${criteria.split('=')[0]}] page ${page}: ${orders.length} orders received`);
          
          return { orders, success: true, statusCode: response.status, error: null };
        } catch (err) {
          const callDuration = Date.now() - callStart;
          const errorMsg = err instanceof Error ? err.message : String(err);
          await logApiCall(url, null, errorMsg, callDuration);
          
          // Essayer la prochaine syntaxe
          continue;
        }
      }
      
      return { orders: [], success: false, statusCode: null, error: 'All date parameter variants failed' };
    };

    const allOrders: SendCloudOrder[] = [];
    let workingEndpoint: string | null = null;
    let lastError: { statusCode: number | null; message: string } | null = null;
    
    // Stratégies de collecte : d'abord "all" (sans filtres restrictifs), puis critères spécifiques
    const searchCriteria = [
      { label: 'all', params: '' }, // Nouveau : récupérer TOUTES les commandes
      { label: 'unshipped', params: 'shipment_status=unshipped' },
      { label: 'non-finalisées', params: 'is_fully_created=false' },
      { label: 'avec-erreurs', params: 'contains_errors=true' },
    ];
    
    // Tester les endpoints jusqu'à en trouver un qui fonctionne
    endpointLoop: for (const endpoint of SENDCLOUD_ENDPOINTS) {
      console.log(`[SendCloud Sync] Testing endpoint: ${endpoint}`);
      
      for (const criteria of searchCriteria) {
        let page = 1;
        let hasMorePages = true;
        let criteriaSuccess = false;

        while (hasMorePages && page <= 50) {
          const result = await fetchFromEndpoint(endpoint, criteria.params, page);
          
          if (!result.success) {
            lastError = { statusCode: result.statusCode, message: result.error || 'Unknown error' };
            
            // Si 401/403, cet endpoint ne fonctionne pas du tout, passer au suivant
            if (result.statusCode === 401 || result.statusCode === 403) {
              console.log(`[SendCloud Sync] ${endpoint} returned ${result.statusCode}, trying next endpoint...`);
              continue endpointLoop;
            }
            
            // Si 404, essayer le prochain critère
            if (result.statusCode === 404) {
              console.log(`[SendCloud Sync] 404 on ${criteria.label}, trying next criteria...`);
              break;
            }
            
            // Autres erreurs : continuer quand même avec les autres critères
            break;
          }
          
          criteriaSuccess = true;
          workingEndpoint = endpoint;
          
          if (result.orders.length === 0) {
            hasMorePages = false;
          } else {
            allOrders.push(...result.orders);
            page++;
          }
        }
        
        // Si un critère a fonctionné, on sait que cet endpoint est bon
        if (criteriaSuccess) {
          workingEndpoint = endpoint;
        }
      }
      
      // Si on a trouvé un endpoint qui fonctionne, ne pas essayer les autres
      if (workingEndpoint) {
        break;
      }
    }

    // Si aucun endpoint n'a fonctionné, retourner une erreur explicite
    if (!workingEndpoint && allOrders.length === 0) {
      const errorMessage = lastError 
        ? `SendCloud API Error (${lastError.statusCode || 'Network'}): ${lastError.message}. Vérifiez vos clés API (SENDCLOUD_API_PUBLIC_KEY / SECRET_KEY) et que l'API Orders est activée sur votre compte SendCloud.`
        : 'Impossible de se connecter à l\'API SendCloud. Tous les endpoints ont échoué.';
      
      console.error(`[SendCloud Sync] ${errorMessage}`);
      
      await supabase.from('sendcloud_sync_log').insert({
        statut: 'error',
        nb_commandes_trouvees: 0,
        nb_commandes_creees: 0,
        nb_commandes_existantes: 0,
        nb_erreurs: 1,
        duree_ms: Date.now() - startTime,
        mode_sync: mode,
        erreur_message: errorMessage,
      });

      return new Response(
        JSON.stringify({ success: false, error: errorMessage }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' }, status: 500 }
      );
    }

    // Dédupliquer par order.id
    const uniqueOrders = Array.from(
      new Map(allOrders.map(o => [o.id, o])).values()
    );

    const orders: SendCloudOrder[] = uniqueOrders;

    console.log(`[SendCloud Sync] Found ${orders.length} orders from SendCloud (endpoint: ${workingEndpoint})`);

    if (orders.length === 0) {
      const duration = Date.now() - startTime;
      
      await supabase.from('sendcloud_sync_log').insert({
        statut: 'success',
        nb_commandes_trouvees: 0,
        nb_commandes_creees: 0,
        nb_commandes_existantes: 0,
        duree_ms: duration,
        mode_sync: mode,
      });

      return new Response(
        JSON.stringify({ 
          success: true, 
          message: 'No new orders to sync',
          found: 0,
          created: 0,
          existing: 0,
        }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Vérifier quelles commandes existent déjà
    const sendcloudIds = orders.map(o => o.id.toString());
    const orderNumbers = orders.map(o => o.order_number);

    const [bySendcloudIds, byOrderNumbers] = await Promise.all([
      supabase
        .from('commande')
        .select('sendcloud_id')
        .in('sendcloud_id', sendcloudIds),
      supabase
        .from('commande')
        .select('numero_commande')
        .in('numero_commande', orderNumbers)
    ]);

    const existingSet = new Set([
      ...(bySendcloudIds.data || []).map((c: any) => c.sendcloud_id),
      ...(byOrderNumbers.data || []).map((c: any) => c.numero_commande),
    ]);

    // Récupérer les commandes finales à exclure
    const { data: excludedCommandes } = await supabase
      .from('commande')
      .select('sendcloud_id, numero_commande')
      .in('statut_wms', ['Expédiée', 'Livré', 'Archivé', 'Préparée', 'Prête à expédier']);
    
    const excludedSet = new Set([
      ...(excludedCommandes || []).map((c: any) => c.sendcloud_id),
      ...(excludedCommandes || []).map((c: any) => c.numero_commande),
    ].filter(Boolean));

    // Filtrer les nouvelles commandes
    const newOrders = orders.filter(order => 
      !existingSet.has(order.id.toString()) && 
      !existingSet.has(order.order_number) &&
      !excludedSet.has(order.id.toString()) &&
      !excludedSet.has(order.order_number)
    );

    console.log(`[SendCloud Sync] ${newOrders.length} new orders to create, ${orders.length - newOrders.length} already exist`);

    let nbCreated = 0;
    let nbErrors = 0;
    const errors: string[] = [];

    if (newOrders.length > 0) {
      const { data: batchResult, error: batchError } = await supabase.functions.invoke('sendcloud-orders-batch', {
        body: { orders: newOrders }
      });

      if (batchError) {
        console.error('[SendCloud Sync] Batch creation error:', batchError);
        errors.push(batchError.message);
        nbErrors = newOrders.length;
      } else {
        nbCreated = batchResult?.summary?.created || 0;
        nbErrors = batchResult?.summary?.errored || 0;
        if (batchResult?.summary?.errors) {
          errors.push(...batchResult.summary.errors);
        }
      }
    }

    const duration = Date.now() - startTime;
    const statut = nbErrors > 0 ? (nbCreated > 0 ? 'partial' : 'error') : 'success';

    await supabase.from('sendcloud_sync_log').insert({
      statut,
      nb_commandes_trouvees: orders.length,
      nb_commandes_creees: nbCreated,
      nb_commandes_existantes: orders.length - newOrders.length,
      nb_erreurs: nbErrors,
      duree_ms: duration,
      mode_sync: mode,
      erreur_message: errors.length > 0 ? errors.join('; ') : null,
      details: {
        mode: mode,
        endpoint_used: workingEndpoint,
        orders_found: orders.length,
        orders_new: newOrders.length,
        orders_existing: orders.length - newOrders.length,
        orders_created: nbCreated,
        errors: errors,
      },
    });

    console.log(`[SendCloud Sync] Mode: ${mode} - Completed in ${duration}ms`);
    console.log(`[SendCloud Sync] Found: ${orders.length}, New: ${newOrders.length}, Created: ${nbCreated}, Errors: ${nbErrors}`);

    return new Response(
      JSON.stringify({
        success: true,
        found: orders.length,
        created: nbCreated,
        existing: orders.length - newOrders.length,
        errors: nbErrors,
        duration_ms: duration,
        endpoint_used: workingEndpoint,
      }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' }, status: 200 }
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
      nb_commandes_trouvees: 0,
      nb_commandes_creees: 0,
      nb_commandes_existantes: 0,
      nb_erreurs: 1,
      duree_ms: duration,
      mode_sync: 'unknown',
      erreur_message: errorMessage,
    });

    return new Response(
      JSON.stringify({ success: false, error: errorMessage }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' }, status: 500 }
    );
  }
});
