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
    console.log('Raw body:', rawBody);
    console.log('Body length:', rawBody.length);

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
    let sendcloudData: SendCloudOrder;
    try {
      sendcloudData = JSON.parse(rawBody);
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
          receivedBody: rawBody.substring(0, 500)
        }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' }, status: 400 }
      );
    }

    console.log('Données SendCloud parsées:', JSON.stringify(sendcloudData, null, 2));

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
    // CRITIQUE: Chercher d'abord par external_reference si présent (c'est notre ID interne)
    let existingCommande = null;
    
    // On ne peut pas utiliser external_reference dans ce webhook car SendCloud ne le renvoie pas
    // On cherche donc par sendcloud_id ou numero_commande
    const { data: foundCommande } = await supabase
      .from('commande')
      .select('id, numero_commande, sendcloud_id')
      .or(`sendcloud_id.eq.${sendcloudData.id},numero_commande.eq.${orderNumber}`)
      .maybeSingle();
    
    existingCommande = foundCommande;

    if (existingCommande) {
      console.log('⚠️ Commande déjà existante:', existingCommande.numero_commande);
      
      // Mettre à jour le log
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
      
      return new Response(
        JSON.stringify({ 
          success: true,
          already_exists: true,
          message: 'Commande déjà traitée',
          commande_id: existingCommande.id,
          numero_commande: existingCommande.numero_commande
        }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' }, status: 200 }
      );
    }

    // 2. Insérer la commande
    console.log('➕ Création nouvelle commande:', orderNumber);
    const { data: commande, error: commandeError } = await supabase
      .from('commande')
      .insert({
        sendcloud_id: String(sendcloudData.id),
        // sendcloud_reference sera mis à jour plus tard si on a external_reference
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

      // Chercher le produit par référence
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
        
        // Créer quand même la ligne avec produit_id null
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

      // Vérifier le stock disponible
      const { data: stockDispo } = await supabase
        .from('stock_disponible')
        .select('stock_disponible')
        .eq('produit_id', produit.id)
        .single();

      const stockDisponible = stockDispo?.stock_disponible || produit.stock_actuel;

      if (stockDisponible < product.quantity) {
        console.warn(`⚠️ Stock insuffisant pour ${product.sku}: dispo=${stockDisponible}, demandé=${product.quantity}`);
        peutReserver = false;
      }

      // Créer la ligne de commande
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
          statut_ligne: stockDisponible >= product.quantity ? 'en_attente' : 'en_attente',
        })
        .select()
        .single();

      if (ligneError) {
        console.error('❌ Erreur création ligne:', ligneError);
        continue;
      }

      lignesCreees.push(ligne);

      // Si stock suffisant, créer la réservation
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
          
          // Mettre à jour le statut de la ligne
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

    // Mettre à jour le log comme traité
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

    return new Response(
      JSON.stringify({
        success: true,
        commande_id: commande.id,
        numero_commande: commande.numero_commande,
        statut: nouveauStatut,
        lignes_creees: lignesCreees.length,
        mouvements_crees: mouvementsCreees.length,
        produits_manquants: produitsManquants,
        details: {
          peut_reserver: peutReserver,
          lignes: lignesCreees,
        }
      }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' }, status: 200 }
    );

  } catch (error) {
    console.error('❌ Erreur webhook:', error);
    const errorMessage = error instanceof Error ? error.message : 'Unknown error';
    const errorStack = error instanceof Error ? error.stack : undefined;
    
    // Logger l'erreur
    if (logId) {
      const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
      const supabaseKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
      const supabase = createClient(supabaseUrl, supabaseKey);
      
      await supabase
        .from('webhook_sendcloud_log')
        .update({
          statut: 'erreur',
          erreur: `${errorMessage}\n\n${errorStack || ''}`,
        })
        .eq('id', logId);
    }
    
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
