import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.38.4';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  const startTime = Date.now();

  try {
    const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
    const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
    const sendcloudPublicKey = Deno.env.get('SENDCLOUD_API_PUBLIC_KEY')!;
    const sendcloudSecretKey = Deno.env.get('SENDCLOUD_API_SECRET_KEY')!;

    const supabase = createClient(supabaseUrl, supabaseServiceKey);

    console.log('[Update Shipped] Checking for shipped orders...');

    // Récupérer toutes les commandes non expédiées avec sendcloud_id
    const { data: commandes, error: fetchError } = await supabase
      .from('commande')
      .select('id, sendcloud_id, numero_commande, statut_wms')
      .not('sendcloud_id', 'is', null)
      .in('statut_wms', ['En attente de réappro', 'Prêt à préparer', 'En préparation'])
      .limit(100);

    if (fetchError) throw fetchError;
    if (!commandes || commandes.length === 0) {
      console.log('[Update Shipped] No orders to check');
      return new Response(
        JSON.stringify({ success: true, updated: 0, message: 'No orders to check' }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    console.log(`[Update Shipped] Checking ${commandes.length} orders...`);

    const authHeader = 'Basic ' + btoa(`${sendcloudPublicKey}:${sendcloudSecretKey}`);
    let updatedCount = 0;

    for (const commande of commandes) {
      try {
        // Récupérer le parcel depuis SendCloud
        const parcelResponse = await fetch(
          `https://panel.sendcloud.sc/api/v2/parcels?external_order_id=${commande.sendcloud_id}`,
          {
            headers: {
              'Authorization': authHeader,
              'Content-Type': 'application/json',
            },
          }
        );

        if (!parcelResponse.ok) continue;

        const parcelData = await parcelResponse.json();
        if (!parcelData.parcels || parcelData.parcels.length === 0) continue;

        const parcel = parcelData.parcels[0];
        const statusId = parcel.status?.id || 0;

        // Déterminer le nouveau statut WMS
        let nouveauStatut = commande.statut_wms;
        if (statusId >= 3000) {
          nouveauStatut = 'Livré';
        } else if (statusId >= 2000) {
          nouveauStatut = 'Expédié';
        } else if (statusId >= 1000) {
          nouveauStatut = 'En préparation';
        }

        // Mettre à jour si le statut a changé
        if (nouveauStatut !== commande.statut_wms) {
          await supabase
            .from('commande')
            .update({
              statut_wms: nouveauStatut,
              transporteur: parcel.carrier?.name || null,
              tracking_number: parcel.tracking_number || null,
              tracking_url: parcel.tracking_url || null,
            })
            .eq('id', commande.id);

          console.log(`[Update Shipped] ${commande.numero_commande}: ${commande.statut_wms} → ${nouveauStatut}`);
          updatedCount++;
        }
      } catch (error) {
        console.error(`[Update Shipped] Error for ${commande.numero_commande}:`, error);
      }
    }

    const duration = Date.now() - startTime;
    console.log(`[Update Shipped] Completed in ${duration}ms - ${updatedCount} updated`);

    return new Response(
      JSON.stringify({
        success: true,
        checked: commandes.length,
        updated: updatedCount,
        duration_ms: duration,
      }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );

  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : String(error);
    console.error('[Update Shipped] Fatal error:', errorMessage);

    return new Response(
      JSON.stringify({ success: false, error: errorMessage }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' }, status: 500 }
    );
  }
});
