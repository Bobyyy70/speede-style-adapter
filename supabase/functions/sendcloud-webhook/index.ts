import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.39.3';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

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

  let logId: string | null = null;
  
  try {
    const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
    const supabaseKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
    const supabase = createClient(supabaseUrl, supabaseKey);

    console.log('📦 Webhook SendCloud reçu');
    console.log('Method:', req.method);
    console.log('Content-Type:', req.headers.get('content-type'));

    // 🔒 Vérifier le token de sécurité
    const authHeader = req.headers.get('x-webhook-token');
    const url = new URL(req.url);
    const queryToken = url.searchParams.get('token');
    const receivedToken = authHeader || queryToken;
    
    const expectedToken = Deno.env.get('SENDCLOUD_WEBHOOK_SECRET') || 'default-webhook-secret-change-me';
    
    if (receivedToken !== expectedToken) {
      console.error('❌ Token invalide ou manquant');
      return new Response(
        JSON.stringify({ 
          success: false, 
          error: 'Token de sécurité invalide ou manquant',
          hint: 'Ajoutez le header X-Webhook-Token ou le query param ?token=...'
        }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' }, status: 401 }
      );
    }

    console.log('✅ Token validé');

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
        statut_wms: 'En attente de réappro',
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
