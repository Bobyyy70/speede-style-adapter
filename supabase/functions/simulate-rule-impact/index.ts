import { createClient } from 'npm:@supabase/supabase-js@2';

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
    const supabaseKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
    const supabase = createClient(supabaseUrl, supabaseKey);
    
    const { regle_modifiee, periode_jours = 30 } = await req.json();
    
    console.log('🎯 Rule Impact Simulation:', { regle_modifiee, periode_jours });

    if (!regle_modifiee) {
      throw new Error('regle_modifiee is required');
    }

    // 1. Récupérer les commandes historiques sur la période
    const dateDebut = new Date(Date.now() - periode_jours * 24 * 60 * 60 * 1000);
    
    const { data: commandesHistorique, error: cmdError } = await supabase
      .from('commande')
      .select(`
        id,
        numero_commande,
        client_id,
        poids_total,
        pays_code,
        priorite_expedition,
        transporteur,
        montant_expedition,
        date_creation
      `)
      .gte('date_creation', dateDebut.toISOString())
      .not('transporteur', 'is', null)
      .order('date_creation', { ascending: false });

    if (cmdError) {
      throw cmdError;
    }

    console.log(`📦 ${commandesHistorique?.length || 0} commandes historiques récupérées`);

    // 2. Simuler l'application de la règle modifiée
    const resultatsAvant: any[] = [];
    const resultatsApres: any[] = [];
    const comparaison = {
      cout_total_avant: 0,
      cout_total_apres: 0,
      commandes_impactees: 0,
      transporteurs_avant: {} as Record<string, number>,
      transporteurs_apres: {} as Record<string, number>
    };

    for (const commande of commandesHistorique || []) {
      // État AVANT (transporteur historique)
      resultatsAvant.push({
        commande_id: commande.id,
        numero: commande.numero_commande,
        transporteur: commande.transporteur,
        cout: commande.montant_expedition || 0
      });
      
      comparaison.cout_total_avant += commande.montant_expedition || 0;
      comparaison.transporteurs_avant[commande.transporteur] = 
        (comparaison.transporteurs_avant[commande.transporteur] || 0) + 1;

      // État APRÈS (simuler avec règle modifiée)
      let transporteurSimule = commande.transporteur;
      let coutSimule = commande.montant_expedition || 0;
      
      // Vérifier si la règle modifiée match cette commande
      const conditions = regle_modifiee.conditions || {};
      let match = true;
      
      if (conditions.poids_min && commande.poids_total < conditions.poids_min) match = false;
      if (conditions.poids_max && commande.poids_total > conditions.poids_max) match = false;
      if (conditions.pays && !conditions.pays.includes(commande.pays_code)) match = false;
      if (conditions.delai_souhaite && commande.priorite_expedition !== conditions.delai_souhaite) match = false;
      
      if (match && regle_modifiee.force_transporteur && regle_modifiee.transporteur_force_id) {
        // Récupérer le transporteur forcé
        const { data: forcedTransporteur } = await supabase
          .from('transporteur_service')
          .select('code_service, nom_affichage')
          .eq('id', regle_modifiee.transporteur_force_id)
          .single();
        
        if (forcedTransporteur) {
          transporteurSimule = forcedTransporteur.code_service;
          // Estimation du coût (simplifiée, à améliorer avec vraies données)
          coutSimule = commande.montant_expedition || 0;
        }
      }
      
      resultatsApres.push({
        commande_id: commande.id,
        numero: commande.numero_commande,
        transporteur: transporteurSimule,
        cout: coutSimule,
        a_change: transporteurSimule !== commande.transporteur
      });
      
      comparaison.cout_total_apres += coutSimule;
      comparaison.transporteurs_apres[transporteurSimule] = 
        (comparaison.transporteurs_apres[transporteurSimule] || 0) + 1;
      
      if (transporteurSimule !== commande.transporteur) {
        comparaison.commandes_impactees++;
      }
    }

    // 3. Calculer les métriques de comparaison
    const economiesEstimees = comparaison.cout_total_avant - comparaison.cout_total_apres;
    const pourcentageEconomie = comparaison.cout_total_avant > 0 
      ? (economiesEstimees / comparaison.cout_total_avant) * 100 
      : 0;

    const processingTime = Date.now() - startTime;

    console.log(`✅ Simulation completed in ${processingTime}ms`);
    console.log(`💰 Économies estimées: ${economiesEstimees.toFixed(2)} € (${pourcentageEconomie.toFixed(2)}%)`);
    console.log(`📊 ${comparaison.commandes_impactees} commandes impactées`);

    return new Response(
      JSON.stringify({
        success: true,
        simulation: {
          periode_jours,
          nombre_commandes: commandesHistorique?.length || 0,
          commandes_impactees: comparaison.commandes_impactees,
          pourcentage_impact: ((comparaison.commandes_impactees / (commandesHistorique?.length || 1)) * 100).toFixed(2),
          cout_total_avant: comparaison.cout_total_avant.toFixed(2),
          cout_total_apres: comparaison.cout_total_apres.toFixed(2),
          economies_estimees: economiesEstimees.toFixed(2),
          pourcentage_economie: pourcentageEconomie.toFixed(2),
          distribution_avant: comparaison.transporteurs_avant,
          distribution_apres: comparaison.transporteurs_apres
        },
        details_avant: resultatsAvant.slice(0, 20),
        details_apres: resultatsApres.filter(r => r.a_change).slice(0, 20),
        processing_time_ms: processingTime
      }),
      { 
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        status: 200 
      }
    );

  } catch (error) {
    console.error('❌ Error in simulate-rule-impact:', error);
    return new Response(
      JSON.stringify({ 
        error: error instanceof Error ? error.message : 'Unknown error',
        success: false 
      }),
      { 
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        status: 500 
      }
    );
  }
});