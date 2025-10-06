import { serve } from 'https://deno.land/std@0.168.0/http/server.ts';
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const supabase = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? ''
    );

    const publicKey = Deno.env.get('SENDCLOUD_API_PUBLIC_KEY');
    const secretKey = Deno.env.get('SENDCLOUD_API_SECRET_KEY');

    if (!publicKey || !secretKey) {
      throw new Error('SendCloud API keys not configured');
    }

    console.log('[Refresh Tracking] Fetching orders without tracking...');

    // Récupérer toutes les commandes avec sendcloud_id mais sans tracking_number
    const { data: commandes, error: fetchError } = await supabase
      .from('commande')
      .select('id, sendcloud_id, numero_commande')
      .not('sendcloud_id', 'is', null)
      .is('tracking_number', null);

    if (fetchError) throw fetchError;

    console.log(`[Refresh Tracking] Found ${commandes?.length || 0} orders to update`);

    const basicAuth = btoa(`${publicKey}:${secretKey}`);
    let updated = 0;
    let errors = 0;

    // Pour chaque commande, récupérer les infos de parcel
    for (const commande of commandes || []) {
      try {
        console.log(`[Refresh Tracking] Processing order ${commande.numero_commande} (SendCloud ID: ${commande.sendcloud_id})`);

        // Récupérer le parcel via l'API SendCloud v2 Parcels
        const parcelResponse = await fetch(
          `https://panel.sendcloud.sc/api/v2/parcels?external_order_id=${commande.sendcloud_id}`,
          {
            headers: {
              'Authorization': `Basic ${basicAuth}`,
              'Content-Type': 'application/json',
            },
          }
        );

        if (!parcelResponse.ok) {
          console.error(`[Refresh Tracking] Failed to fetch parcel for order ${commande.numero_commande}`);
          errors++;
          continue;
        }

        const parcelData = await parcelResponse.json();
        
        if (!parcelData.parcels || parcelData.parcels.length === 0) {
          console.log(`[Refresh Tracking] No parcel found for order ${commande.numero_commande}`);
          continue;
        }

        const parcel = parcelData.parcels[0];

        // Mapper le statut SendCloud vers statut WMS
        let statutWms = 'En attente de réappro';
        if (parcel.status) {
          const statusId = parcel.status.id;
          if (statusId >= 1000 && statusId < 2000) {
            statutWms = 'En préparation';
          } else if (statusId >= 2000 && statusId < 3000) {
            statutWms = 'En cours de livraison';
          } else if (statusId >= 3000) {
            statutWms = 'Livré';
          }
        }

        // Mettre à jour la commande avec les infos de tracking
        const { error: updateError } = await supabase
          .from('commande')
          .update({
            transporteur: parcel.carrier?.name || null,
            methode_expedition: parcel.shipping_method?.name || null,
            tracking_number: parcel.tracking_number || null,
            tracking_url: parcel.tracking_url || null,
            label_url: parcel.label?.label_printer || null,
            sendcloud_shipment_id: parcel.id?.toString() || null,
            statut_wms: statutWms,
          })
          .eq('id', commande.id);

        if (updateError) {
          console.error(`[Refresh Tracking] Error updating order ${commande.numero_commande}:`, updateError);
          errors++;
        } else {
          console.log(`[Refresh Tracking] Updated order ${commande.numero_commande} with tracking ${parcel.tracking_number}`);
          updated++;
        }
      } catch (err: any) {
        console.error(`[Refresh Tracking] Error processing order ${commande.numero_commande}:`, err.message);
        errors++;
      }
    }

    console.log(`[Refresh Tracking] Complete: ${updated} updated, ${errors} errors`);

    return new Response(
      JSON.stringify({
        success: true,
        updated,
        errors,
        total: commandes?.length || 0,
      }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  } catch (error: any) {
    console.error('[Refresh Tracking] Fatal error:', error);
    return new Response(
      JSON.stringify({ success: false, error: error.message }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' }, status: 500 }
    );
  }
});
