import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "npm:@supabase/supabase-js@2";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

interface CalculateWeightRequest {
  commande_id?: string;
  transporteur_code?: string;
  recalculate_all?: boolean;
}

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const supabaseClient = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? ''
    );

    const { commande_id, transporteur_code, recalculate_all }: CalculateWeightRequest = await req.json();

    console.log('Calculate volumetric weight request:', { commande_id, transporteur_code, recalculate_all });

    // Si recalculate_all est true, recalculer pour toutes les commandes
    if (recalculate_all) {
      const { data: commandes, error: commandesError } = await supabaseClient
        .from('commande')
        .select('id, transporteur_choisi')
        .not('statut_wms', 'in', '("annule", "livre")');

      if (commandesError) {
        throw commandesError;
      }

      let successCount = 0;
      let errorCount = 0;
      const errors: any[] = [];

      for (const commande of commandes || []) {
        try {
          const { data: result, error: calcError } = await supabaseClient
            .rpc('calculer_poids_volumetrique_commande', {
              p_commande_id: commande.id,
              p_transporteur_code: commande.transporteur_choisi || 'DEFAULT'
            });

          if (calcError) throw calcError;

          if (result && result.length > 0) {
            const calcResult = result[0];
            
            const { error: updateError } = await supabaseClient
              .from('commande')
              .update({
                poids_reel_kg: calcResult.poids_reel_total,
                poids_volumetrique_kg: calcResult.poids_volumetrique_total,
                poids_total: calcResult.poids_facturable,
                date_modification: new Date().toISOString()
              })
              .eq('id', commande.id);

            if (updateError) throw updateError;

            successCount++;
          }
        } catch (error: any) {
          console.error(`Error calculating weight for commande ${commande.id}:`, error);
          errorCount++;
          errors.push({ commande_id: commande.id, error: error.message });
        }
      }

      return new Response(
        JSON.stringify({
          success: true,
          message: `Recalcul terminé: ${successCount} succès, ${errorCount} erreurs`,
          details: {
            total: commandes?.length || 0,
            success: successCount,
            errors: errorCount,
            error_details: errors
          }
        }),
        {
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
          status: 200,
        }
      );
    }

    // Calculer pour une commande spécifique
    if (!commande_id) {
      throw new Error('commande_id is required when recalculate_all is false');
    }

    // Récupérer les infos de la commande
    const { data: commande, error: commandeError } = await supabaseClient
      .from('commande')
      .select('transporteur_choisi')
      .eq('id', commande_id)
      .single();

    if (commandeError) throw commandeError;

    const carrier = transporteur_code || commande?.transporteur_choisi || 'DEFAULT';

    // Appeler la fonction PostgreSQL pour calculer les poids
    const { data: result, error: calcError } = await supabaseClient
      .rpc('calculer_poids_volumetrique_commande', {
        p_commande_id: commande_id,
        p_transporteur_code: carrier
      });

    if (calcError) {
      console.error('Error calculating volumetric weight:', calcError);
      throw calcError;
    }

    if (!result || result.length === 0) {
      throw new Error('No result from calculation function');
    }

    const calcResult = result[0];

    // Mettre à jour la commande avec les poids calculés
    const { error: updateError } = await supabaseClient
      .from('commande')
      .update({
        poids_reel_kg: calcResult.poids_reel_total,
        poids_volumetrique_kg: calcResult.poids_volumetrique_total,
        poids_total: calcResult.poids_facturable,
        date_modification: new Date().toISOString()
      })
      .eq('id', commande_id);

    if (updateError) {
      console.error('Error updating commande:', updateError);
      throw updateError;
    }

    console.log('Volumetric weight calculated successfully:', calcResult);

    return new Response(
      JSON.stringify({
        success: true,
        data: {
          commande_id,
          transporteur_code: carrier,
          poids_reel_kg: calcResult.poids_reel_total,
          poids_volumetrique_kg: calcResult.poids_volumetrique_total,
          poids_facturable_kg: calcResult.poids_facturable,
          facteur_division: calcResult.facteur_utilise,
          details: calcResult.details
        }
      }),
      {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        status: 200,
      }
    );

  } catch (error: any) {
    console.error('Error in calculate-volumetric-weight function:', error);
    return new Response(
      JSON.stringify({
        success: false,
        error: error.message,
        details: error
      }),
      {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        status: 400,
      }
    );
  }
});
