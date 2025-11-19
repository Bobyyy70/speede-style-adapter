import { createClient } from 'npm:@supabase/supabase-js@2';
import { startSyncLog, finalizeSyncLog } from '../_shared/sync-logger.ts';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

interface SetupStep {
  id: string;
  label: string;
  function: string;
  params?: any;
}

const SETUP_STEPS: SetupStep[] = [
  { id: 'test', label: 'Test de connexion', function: 'sendcloud-test-connection' },
  { id: 'carriers', label: 'Import des transporteurs', function: 'sendcloud-import-carriers' },
  { id: 'methods', label: 'Import des méthodes d\'expédition', function: 'sendcloud-import-shipping-methods' },
  { id: 'products', label: 'Synchronisation des produits', function: 'sendcloud-sync-products', params: { sync_all: true } },
  { id: 'orders', label: 'Import des commandes récentes', function: 'sendcloud-sync-orders', params: { mode: 'initial', limit: 100 } },
];

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  const startTime = Date.now();
  let runId: string | null = null;

  try {
    const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
    const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
    const supabase = createClient(supabaseUrl, supabaseServiceKey);
    
    console.log('[Initial Setup] Starting SendCloud initial setup');
    
    runId = await startSyncLog(supabase, 'carriers', undefined); // Utiliser 'carriers' comme job parent
    
    const results = [];
    
    for (const step of SETUP_STEPS) {
      console.log(`[Initial Setup] ========================================`);
      console.log(`[Initial Setup] Executing: ${step.label}`);
      console.log(`[Initial Setup] ========================================`);
      
      const stepStart = Date.now();
      
      try {
        const { data, error } = await supabase.functions.invoke(step.function, {
          body: step.params || {},
        });

        if (error) {
          throw new Error(`${step.label} failed: ${error.message}`);
        }

        results.push({
          step: step.id,
          label: step.label,
          success: true,
          duration_ms: Date.now() - stepStart,
          data,
        });

        console.log(`[Initial Setup] ✅ ${step.label} completed in ${Date.now() - stepStart}ms`);
        
      } catch (error) {
        console.error(`[Initial Setup] ❌ ${step.label} failed:`, error);
        const errorMessage = error instanceof Error ? error.message : 'Unknown error';
        
        results.push({
          step: step.id,
          label: step.label,
          success: false,
          error: errorMessage,
          duration_ms: Date.now() - stepStart,
        });

        // Continuer avec les autres étapes même si une échoue
        console.log(`[Initial Setup] Continuing with next steps despite error...`);
      }
    }

    const allSuccess = results.every(r => r.success);
    const successCount = results.filter(r => r.success).length;
    
    await finalizeSyncLog(supabase, runId, allSuccess ? 'success' : 'partial', {
      batchCount: results.length,
      itemCount: successCount,
      metadata: {
        steps: results,
        total_duration_ms: Date.now() - startTime,
      },
    });

    console.log('[Initial Setup] ========================================');
    console.log(`[Initial Setup] Setup completed: ${successCount}/${results.length} steps successful`);
    console.log(`[Initial Setup] Total duration: ${Date.now() - startTime}ms`);
    console.log('[Initial Setup] ========================================');

    return new Response(
      JSON.stringify({
        success: allSuccess,
        results,
        total_duration_ms: Date.now() - startTime,
        steps_completed: successCount,
        steps_total: results.length,
      }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );

  } catch (error) {
    console.error('[Initial Setup] Fatal error:', error);
    const errorMessage = error instanceof Error ? error.message : 'Unknown error';
    
    if (runId) {
      const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
      const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
      const supabase = createClient(supabaseUrl, supabaseServiceKey);
      
      await finalizeSyncLog(supabase, runId, 'error', {
        batchCount: 0,
        itemCount: 0,
        errorMessage,
      });
    }

    return new Response(
      JSON.stringify({ success: false, error: errorMessage }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});
