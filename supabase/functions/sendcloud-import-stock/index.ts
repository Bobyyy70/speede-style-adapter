// SendCloud Import Stock: Import stock levels from SendCloud and detect discrepancies
// Runs daily to reconcile stock between SendCloud and WMS

import { createClient } from 'npm:@supabase/supabase-js@2';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

interface SendCloudProduct {
  id: number;
  sku: string;
  description: string;
  stock?: number;
}

Deno.serve(async (req) => {
  // Handle CORS preflight
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
    const supabaseKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
    const supabase = createClient(supabaseUrl, supabaseKey);

    const sendcloudApiKey = Deno.env.get('SENDCLOUD_API_PUBLIC_KEY');
    const sendcloudApiSecret = Deno.env.get('SENDCLOUD_API_SECRET_KEY');

    if (!sendcloudApiKey || !sendcloudApiSecret) {
      console.error('[sendcloud-import-stock] Missing SendCloud API credentials');
      return new Response(
        JSON.stringify({ error: 'SendCloud API not configured' }),
        { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Parse request body
    const body = await req.json().catch(() => ({}));
    const { threshold_percent = 10 } = body as { threshold_percent?: number };

    console.log('[sendcloud-import-stock] Starting stock reconciliation', { threshold_percent });

    const authHeader = 'Basic ' + btoa(`${sendcloudApiKey}:${sendcloudApiSecret}`);
    let allProducts: SendCloudProduct[] = [];
    let page = 1;
    let hasMore = true;

    // Fetch all products with stock from SendCloud (paginated)
    while (hasMore) {
      const response = await fetch(
        `https://panel.sendcloud.sc/api/v2/products?page=${page}&per_page=100`,
        {
          method: 'GET',
          headers: {
            'Authorization': authHeader,
          },
        }
      );

      if (!response.ok) {
        const errorText = await response.text();
        console.error('[sendcloud-import-stock] SendCloud API error:', errorText);
        throw new Error(`SendCloud API returned ${response.status}: ${errorText}`);
      }

      const data = await response.json();
      const products = data.products || [];

      allProducts = allProducts.concat(products);
      hasMore = products.length === 100;
      page++;
    }

    console.log(`[sendcloud-import-stock] Fetched ${allProducts.length} products from SendCloud`);

    let checked = 0;
    let discrepancies = 0;
    const discrepancyDetails = [];

    // Check each product's stock
    for (const scProduct of allProducts) {
      try {
        // Get WMS product
        const { data: mapping } = await supabase
          .from('sendcloud_product_mapping')
          .select('produit_id')
          .eq('sendcloud_sku', scProduct.sku)
          .single();

        if (!mapping) {
          console.warn(`[sendcloud-import-stock] Product ${scProduct.sku} not found in WMS, skipping`);
          continue;
        }

        // Get WMS stock
        const { data: product } = await supabase
          .from('produit')
          .select('id, reference, nom, stock_actuel')
          .eq('id', mapping.produit_id)
          .single();

        if (!product) {
          console.warn(`[sendcloud-import-stock] Product ${mapping.produit_id} not found in produit table, skipping`);
          continue;
        }

        const stockWms = product.stock_actuel || 0;
        const stockSendcloud = scProduct.stock || 0;
        const difference = Math.abs(stockWms - stockSendcloud);
        const percentDifference = stockWms > 0 
          ? (difference / stockWms) * 100 
          : (stockSendcloud > 0 ? 100 : 0);

        checked++;

        // If discrepancy exceeds threshold, log it
        if (percentDifference > threshold_percent && difference > 0) {
          console.warn(
            `[sendcloud-import-stock] Stock discrepancy for ${scProduct.sku}: ` +
            `WMS=${stockWms}, SendCloud=${stockSendcloud}, diff=${difference} (${percentDifference.toFixed(1)}%)`
          );

          // Insert reconciliation record
          await supabase.from('sendcloud_stock_reconciliation').insert({
            produit_id: product.id,
            produit_reference: product.reference,
            produit_nom: product.nom,
            stock_wms: stockWms,
            stock_sendcloud: stockSendcloud,
            ecart: stockWms - stockSendcloud,
            pourcentage_ecart: percentDifference,
            resolu: false,
          });

          discrepancies++;
          discrepancyDetails.push({
            sku: scProduct.sku,
            nom: product.nom,
            stock_wms: stockWms,
            stock_sendcloud: stockSendcloud,
            ecart: stockWms - stockSendcloud,
            pourcentage: percentDifference.toFixed(1),
          });
        }

      } catch (error) {
        console.error(`[sendcloud-import-stock] Error processing product ${scProduct.sku}:`, error);
      }
    }

    console.log(`[sendcloud-import-stock] Reconciliation complete: ${checked} checked, ${discrepancies} discrepancies found`);

    return new Response(
      JSON.stringify({
        success: true,
        checked,
        discrepancies,
        threshold_percent,
        details: discrepancyDetails,
      }),
      { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );

  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : 'Unknown error';
    console.error('[sendcloud-import-stock] Fatal error:', error);
    return new Response(
      JSON.stringify({ error: errorMessage }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});
