import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

interface SendCloudOrderResponse {
  id: string | number;
  order_number: string;
  name: string;
  email?: string;
  telephone?: string;
  address: string;
  address_2?: string;
  city: string;
  postal_code: string;
  country: string;
  order_status?: { id: number; message: string };
  parcel?: { id: number; tracking_number?: string };
  to_service_point?: number;
  shipment?: { id: number; name: string };
  order_products?: Array<{
    sku: string;
    name: string;
    quantity: number;
    unit_price?: { value: number; currency: string };
    total_price?: { value: number; currency: string };
    measurement?: { weight?: { value: number; unit: string } };
  }>;
  total_order_value?: number;
  currency?: string;
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    console.log('🚀 Début synchronisation SendCloud');

    const supabase = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? ''
    );

    const SENDCLOUD_API_PUBLIC_KEY = Deno.env.get('SENDCLOUD_API_PUBLIC_KEY');
    const SENDCLOUD_API_SECRET_KEY = Deno.env.get('SENDCLOUD_API_SECRET_KEY');

    if (!SENDCLOUD_API_PUBLIC_KEY || !SENDCLOUD_API_SECRET_KEY) {
      throw new Error('Clés API SendCloud manquantes');
    }

    // Récupérer toutes les commandes depuis SendCloud
    const authHeader = 'Basic ' + btoa(`${SENDCLOUD_API_PUBLIC_KEY}:${SENDCLOUD_API_SECRET_KEY}`);
    
    let allOrders: SendCloudOrderResponse[] = [];
    let page = 1;
    let hasMore = true;

    while (hasMore) {
      console.log(`📥 Récupération page ${page}...`);
      
      const response = await fetch(
        `https://panel.sendcloud.sc/api/v2/parcels?page=${page}&per_page=100`,
        {
          method: 'GET',
          headers: {
            'Authorization': authHeader,
            'Content-Type': 'application/json',
          },
        }
      );

      if (!response.ok) {
        const errorText = await response.text();
        throw new Error(`SendCloud API error: ${response.status} - ${errorText}`);
      }

      const data = await response.json();
      const parcels = data.parcels || [];
      
      console.log(`✅ Page ${page}: ${parcels.length} commandes récupérées`);
      
      allOrders = allOrders.concat(parcels);
      
      // Vérifier s'il y a d'autres pages
      hasMore = parcels.length === 100;
      page++;

      // Sécurité: limite à 10 pages (1000 commandes max)
      if (page > 10) {
        console.log('⚠️ Limite de 10 pages atteinte');
        break;
      }
    }

    console.log(`📦 Total: ${allOrders.length} commandes récupérées de SendCloud`);

    if (allOrders.length === 0) {
      return new Response(
        JSON.stringify({ 
          success: true, 
          total: 0, 
          processed: 0, 
          existing: 0, 
          errors: 0,
          message: 'Aucune commande à synchroniser' 
        }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' }, status: 200 }
      );
    }

    // Convertir les commandes SendCloud au format attendu par sendcloud-orders-batch
    const formattedOrders = allOrders.map(order => ({
      id: order.id,
      order_number: order.order_number,
      name: order.name,
      email: order.email,
      telephone: order.telephone,
      address: order.address,
      address_2: order.address_2,
      city: order.city,
      postal_code: order.postal_code,
      country: order.country,
      order_products: order.order_products || [],
      total_order_value: order.total_order_value,
      currency: order.currency,
    }));

    // Appeler sendcloud-orders-batch pour traiter les commandes
    console.log('📤 Envoi vers sendcloud-orders-batch...');
    
    const { data: batchResult, error: batchError } = await supabase.functions.invoke(
      'sendcloud-orders-batch',
      {
        body: { orders: formattedOrders }
      }
    );

    if (batchError) {
      throw batchError;
    }

    console.log('✅ Synchronisation terminée:', batchResult);

    return new Response(
      JSON.stringify(batchResult),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' }, status: 200 }
    );

  } catch (error) {
    console.error('❌ Erreur synchronisation:', error);
    return new Response(
      JSON.stringify({ 
        success: false, 
        error: error instanceof Error ? error.message : String(error) 
      }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' }, status: 500 }
    );
  }
});
