import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type, x-n8n-api-key',
};

Deno.serve(async (req) => {
  // Handle CORS preflight
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    // Validate N8N API Key
    const n8nApiKey = req.headers.get('X-N8N-API-KEY');
    const expectedApiKey = Deno.env.get('N8N_API_KEY');
    
    if (!n8nApiKey || n8nApiKey !== expectedApiKey) {
      console.error('Invalid or missing N8N API key');
      return new Response(
        JSON.stringify({ 
          error: 'Unauthorized',
          message: 'Valid X-N8N-API-KEY header required'
        }),
        { 
          status: 401,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' }
        }
      );
    }

    // Initialize Supabase client
    const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
    const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
    const supabase = createClient(supabaseUrl, supabaseServiceKey);

    // Get SendCloud API credentials
    const sendcloudPublicKey = Deno.env.get('SENDCLOUD_API_PUBLIC_KEY');
    const sendcloudSecretKey = Deno.env.get('SENDCLOUD_API_SECRET_KEY');

    if (!sendcloudPublicKey || !sendcloudSecretKey) {
      throw new Error('SendCloud API credentials not configured');
    }

    // Parse request body for sync options
    const { mode = 'incremental', startDate, endDate } = await req.json().catch(() => ({}));

    console.log('Starting SendCloud import via n8n', { mode, startDate, endDate });

    // Determine date range based on mode
    let dateFrom = new Date();
    let dateTo = new Date();

    if (mode === 'full') {
      dateFrom = new Date('2020-01-01');
    } else if (mode === 'custom' && startDate) {
      dateFrom = new Date(startDate);
      if (endDate) {
        dateTo = new Date(endDate);
      }
    } else {
      // Incremental: last 7 days
      dateFrom.setDate(dateFrom.getDate() - 7);
    }

    const dateFromStr = dateFrom.toISOString().split('T')[0];
    const dateToStr = dateTo.toISOString().split('T')[0];

    console.log(`Fetching orders from ${dateFromStr} to ${dateToStr}`);

    // Fetch orders from SendCloud
    const allOrders: any[] = [];
    let currentPage = 1;
    const perPage = 100;
    let hasMore = true;

    while (hasMore) {
      const params = new URLSearchParams({
        page: currentPage.toString(),
        per_page: perPage.toString(),
        date_from: dateFromStr,
        date_to: dateToStr,
      });

      const response = await fetch(
        `https://panel.sendcloud.sc/api/v2/orders?${params}`,
        {
          headers: {
            'Authorization': `Basic ${btoa(`${sendcloudPublicKey}:${sendcloudSecretKey}`)}`,
            'Content-Type': 'application/json',
          },
        }
      );

      if (!response.ok) {
        throw new Error(`SendCloud API error: ${response.status}`);
      }

      const data = await response.json();
      allOrders.push(...data.results);

      console.log(`Fetched page ${currentPage}, total orders: ${allOrders.length}`);

      hasMore = data.next !== null;
      currentPage++;

      // Safety limit
      if (currentPage > 100) {
        console.warn('Reached page limit (100), stopping fetch');
        break;
      }
    }

    console.log(`Total orders fetched: ${allOrders.length}`);

    // Check for existing orders in database
    const sendcloudIds = allOrders.map(o => o.id);
    const { data: existingOrders } = await supabase
      .from('commande')
      .select('sendcloud_id, statut_wms')
      .in('sendcloud_id', sendcloudIds);

    const existingMap = new Map(
      existingOrders?.map(o => [o.sendcloud_id, o.statut_wms]) || []
    );

    // Filter out already processed orders
    const newOrders = allOrders.filter(order => {
      const status = existingMap.get(order.id);
      return !status || !['expédiée', 'terminée', 'annulée'].includes(status);
    });

    console.log(`New/updatable orders: ${newOrders.length}`);

    if (newOrders.length === 0) {
      return new Response(
        JSON.stringify({
          success: true,
          message: 'No new orders to import',
          total_fetched: allOrders.length,
          new_orders: 0,
        }),
        {
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        }
      );
    }

    // Process orders in batches via sendcloud-orders-batch function
    const { data: batchResult, error: batchError } = await supabase.functions.invoke(
      'sendcloud-orders-batch',
      {
        body: { orders: newOrders },
      }
    );

    if (batchError) {
      throw new Error(`Batch processing error: ${batchError.message}`);
    }

    // Log sync result
    await supabase.from('sendcloud_sync_log').insert({
      sync_status: batchResult.success_count > 0 ? 'success' : 'error',
      orders_fetched: allOrders.length,
      orders_created: batchResult.success_count,
      orders_failed: batchResult.errors?.length || 0,
      error_details: batchResult.errors || null,
    });

    console.log('Import completed', {
      fetched: allOrders.length,
      created: batchResult.success_count,
      failed: batchResult.errors?.length || 0,
    });

    return new Response(
      JSON.stringify({
        success: true,
        message: 'Orders imported successfully',
        total_fetched: allOrders.length,
        new_orders: newOrders.length,
        created: batchResult.success_count,
        failed: batchResult.errors?.length || 0,
        errors: batchResult.errors || [],
      }),
      {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      }
    );

  } catch (error) {
    console.error('Error in n8n-import-sendcloud-orders:', error);
    return new Response(
      JSON.stringify({
        error: error.message,
        details: error.toString(),
      }),
      {
        status: 500,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      }
    );
  }
});
