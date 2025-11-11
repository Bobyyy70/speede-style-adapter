// SendCloud Stock Batch Update: Process queued stock updates and send to SendCloud
// Runs every 2 minutes via cron to batch update stock levels

import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.39.3';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

interface StockQueueItem {
  id: string;
  produit_id: string;
  sendcloud_sku: string;
  stock_actuel: number;
  queued_at: string;
  retry_count: number;
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
      console.error('[sendcloud-update-stock] Missing SendCloud API credentials');
      return new Response(
        JSON.stringify({ error: 'SendCloud API not configured' }),
        { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    console.log('[sendcloud-update-stock] Starting batch stock update');

    // Fetch pending stock updates (max 100 at a time)
    const { data: queueItems, error: queueError } = await supabase
      .from('sendcloud_stock_queue')
      .select('*')
      .eq('processed', false)
      .order('queued_at', { ascending: true })
      .limit(100);

    if (queueError) {
      console.error('[sendcloud-update-stock] Error fetching queue:', queueError);
      throw queueError;
    }

    if (!queueItems || queueItems.length === 0) {
      console.log('[sendcloud-update-stock] No pending stock updates');
      return new Response(
        JSON.stringify({ success: true, updated: 0, message: 'No pending stock updates' }),
        { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    console.log(`[sendcloud-update-stock] Processing ${queueItems.length} stock updates`);

    let updated = 0;
    let errors = 0;
    const authHeader = 'Basic ' + btoa(`${sendcloudApiKey}:${sendcloudApiSecret}`);

    // Process each queue item
    for (const item of queueItems as StockQueueItem[]) {
      try {
        // Skip if already retried 3 times
        if (item.retry_count >= 3) {
          console.warn(`[sendcloud-update-stock] Max retries reached for SKU ${item.sendcloud_sku}, marking as error`);
          
          await supabase
            .from('sendcloud_stock_queue')
            .update({
              processed: true,
              processed_at: new Date().toISOString(),
              error_message: 'Max retries exceeded',
            })
            .eq('id', item.id);

          await supabase.from('sendcloud_sync_errors').insert({
            entity_type: 'stock',
            entity_id: item.produit_id,
            operation: 'update',
            error_message: 'Max retries exceeded for stock update',
            request_payload: { sku: item.sendcloud_sku, stock: item.stock_actuel },
            resolved: true,
          });

          errors++;
          continue;
        }

        // Call SendCloud Stock API
        const response = await fetch(
          `https://panel.sendcloud.sc/api/v2/products/${item.sendcloud_sku}/stock`,
          {
            method: 'PATCH',
            headers: {
              'Authorization': authHeader,
              'Content-Type': 'application/json',
            },
            body: JSON.stringify({
              stock: item.stock_actuel,
            }),
          }
        );

        if (!response.ok) {
          const errorText = await response.text();
          console.error(`[sendcloud-update-stock] SendCloud API error for SKU ${item.sendcloud_sku}:`, errorText);

          // Increment retry count
          await supabase
            .from('sendcloud_stock_queue')
            .update({
              retry_count: item.retry_count + 1,
              error_message: `API error: ${response.status}`,
            })
            .eq('id', item.id);

          // Log error if this is the final retry
          if (item.retry_count + 1 >= 3) {
            await supabase.from('sendcloud_sync_errors').insert({
              entity_type: 'stock',
              entity_id: item.produit_id,
              operation: 'update',
              error_code: `HTTP_${response.status}`,
              error_message: `SendCloud API returned ${response.status}`,
              error_details: { response_body: errorText },
              request_payload: { sku: item.sendcloud_sku, stock: item.stock_actuel },
              retry_count: item.retry_count + 1,
            });
          }

          errors++;
          continue;
        }

        const responseData = await response.json();
        console.log(`[sendcloud-update-stock] Updated stock for SKU ${item.sendcloud_sku}: ${item.stock_actuel}`);

        // Mark as processed
        await supabase
          .from('sendcloud_stock_queue')
          .update({
            processed: true,
            processed_at: new Date().toISOString(),
            error_message: null,
          })
          .eq('id', item.id);

        // Update mapping last sync time
        await supabase
          .from('sendcloud_product_mapping')
          .update({
            last_sync_at: new Date().toISOString(),
            sync_status: 'synced',
          })
          .eq('sendcloud_sku', item.sendcloud_sku);

        updated++;

      } catch (error) {
        const errorMessage = error instanceof Error ? error.message : 'Unknown error';
        console.error(`[sendcloud-update-stock] Error processing SKU ${item.sendcloud_sku}:`, error);

        // Increment retry count
        await supabase
          .from('sendcloud_stock_queue')
          .update({
            retry_count: item.retry_count + 1,
            error_message: errorMessage,
          })
          .eq('id', item.id);

        errors++;
      }
    }

    console.log(`[sendcloud-update-stock] Batch complete: ${updated} updated, ${errors} errors`);

    return new Response(
      JSON.stringify({
        success: true,
        updated,
        errors,
        total: queueItems.length,
      }),
      { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );

  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : 'Unknown error';
    console.error('[sendcloud-update-stock] Fatal error:', error);
    return new Response(
      JSON.stringify({ error: errorMessage }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});
