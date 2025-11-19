// SendCloud Import Carriers - Importer les transporteurs depuis SendCloud API
import { createClient } from "npm:@supabase/supabase-js@2";

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
    
    // Récupérer les transporteurs depuis SendCloud
    console.log('[SendCloud Import] Fetching carriers from SendCloud...');
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

    console.log(`[SendCloud Import] Found ${shippingMethods.length} shipping methods`);

    // Extraire les transporteurs uniques
    const carriersMap = new Map();
    
    shippingMethods.forEach((method: any) => {
      const carrierName = method.carrier || 'Unknown';
      if (!carriersMap.has(carrierName)) {
        carriersMap.set(carrierName, {
          code_transporteur: method.carrier?.toLowerCase().replace(/\s+/g, '_') || 'unknown',
          nom_complet: carrierName,
          api_key: method.id?.toString() || '',
          actif: method.is_active || false,
          zones_couverture: method.countries || [],
          supports_tracking: true,
          supports_label_generation: true,
          sendcloud_carrier_code: method.carrier || '',
        });
      }
    });

    const carriers = Array.from(carriersMap.values());
    console.log(`[SendCloud Import] Processing ${carriers.length} unique carriers`);

    let importedCount = 0;
    let updatedCount = 0;
    const errors: any[] = [];

    // Insérer ou mettre à jour chaque transporteur
    for (const carrier of carriers) {
      try {
        // Vérifier si le transporteur existe déjà
        const { data: existing } = await supabase
          .from('transporteur_configuration')
          .select('id')
          .eq('code_transporteur', carrier.code_transporteur)
          .maybeSingle();

        if (existing) {
          // Mise à jour
          const { error } = await supabase
            .from('transporteur_configuration')
            .update({
              nom_complet: carrier.nom_complet,
              zones_couverture: carrier.zones_couverture,
              actif: carrier.actif,
              sendcloud_carrier_code: carrier.sendcloud_carrier_code,
            })
            .eq('id', existing.id);

          if (error) throw error;
          updatedCount++;
        } else {
          // Insertion
          const { error } = await supabase
            .from('transporteur_configuration')
            .insert(carrier);

          if (error) throw error;
          importedCount++;
        }
      } catch (error) {
        console.error(`[SendCloud Import] Error processing carrier ${carrier.code_transporteur}:`, error);
        errors.push({
          carrier: carrier.code_transporteur,
          error: (error as Error).message,
        });
      }
    }

    console.log(`[SendCloud Import] Import completed: ${importedCount} new, ${updatedCount} updated, ${errors.length} errors`);

    return new Response(
      JSON.stringify({
        success: true,
        imported: importedCount,
        updated: updatedCount,
        total: carriers.length,
        errors: errors.length > 0 ? errors : undefined,
        message: `Importation réussie: ${importedCount} nouveaux transporteurs, ${updatedCount} mis à jour`,
      }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );

  } catch (error) {
    console.error('[SendCloud Import] Fatal error:', error);
    return new Response(
      JSON.stringify({ 
        success: false,
        error: (error as Error).message 
      }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});
