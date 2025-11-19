// SendCloud Retry Webhooks - Système de retry automatique
import { createClient } from "npm:@supabase/supabase-js@2";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const supabase = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? ''
    );

    console.log('[SendCloud Retry] Starting retry process...');

    // Récupérer les webhooks en échec à retrier
    const { data: failedWebhooks, error: fetchError } = await supabase
      .from('sendcloud_failed_webhooks')
      .select('*')
      .limit(50);

    if (fetchError) throw fetchError;

    if (!failedWebhooks || failedWebhooks.length === 0) {
      console.log('[SendCloud Retry] No webhooks to retry');
      return new Response(
        JSON.stringify({ message: 'No webhooks to retry', retried: 0 }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    console.log(`[SendCloud Retry] Found ${failedWebhooks.length} webhooks to retry`);

    const sendCloudApiKey = Deno.env.get('SENDCLOUD_API_PUBLIC_KEY');
    const sendCloudSecretKey = Deno.env.get('SENDCLOUD_API_SECRET_KEY');

    if (!sendCloudApiKey || !sendCloudSecretKey) {
      throw new Error('SendCloud API credentials not configured');
    }

    const auth = btoa(`${sendCloudApiKey}:${sendCloudSecretKey}`);
    let successCount = 0;
    let failureCount = 0;

    // Retrier chaque webhook
    for (const webhook of failedWebhooks) {
      const startTime = Date.now();
      let success = false;
      let errorMessage = null;

      try {
        const sendCloudUrl = getSendCloudEndpoint(webhook.event_type, webhook.entity_type);

        const response = await fetch(sendCloudUrl, {
          method: 'POST',
          headers: {
            'Authorization': `Basic ${auth}`,
            'Content-Type': 'application/json',
          },
          body: JSON.stringify(webhook.payload),
        });

        const responseData = await response.json();

        if (!response.ok) {
          throw new Error(`SendCloud API error: ${response.status} - ${JSON.stringify(responseData)}`);
        }

        // Succès - mettre à jour le webhook
        await supabase
          .from('sendcloud_outgoing_webhooks')
          .update({
            status: 'sent',
            sent_at: new Date().toISOString(),
            sendcloud_response: responseData,
          })
          .eq('id', webhook.id);

        success = true;
        successCount++;
        console.log(`[SendCloud Retry] ✓ Success: ${webhook.event_type} (attempt ${webhook.retry_count + 1})`);

      } catch (error) {
        errorMessage = (error as Error).message;
        failureCount++;
        console.error(`[SendCloud Retry] ✗ Failed: ${webhook.event_type} (attempt ${webhook.retry_count + 1}): ${errorMessage}`);

        const newRetryCount = webhook.retry_count + 1;

        // Si on n'a pas atteint le max de retries, calculer next_retry_at
        if (newRetryCount < webhook.max_retries) {
          const { data: nextRetry } = await supabase
            .rpc('calculate_next_retry', { retry_count: newRetryCount });

          await supabase
            .from('sendcloud_outgoing_webhooks')
            .update({
              retry_count: newRetryCount,
              next_retry_at: nextRetry,
              error_message: errorMessage,
            })
            .eq('id', webhook.id);
        } else {
          // Max retries atteint - marquer comme définitivement échoué
          await supabase
            .from('sendcloud_outgoing_webhooks')
            .update({
              retry_count: newRetryCount,
              error_message: `Max retries reached: ${errorMessage}`,
              next_retry_at: null,
            })
            .eq('id', webhook.id);

          console.log(`[SendCloud Retry] Max retries reached for webhook ${webhook.id}`);
        }
      }

      // Logger dans l'historique
      await supabase
        .from('sendcloud_event_history')
        .insert({
          event_type: `retry_${webhook.event_type}`,
          direction: 'outgoing',
          entity_type: webhook.entity_type,
          entity_id: webhook.entity_id,
          success,
          processing_time_ms: Date.now() - startTime,
          error_details: errorMessage,
          metadata: {
            webhook_id: webhook.id,
            retry_attempt: webhook.retry_count + 1,
          },
        });
    }

    console.log(`[SendCloud Retry] Completed: ${successCount} succeeded, ${failureCount} failed`);

    return new Response(
      JSON.stringify({
        success: true,
        retried: failedWebhooks.length,
        succeeded: successCount,
        failed: failureCount,
      }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );

  } catch (error) {
    console.error('[SendCloud Retry] Fatal error:', error);
    return new Response(
      JSON.stringify({ error: (error as Error).message }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});

function getSendCloudEndpoint(eventType: string, entityType: string): string {
  const baseUrl = 'https://panel.sendcloud.sc/api/v2';

  switch (entityType) {
    case 'order':
      return `${baseUrl}/parcels`;
    case 'product':
      return `${baseUrl}/products`;
    case 'stock':
      return `${baseUrl}/products/stock`;
    default:
      throw new Error(`Unknown entity type: ${entityType}`);
  }
}
