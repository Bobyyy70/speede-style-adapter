// SendCloud Product Sync: Export WMS products to SendCloud
// Automatically creates/updates products in SendCloud when they are created/modified in WMS

import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.39.3';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

interface Product {
  id: string;
  reference: string;
  nom: string;
  poids_unitaire?: number;
  code_barre_ean?: string;
  code_sh?: string;
  pays_origine?: string;
  valeur_douaniere?: number;
  longueur_cm?: number;
  largeur_cm?: number;
  hauteur_cm?: number;
  client_id?: string;
}

interface SendCloudProduct {
  sku: string;
  description: string;
  weight?: number; // in grams
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
      console.error('[sendcloud-sync-products] Missing SendCloud API credentials');
      return new Response(
        JSON.stringify({ error: 'SendCloud API not configured' }),
        { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Parse request body
    const body = await req.json().catch(() => ({}));
    const { product_ids, sync_all = false } = body as { product_ids?: string[]; sync_all?: boolean };

    console.log('[sendcloud-sync-products] Starting sync:', { product_ids, sync_all });

    // Build query for products to sync
    let query = supabase
      .from('produit')
      .select('*')
      .eq('statut_actif', true);

    if (!sync_all && product_ids && product_ids.length > 0) {
      query = query.in('id', product_ids);
    }

    const { data: products, error: productsError } = await query;

    if (productsError) {
      console.error('[sendcloud-sync-products] Error fetching products:', productsError);
      throw productsError;
    }

    if (!products || products.length === 0) {
      return new Response(
        JSON.stringify({ success: true, synced: 0, message: 'No products to sync' }),
        { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    console.log(`[sendcloud-sync-products] Found ${products.length} products to sync`);

    let synced = 0;
    let errors = 0;
    const results = [];

    // Sync each product
    for (const product of products as Product[]) {
      try {
        // Check if product already has SendCloud mapping
        const { data: existingMapping } = await supabase
          .from('sendcloud_product_mapping')
          .select('*')
          .eq('produit_id', product.id)
          .single();

        // Map WMS product to SendCloud format
        const sendcloudProduct: SendCloudProduct = {
          sku: product.reference,
          description: product.nom,
          weight: product.poids_unitaire ? Math.round(product.poids_unitaire * 1000) : undefined, // kg to grams
          ean: product.code_barre_ean || undefined,
          hs_code: product.code_sh || undefined,
          country_of_origin: product.pays_origine || undefined,
          value: product.valeur_douaniere || undefined,
        };

        // Add dimensions if available
        if (product.longueur_cm || product.largeur_cm || product.hauteur_cm) {
          sendcloudProduct.properties = {
            length: product.longueur_cm || undefined,
            width: product.largeur_cm || undefined,
            height: product.hauteur_cm || undefined,
          };
        }

        // Call SendCloud API
        const method = existingMapping ? 'PUT' : 'POST';
        const url = existingMapping
          ? `https://panel.sendcloud.sc/api/v2/products/${existingMapping.sendcloud_product_id}`
          : 'https://panel.sendcloud.sc/api/v2/products';

        const authHeader = 'Basic ' + btoa(`${sendcloudApiKey}:${sendcloudApiSecret}`);

        const response = await fetch(url, {
          method,
          headers: {
            'Authorization': authHeader,
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({ product: sendcloudProduct }),
        });

        if (!response.ok) {
          const errorText = await response.text();
          console.error(`[sendcloud-sync-products] SendCloud API error for ${product.reference}:`, errorText);
          
          // Log error to database
          await supabase.from('sendcloud_sync_errors').insert({
            entity_type: 'product',
            entity_id: product.id,
            operation: existingMapping ? 'update' : 'create',
            error_code: `HTTP_${response.status}`,
            error_message: `SendCloud API returned ${response.status}`,
            error_details: { response_body: errorText },
            request_payload: sendcloudProduct,
            next_retry_at: new Date(Date.now() + 15 * 60 * 1000), // Retry in 15 minutes
          });

          // Update mapping status to error
          if (existingMapping) {
            await supabase
              .from('sendcloud_product_mapping')
              .update({ 
                sync_status: 'error', 
                error_message: `API error: ${response.status}`,
                last_sync_at: new Date().toISOString()
              })
              .eq('produit_id', product.id);
          }

          errors++;
          results.push({ product_id: product.id, reference: product.reference, status: 'error', error: errorText });
          continue;
        }

        const responseData = await response.json();
        const sendcloudProductId = responseData.product?.id || responseData.id;

        console.log(`[sendcloud-sync-products] Synced product ${product.reference} -> SendCloud ID: ${sendcloudProductId}`);

        // Upsert mapping
        await supabase
          .from('sendcloud_product_mapping')
          .upsert({
            produit_id: product.id,
            sendcloud_product_id: sendcloudProductId.toString(),
            sendcloud_sku: product.reference,
            last_sync_at: new Date().toISOString(),
            sync_status: 'synced',
            sync_direction: 'to_sendcloud',
            error_message: null,
            metadata: { last_response: responseData },
          }, {
            onConflict: 'produit_id'
          });

        synced++;
        results.push({ product_id: product.id, reference: product.reference, status: 'synced', sendcloud_id: sendcloudProductId });

      } catch (error) {
        const errorMessage = error instanceof Error ? error.message : 'Unknown error';
        const errorStack = error instanceof Error ? error.stack : undefined;
        console.error(`[sendcloud-sync-products] Error syncing product ${product.reference}:`, error);
        
        // Log error
        await supabase.from('sendcloud_sync_errors').insert({
          entity_type: 'product',
          entity_id: product.id,
          operation: 'sync',
          error_message: errorMessage,
          error_details: { stack: errorStack },
          request_payload: product,
          next_retry_at: new Date(Date.now() + 15 * 60 * 1000),
        });

        errors++;
        results.push({ product_id: product.id, reference: product.reference, status: 'error', error: errorMessage });
      }
    }

    console.log(`[sendcloud-sync-products] Sync complete: ${synced} synced, ${errors} errors`);

    return new Response(
      JSON.stringify({
        success: true,
        synced,
        errors,
        total: products.length,
        results,
      }),
      { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );

  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : 'Unknown error';
    console.error('[sendcloud-sync-products] Fatal error:', error);
    return new Response(
      JSON.stringify({ error: errorMessage }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});
