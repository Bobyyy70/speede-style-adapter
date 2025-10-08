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

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  const startTime = Date.now();

  try {
    const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
    const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
    const sendcloudPublicKey = Deno.env.get('SENDCLOUD_API_PUBLIC_KEY')!;
    const sendcloudSecretKey = Deno.env.get('SENDCLOUD_API_SECRET_KEY')!;

    const supabase = createClient(supabaseUrl, supabaseServiceKey);

    // Récupérer le mode et la date de début depuis le body
    const body = req.method === 'POST' ? await req.json().catch(() => ({})) : {};
    const mode = body.mode || 'incremental';
    const customStartDate = body.startDate; // Format YYYY-MM-DD

    console.log(`[SendCloud Sync] Mode: ${mode}`);

    // Calculer la fenêtre temporelle selon le mode
    let dateMin: Date | null = null;
    if (mode === 'full') {
      // Mode full: 90 jours en arrière
      dateMin = new Date(Date.now() - 90 * 24 * 60 * 60 * 1000);
      console.log(`[SendCloud Sync] Full scan mode: fetching orders from last 90 days`);
    } else if (customStartDate) {
      // Date personnalisée fournie (format YYYY-MM-DD)
      dateMin = new Date(customStartDate);
      console.log(`[SendCloud Sync] Using custom start date: ${customStartDate}`);
    } else if (mode === 'incremental') {
      // Dernières 5 minutes pour sync incrémentale
      dateMin = new Date(Date.now() - 5 * 60 * 1000);
    } else {
      // Dernières 24h pour sync initiale
      dateMin = new Date(Date.now() - 24 * 60 * 60 * 1000);
    }
    const dateMinISO = dateMin ? dateMin.toISOString() : null;

    // Utiliser l'API v3 de SendCloud (Orders API) avec stratégie multi-critères
    const authHeader = 'Basic ' + btoa(`${sendcloudPublicKey}:${sendcloudSecretKey}`);
    
    console.log(`[SendCloud Sync] Fetching orders with multi-criteria strategy${dateMinISO ? ` since ${dateMinISO}` : ' (no date filter)'}...`);

    const allOrders: SendCloudOrder[] = [];
    
    // Stratégie multi-critères pour capturer toutes les commandes utiles
    const searchCriteria = [
      { label: 'unshipped', params: 'shipment_status=unshipped' },
      { label: 'non-finalisées', params: 'is_fully_created=false' },
      { label: 'avec-erreurs', params: 'contains_errors=true' },
    ];
    
    for (const criteria of searchCriteria) {
      let page = 1;
      let hasMorePages = true;

      while (hasMorePages) {
        // Utiliser updated_at au lieu de created_at pour capturer les modifications
        const dateFilter = dateMinISO ? `&updated_at__gte=${dateMinISO}` : '';
        const sendcloudUrl = `https://panel.sendcloud.sc/api/v3/orders?${criteria.params}${dateFilter}&page=${page}&page_size=100`;
        
        console.log(`[SendCloud Sync] API Call [${criteria.label}] page ${page}: ${sendcloudUrl}`);

        const sendcloudResponse = await fetch(sendcloudUrl, {
          method: 'GET',
          headers: {
            'Authorization': authHeader,
            'Content-Type': 'application/json',
          },
        });

        if (!sendcloudResponse.ok) {
          const errorText = await sendcloudResponse.text();
          console.error(`[SendCloud Sync] Error fetching ${criteria.label}:`, errorText);
          break;
        }

        const sendcloudData = await sendcloudResponse.json();
        // Parsing robuste: essayer plusieurs chemins
        const pageOrders = sendcloudData.orders || sendcloudData.data?.orders || sendcloudData.results || [];
        
        console.log(`[SendCloud Sync] ${criteria.label} page ${page}: ${pageOrders.length} orders received`);
        
        if (pageOrders.length === 0) {
          hasMorePages = false;
        } else {
          allOrders.push(...pageOrders);
          page++;
          
          if (page > 50) {
            console.log(`[SendCloud Sync] Safety limit reached for ${criteria.label}`);
            hasMorePages = false;
          }
        }
      }
    }

    // Dédupliquer par order.id en mémoire (au cas où)
    const uniqueOrders = Array.from(
      new Map(allOrders.map(o => [o.id, o])).values()
    );

    const orders: SendCloudOrder[] = uniqueOrders;

    console.log(`[SendCloud Sync] Found ${orders.length} orders from SendCloud`);

    if (orders.length === 0) {
      const duration = Date.now() - startTime;
      
      // Log success avec 0 commandes
      await supabase.from('sendcloud_sync_log').insert({
        statut: 'success',
        nb_commandes_trouvees: 0,
        nb_commandes_creees: 0,
        nb_commandes_existantes: 0,
        duree_ms: duration,
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

    // Vérifier quelles commandes existent déjà avec deux requêtes séparées
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

    // Récupérer les commandes déjà expédiées/archivées/préparées à exclure
    const { data: excludedCommandes } = await supabase
      .from('commande')
      .select('sendcloud_id, numero_commande')
      .in('statut_wms', ['Expédiée', 'Livré', 'Archivé', 'Préparée', 'Prête à expédier']);
    
    const excludedSet = new Set([
      ...(excludedCommandes || []).map((c: any) => c.sendcloud_id),
      ...(excludedCommandes || []).map((c: any) => c.numero_commande),
    ].filter(Boolean));

    // Filtrer les nouvelles commandes (non existantes et non exclues)
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
      // Appeler la fonction batch pour créer les commandes
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

    // Logger le résultat avec les nouveaux champs
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

    // Logger l'erreur
    await supabase.from('sendcloud_sync_log').insert({
      statut: 'error',
      nb_commandes_trouvees: 0,
      nb_commandes_creees: 0,
      nb_commandes_existantes: 0,
      nb_erreurs: 1,
      duree_ms: duration,
      erreur_message: errorMessage,
    });

    return new Response(
      JSON.stringify({ success: false, error: errorMessage }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' }, status: 500 }
    );
  }
});
