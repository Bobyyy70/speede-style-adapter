import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.39.3';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

interface SendCloudReturnRequest {
  commande_id: string;
  retour_id?: string;
  raison?: string;
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

    const { commande_id, retour_id, raison } = await req.json() as SendCloudReturnRequest;

    console.log('🔄 Création retour SendCloud pour commande:', commande_id);

    // 1. Récupérer la commande
    const { data: commande, error: commandeError } = await supabase
      .from('commande')
      .select('*')
      .eq('id', commande_id)
      .single();

    if (commandeError || !commande) {
      throw new Error(`Commande non trouvée: ${commande_id}`);
    }

    // 2. Vérifier si la commande a un sendcloud_shipment_id
    if (!commande.sendcloud_shipment_id) {
      throw new Error('La commande n\'a pas été envoyée via SendCloud');
    }

    // 3. Créer le retour dans SendCloud via API v2/returns
    const returnPayload = {
      parcel: {
        id: parseInt(commande.sendcloud_shipment_id),
      },
      reason: raison || 'Retour client',
      // Par défaut: Mondial Relay
      outgoing_parcel: {
        name: commande.adresse_nom,
        email: commande.email_client || 'noreply@speedelog.com',
        telephone: commande.telephone_client || '',
        address: commande.adresse_ligne_1,
        address_2: commande.adresse_ligne_2 || '',
        city: commande.ville,
        postal_code: commande.code_postal,
        country: commande.pays_code,
        shipment: {
          name: 'Mondial Relay', // Transporteur par défaut
        },
      },
    };

    console.log('📤 Payload retour SendCloud:', JSON.stringify(returnPayload, null, 2));

    const sendcloudAuth = btoa(`${sendcloudPublicKey}:${sendcloudSecretKey}`);
    const sendcloudResponse = await fetch('https://panel.sendcloud.sc/api/v2/returns', {
      method: 'POST',
      headers: {
        'Authorization': `Basic ${sendcloudAuth}`,
        'Content-Type': 'application/json',
        'Accept': 'application/json',
      },
      body: JSON.stringify(returnPayload),
    });

    const sendcloudData = await sendcloudResponse.json();

    if (!sendcloudResponse.ok) {
      console.error('❌ Erreur SendCloud Returns API:', sendcloudData);
      throw new Error(`SendCloud Returns API error: ${JSON.stringify(sendcloudData)}`);
    }

    console.log('✅ Retour créé dans SendCloud:', JSON.stringify(sendcloudData, null, 2));

    // 4. Mettre à jour le statut de la commande
    const { error: updateCommandeError } = await supabase
      .from('commande')
      .update({
        statut_wms: 'Retour en cours',
      })
      .eq('id', commande_id);

    if (updateCommandeError) {
      console.error('⚠️ Erreur mise à jour statut commande:', updateCommandeError);
    } else {
      console.log('✅ Statut commande mis à jour: Retour en cours');
    }

    // 5. Créer ou mettre à jour le retour dans notre DB
    let retourDbId = retour_id;
    if (retour_id) {
      // Mettre à jour le retour existant
      const { error: updateError } = await supabase
        .from('retour_produit')
        .update({
          statut_retour: 'etiquette_generee',
          remarques: `Étiquette Mondial Relay générée via SendCloud. Tracking: ${sendcloudData.return?.tracking_number || 'N/A'}`,
        })
        .eq('id', retour_id);

      if (updateError) {
        console.error('❌ Erreur mise à jour retour:', updateError);
      }
    } else {
      // Créer un nouveau retour
      const { data: newRetour, error: retourError } = await supabase
        .from('retour_produit')
        .insert({
          numero_retour: `RET-${commande.numero_commande}`,
          client_id: commande.client_id,
          client_nom: commande.nom_client,
          commande_origine_id: commande_id,
          raison_retour: raison || 'Retour client via SendCloud',
          statut_retour: 'etiquette_generee',
          remarques: `Étiquette Mondial Relay générée. Tracking: ${sendcloudData.return?.tracking_number || 'N/A'}`,
        })
        .select()
        .single();

      if (retourError) {
        console.error('❌ Erreur création retour:', retourError);
      } else {
        retourDbId = newRetour?.id;
      }
    }

    return new Response(
      JSON.stringify({
        success: true,
        retour_id: retourDbId,
        sendcloud_return_id: sendcloudData.return?.id,
        tracking_number: sendcloudData.return?.tracking_number,
        label_url: sendcloudData.return?.label_url,
        carrier: 'Mondial Relay',
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
