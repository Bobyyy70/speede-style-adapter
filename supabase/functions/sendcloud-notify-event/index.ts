// SendCloud Notify Event - Webhooks sortants WMS → SendCloud
import { createClient } from "npm:@supabase/supabase-js@2";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

interface NotifyEventPayload {
  event_type: string;
  entity_type: 'order' | 'product' | 'stock';
  entity_id: string;
  data: any;
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const supabase = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? ''
    );

    const { event_type, entity_type, entity_id, data } = await req.json() as NotifyEventPayload;

    console.log(`[SendCloud Notify] Event: ${event_type} for ${entity_type} ${entity_id}`);

    // Construire le payload pour SendCloud
    const payload = await buildPayloadForSendCloud(supabase, event_type, entity_type, entity_id, data);

    // Logger dans la table outgoing_webhooks
    const { data: webhook, error: webhookError } = await supabase
      .from('sendcloud_outgoing_webhooks')
      .insert({
        event_type,
        entity_type,
        entity_id,
        payload,
        status: 'pending',
      })
      .select()
      .single();

    if (webhookError) throw webhookError;

    // Envoyer à SendCloud
    const startTime = Date.now();
    let success = false;
    let errorMessage = null;

    try {
      const sendCloudApiKey = Deno.env.get('SENDCLOUD_API_PUBLIC_KEY');
      const sendCloudSecretKey = Deno.env.get('SENDCLOUD_API_SECRET_KEY');

      if (!sendCloudApiKey || !sendCloudSecretKey) {
        throw new Error('SendCloud API credentials not configured');
      }

      const auth = btoa(`${sendCloudApiKey}:${sendCloudSecretKey}`);
      const sendCloudUrl = getSendCloudEndpoint(event_type, entity_type);

      const response = await fetch(sendCloudUrl, {
        method: 'POST',
        headers: {
          'Authorization': `Basic ${auth}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(payload),
      });

      const responseData = await response.json();

      if (!response.ok) {
        throw new Error(`SendCloud API error: ${response.status} - ${JSON.stringify(responseData)}`);
      }

      // Mise à jour succès
      await supabase
        .from('sendcloud_outgoing_webhooks')
        .update({
          status: 'sent',
          sent_at: new Date().toISOString(),
          sendcloud_response: responseData,
        })
        .eq('id', webhook.id);

      success = true;
      console.log(`[SendCloud Notify] Success: ${event_type} sent to SendCloud`);

    } catch (error) {
      errorMessage = (error as Error).message;
      console.error(`[SendCloud Notify] Error: ${errorMessage}`);

      // Calculer next_retry_at avec backoff exponentiel
      const { data: nextRetry } = await supabase
        .rpc('calculate_next_retry', { retry_count: 0 });

      // Mise à jour échec
      await supabase
        .from('sendcloud_outgoing_webhooks')
        .update({
          status: 'failed',
          error_message: errorMessage,
          retry_count: 1,
          next_retry_at: nextRetry,
        })
        .eq('id', webhook.id);
    }

    // Logger dans l'historique
    await supabase
      .from('sendcloud_event_history')
      .insert({
        event_type,
        direction: 'outgoing',
        entity_type,
        entity_id,
        success,
        processing_time_ms: Date.now() - startTime,
        error_details: errorMessage,
        metadata: { webhook_id: webhook.id },
      });

    return new Response(
      JSON.stringify({
        success,
        webhook_id: webhook.id,
        message: success ? 'Event sent to SendCloud' : 'Event queued for retry',
      }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );

  } catch (error) {
    console.error('[SendCloud Notify] Fatal error:', error);
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

async function buildPayloadForSendCloud(
  supabase: any,
  eventType: string,
  entityType: string,
  entityId: string,
  data: any
): Promise<any> {
  switch (entityType) {
    case 'order':
      return buildOrderPayload(supabase, entityId, data);
    case 'product':
      return buildProductPayload(supabase, entityId, data);
    case 'stock':
      return buildStockPayload(supabase, entityId, data);
    default:
      return data;
  }
}

async function buildOrderPayload(supabase: any, commandeId: string, data: any): Promise<any> {
  const { data: commande } = await supabase
    .from('commande')
    .select('*')
    .eq('id', commandeId)
    .single();

  if (!commande) throw new Error('Commande not found');

  return {
    name: commande.destinataire_nom || 'Unknown',
    company_name: commande.destinataire_entreprise || '',
    address: commande.adresse_ligne_1 || '',
    address_2: commande.adresse_ligne_2 || '',
    city: commande.ville || '',
    postal_code: commande.code_postal || '',
    country: commande.pays_code || 'FR',
    email: commande.destinataire_email || '',
    telephone: commande.destinataire_telephone || '',
    order_number: commande.numero_commande,
    weight: commande.poids_total?.toString() || '1',
    ...data,
  };
}

async function buildProductPayload(supabase: any, produitId: string, data: any): Promise<any> {
  const { data: produit } = await supabase
    .from('produit')
    .select('*')
    .eq('id', produitId)
    .single();

  if (!produit) throw new Error('Produit not found');

  return {
    sku: produit.reference,
    description: produit.nom,
    weight: produit.poids_unitaire ? (produit.poids_unitaire * 1000).toString() : '0',
    hs_code: produit.code_sh || '',
    country_of_origin: produit.pays_origine || 'FR',
    ...data,
  };
}

async function buildStockPayload(supabase: any, produitId: string, data: any): Promise<any> {
  const { data: produit } = await supabase
    .from('produit')
    .select('reference, stock_actuel')
    .eq('id', produitId)
    .single();

  if (!produit) throw new Error('Produit not found');

  return {
    sku: produit.reference,
    quantity: produit.stock_actuel || 0,
    ...data,
  };
}
