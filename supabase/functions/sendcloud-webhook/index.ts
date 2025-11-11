import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.39.3';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type, x-webhook-token',
};

// Constant-time string comparison to prevent timing attacks
function constantTimeCompare(a: string, b: string): boolean {
  if (a.length !== b.length) {
    return false;
  }
  
  let result = 0;
  for (let i = 0; i < a.length; i++) {
    result |= a.charCodeAt(i) ^ b.charCodeAt(i);
  }
  
  return result === 0;
}

// Rate limiting: max 100 requests per minute per IP
async function checkRateLimit(
  supabase: any, 
  ipAddress: string, 
  endpoint: string
): Promise<{ allowed: boolean; reason?: string }> {
  const now = new Date();
  const oneMinuteAgo = new Date(now.getTime() - 60000);
  
  // Get or create rate limit entry
  const { data: existing } = await supabase
    .from('webhook_rate_limit')
    .select('*')
    .eq('ip_address', ipAddress)
    .eq('endpoint', endpoint)
    .gte('last_request_at', oneMinuteAgo.toISOString())
    .single();
  
  if (existing) {
    // Check if blocked
    if (existing.blocked_until && new Date(existing.blocked_until) > now) {
      return { 
        allowed: false, 
        reason: `Blocked until ${existing.blocked_until}` 
      };
    }
    
    // Check rate limit (100 req/min)
    if (existing.request_count >= 100) {
      // Block for 5 minutes
      const blockedUntil = new Date(now.getTime() + 300000);
      
      await supabase
        .from('webhook_rate_limit')
        .update({ 
          blocked_until: blockedUntil.toISOString(),
          last_request_at: now.toISOString()
        })
        .eq('id', existing.id);
      
      return { 
        allowed: false, 
        reason: 'Rate limit exceeded (100 req/min)' 
      };
    }
    
    // Increment counter
    await supabase
      .from('webhook_rate_limit')
      .update({ 
        request_count: existing.request_count + 1,
        last_request_at: now.toISOString()
      })
      .eq('id', existing.id);
  } else {
    // Create new entry
    await supabase
      .from('webhook_rate_limit')
      .insert({
        ip_address: ipAddress,
        endpoint: endpoint,
        request_count: 1,
        first_request_at: now.toISOString(),
        last_request_at: now.toISOString()
      });
  }
  
  return { allowed: true };
}

// Log security events
async function logSecurityEvent(
  supabase: any,
  ipAddress: string | null,
  endpoint: string,
  eventType: string,
  userAgent: string | null,
  details: any
): Promise<void> {
  await supabase
    .from('webhook_security_log')
    .insert({
      ip_address: ipAddress,
      endpoint: endpoint,
      event_type: eventType,
      user_agent: userAgent,
      details: details
    });
}

interface SendCloudProduct {
  sku: string;
  name: string;
  quantity: number;
  weight?: number;
  price?: number;
}

interface SendCloudOrder {
  id: string | number;
  order_number?: string;
  order_id?: string;
  name: string;
  email?: string;
  telephone?: string;
  address: string;
  address_2?: string;
  city: string;
  postal_code: string;
  country: string;
  order_products: SendCloudProduct[];
  total_order_value?: number;
  currency?: string;
  shipment?: {
    name?: string;
  };
}

// SendCloud webhook event types
interface SendCloudWebhookEvent {
  action: string;
  timestamp: string;
  integration?: number;
  parcel?: SendCloudParcel;
  order?: SendCloudOrder;
}

interface SendCloudParcel {
  id: number;
  external_order_id?: string;
  external_reference?: string;
  tracking_number?: string;
  tracking_url?: string;
  carrier?: {
    code?: string;
    name?: string;
  };
  status?: {
    id: number;
    message: string;
  };
  shipment?: {
    id: number;
    name?: string;
  };
  label?: {
    label_printer?: string;
    normal_printer?: string[];
  };
  to_address?: {
    name: string;
    country: string;
    city: string;
  };
}

// Map SendCloud status IDs to WMS statuses
function mapSendcloudStatusToWMS(statusId: number): string {
  // SendCloud status mappings based on documentation
  if (statusId >= 2000 && statusId < 3000) return 'livre'; // Delivered
  if (statusId >= 1000 && statusId < 2000) return 'expedie'; // In transit
  if (statusId >= 13 && statusId < 1000) return 'en_preparation'; // Ready for shipping
  if (statusId >= 3000) return 'annule'; // Cancelled/Error
  return 'en_attente_reappro'; // Unknown/pending
}

// Event handlers
async function handleParcelStatusChanged(supabase: any, event: SendCloudWebhookEvent) {
  if (!event.parcel) return { success: false, error: 'No parcel data' };
  
  const { parcel } = event;
  const externalRef = parcel.external_reference || parcel.external_order_id;
  
  if (!externalRef) {
    console.warn('⚠️ No external reference in parcel status changed event');
    return { success: false, error: 'No external reference' };
  }
  
  // Find order by external reference or sendcloud_shipment_id
  const { data: commande } = await supabase
    .from('commande')
    .select('id, numero_commande, statut_wms')
    .or(`sendcloud_reference.eq.${externalRef},sendcloud_shipment_id.eq.${parcel.id}`)
    .maybeSingle();
  
  if (!commande) {
    console.warn(`⚠️ Order not found for reference: ${externalRef}`);
    return { success: false, error: 'Order not found' };
  }
  
  const newStatus = mapSendcloudStatusToWMS(parcel.status?.id || 0);
  
  await supabase
    .from('commande')
    .update({
      statut_wms: newStatus,
      tracking_number: parcel.tracking_number || undefined,
      tracking_url: parcel.tracking_url || undefined,
      transporteur: parcel.carrier?.code || parcel.carrier?.name || undefined,
      date_modification: new Date().toISOString(),
    })
    .eq('id', commande.id);
  
  console.log(`✅ Status updated: ${commande.numero_commande} -> ${newStatus}`);
  
  return { 
    success: true, 
    commande_id: commande.id,
    old_status: commande.statut_wms,
    new_status: newStatus,
  };
}

async function handleTrackingUpdated(supabase: any, event: SendCloudWebhookEvent) {
  if (!event.parcel) return { success: false, error: 'No parcel data' };
  
  const { parcel } = event;
  const externalRef = parcel.external_reference || parcel.external_order_id;
  
  if (!externalRef) return { success: false, error: 'No external reference' };
  
  const { data: commande } = await supabase
    .from('commande')
    .select('id, numero_commande')
    .or(`sendcloud_reference.eq.${externalRef},sendcloud_shipment_id.eq.${parcel.id}`)
    .maybeSingle();
  
  if (!commande) return { success: false, error: 'Order not found' };
  
  await supabase
    .from('commande')
    .update({
      tracking_number: parcel.tracking_number,
      tracking_url: parcel.tracking_url,
      date_modification: new Date().toISOString(),
    })
    .eq('id', commande.id);
  
  console.log(`✅ Tracking updated: ${commande.numero_commande}`);
  
  return { success: true, commande_id: commande.id };
}

async function handleLabelCreated(supabase: any, event: SendCloudWebhookEvent) {
  if (!event.parcel) return { success: false, error: 'No parcel data' };
  
  const { parcel } = event;
  const externalRef = parcel.external_reference || parcel.external_order_id;
  
  if (!externalRef) return { success: false, error: 'No external reference' };
  
  const { data: commande } = await supabase
    .from('commande')
    .select('id, numero_commande')
    .or(`sendcloud_reference.eq.${externalRef},sendcloud_shipment_id.eq.${parcel.id}`)
    .maybeSingle();
  
  if (!commande) return { success: false, error: 'Order not found' };
  
  // Get label URLs from parcel data
  const labelUrl = parcel.label?.label_printer || parcel.label?.normal_printer?.[0];
  
  await supabase
    .from('commande')
    .update({
      label_url: labelUrl,
      label_source: 'sendcloud',
      sendcloud_shipment_id: String(parcel.id),
      date_modification: new Date().toISOString(),
    })
    .eq('id', commande.id);
  
  console.log(`✅ Label created: ${commande.numero_commande}`);
  
  return { success: true, commande_id: commande.id, label_url: labelUrl };
}

async function handleShipmentDelayed(supabase: any, event: SendCloudWebhookEvent) {
  if (!event.parcel) return { success: false, error: 'No parcel data' };
  
  const { parcel } = event;
  const externalRef = parcel.external_reference || parcel.external_order_id;
  
  if (!externalRef) return { success: false, error: 'No external reference' };
  
  const { data: commande } = await supabase
    .from('commande')
    .select('id, numero_commande, remarques')
    .or(`sendcloud_reference.eq.${externalRef},sendcloud_shipment_id.eq.${parcel.id}`)
    .maybeSingle();
  
  if (!commande) return { success: false, error: 'Order not found' };
  
  const delayNote = `[${new Date().toISOString()}] Expédition retardée - Statut: ${parcel.status?.message || 'Unknown'}`;
  const updatedRemarks = commande.remarques ? `${commande.remarques}\n${delayNote}` : delayNote;
  
  await supabase
    .from('commande')
    .update({
      remarques: updatedRemarks,
      date_modification: new Date().toISOString(),
    })
    .eq('id', commande.id);
  
  console.log(`⚠️ Shipment delayed: ${commande.numero_commande}`);
  
  return { success: true, commande_id: commande.id };
}

async function handleDeliveryFailed(supabase: any, event: SendCloudWebhookEvent) {
  if (!event.parcel) return { success: false, error: 'No parcel data' };
  
  const { parcel } = event;
  const externalRef = parcel.external_reference || parcel.external_order_id;
  
  if (!externalRef) return { success: false, error: 'No external reference' };
  
  const { data: commande } = await supabase
    .from('commande')
    .select('id, numero_commande, remarques')
    .or(`sendcloud_reference.eq.${externalRef},sendcloud_shipment_id.eq.${parcel.id}`)
    .maybeSingle();
  
  if (!commande) return { success: false, error: 'Order not found' };
  
  const failNote = `[${new Date().toISOString()}] ❌ Échec de livraison - ${parcel.status?.message || 'Unknown reason'}`;
  const updatedRemarks = commande.remarques ? `${commande.remarques}\n${failNote}` : failNote;
  
  await supabase
    .from('commande')
    .update({
      statut_wms: 'probleme',
      remarques: updatedRemarks,
      date_modification: new Date().toISOString(),
    })
    .eq('id', commande.id);
  
  console.log(`❌ Delivery failed: ${commande.numero_commande}`);
  
  return { success: true, commande_id: commande.id };
}

async function handleReturnInitiated(supabase: any, event: SendCloudWebhookEvent) {
  if (!event.parcel) return { success: false, error: 'No parcel data' };
  
  const { parcel } = event;
  const externalRef = parcel.external_reference || parcel.external_order_id;
  
  if (!externalRef) return { success: false, error: 'No external reference' };
  
  const { data: commande } = await supabase
    .from('commande')
    .select('id, numero_commande, client_id, remarques')
    .or(`sendcloud_reference.eq.${externalRef},sendcloud_shipment_id.eq.${parcel.id}`)
    .maybeSingle();
  
  if (!commande) return { success: false, error: 'Order not found' };
  
  // Create return record
  const { data: retour } = await supabase
    .from('retour_produit')
    .insert({
      client_id: commande.client_id,
      commande_origine_id: commande.id,
      statut: 'en_transit',
      raison_retour: ['retour_client'],
      tracking_number: parcel.tracking_number,
      remarques: `Retour initié depuis SendCloud - Parcel ID: ${parcel.id}`,
    })
    .select()
    .single();
  
  const returnNote = `[${new Date().toISOString()}] 🔄 Retour initié - Retour ID: ${retour?.id || 'N/A'}`;
  const updatedRemarks = commande.remarques ? `${commande.remarques}\n${returnNote}` : returnNote;
  
  await supabase
    .from('commande')
    .update({
      remarques: updatedRemarks,
      date_modification: new Date().toISOString(),
    })
    .eq('id', commande.id);
  
  console.log(`🔄 Return initiated: ${commande.numero_commande}`);
  
  return { success: true, commande_id: commande.id, retour_id: retour?.id };
}

async function handleCancellationRequested(supabase: any, event: SendCloudWebhookEvent) {
  if (!event.parcel) return { success: false, error: 'No parcel data' };
  
  const { parcel } = event;
  const externalRef = parcel.external_reference || parcel.external_order_id;
  
  if (!externalRef) return { success: false, error: 'No external reference' };
  
  const { data: commande } = await supabase
    .from('commande')
    .select('id, numero_commande')
    .or(`sendcloud_reference.eq.${externalRef},sendcloud_shipment_id.eq.${parcel.id}`)
    .maybeSingle();
  
  if (!commande) return { success: false, error: 'Order not found' };
  
  await supabase
    .from('commande')
    .update({
      statut_wms: 'annule',
      date_modification: new Date().toISOString(),
    })
    .eq('id', commande.id);
  
  console.log(`🚫 Cancellation requested: ${commande.numero_commande}`);
  
  return { success: true, commande_id: commande.id };
}

// Generic handler for status-only updates
async function handleGenericStatusUpdate(supabase: any, event: SendCloudWebhookEvent, action: string) {
  if (!event.parcel) return { success: false, error: 'No parcel data' };
  
  const { parcel } = event;
  const externalRef = parcel.external_reference || parcel.external_order_id;
  
  if (!externalRef) return { success: false, error: 'No external reference' };
  
  const { data: commande } = await supabase
    .from('commande')
    .select('id, numero_commande')
    .or(`sendcloud_reference.eq.${externalRef},sendcloud_shipment_id.eq.${parcel.id}`)
    .maybeSingle();
  
  if (!commande) return { success: false, error: 'Order not found' };
  
  console.log(`ℹ️ Generic event handled: ${action} for ${commande.numero_commande}`);
  
  return { success: true, commande_id: commande.id, action };
}

Deno.serve(async (req) => {
  // Handle CORS preflight
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
  const supabaseKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
  const supabase = createClient(supabaseUrl, supabaseKey);

  // Get IP address and user agent for rate limiting and logging
  const ipAddress = req.headers.get('x-forwarded-for')?.split(',')[0]?.trim() || 
                   req.headers.get('x-real-ip') || 
                   'unknown';
  const userAgent = req.headers.get('user-agent');
  const endpoint = '/sendcloud-webhook';

  let logId: string | null = null;
  
  try {
    console.log('📦 Webhook SendCloud reçu from', ipAddress);
    console.log('Method:', req.method);
    console.log('Content-Type:', req.headers.get('content-type'));

    // 🛡️ 1. CHECK RATE LIMITING FIRST
    const rateLimitCheck = await checkRateLimit(supabase, ipAddress, endpoint);
    
    if (!rateLimitCheck.allowed) {
      await logSecurityEvent(
        supabase,
        ipAddress,
        endpoint,
        'rate_limit_exceeded',
        userAgent,
        { reason: rateLimitCheck.reason }
      );
      
      console.error(`❌ Rate limit exceeded for ${ipAddress}`);
      
      return new Response(
        JSON.stringify({ 
          error: 'Too many requests', 
          message: rateLimitCheck.reason 
        }),
        { 
          status: 429, 
          headers: { 
            ...corsHeaders, 
            'Content-Type': 'application/json',
            'Retry-After': '300' // 5 minutes
          } 
        }
      );
    }

    // 🔒 2. SECURITY CHECK: Validate webhook token (HEADER ONLY)
    const receivedToken = req.headers.get('x-webhook-token');

    if (!receivedToken) {
      await logSecurityEvent(
        supabase,
        ipAddress,
        endpoint,
        'missing_token_header',
        userAgent,
        { message: 'X-Webhook-Token header missing' }
      );
      
      console.error('❌ Missing X-Webhook-Token header');
      
      return new Response(
        JSON.stringify({ 
          error: 'Unauthorized', 
          message: 'X-Webhook-Token header is required' 
        }),
        { 
          status: 401, 
          headers: { ...corsHeaders, 'Content-Type': 'application/json' } 
        }
      );
    }

    // Get expected token from environment
    const expectedToken = Deno.env.get('SENDCLOUD_WEBHOOK_SECRET');
    
    if (!expectedToken) {
      console.error('❌ SENDCLOUD_WEBHOOK_SECRET not configured');
      
      return new Response(
        JSON.stringify({ 
          error: 'Configuration error', 
          message: 'Webhook not properly configured' 
        }),
        { 
          status: 500, 
          headers: { ...corsHeaders, 'Content-Type': 'application/json' } 
        }
      );
    }

    // 🔐 3. CONSTANT-TIME COMPARISON to prevent timing attacks
    if (!constantTimeCompare(receivedToken, expectedToken)) {
      await logSecurityEvent(
        supabase,
        ipAddress,
        endpoint,
        'invalid_token',
        userAgent,
        { message: 'Invalid webhook token provided' }
      );
      
      console.error('❌ Invalid webhook token');
      
      return new Response(
        JSON.stringify({ 
          error: 'Unauthorized', 
          message: 'Invalid webhook token' 
        }),
        { 
          status: 401, 
          headers: { ...corsHeaders, 'Content-Type': 'application/json' } 
        }
      );
    }

    console.log('✅ Token validé - IP:', ipAddress);

    // Lire le body brut d'abord
    const rawBody = await req.text();
    console.log('Raw body length:', rawBody.length);

    // Vérifier si le body est vide
    if (!rawBody || rawBody.trim() === '') {
      console.error('❌ Body vide reçu');
      return new Response(
        JSON.stringify({ 
          success: false, 
          error: 'Body vide - veuillez envoyer des données JSON',
        }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' }, status: 400 }
      );
    }

    // Parser le JSON
    let webhookEvent: SendCloudWebhookEvent | SendCloudOrder;
    try {
      webhookEvent = JSON.parse(rawBody);
    } catch (parseError) {
      console.error('❌ Erreur parsing JSON:', parseError);
      
      // Logger l'erreur de parsing
      await supabase.from('webhook_sendcloud_log').insert({
        payload: { raw: rawBody.substring(0, 1000), error: 'JSON invalide' },
        statut: 'erreur',
        erreur: parseError instanceof Error ? parseError.message : 'Unknown parsing error',
      });
      
      return new Response(
        JSON.stringify({ 
          success: false, 
          error: 'JSON invalide',
          details: parseError instanceof Error ? parseError.message : 'Unknown parsing error',
        }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' }, status: 400 }
      );
    }

    console.log('📦 Webhook data received');
    
    // Detect event type
    const eventType = 'action' in webhookEvent ? webhookEvent.action : 'order_import';
    console.log('📋 Event type:', eventType);

    // Log event to history
    const { data: historyLog } = await supabase
      .from('sendcloud_event_history')
      .insert({
        event_type: eventType,
        direction: 'incoming',
        entity_type: 'action' in webhookEvent ? 'parcel' : 'order',
        success: false, // Will update later
        metadata: webhookEvent,
      })
      .select()
      .single();

    const historyId = historyLog?.id;

    // Route to appropriate handler based on event type
    let result: any;
    const startTime = Date.now();

    try {
      switch (eventType) {
        // === Status & Tracking Events ===
        case 'parcel_status_changed':
        case 'status_changed':
          result = await handleParcelStatusChanged(supabase, webhookEvent as SendCloudWebhookEvent);
          break;

        case 'tracking_updated':
        case 'tracking_number_updated':
          result = await handleTrackingUpdated(supabase, webhookEvent as SendCloudWebhookEvent);
          break;

        case 'label_created':
        case 'label_printed':
          result = await handleLabelCreated(supabase, webhookEvent as SendCloudWebhookEvent);
          break;

        // === Delivery Events ===
        case 'shipment_departed':
        case 'parcel_departed':
          result = await handleGenericStatusUpdate(supabase, webhookEvent as SendCloudWebhookEvent, 'departed');
          break;

        case 'shipment_in_transit':
        case 'parcel_in_transit':
          result = await handleGenericStatusUpdate(supabase, webhookEvent as SendCloudWebhookEvent, 'in_transit');
          break;

        case 'shipment_delivered':
        case 'parcel_delivered':
          result = await handleParcelStatusChanged(supabase, webhookEvent as SendCloudWebhookEvent);
          break;

        case 'shipment_delayed':
        case 'delivery_delayed':
          result = await handleShipmentDelayed(supabase, webhookEvent as SendCloudWebhookEvent);
          break;

        case 'delivery_failed':
        case 'delivery_exception':
          result = await handleDeliveryFailed(supabase, webhookEvent as SendCloudWebhookEvent);
          break;

        // === Return Events ===
        case 'return_initiated':
        case 'return_requested':
          result = await handleReturnInitiated(supabase, webhookEvent as SendCloudWebhookEvent);
          break;

        case 'return_received':
        case 'return_delivered':
          result = await handleGenericStatusUpdate(supabase, webhookEvent as SendCloudWebhookEvent, 'return_received');
          break;

        // === Cancellation Events ===
        case 'cancellation_requested':
        case 'parcel_cancelled':
          result = await handleCancellationRequested(supabase, webhookEvent as SendCloudWebhookEvent);
          break;

        // === Exception Events ===
        case 'shipment_exception':
        case 'customs_delay':
        case 'address_issue':
          result = await handleGenericStatusUpdate(supabase, webhookEvent as SendCloudWebhookEvent, eventType);
          break;

        // === Order Import (Legacy/Default) ===
        case 'order_import':
        case 'order_created':
        default:
          // Handle as order creation (original logic)
          result = await handleOrderImport(supabase, webhookEvent as SendCloudOrder);
          break;
      }

      const processingTime = Date.now() - startTime;

      // Update history with success
      if (historyId) {
        await supabase
          .from('sendcloud_event_history')
          .update({
            success: result.success,
            processing_time_ms: processingTime,
            entity_id: result.commande_id || result.retour_id,
            error_details: result.error || null,
          })
          .eq('id', historyId);
      }

      console.log(`✅ Event processed in ${processingTime}ms:`, eventType);

      return new Response(
        JSON.stringify({
          success: true,
          event_type: eventType,
          result: result,
          processing_time_ms: processingTime,
        }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' }, status: 200 }
      );

    } catch (handlerError) {
      const processingTime = Date.now() - startTime;
      const errorMessage = handlerError instanceof Error ? handlerError.message : 'Unknown handler error';

      // Update history with failure
      if (historyId) {
        await supabase
          .from('sendcloud_event_history')
          .update({
            success: false,
            processing_time_ms: processingTime,
            error_details: errorMessage,
          })
          .eq('id', historyId);
      }

      throw handlerError;
    }
  } catch (error) {
    console.error('❌ Erreur webhook:', error);
    const errorMessage = error instanceof Error ? error.message : 'Unknown error';
    const errorStack = error instanceof Error ? error.stack : undefined;

    return new Response(
      JSON.stringify({ 
        success: false, 
        error: errorMessage,
        stack: errorStack 
      }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' }, status: 500 }
    );
  }
});

// Order import handler (original logic refactored)
async function handleOrderImport(supabase: any, sendcloudData: SendCloudOrder) {
  let logId: string | null = null;

  // Logger la réception du webhook
  const { data: logData } = await supabase
    .from('webhook_sendcloud_log')
    .insert({
      payload: sendcloudData,
      statut: 'recu',
    })
    .select()
    .single();
  
  if (logData) {
    logId = logData.id;
  }

  // Normaliser order_number (accepter order_number ou order_id)
  const orderNumber = sendcloudData.order_number || sendcloudData.order_id || String(sendcloudData.id);
  console.log('📋 Traitement commande:', orderNumber);

  // 1. Vérifier si la commande existe déjà
  let existingCommande = null;
  
  const { data: foundCommande } = await supabase
    .from('commande')
    .select('id, numero_commande, sendcloud_id')
    .or(`sendcloud_id.eq.${sendcloudData.id},numero_commande.eq.${orderNumber}`)
    .maybeSingle();
  
  existingCommande = foundCommande;

  if (existingCommande) {
    console.log('⚠️ Commande déjà existante:', existingCommande.numero_commande);
    
    if (logId) {
      await supabase
        .from('webhook_sendcloud_log')
        .update({
          statut: 'deja_existe',
          commande_id: existingCommande.id,
          traite_a: new Date().toISOString(),
        })
        .eq('id', logId);
    }
    
    return { 
      success: true,
      already_exists: true,
      commande_id: existingCommande.id,
      numero_commande: existingCommande.numero_commande
    };
  }

  // 2. Insérer la commande
  console.log('➕ Création nouvelle commande:', orderNumber);
  const { data: commande, error: commandeError } = await supabase
    .from('commande')
    .insert({
      sendcloud_id: String(sendcloudData.id),
      numero_commande: orderNumber,
      nom_client: sendcloudData.name,
      email_client: sendcloudData.email || null,
      telephone_client: sendcloudData.telephone || null,
      adresse_nom: sendcloudData.name,
      adresse_ligne_1: sendcloudData.address,
      adresse_ligne_2: sendcloudData.address_2 || null,
      code_postal: sendcloudData.postal_code,
      ville: sendcloudData.city,
      pays_code: sendcloudData.country,
      valeur_totale: sendcloudData.total_order_value || 0,
      devise: sendcloudData.currency || 'EUR',
      statut_wms: 'en_attente_reappro',
      source: 'sendcloud',
      transporteur: sendcloudData.shipment?.name || null,
    })
    .select()
    .single();

  if (commandeError) {
    console.error('❌ Erreur insertion commande:', orderNumber, commandeError);
    throw commandeError;
  }

  console.log('✅ Commande créée:', commande.id, '- N°:', commande.numero_commande);

  // 3. Traiter chaque produit et créer les lignes
  const lignesCreees = [];
  const mouvementsCreees = [];
  const produitsManquants = [];
  let peutReserver = true;

  for (const product of sendcloudData.order_products) {
    console.log(`📦 Traitement produit: ${product.sku} x${product.quantity}`);

    const { data: produit, error: produitError } = await supabase
      .from('produit')
      .select('id, reference, nom, stock_actuel, poids_unitaire, prix_unitaire')
      .eq('reference', product.sku)
      .eq('statut_actif', true)
      .single();

    if (produitError || !produit) {
      console.warn(`⚠️ Produit non trouvé: ${product.sku}`);
      produitsManquants.push(product.sku);
      peutReserver = false;
      
      const { data: ligne } = await supabase
        .from('ligne_commande')
        .insert({
          commande_id: commande.id,
          produit_reference: product.sku,
          produit_nom: product.name,
          quantite_commandee: product.quantity,
          quantite_preparee: 0,
          poids_unitaire: product.weight || null,
          prix_unitaire: product.price || null,
          valeur_totale: (product.price || 0) * product.quantity,
          statut_ligne: 'en_attente',
        })
        .select()
        .single();

      if (ligne) lignesCreees.push(ligne);
      continue;
    }

    const { data: stockDispo } = await supabase
      .from('stock_disponible')
      .select('stock_disponible')
      .eq('produit_id', produit.id)
      .single();

    const stockDisponible = stockDispo?.stock_disponible || produit.stock_actuel;

    if (stockDisponible < product.quantity) {
      console.warn(`⚠️ Stock insuffisant pour ${product.sku}`);
      peutReserver = false;
    }

    const { data: ligne, error: ligneError } = await supabase
      .from('ligne_commande')
      .insert({
        commande_id: commande.id,
        produit_id: produit.id,
        produit_reference: product.sku,
        produit_nom: product.name,
        quantite_commandee: product.quantity,
        quantite_preparee: 0,
        poids_unitaire: product.weight || produit.poids_unitaire,
        prix_unitaire: product.price || produit.prix_unitaire,
        valeur_totale: (product.price || produit.prix_unitaire || 0) * product.quantity,
        statut_ligne: 'en_attente',
      })
      .select()
      .single();

    if (ligneError) {
      console.error('❌ Erreur création ligne:', ligneError);
      continue;
    }

    lignesCreees.push(ligne);

    if (stockDisponible >= product.quantity) {
      const { data: reservation, error: reservError } = await supabase.rpc('reserver_stock', {
        p_produit_id: produit.id,
        p_quantite: product.quantity,
        p_commande_id: commande.id,
        p_reference_origine: commande.numero_commande,
      });

      if (reservError) {
        console.error('❌ Erreur réservation stock:', reservError);
      } else if (reservation?.success) {
        console.log(`✅ Stock réservé: ${product.sku} x${product.quantity}`);
        mouvementsCreees.push(reservation.mouvement_id);
        
        await supabase
          .from('ligne_commande')
          .update({ statut_ligne: 'réservé' })
          .eq('id', ligne.id);
      }
    }
  }

  // 4. Mettre à jour le statut de la commande
  let nouveauStatut = 'En attente de réappro';
  if (peutReserver && produitsManquants.length === 0) {
    nouveauStatut = 'Réservé';
  } else if (produitsManquants.length > 0) {
    nouveauStatut = 'En attente de réappro';
  }

  await supabase
    .from('commande')
    .update({ statut_wms: nouveauStatut })
    .eq('id', commande.id);

  console.log('✅ Traitement terminé -', commande.numero_commande, '- Statut:', nouveauStatut);

  if (logId) {
    await supabase
      .from('webhook_sendcloud_log')
      .update({
        statut: 'traite',
        commande_id: commande.id,
        traite_a: new Date().toISOString(),
      })
      .eq('id', logId);
  }

  return {
    success: true,
    commande_id: commande.id,
    numero_commande: commande.numero_commande,
    statut: nouveauStatut,
    lignes_creees: lignesCreees.length,
    mouvements_crees: mouvementsCreees.length,
    produits_manquants: produitsManquants,
  };
}
