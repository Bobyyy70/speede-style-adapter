import { SupabaseClient } from 'https://esm.sh/@supabase/supabase-js@2.38.4';

export interface SyncLogContext {
  runId: string;
  job: 'orders' | 'products' | 'parcels' | 'carriers' | 'shipping_methods';
  clientId?: string;
}

/**
 * Démarre un log de synchronisation
 * @returns runId - Identifiant unique de ce run
 */
export async function startSyncLog(
  supabase: SupabaseClient,
  job: SyncLogContext['job'],
  clientId?: string
): Promise<string> {
  console.log(`[Sync Logger] Starting ${job} sync`);
  
  const { data, error } = await supabase
    .from('sendcloud_sync_logs')
    .insert({
      job,
      client_id: clientId || null,
      status: 'running',
      started_at: new Date().toISOString(),
    })
    .select('run_id')
    .single();

  if (error) {
    console.error('[Sync Logger] Failed to create log:', error);
    throw new Error(`Failed to start sync log: ${error.message}`);
  }

  console.log(`[Sync Logger] Log created with runId: ${data.run_id}`);
  return data.run_id;
}

/**
 * Finalise un log de synchronisation
 */
export async function finalizeSyncLog(
  supabase: SupabaseClient,
  runId: string,
  status: 'success' | 'partial' | 'error',
  stats: {
    batchCount: number;
    itemCount: number;
    errorMessage?: string;
    metadata?: Record<string, any>;
  }
): Promise<void> {
  console.log(`[Sync Logger] Finalizing ${runId} with status: ${status}`);
  
  const { error } = await supabase
    .from('sendcloud_sync_logs')
    .update({
      status,
      finished_at: new Date().toISOString(),
      batch_count: stats.batchCount,
      item_count: stats.itemCount,
      error_message: stats.errorMessage || null,
      metadata: stats.metadata || {},
    })
    .eq('run_id', runId);

  if (error) {
    console.error('[Sync Logger] Failed to finalize log:', error);
  }
}

/**
 * Met à jour le compteur d'items/batches pendant le traitement
 */
export async function updateSyncProgress(
  supabase: SupabaseClient,
  runId: string,
  incrementBatch: number = 0,
  incrementItems: number = 0
): Promise<void> {
  // Récupérer les valeurs actuelles
  const { data: current } = await supabase
    .from('sendcloud_sync_logs')
    .select('batch_count, item_count')
    .eq('run_id', runId)
    .single();

  if (current) {
    await supabase
      .from('sendcloud_sync_logs')
      .update({
        batch_count: (current.batch_count || 0) + incrementBatch,
        item_count: (current.item_count || 0) + incrementItems,
      })
      .eq('run_id', runId);
  }
}

/**
 * Pousse un message dans la Dead Letter Queue
 */
export async function pushToDLQ(
  supabase: SupabaseClient,
  eventType: string,
  payload: any,
  errorMessage: string,
  maxRetries: number = 3
): Promise<void> {
  console.error(`[DLQ] Pushing to DLQ: ${eventType} - ${errorMessage}`);
  
  const nextRetryAt = new Date(Date.now() + 5 * 60 * 1000); // 5 minutes
  
  const { error } = await supabase
    .from('sendcloud_dlq')
    .insert({
      event_type: eventType,
      payload,
      error_message: errorMessage,
      retry_count: 0,
      max_retries: maxRetries,
      next_retry_at: nextRetryAt.toISOString(),
      status: 'pending',
    });

  if (error) {
    console.error('[DLQ] Failed to push to DLQ:', error);
  }
}
