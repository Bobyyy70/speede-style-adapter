// SendCloud Import Products: Import product catalog from SendCloud to WMS
// Creates/updates products in WMS based on SendCloud catalog

import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.39.3';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

interface SendCloudProduct {
  id: number;
  sku: string;
  description: string;
  weight?: number;
  ean?: string;
  hs_code?: string;
  country_of_origin?: string;
  value?: number;
  properties?: {
    length?: number;
    width?: number;
    height?: number;
  };
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
      console.error('[sendcloud-import-products] Missing SendCloud API credentials');
      return new Response(
        JSON.stringify({ error: 'SendCloud API not configured' }),
        { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Parse request body
    const body = await req.json().catch(() => ({}));
    const { client_id } = body as { client_id?: string };

    console.log('[sendcloud-import-products] Starting import from SendCloud', { client_id });

    const authHeader = 'Basic ' + btoa(`${sendcloudApiKey}:${sendcloudApiSecret}`);
    let allProducts: SendCloudProduct[] = [];
    let page = 1;
    let hasMore = true;

    // Fetch all products from SendCloud (paginated)
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
        console.error('[sendcloud-import-products] SendCloud API error:', errorText);
        throw new Error(`SendCloud API returned ${response.status}: ${errorText}`);
      }

      const data = await response.json();
      const products = data.products || [];

      allProducts = allProducts.concat(products);
      hasMore = products.length === 100; // If we got 100, there might be more
      page++;

      console.log(`[sendcloud-import-products] Fetched page ${page - 1}, total products: ${allProducts.length}`);
    }

    console.log(`[sendcloud-import-products] Fetched ${allProducts.length} products from SendCloud`);

    let created = 0;
    let updated = 0;
    let errors = 0;
    const results = [];

    // Process each SendCloud product
    for (const scProduct of allProducts) {
      try {
        // Check if product already exists in WMS by SKU
        const { data: existingMapping } = await supabase
          .from('sendcloud_product_mapping')
          .select('produit_id')
          .eq('sendcloud_sku', scProduct.sku)
          .single();

        // Map SendCloud product to WMS format
        const wmsProduct = {
          reference: scProduct.sku,
          nom: scProduct.description,
          poids_unitaire: scProduct.weight ? scProduct.weight / 1000 : null, // grams to kg
          code_barre_ean: scProduct.ean || null,
          code_sh: scProduct.hs_code || null,
          pays_origine: scProduct.country_of_origin || null,
          valeur_douaniere: scProduct.value || null,
          longueur_cm: scProduct.properties?.length || null,
          largeur_cm: scProduct.properties?.width || null,
          hauteur_cm: scProduct.properties?.height || null,
          client_id: client_id || null,
          statut_actif: true,
        };

        if (existingMapping?.produit_id) {
          // Update existing product
          const { error: updateError } = await supabase
            .from('produit')
            .update(wmsProduct)
            .eq('id', existingMapping.produit_id);

          if (updateError) {
            console.error(`[sendcloud-import-products] Error updating product ${scProduct.sku}:`, updateError);
            errors++;
            results.push({ sku: scProduct.sku, status: 'error', error: updateError.message });
            continue;
          }

          // Update mapping
          await supabase
            .from('sendcloud_product_mapping')
            .update({
              last_sync_at: new Date().toISOString(),
              sync_status: 'synced',
              sync_direction: 'from_sendcloud',
            })
            .eq('produit_id', existingMapping.produit_id);

          updated++;
          results.push({ sku: scProduct.sku, status: 'updated', produit_id: existingMapping.produit_id });

        } else {
          // Create new product
          const { data: newProduct, error: insertError } = await supabase
            .from('produit')
            .insert(wmsProduct)
            .select('id')
            .single();

          if (insertError) {
            console.error(`[sendcloud-import-products] Error creating product ${scProduct.sku}:`, insertError);
            errors++;
            results.push({ sku: scProduct.sku, status: 'error', error: insertError.message });
            continue;
          }

          // Create mapping
          await supabase
            .from('sendcloud_product_mapping')
            .insert({
              produit_id: newProduct.id,
              sendcloud_product_id: scProduct.id.toString(),
              sendcloud_sku: scProduct.sku,
              last_sync_at: new Date().toISOString(),
              sync_status: 'synced',
              sync_direction: 'from_sendcloud',
            });

          created++;
          results.push({ sku: scProduct.sku, status: 'created', produit_id: newProduct.id });
        }

      } catch (error) {
        const errorMessage = error instanceof Error ? error.message : 'Unknown error';
        const errorStack = error instanceof Error ? error.stack : undefined;
        console.error(`[sendcloud-import-products] Error processing product ${scProduct.sku}:`, error);
        
        await supabase.from('sendcloud_sync_errors').insert({
          entity_type: 'product',
          entity_id: null,
          operation: 'sync',
          error_message: errorMessage,
          error_details: { product: scProduct, stack: errorStack },
          request_payload: scProduct,
        });

        errors++;
        results.push({ sku: scProduct.sku, status: 'error', error: errorMessage });
      }
    }

    console.log(`[sendcloud-import-products] Import complete: ${created} created, ${updated} updated, ${errors} errors`);

    return new Response(
      JSON.stringify({
        success: true,
        created,
        updated,
        errors,
        total: allProducts.length,
        results,
      }),
      { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );

  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : 'Unknown error';
    console.error('[sendcloud-import-products] Fatal error:', error);
    return new Response(
      JSON.stringify({ error: errorMessage }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});
