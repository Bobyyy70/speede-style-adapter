// SendCloud Import Shipping Methods - Importer les méthodes d'expédition depuis SendCloud API
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const supabase = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? ''
    );

    const sendCloudApiKey = Deno.env.get('SENDCLOUD_API_PUBLIC_KEY');
    const sendCloudSecretKey = Deno.env.get('SENDCLOUD_API_SECRET_KEY');

    if (!sendCloudApiKey || !sendCloudSecretKey) {
      throw new Error('SendCloud API credentials not configured');
    }

    const auth = btoa(`${sendCloudApiKey}:${sendCloudSecretKey}`);
    
    console.log('[SendCloud Import Methods] Fetching shipping methods from SendCloud...');
    const response = await fetch('https://panel.sendcloud.sc/api/v2/shipping_methods', {
      method: 'GET',
      headers: {
        'Authorization': `Basic ${auth}`,
        'Content-Type': 'application/json',
      },
    });

    if (!response.ok) {
      const errorText = await response.text();
      throw new Error(`SendCloud API error: ${response.status} - ${errorText}`);
    }

    const data = await response.json();
    const shippingMethods = data.shipping_methods || [];

    console.log(`[SendCloud Import Methods] Found ${shippingMethods.length} shipping methods`);

    let importedCount = 0;
    let updatedCount = 0;
    const errors: any[] = [];

    for (const method of shippingMethods) {
      try {
        // Trouver le transporteur correspondant
        const { data: carrier } = await supabase
          .from('transporteur_configuration')
          .select('id')
          .eq('sendcloud_carrier_code', method.carrier)
          .maybeSingle();

        if (!carrier) {
          console.warn(`[SendCloud Import Methods] Carrier not found for method ${method.id}: ${method.carrier}`);
          continue;
        }

        // Préparer les données du service
        const serviceData = {
          transporteur_id: carrier.id,
          code_service: method.service_point_input || method.id?.toString() || 'unknown',
          nom_affichage: method.name || 'Unknown Service',
          description: `${method.carrier} - ${method.name}`,
          sendcloud_shipping_method_id: method.id?.toString() || null,
          delai_min_jours: method.min_delivery_days || null,
          delai_max_jours: method.max_delivery_days || null,
          poids_min_kg: method.min_weight ? method.min_weight / 1000 : null,
          poids_max_kg: method.max_weight ? method.max_weight / 1000 : null,
          suivi_disponible: true,
          assurance_incluse: false,
          actif: method.is_active || false,
        };

        // Vérifier si le service existe déjà
        const { data: existing } = await supabase
          .from('transporteur_service')
          .select('id')
          .eq('transporteur_id', carrier.id)
          .eq('code_service', serviceData.code_service)
          .maybeSingle();

        if (existing) {
          // Mise à jour
          const { error } = await supabase
            .from('transporteur_service')
            .update(serviceData)
            .eq('id', existing.id);

          if (error) throw error;
          updatedCount++;
        } else {
          // Insertion
          const { error } = await supabase
            .from('transporteur_service')
            .insert(serviceData);

          if (error) throw error;
          importedCount++;
        }
      } catch (error) {
        console.error(`[SendCloud Import Methods] Error processing method ${method.id}:`, error);
        errors.push({
          method_id: method.id,
          method_name: method.name,
          error: (error as Error).message,
        });
      }
    }

    console.log(`[SendCloud Import Methods] Import completed: ${importedCount} new, ${updatedCount} updated, ${errors.length} errors`);

    return new Response(
      JSON.stringify({
        success: true,
        imported: importedCount,
        updated: updatedCount,
        total: shippingMethods.length,
        errors: errors.length > 0 ? errors : undefined,
        message: `Importation réussie: ${importedCount} nouveaux services, ${updatedCount} mis à jour`,
      }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );

  } catch (error) {
    console.error('[SendCloud Import Methods] Fatal error:', error);
    return new Response(
      JSON.stringify({ 
        success: false,
        error: (error as Error).message 
      }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});
