import { createClient } from 'npm:@supabase/supabase-js@2';

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

    console.log('🚫 Annulation parcel SendCloud pour commande:', commande_id);

    // 1. Récupérer la commande
    const { data: commande, error: commandeError } = await supabase
      .from('commande')
      .select('sendcloud_shipment_id, numero_commande, statut_wms')
      .eq('id', commande_id)
      .single();

    if (commandeError || !commande) {
      throw new Error(`Commande non trouvée: ${commande_id}`);
    }

    if (!commande.sendcloud_shipment_id) {
      throw new Error('Pas de shipment_id SendCloud pour cette commande');
    }

    // 2. Vérifier que la commande n'est pas déjà expédiée
    if (['Expédié', 'Livré'].includes(commande.statut_wms)) {
      throw new Error('Impossible d\'annuler une commande déjà expédiée ou livrée');
    }

    // 3. Appeler l'API SendCloud pour annuler
    const sendcloudAuth = btoa(`${sendcloudPublicKey}:${sendcloudSecretKey}`);
    const cancelResponse = await fetch(
      `https://panel.sendcloud.sc/api/v2/parcels/${commande.sendcloud_shipment_id}/cancel`,
      {
        method: 'POST',
        headers: {
          'Authorization': `Basic ${sendcloudAuth}`,
          'Content-Type': 'application/json',
          'Accept': 'application/json',
        },
      }
    );

    if (!cancelResponse.ok) {
      const errorData = await cancelResponse.json();
      console.error('❌ Erreur SendCloud Cancel API:', errorData);
      throw new Error(`SendCloud Cancel error: ${JSON.stringify(errorData)}`);
    }

    console.log('✅ Parcel annulé dans SendCloud');

    // 4. Mettre à jour notre DB
    const { error: updateError } = await supabase
      .from('commande')
      .update({
        statut_wms: 'Annulé',
      })
      .eq('id', commande_id);

    if (updateError) {
      console.error('❌ Erreur mise à jour commande:', updateError);
      throw updateError;
    }

    // 5. Libérer les réservations de stock (si applicable)
    const { data: reservations } = await supabase
      .from('mouvement_stock')
      .select('id, produit_id, quantite')
      .eq('commande_id', commande_id)
      .eq('type_mouvement', 'réservation')
      .eq('statut_mouvement', 'stock_physique');

    if (reservations && reservations.length > 0) {
      for (const reservation of reservations) {
        // Créer un mouvement inverse pour libérer le stock
        await supabase.from('mouvement_stock').insert({
          type_mouvement: 'ajustement_inventaire_positif',
          produit_id: reservation.produit_id,
          quantite: reservation.quantite,
          reference_origine: commande.numero_commande,
          type_origine: 'annulation_commande',
          commande_id: commande_id,
          remarques: `Libération stock suite annulation commande ${commande.numero_commande}`,
          statut_mouvement: 'stock_physique',
        });
      }
      console.log(`✅ ${reservations.length} réservation(s) libérée(s)`);
    }

    return new Response(
      JSON.stringify({
        success: true,
        commande_id,
        message: 'Commande annulée et stock libéré',
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
