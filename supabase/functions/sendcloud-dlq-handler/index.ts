import { createClient } from 'npm:@supabase/supabase-js@2';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
    const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
    const supabase = createClient(supabaseUrl, supabaseServiceKey);
    
    console.log('[DLQ Handler] Starting DLQ processing');
    
    // Récupérer les messages DLQ prêts pour retry
    const { data: messages, error } = await supabase
      .from('sendcloud_dlq')
      .select('*')
      .eq('status', 'pending')
      .lt('next_retry_at', new Date().toISOString())
      .limit(50); // Traiter max 50 à la fois

    if (error) {
      console.error('[DLQ Handler] Error fetching messages:', error);
      throw error;
    }

    if (!messages || messages.length === 0) {
      console.log('[DLQ Handler] No messages to retry');
      return new Response(
        JSON.stringify({ success: true, processed: 0, message: 'No messages to retry' }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    console.log(`[DLQ Handler] Processing ${messages.length} messages`);

    let successCount = 0;
    let failedCount = 0;

    for (const msg of messages) {
      try {
        console.log(`[DLQ Handler] Processing message ${msg.id} (type: ${msg.event_type}, retry: ${msg.retry_count}/${msg.max_retries})`);
        
        // Marquer comme "retrying"
        await supabase
          .from('sendcloud_dlq')
          .update({ status: 'retrying' })
          .eq('id', msg.id);

        // Router selon event_type
        let success = false;
        
        switch (msg.event_type) {
          case 'order_sync':
            success = await retryOrderSync(supabase, msg.payload);
            break;
          case 'product_sync':
            success = await retryProductSync(supabase, msg.payload);
            break;
          default:
            console.warn(`[DLQ Handler] Unknown event type: ${msg.event_type}`);
            success = false;
        }

        if (success) {
          // Marquer comme traité
          await supabase
            .from('sendcloud_dlq')
            .update({
              status: 'success',
              processed_at: new Date().toISOString(),
            })
            .eq('id', msg.id);
          
          console.log(`[DLQ Handler] ✅ Message ${msg.id} processed successfully`);
          successCount++;
        } else {
          // Échec : incrémenter retry_count
          const newRetryCount = msg.retry_count + 1;
          
          if (newRetryCount >= msg.max_retries) {
            // Max retries atteint, abandon
            await supabase
              .from('sendcloud_dlq')
              .update({ 
                status: 'failed',
                retry_count: newRetryCount,
              })
              .eq('id', msg.id);
            
            console.error(`[DLQ Handler] ❌ Message ${msg.id} reached max retries, marking as failed`);
          } else {
            // Calculer prochain retry avec backoff exponentiel
            const delayMinutes = Math.pow(2, newRetryCount) * 5; // 5, 10, 20, 40 minutes
            const nextRetry = new Date(Date.now() + delayMinutes * 60 * 1000);
            
            await supabase
              .from('sendcloud_dlq')
              .update({
                status: 'pending',
                retry_count: newRetryCount,
                next_retry_at: nextRetry.toISOString(),
              })
              .eq('id', msg.id);
            
            console.log(`[DLQ Handler] 🔄 Message ${msg.id} scheduled for retry in ${delayMinutes} minutes`);
          }
          
          failedCount++;
        }
        
      } catch (error) {
        console.error(`[DLQ Handler] Error processing message ${msg.id}:`, error);
        failedCount++;
        
        // Remettre en pending pour retry ultérieur
        await supabase
          .from('sendcloud_dlq')
          .update({ status: 'pending' })
          .eq('id', msg.id);
      }
    }

    console.log(`[DLQ Handler] Completed: ${successCount} succeeded, ${failedCount} failed`);

    return new Response(
      JSON.stringify({
        success: true,
        processed: messages.length,
        succeeded: successCount,
        failed: failedCount,
      }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );

  } catch (error) {
    console.error('[DLQ Handler] Fatal error:', error);
    const errorMessage = error instanceof Error ? error.message : 'Unknown error';
    return new Response(
      JSON.stringify({ success: false, error: errorMessage }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});

// Helper functions
async function retryOrderSync(supabase: any, payload: any): Promise<boolean> {
  try {
    console.log('[DLQ Handler] Retrying order sync:', payload);
    
    const result = await supabase.functions.invoke('sendcloud-orders-batch', {
      body: { orders: [payload.order] }
    });
    
    if (result.error) {
      console.error('[DLQ Handler] Order sync error:', result.error);
      return false;
    }
    
    return true;
  } catch (error) {
    console.error('[DLQ Handler] Exception in retryOrderSync:', error);
    return false;
  }
}

async function retryProductSync(supabase: any, payload: any): Promise<boolean> {
  try {
    console.log('[DLQ Handler] Retrying product sync:', payload);
    
    const result = await supabase.functions.invoke('sendcloud-sync-products', {
      body: { product_ids: [payload.product_id] }
    });
    
    if (result.error) {
      console.error('[DLQ Handler] Product sync error:', result.error);
      return false;
    }
    
    return true;
  } catch (error) {
    console.error('[DLQ Handler] Exception in retryProductSync:', error);
    return false;
  }
}
