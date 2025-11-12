import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.39.3';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

interface SendCloudParcelRequest {
  commande_id: string;
  shipping_method?: string;
  with_insurance?: boolean;
  insurance_amount?: number;
  with_signature?: boolean;
  relay_point_id?: string;
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
    const supabaseKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
    const sendcloudPublicKey = Deno.env.get('SENDCLOUD_API_PUBLIC_KEY')!;
    const sendcloudSecretKey = Deno.env.get('SENDCLOUD_API_SECRET_KEY')!;
    
    const supabase = createClient(supabaseUrl, supabaseKey);

    const { 
      commande_id, 
      shipping_method,
      with_insurance = false,
      insurance_amount = 0,
      with_signature = false,
      relay_point_id 
    } = await req.json() as SendCloudParcelRequest;

    console.log('📦 Création parcel SendCloud pour commande:', commande_id);

    // 1. Récupérer la commande et ses lignes
    const { data: commande, error: commandeError } = await supabase
      .from('commande')
      .select(`
        *,
        ligne_commande (
          produit_reference,
          produit_nom,
          quantite_commandee,
          poids_unitaire,
          prix_unitaire,
          valeur_totale
        )
      `)
      .eq('id', commande_id)
      .single();

    if (commandeError || !commande) {
      throw new Error(`Commande non trouvée: ${commande_id}`);
    }

    // 2. Vérifier si pas déjà envoyé à SendCloud
    if (commande.sendcloud_shipment_id) {
      console.log('⚠️ Parcel déjà créé:', commande.sendcloud_shipment_id);
      return new Response(
        JSON.stringify({
          success: false,
          error: 'Parcel déjà créé dans SendCloud',
          sendcloud_shipment_id: commande.sendcloud_shipment_id,
        }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' }, status: 400 }
      );
    }

    // 3. Construire le payload SendCloud API v3 Orders
    const sendcloudPayload: any = {
      order_number: commande.numero_commande,
      order_date: commande.date_creation,
      shipping_address: {
        name: commande.adresse_nom,
        email: commande.email_client || 'noreply@speedelog.com',
        phone_number: commande.telephone_client || '',
        address_line_1: commande.adresse_ligne_1,
        address_line_2: commande.adresse_ligne_2 || '',
        city: commande.ville,
        postal_code: commande.code_postal,
        country_code: commande.pays_code,
      },
      billing_address: commande.facturation_nom ? {
        name: commande.facturation_nom,
        address_line_1: commande.facturation_ligne_1,
        address_line_2: commande.facturation_ligne_2 || '',
        city: commande.facturation_ville,
        postal_code: commande.facturation_code_postal,
        country_code: commande.facturation_pays_code,
      } : undefined,
      order_items: (commande.ligne_commande || []).map((ligne: any) => ({
        sku: ligne.produit_reference,
        name: ligne.produit_nom,
        quantity: ligne.quantite_commandee,
        weight: ligne.poids_unitaire ? `${ligne.poids_unitaire}` : '0.5',
        price: ligne.prix_unitaire || 0,
      })),
      payment_details: {
        total_price: {
          value: commande.valeur_totale,
          currency: commande.devise || 'EUR',
        },
      },
      shipping_option_code: shipping_method || commande.transporteur_choisi || 'STANDARD',
      external_reference: commande.id,
    };

    // Add insurance if requested
    if (with_insurance && insurance_amount > 0) {
      sendcloudPayload.insured_value = {
        value: insurance_amount,
        currency: commande.devise || 'EUR',
      };
    }

    // Add signature requirement
    if (with_signature) {
      sendcloudPayload.require_signature = true;
    }

    // Add relay point if specified
    if (relay_point_id) {
      sendcloudPayload.to_service_point = relay_point_id;
    }

    console.log('📤 Envoi vers SendCloud API:', JSON.stringify(sendcloudPayload, null, 2));

    // 4. Appeler l'API SendCloud v3
    const sendcloudAuth = btoa(`${sendcloudPublicKey}:${sendcloudSecretKey}`);
    const sendcloudResponse = await fetch('https://panel.sendcloud.sc/api/v3/orders', {
      method: 'POST',
      headers: {
        'Authorization': `Basic ${sendcloudAuth}`,
        'Content-Type': 'application/json',
        'Accept': 'application/json',
      },
      body: JSON.stringify(sendcloudPayload),
    });

    const sendcloudData = await sendcloudResponse.json();

    if (!sendcloudResponse.ok) {
      console.error('❌ Erreur SendCloud API:', sendcloudData);
      throw new Error(`SendCloud API error: ${JSON.stringify(sendcloudData)}`);
    }

    console.log('✅ Réponse SendCloud:', JSON.stringify(sendcloudData, null, 2));

    // 5. Mettre à jour la commande avec les données SendCloud
    const { error: updateError } = await supabase
      .from('commande')
      .update({
        sendcloud_id: String(sendcloudData.id),
        sendcloud_reference: commande.id, // ✅ CRITIQUE: Garantir mapping tracking correct
        sendcloud_shipment_id: sendcloudData.shipment_id || String(sendcloudData.id),
        tracking_number: sendcloudData.tracking_number || null,
        tracking_url: sendcloudData.tracking_url || null,
        label_url: sendcloudData.label?.label_printer || null,
        transporteur_choisi: sendcloudData.carrier?.name || commande.transporteur,
        statut_wms: 'Étiquette générée',
      })
      .eq('id', commande_id);

    if (updateError) {
      console.error('❌ Erreur mise à jour commande:', updateError);
      throw updateError;
    }

    console.log(`✅ Tracking créé: Commande ${commande.numero_commande} (${commande.id}) → SendCloud ID ${sendcloudData.id} → Tracking ${sendcloudData.tracking_number}`);

    return new Response(
      JSON.stringify({
        success: true,
        commande_id,
        sendcloud_id: sendcloudData.id,
        tracking_number: sendcloudData.tracking_number,
        label_url: sendcloudData.label?.label_printer,
      }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' }, status: 200 }
    );

  } catch (error) {
    console.error('❌ Erreur:', error);
    return new Response(
      JSON.stringify({
        success: false,
        error: error instanceof Error ? error.message : 'Unknown error',
      }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' }, status: 500 }
    );
  }
});
