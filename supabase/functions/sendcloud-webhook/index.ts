import { createClient } from 'npm:@supabase/supabase-js@2';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

// Security utilities
function constantTimeCompare(a: string, b: string): boolean {
  if (a.length !== b.length) return false;
  let result = 0;
  for (let i = 0; i < a.length; i++) {
    result |= a.charCodeAt(i) ^ b.charCodeAt(i);
  }
  return result === 0;
}

async function checkRateLimit(supabase: any, ipAddress: string, endpoint: string): Promise<{ allowed: boolean; reason?: string }> {
  const { data, error } = await supabase
    .from('webhook_rate_limit')
    .select('*')
    .eq('ip_address', ipAddress)
    .eq('endpoint', endpoint)
    .gte('created_at', new Date(Date.now() - 60000).toISOString());

  if (error) {
    console.error('Rate limit check error:', error);
    return { allowed: true };
  }

  if (data && data.length >= 100) {
    return { allowed: false, reason: 'Rate limit exceeded (100 requests per minute)' };
  }

  await supabase.from('webhook_rate_limit').insert({
    ip_address: ipAddress,
    endpoint: endpoint,
    created_at: new Date().toISOString(),
  });

  return { allowed: true };
}

async function logSecurityEvent(supabase: any, ipAddress: string | null, endpoint: string, eventType: string, userAgent: string | null, details: any): Promise<void> {
  await supabase.from('webhook_security_log').insert({
    endpoint,
    event_type: eventType,
    ip_address: ipAddress,
    user_agent: userAgent,
    details,
    created_at: new Date().toISOString(),
  });
}

// Data structures
interface SendCloudProduct {
  sku: string;
  name: string;
  quantity: number;
  weight?: string | number;
  price?: number;
  hs_code?: string;
  origin_country?: string;
}

interface SendCloudOrder {
  id: number | string;
  order_number: string;
  email?: string;
  name?: string;
  phone_number?: string;
  address?: string;
  address_2?: string;
  city?: string;
  postal_code?: string;
  country_code?: string;
  order_items?: SendCloudProduct[];
  total_order_value?: number;
  currency?: string;
  external_reference?: string;
  integration?: number;
}

interface SendCloudWebhookEvent {
  action: string;
  timestamp: number;
  integration?: number;
  parcel?: any;
  order?: SendCloudOrder;
  external_order_id?: string;
  external_reference?: string;
}

interface SendCloudParcel {
  id: number;
  tracking_number?: string;
  tracking_url?: string;
  status?: { id: number; message: string };
  carrier?: { name: string; code: string };
  label?: { label_printer?: string };
  external_order_id?: string;
  external_reference?: string;
}

// Mapping SendCloud → WMS
function mapSendcloudStatusToWMS(statusId: number): string {
  const statusMap: Record<number, string> = {
    1: 'en_preparation',
    2: 'en_preparation',
    3: 'pret_expedition',
    4: 'pret_expedition',
    5: 'expedie',
    6: 'expedie',
    7: 'expedie',
    8: 'expedie',
    11: 'livre',
    12: 'expedie',
    13: 'expedie',
    80: 'erreur',
    91: 'annule',
    93: 'erreur',
    94: 'erreur',
    99: 'annule',
  };
  return statusMap[statusId] || 'expedie';
}

// Enregistrer ou mettre à jour un colis dans la base
async function upsertParcel(supabase: any, parcel: SendCloudParcel): Promise<void> {
  const reference = parcel.external_order_id || parcel.external_reference;
  const { error } = await supabase
    .from('sendcloud_parcels')
    .upsert({
      parcel_id: parcel.id.toString(),
      commande_id: reference ? await getCommandeIdFromReference(supabase, reference) : null,
      tracking_number: parcel.tracking_number,
      tracking_url: parcel.tracking_url,
      carrier_code: parcel.carrier?.code,
      carrier_name: parcel.carrier?.name,
      status_id: parcel.status?.id,
      status_message: parcel.status?.message,
      updated_at: new Date().toISOString()
    }, {
      onConflict: 'parcel_id'
    });

  if (error) {
    console.error('❌ Erreur upsert parcel:', error);
  }
}

// Enregistrer un événement de tracking
async function addTrackingEvent(supabase: any, parcelId: string, status: any, metadata: any = {}): Promise<void> {
  const { error } = await supabase
    .from('sendcloud_tracking_events')
    .insert({
      parcel_id: parcelId,
      event_timestamp: new Date().toISOString(),
      status_id: status.id,
      status_message: status.message,
      location: metadata.location,
      carrier_message: metadata.carrier_message,
      metadata: metadata
    });

  if (error) {
    console.error('❌ Erreur insert tracking event:', error);
  }
}

// Récupérer l'ID de commande depuis une référence
async function getCommandeIdFromReference(supabase: any, reference: string): Promise<string | null> {
  const { data, error } = await supabase
    .from('commande')
    .select('id')
    .eq('id', reference)
    .single();

  if (error || !data) return null;
  return data.id;
}

// Auto-detect client_id from SendCloud data
async function detectClientId(supabase: any, event: SendCloudWebhookEvent, sendcloudData: SendCloudOrder): Promise<string | null> {
  console.log('🔍 Detecting client_id for order:', sendcloudData.order_number);

  // 1. Try by integration_id
  if (event.integration || sendcloudData.integration) {
    const integrationId = event.integration || sendcloudData.integration;
    const { data } = await supabase
      .from('sendcloud_client_mapping')
      .select('client_id')
      .eq('integration_id', integrationId)
      .eq('actif', true)
      .single();
    
    if (data) {
      console.log(`✅ Client found by integration_id ${integrationId}:`, data.client_id);
      return data.client_id;
    }
  }

  // 2. Try by email domain
  const email = sendcloudData.email;
  if (email && email.includes('@')) {
    const domain = email.split('@')[1];
    const { data } = await supabase
      .from('sendcloud_client_mapping')
      .select('client_id')
      .eq('email_domain', domain)
      .eq('actif', true)
      .single();
    
    if (data) {
      console.log(`✅ Client found by email domain ${domain}:`, data.client_id);
      return data.client_id;
    }
  }

  console.warn('⚠️ No client mapping found. Order will be created without client_id.');
  return null;
}

// Apply sender configuration
async function applySenderConfig(supabase: any, commandeId: string, clientId: string | null): Promise<void> {
  if (!clientId) {
    console.log('⚠️ No client_id, skipping sender config application');
    return;
  }

  console.log('📮 Applying sender config for client:', clientId);

  // Get default sender config from mapping
  const { data: mapping } = await supabase
    .from('sendcloud_client_mapping')
    .select('config_expediteur_defaut_id')
    .eq('client_id', clientId)
    .eq('actif', true)
    .single();

  if (mapping?.config_expediteur_defaut_id) {
    const { data: config } = await supabase
      .from('configuration_expediteur')
      .select('*')
      .eq('id', mapping.config_expediteur_defaut_id)
      .single();

    if (config) {
      await supabase.from('commande').update({
        expediteur_nom: config.nom,
        expediteur_entreprise: config.entreprise,
        expediteur_email: config.email,
        expediteur_telephone: config.telephone,
        expediteur_adresse_ligne_1: config.adresse_ligne_1,
        expediteur_adresse_ligne_2: config.adresse_ligne_2,
        expediteur_code_postal: config.code_postal,
        expediteur_ville: config.ville,
        expediteur_pays_code: config.pays_code,
      }).eq('id', commandeId);

      console.log('✅ Default sender config applied');
      return;
    }
  }

  // Fallback: call apply-expediteur-rules edge function
  try {
    const { data: commande } = await supabase
      .from('commande')
      .select('numero_commande, tags')
      .eq('id', commandeId)
      .single();

    const functionUrl = `${Deno.env.get('SUPABASE_URL')}/functions/v1/apply-expediteur-rules`;
    const response = await fetch(functionUrl, {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        commandeId,
        clientId,
        tagsCommande: commande?.tags || [],
      }),
    });

    if (response.ok) {
      console.log('✅ Sender rules applied via edge function');
    }
  } catch (error) {
    console.error('❌ Error applying sender rules:', error);
  }
}

// Apply carrier selection
async function applyCarrierSelection(supabase: any, commandeId: string): Promise<void> {
  console.log('🚚 Applying carrier selection for:', commandeId);

  try {
    const functionUrl = `${Deno.env.get('SUPABASE_URL')}/functions/v1/apply-automatic-carrier-selection`;
    const response = await fetch(functionUrl, {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ commande_id: commandeId }),
    });

    if (response.ok) {
      const result = await response.json();
      console.log('✅ Carrier selected:', result.transporteur_choisi?.nom);
    } else {
      console.warn('⚠️ Carrier selection failed:', await response.text());
    }
  } catch (error) {
    console.error('❌ Error applying carrier selection:', error);
  }
}

// Find or create product
async function findOrCreateProduct(supabase: any, productData: SendCloudProduct, clientId: string | null): Promise<string | null> {
  console.log('🔍 Finding/creating product:', productData.sku);

  // Try to find by SKU
  let { data: produit } = await supabase
    .from('produit')
    .select('id')
    .eq('reference', productData.sku)
    .maybeSingle();

  if (produit) {
    console.log('✅ Product found:', produit.id);
    return produit.id;
  }

  // Create minimal product
  console.log('➕ Creating minimal product for SKU:', productData.sku);
  
  const weight = typeof productData.weight === 'string' 
    ? parseFloat(productData.weight) 
    : (productData.weight || 0.5);

  const { data: newProduit, error } = await supabase
    .from('produit')
    .insert({
      reference: productData.sku,
      nom: productData.name || productData.sku,
      poids_unitaire: weight,
      prix_unitaire: productData.price || 0,
      client_id: clientId,
      code_ean: productData.sku,
      actif: true,
      stock_actuel: 0,
      source: 'sendcloud_webhook',
    })
    .select('id')
    .single();

  if (error) {
    console.error('❌ Error creating product:', error);
    return null;
  }

  console.log('✅ Product created:', newProduit.id);
  return newProduit.id;
}

// Event handlers
async function handleOrderImport(supabase: any, event: SendCloudWebhookEvent, sendcloudData: SendCloudOrder): Promise<void> {
  console.log('📦 Import order:', sendcloudData.order_number);

  // Check if order already exists
  const { data: existing } = await supabase
    .from('commande')
    .select('id')
    .or(`numero_commande.eq.${sendcloudData.order_number},sendcloud_id.eq.${sendcloudData.id}`)
    .maybeSingle();

  if (existing) {
    console.log('⚠️ Order already exists:', existing.id);
    return;
  }

  // Detect client_id
  const clientId = await detectClientId(supabase, event, sendcloudData);

  // Calculate total weight
  const products = sendcloudData.order_items || [];
  const poidsTotal = products.reduce((sum, p) => {
    const weight = typeof p.weight === 'string' ? parseFloat(p.weight) : (p.weight || 0.5);
    return sum + (weight * p.quantity);
  }, 0);

  // Insert order
  const { data: commande, error: insertError } = await supabase
    .from('commande')
    .insert({
      numero_commande: sendcloudData.order_number,
      sendcloud_id: String(sendcloudData.id),
      sendcloud_reference: sendcloudData.external_reference || String(sendcloudData.id),
      client_id: clientId,
      nom_client: sendcloudData.name || 'Client SendCloud',
      email_client: sendcloudData.email,
      telephone_client: sendcloudData.phone_number,
      adresse_nom: sendcloudData.name || 'Client',
      adresse_ligne_1: sendcloudData.address || 'N/A',
      adresse_ligne_2: sendcloudData.address_2,
      code_postal: sendcloudData.postal_code || '00000',
      ville: sendcloudData.city || 'N/A',
      pays_code: sendcloudData.country_code || 'FR',
      valeur_totale: sendcloudData.total_order_value || 0,
      devise: sendcloudData.currency || 'EUR',
      poids_total: poidsTotal,
      poids_reel_kg: poidsTotal,
      statut_wms: 'stock_reserve',
      source: 'sendcloud',
      date_creation: new Date().toISOString(),
    })
    .select('id')
    .single();

  if (insertError) {
    console.error('❌ Error creating order:', insertError);
    throw insertError;
  }

  console.log('✅ Order created:', commande.id);

  // Create product lines
  for (const productData of products) {
    const produitId = await findOrCreateProduct(supabase, productData, clientId);
    
    if (produitId) {
      const weight = typeof productData.weight === 'string' ? parseFloat(productData.weight) : (productData.weight || 0.5);
      
      await supabase.from('ligne_commande').insert({
        commande_id: commande.id,
        produit_id: produitId,
        produit_reference: productData.sku,
        produit_nom: productData.name || productData.sku,
        quantite_commandee: productData.quantity,
        poids_unitaire: weight,
        prix_unitaire: productData.price || 0,
        valeur_totale: (productData.price || 0) * productData.quantity,
      });
    }
  }

  // Apply sender config
  await applySenderConfig(supabase, commande.id, clientId);

  // Apply carrier selection
  await applyCarrierSelection(supabase, commande.id);

  console.log('✅ Order fully processed:', commande.id);
}

async function handleParcelStatusChanged(supabase: any, parcel: SendCloudParcel): Promise<void> {
  console.log('📊 Status changed:', parcel.tracking_number);

  // Enregistrer/mettre à jour le colis
  await upsertParcel(supabase, parcel);

  // Enregistrer l'événement de tracking
  await addTrackingEvent(supabase, parcel.id.toString(), parcel.status || { id: 5, message: 'En transit' }, {
    carrier: parcel.carrier?.name,
    tracking_number: parcel.tracking_number
  });

  const { data: commande } = await supabase
    .from('commande')
    .select('id')
    .or(`sendcloud_shipment_id.eq.${parcel.id},sendcloud_id.eq.${parcel.external_order_id},sendcloud_reference.eq.${parcel.external_reference},tracking_number.eq.${parcel.tracking_number}`)
    .maybeSingle();

  if (!commande) {
    console.warn('⚠️ Order not found for parcel:', parcel.id);
    return;
  }

  const newStatus = mapSendcloudStatusToWMS(parcel.status?.id || 5);

  await supabase.from('commande').update({
    statut_wms: newStatus,
    tracking_number: parcel.tracking_number,
    tracking_url: parcel.tracking_url,
    transporteur: parcel.carrier?.name,
    date_modification: new Date().toISOString(),
  }).eq('id', commande.id);

  console.log(`✅ Status updated to ${newStatus}`);
}

async function handleLabelCreated(supabase: any, parcel: SendCloudParcel): Promise<void> {
  console.log('🏷️ Label created:', parcel.tracking_number);

  // Enregistrer/mettre à jour le colis
  await upsertParcel(supabase, parcel);

  // Enregistrer l'événement
  await addTrackingEvent(supabase, parcel.id.toString(), {
    id: 2,
    message: 'Étiquette générée'
  }, {
    label_url: parcel.label?.label_printer
  });

  const { data: commande } = await supabase
    .from('commande')
    .select('id')
    .or(`sendcloud_shipment_id.eq.${parcel.id},sendcloud_id.eq.${parcel.external_order_id},sendcloud_reference.eq.${parcel.external_reference}`)
    .maybeSingle();

  if (!commande) {
    console.warn('⚠️ Order not found for label:', parcel.id);
    return;
  }

  await supabase.from('commande').update({
    label_url: parcel.label?.label_printer,
    tracking_number: parcel.tracking_number,
    tracking_url: parcel.tracking_url,
    statut_wms: 'etiquette_generee',
    date_modification: new Date().toISOString(),
  }).eq('id', commande.id);

  console.log('✅ Label attached to order');
}

// ============================================================
// NEW HANDLERS: Returns, Delivery, Errors, Label Download
// ============================================================

async function handleReturnEvent(supabase: any, event: SendCloudWebhookEvent): Promise<void> {
  console.log('🔄 Return event:', event.action);

  const parcel = event.parcel;
  if (!parcel) return;

  // Trouver la commande associée
  const { data: commande } = await supabase
    .from('commande')
    .select('id, numero_commande, client_id')
    .or(`sendcloud_shipment_id.eq.${parcel.id},tracking_number.eq.${parcel.tracking_number}`)
    .maybeSingle();

  if (!commande) {
    console.warn('⚠️ Order not found for return:', parcel.id);
    return;
  }

  // Vérifier si le retour existe déjà
  const { data: existingReturn } = await supabase
    .from('retour_produit')
    .select('id')
    .eq('sendcloud_parcel_id', parcel.id.toString())
    .maybeSingle();

  if (!existingReturn) {
    // Créer un nouveau retour
    const { data: newReturn, error } = await supabase
      .from('retour_produit')
      .insert({
        commande_id: commande.id,
        client_id: commande.client_id,
        numero_retour: `RET-${parcel.id}`,
        sendcloud_parcel_id: parcel.id.toString(),
        tracking_number: parcel.tracking_number,
        tracking_url: parcel.tracking_url,
        statut: 'cree',
        raison_retour: 'Retour client',
        date_creation: new Date().toISOString(),
        source: 'sendcloud_webhook'
      })
      .select('id')
      .single();

    if (error) {
      console.error('❌ Error creating return:', error);
      return;
    }

    console.log('✅ Return created:', newReturn.id);

    // Créer les lignes de retour
    const { data: lignesCommande } = await supabase
      .from('ligne_commande')
      .select('*')
      .eq('commande_id', commande.id);

    if (lignesCommande) {
      for (const ligne of lignesCommande) {
        await supabase.from('ligne_retour').insert({
          retour_id: newReturn.id,
          produit_id: ligne.produit_id,
          produit_reference: ligne.produit_reference,
          produit_nom: ligne.produit_nom,
          quantite_retournee: ligne.quantite_commandee,
          raison: 'Retour client'
        });
      }
    }
  }

  // Mettre à jour le statut de la commande
  await supabase
    .from('commande')
    .update({ statut_wms: 'retour' })
    .eq('id', commande.id);

  console.log('✅ Return processed for order:', commande.numero_commande);
}

async function handleParcelDelivered(supabase: any, parcel: SendCloudParcel): Promise<void> {
  console.log('📦 Parcel delivered:', parcel.tracking_number);

  await upsertParcel(supabase, parcel);

  await addTrackingEvent(supabase, parcel.id.toString(), {
    id: 11,
    message: 'Livré'
  }, {
    tracking_number: parcel.tracking_number
  });

  const { data: commande } = await supabase
    .from('commande')
    .select('id')
    .or(`sendcloud_shipment_id.eq.${parcel.id},tracking_number.eq.${parcel.tracking_number}`)
    .maybeSingle();

  if (!commande) {
    console.warn('⚠️ Order not found for delivered parcel:', parcel.id);
    return;
  }

  await supabase.from('commande').update({
    statut_wms: 'livre',
    date_livraison: new Date().toISOString(),
    date_modification: new Date().toISOString(),
  }).eq('id', commande.id);

  console.log('✅ Order marked as delivered');
}

async function handleParcelError(supabase: any, parcel: SendCloudParcel, action: string): Promise<void> {
  console.log('⚠️ Parcel error/exception:', parcel.tracking_number);

  await upsertParcel(supabase, parcel);

  await addTrackingEvent(supabase, parcel.id.toString(), {
    id: 80,
    message: action === 'parcel_exception' ? 'Exception' : 'Erreur'
  }, {
    tracking_number: parcel.tracking_number,
    error_type: action
  });

  const { data: commande } = await supabase
    .from('commande')
    .select('id')
    .or(`sendcloud_shipment_id.eq.${parcel.id},tracking_number.eq.${parcel.tracking_number}`)
    .maybeSingle();

  if (!commande) {
    console.warn('⚠️ Order not found for error parcel:', parcel.id);
    return;
  }

  await supabase.from('commande').update({
    statut_wms: 'erreur',
    date_modification: new Date().toISOString(),
  }).eq('id', commande.id);

  // Créer une alerte
  await supabase.from('system_alerts').insert({
    alert_type: 'parcel_error',
    severity: action === 'parcel_exception' ? 'warning' : 'critical',
    message: `Erreur de livraison pour colis ${parcel.tracking_number}`,
    metadata: {
      parcel_id: parcel.id,
      tracking_number: parcel.tracking_number,
      action: action
    },
    created_at: new Date().toISOString()
  });

  console.log('✅ Parcel error logged and alerted');
}

async function downloadLabelAutomatically(supabase: any, parcel: SendCloudParcel): Promise<void> {
  console.log('📥 Auto-downloading label for parcel:', parcel.id);

  if (!parcel.label?.label_printer) {
    console.warn('⚠️ No label URL found for parcel:', parcel.id);
    return;
  }

  try {
    // Appeler la fonction sendcloud-fetch-documents
    const functionUrl = `${Deno.env.get('SUPABASE_URL')}/functions/v1/sendcloud-fetch-documents`;
    const response = await fetch(functionUrl, {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        parcel_id: parcel.id,
        document_type: 'label',
        auto_download: true
      }),
    });

    if (response.ok) {
      const result = await response.json();
      console.log('✅ Label downloaded:', result.file_path || result.url);

      // Mettre à jour la commande avec le lien du label téléchargé
      const { data: commande } = await supabase
        .from('commande')
        .select('id')
        .or(`sendcloud_shipment_id.eq.${parcel.id},tracking_number.eq.${parcel.tracking_number}`)
        .maybeSingle();

      if (commande) {
        await supabase
          .from('commande')
          .update({
            label_file_path: result.file_path,
            label_downloaded_at: new Date().toISOString()
          })
          .eq('id', commande.id);
      }
    } else {
      console.warn('⚠️ Label download failed:', await response.text());
    }
  } catch (error) {
    console.error('❌ Error downloading label:', error);
  }
}

// Main handler
Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  const startTime = Date.now();
  const ipAddress = req.headers.get('x-forwarded-for')?.split(',')[0] || req.headers.get('x-real-ip') || 'unknown';
  const userAgent = req.headers.get('user-agent');

  try {
    const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
    const supabaseKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
    const webhookSecret = Deno.env.get('SENDCLOUD_WEBHOOK_SECRET');
    
    const supabase = createClient(supabaseUrl, supabaseKey);

    // Rate limiting
    const rateLimitResult = await checkRateLimit(supabase, ipAddress, '/sendcloud-webhook');
    if (!rateLimitResult.allowed) {
      await logSecurityEvent(supabase, ipAddress, '/sendcloud-webhook', 'rate_limit_exceeded', userAgent, { reason: rateLimitResult.reason });
      return new Response(JSON.stringify({ error: 'Rate limit exceeded' }), {
        status: 429,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    // Token validation - REQUIRED (no default fallback for security)
    if (!webhookSecret) {
      await logSecurityEvent(supabase, ipAddress, '/sendcloud-webhook', 'secret_not_configured', userAgent, {});
      return new Response(JSON.stringify({ error: 'Webhook secret not configured' }), {
        status: 500,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    // Only accept token from secure header (not query parameters)
    const receivedToken = req.headers.get('x-webhook-token');
    if (!receivedToken || !constantTimeCompare(receivedToken, webhookSecret)) {
      await logSecurityEvent(supabase, ipAddress, '/sendcloud-webhook', 'invalid_token', userAgent, { received: receivedToken ? 'present' : 'missing' });
      return new Response(JSON.stringify({ error: 'Unauthorized' }), {
        status: 401,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    // Parse event
    const event: SendCloudWebhookEvent = await req.json();
    console.log('🔔 Webhook received:', event.action);

    // Log event
    await supabase.from('sendcloud_event_history').insert({
      event_type: event.action,
      direction: 'incoming',
      entity_type: event.parcel ? 'parcel' : 'order',
      entity_id: event.parcel?.id || event.order?.id || null,
      success: true,
      processing_time_ms: 0,
      metadata: event,
    });

    // Route event
    switch (event.action) {
      case 'order_import':
      case 'order_created':
        if (event.order) {
          await handleOrderImport(supabase, event, event.order);
        }
        break;

      case 'parcel_status_changed':
      case 'tracking_updated':
        if (event.parcel) {
          await handleParcelStatusChanged(supabase, event.parcel);
        }
        break;

      case 'label_created':
        if (event.parcel) {
          await handleLabelCreated(supabase, event.parcel);
          // ✅ Télécharger automatiquement l'étiquette
          await downloadLabelAutomatically(supabase, event.parcel);
        }
        break;

      case 'return_created':
      case 'return_status_changed':
        if (event.parcel) {
          await handleReturnEvent(supabase, event);
        }
        break;

      case 'parcel_delivered':
        if (event.parcel) {
          await handleParcelDelivered(supabase, event.parcel);
        }
        break;

      case 'parcel_exception':
      case 'parcel_error':
        if (event.parcel) {
          await handleParcelError(supabase, event.parcel, event.action);
        }
        break;

      default:
        console.log('ℹ️ Unhandled event:', event.action);
        // Logger pour analyse future (fire and forget, no await)
        void supabase.from('sendcloud_unhandled_events').insert({
          action: event.action,
          payload: event,
          created_at: new Date().toISOString()
        });
    }

    const processingTime = Date.now() - startTime;
    console.log(`✅ Webhook processed in ${processingTime}ms`);

    return new Response(
      JSON.stringify({ success: true, processing_time_ms: processingTime }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' }, status: 200 }
    );

  } catch (error) {
    console.error('❌ Webhook error:', error);
    
    return new Response(
      JSON.stringify({ error: error instanceof Error ? error.message : 'Unknown error' }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' }, status: 500 }
    );
  }
});