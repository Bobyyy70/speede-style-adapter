import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.39.3';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

interface Condition {
  field: string;
  operator: 'equals' | 'notEquals' | 'greaterThan' | 'lessThan' | 'contains' | 'in';
  value: any;
}

function evaluateCondition(data: any, condition: Condition): boolean {
  const fieldValue = data[condition.field];
  
  switch (condition.operator) {
    case 'equals':
      return fieldValue === condition.value;
    case 'notEquals':
      return fieldValue !== condition.value;
    case 'greaterThan':
      return Number(fieldValue) > Number(condition.value);
    case 'lessThan':
      return Number(fieldValue) < Number(condition.value);
    case 'contains':
      return String(fieldValue).toLowerCase().includes(String(condition.value).toLowerCase());
    case 'in':
      const values = Array.isArray(condition.value) ? condition.value : [condition.value];
      return values.includes(fieldValue);
    default:
      return false;
  }
}

function evaluateConditions(data: any, conditions: Condition[]): boolean {
  if (!Array.isArray(conditions) || conditions.length === 0) return true;
  return conditions.every(condition => evaluateCondition(data, condition));
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const supabaseClient = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? ''
    );

    const { commandeId } = await req.json();

    // Récupérer la commande
    const { data: commande, error: commandeError } = await supabaseClient
      .from('commande')
      .select('*')
      .eq('id', commandeId)
      .single();

    if (commandeError) throw commandeError;

    const updates: any = {};

    // 1. Appliquer les règles de tags automatiques
    const { data: tagRules } = await supabaseClient
      .from('regle_tag_automatique')
      .select('*')
      .eq('actif', true)
      .order('priorite', { ascending: true });

    if (tagRules && tagRules.length > 0) {
      const applicableTags: string[] = [];
      
      for (const rule of tagRules) {
        if (evaluateConditions(commande, rule.conditions)) {
          applicableTags.push(rule.tag);
        }
      }

      if (applicableTags.length > 0) {
        updates.tags = [...new Set([...(commande.tags || []), ...applicableTags])];
      }
    }

    // 2. Appliquer les règles de transport automatiques
    const { data: transportRules } = await supabaseClient
      .from('regle_transport_automatique')
      .select('*')
      .eq('actif', true)
      .order('priorite', { ascending: true });

    if (transportRules && transportRules.length > 0) {
      for (const rule of transportRules) {
        if (evaluateConditions(commande, rule.conditions)) {
          updates.transporteur_choisi = rule.transporteur;
          
          // Calculer le poids volumétrique si configuré
          if (rule.config_poids_volumetrique?.applique) {
            const diviseur = rule.config_poids_volumetrique.diviseur || 5000;
            
            // Récupérer les lignes de commande avec produits
            const { data: lignes } = await supabaseClient
              .from('ligne_commande')
              .select('produit_id, quantite_commandee')
              .eq('commande_id', commandeId);

            if (lignes && lignes.length > 0) {
              let volumeTotal = 0;
              let poidsTotal = 0;

              for (const ligne of lignes) {
                const { data: produit } = await supabaseClient
                  .from('produit')
                  .select('volume_m3, poids_unitaire')
                  .eq('id', ligne.produit_id)
                  .single();

                if (produit) {
                  volumeTotal += (produit.volume_m3 || 0) * ligne.quantite_commandee;
                  poidsTotal += (produit.poids_unitaire || 0) * ligne.quantite_commandee;
                }
              }

              // Convertir m3 en cm3 pour le calcul
              const volumeCm3 = volumeTotal * 1000000;
              const poidsVolumetrique = volumeCm3 / diviseur;

              updates.poids_reel_kg = poidsTotal;
              updates.poids_volumetrique_kg = poidsVolumetrique;
              updates.poids_total = Math.max(poidsTotal, poidsVolumetrique);

              // Trouver le carton approprié
              const { data: cartons } = await supabaseClient
                .from('type_carton')
                .select('*')
                .eq('actif', true)
                .gte('volume_m3', volumeTotal)
                .order('volume_m3', { ascending: true })
                .limit(1);

              if (cartons && cartons.length > 0) {
                updates.type_carton_id = cartons[0].id;
              }
            }
          }
          
          break; // Prendre la première règle qui match
        }
      }
    }

    // Mettre à jour la commande si des changements ont été détectés
    if (Object.keys(updates).length > 0) {
      const { error: updateError } = await supabaseClient
        .from('commande')
        .update(updates)
        .eq('id', commandeId);

      if (updateError) throw updateError;
    }

    return new Response(
      JSON.stringify({ 
        success: true, 
        updates,
        message: 'Règles automatiques appliquées avec succès'
      }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );

  } catch (error) {
    return new Response(
      JSON.stringify({ error: error instanceof Error ? error.message : String(error) }),
      { 
        status: 400,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      }
    );
  }
});
