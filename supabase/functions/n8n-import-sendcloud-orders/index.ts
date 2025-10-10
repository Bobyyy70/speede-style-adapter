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

    console.log('N8N authentication successful, proxying to sendcloud-sync-orders');

    // Get request body
    const body = await req.json().catch(() => ({}));
    
    // Call the existing sendcloud-sync-orders function
    const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
    const response = await fetch(
      `${supabaseUrl}/functions/v1/sendcloud-sync-orders`,
      {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')}`,
        },
        body: JSON.stringify(body),
      }
    );

    const result = await response.json();

    console.log('Sync completed via proxy', {
      status: response.status,
      result,
    });

    return new Response(
      JSON.stringify(result),
      {
        status: response.status,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      }
    );

  } catch (error) {
    console.error('Error in n8n-import-sendcloud-orders:', error);
    const errorMessage = error instanceof Error ? error.message : 'Unknown error';
    const errorDetails = error instanceof Error ? error.toString() : String(error);
    
    return new Response(
      JSON.stringify({
        error: errorMessage,
        details: errorDetails,
      }),
      {
        status: 500,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      }
    );
  }
});
