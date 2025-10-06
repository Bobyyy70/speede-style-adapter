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

    console.log('[SendCloud Sync] Starting automatic synchronization...');

    // Calculer la date de début (dernières 24h ou 7 jours pour le premier backfill)
    const dateMin = new Date();
    // Utiliser 7 jours pour récupérer toutes les commandes manquées lors du premier sync
    dateMin.setDate(dateMin.getDate() - 7);
    const dateMinISO = dateMin.toISOString();

    // Utiliser l'API v3 de SendCloud (Orders API)
    const authHeader = 'Basic ' + btoa(`${sendcloudPublicKey}:${sendcloudSecretKey}`);
    
    console.log(`[SendCloud Sync] Fetching orders from SendCloud API v3 since ${dateMinISO}...`);

    const allOrders: SendCloudOrder[] = [];
    let page = 1;
    let hasMorePages = true;

    // Pagination de l'API v3
    while (hasMorePages) {
      const sendcloudUrl = `https://panel.sendcloud.sc/api/v3/orders?created_at__gte=${dateMinISO}&page=${page}&page_size=100`;
      
      console.log(`[SendCloud Sync] Fetching page ${page}...`);

      const sendcloudResponse = await fetch(sendcloudUrl, {
        method: 'GET',
        headers: {
          'Authorization': authHeader,
          'Content-Type': 'application/json',
        },
      });

      if (!sendcloudResponse.ok) {
        const errorText = await sendcloudResponse.text();
        throw new Error(`SendCloud API v3 error: ${sendcloudResponse.status} - ${errorText}`);
      }

      const sendcloudData = await sendcloudResponse.json();
      const pageOrders = sendcloudData.orders || [];
      
      if (pageOrders.length === 0) {
        hasMorePages = false;
      } else {
        allOrders.push(...pageOrders);
        page++;
        
        // Limite de sécurité pour éviter les boucles infinies
        if (page > 50) {
          console.log('[SendCloud Sync] Safety limit reached (50 pages), stopping pagination');
          hasMorePages = false;
        }
      }
    }

    const orders: SendCloudOrder[] = allOrders;

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

    // Vérifier quelles commandes existent déjà
    const sendcloudIds = orders.map(o => o.id.toString());
    const orderNumbers = orders.map(o => o.order_number);

    const { data: existingCommandes } = await supabase
      .from('commande')
      .select('sendcloud_id, numero_commande')
      .or(`sendcloud_id.in.(${sendcloudIds.join(',')}),numero_commande.in.(${orderNumbers.join(',')})`);

    const existingSet = new Set([
      ...(existingCommandes || []).map((c: any) => c.sendcloud_id),
      ...(existingCommandes || []).map((c: any) => c.numero_commande),
    ]);

    // Filtrer les nouvelles commandes
    const newOrders = orders.filter(order => 
      !existingSet.has(order.id.toString()) && 
      !existingSet.has(order.order_number)
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

    // Logger le résultat
    await supabase.from('sendcloud_sync_log').insert({
      statut,
      nb_commandes_trouvees: orders.length,
      nb_commandes_creees: nbCreated,
      nb_commandes_existantes: orders.length - newOrders.length,
      nb_erreurs: nbErrors,
      duree_ms: duration,
      erreur_message: errors.length > 0 ? errors.join('; ') : null,
      details: {
        orders_found: orders.length,
        orders_new: newOrders.length,
        orders_existing: orders.length - newOrders.length,
        orders_created: nbCreated,
        errors: errors,
      },
    });

    console.log(`[SendCloud Sync] Completed in ${duration}ms - ${nbCreated} created, ${nbErrors} errors`);

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
