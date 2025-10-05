import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.39.3';

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
    const supabaseKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
    const sendcloudPublicKey = Deno.env.get('SENDCLOUD_API_PUBLIC_KEY')!;
    const sendcloudSecretKey = Deno.env.get('SENDCLOUD_API_SECRET_KEY')!;
    
    const supabase = createClient(supabaseUrl, supabaseKey);

    const { commande_id } = await req.json();

    console.log('📍 Récupération tracking pour commande:', commande_id);

    // 1. Récupérer la commande
    const { data: commande, error: commandeError } = await supabase
      .from('commande')
      .select('sendcloud_shipment_id, numero_commande')
      .eq('id', commande_id)
      .single();

    if (commandeError || !commande) {
      throw new Error(`Commande non trouvée: ${commande_id}`);
    }

    if (!commande.sendcloud_shipment_id) {
      throw new Error('Pas de shipment_id SendCloud pour cette commande');
    }

    // 2. Appeler l'API SendCloud tracking
    const sendcloudAuth = btoa(`${sendcloudPublicKey}:${sendcloudSecretKey}`);
    const trackingResponse = await fetch(
      `https://panel.sendcloud.sc/api/v2/parcels/${commande.sendcloud_shipment_id}`,
      {
        method: 'GET',
        headers: {
          'Authorization': `Basic ${sendcloudAuth}`,
          'Accept': 'application/json',
        },
      }
    );

    const trackingData = await trackingResponse.json();

    if (!trackingResponse.ok) {
      console.error('❌ Erreur SendCloud Tracking API:', trackingData);
      throw new Error(`SendCloud Tracking error: ${JSON.stringify(trackingData)}`);
    }

    console.log('✅ Tracking récupéré:', JSON.stringify(trackingData, null, 2));

    // 3. Mettre à jour notre DB avec les dernières infos
    const parcel = trackingData.parcel;
    const { error: updateError } = await supabase
      .from('commande')
      .update({
        tracking_number: parcel.tracking_number,
        tracking_url: parcel.tracking_url,
        // Mapper les statuts SendCloud vers nos statuts WMS
        statut_wms: mapSendcloudStatus(parcel.status?.id),
      })
      .eq('id', commande_id);

    if (updateError) {
      console.error('❌ Erreur mise à jour tracking:', updateError);
    }

    return new Response(
      JSON.stringify({
        success: true,
        tracking: {
          tracking_number: parcel.tracking_number,
          tracking_url: parcel.tracking_url,
          status: parcel.status,
          carrier: parcel.carrier?.name,
          last_update: parcel.status_updated_at,
        },
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

function mapSendcloudStatus(statusId?: number): string {
  // Mapping des statuts SendCloud vers statuts WMS
  // https://api.sendcloud.dev/docs/sendcloud-public-api/parcels/parcel-statuses
  const statusMap: Record<number, string> = {
    1: 'Étiquette générée',
    2: 'En préparation',
    3: 'En transit',
    11: 'Livré',
    12: 'Annulé',
    13: 'En retour',
  };
  return statusMap[statusId || 1] || 'En préparation';
}
