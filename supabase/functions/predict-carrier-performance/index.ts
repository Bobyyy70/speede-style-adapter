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
    
    const LOVABLE_API_KEY = Deno.env.get('LOVABLE_API_KEY');
    if (!LOVABLE_API_KEY) {
      throw new Error('LOVABLE_API_KEY not configured');
    }

    const { transporteur_id, periode_jours = 30 } = await req.json();
    
    console.log('🔮 AI Carrier Performance Prediction:', { transporteur_id, periode_jours });

    if (!transporteur_id) {
      throw new Error('transporteur_id is required');
    }

    // Récupérer les données du transporteur
    const { data: transporteur } = await supabase
      .from('transporteur_service')
      .select('*')
      .eq('id', transporteur_id)
      .single();

    if (!transporteur) {
      throw new Error('Transporteur not found');
    }

    // Récupérer les stats de performance actuelles
    const { data: stats } = await supabase
      .from('stats_performance_transporteur')
      .select('*')
      .eq('transporteur_id', transporteur_id)
      .single();

    // Récupérer l'historique des commandes (derniers 180 jours)
    const { data: commandesHistory } = await supabase
      .from('commande')
      .select('*')
      .eq('transporteur_choisi', transporteur.code_service)
      .gte('date_creation', new Date(Date.now() - 180 * 24 * 60 * 60 * 1000).toISOString())
      .order('date_creation', { ascending: false });

    // Analyser par mois pour tendances saisonnières
    const analyseParMois: any = {};
    const analyseParZone: any = {};
    
    commandesHistory?.forEach(cmd => {
      const mois = new Date(cmd.date_creation).getMonth();
      const zone = cmd.pays_code?.substring(0, 2) || 'XX';
      
      if (!analyseParMois[mois]) {
        analyseParMois[mois] = { total: 0, livrees: 0, problemes: 0 };
      }
      if (!analyseParZone[zone]) {
        analyseParZone[zone] = { total: 0, livrees: 0, problemes: 0 };
      }
      
      analyseParMois[mois].total++;
      analyseParZone[zone].total++;
      
      if (cmd.statut_wms === 'livre') {
        analyseParMois[mois].livrees++;
        analyseParZone[zone].livrees++;
      }
      if (cmd.statut_wms === 'probleme') {
        analyseParMois[mois].problemes++;
        analyseParZone[zone].problemes++;
      }
    });

    // Récupérer la dernière prédiction pour comparaison
    const { data: lastPrediction } = await supabase
      .from('prediction_performance_transporteur')
      .select('*')
      .eq('transporteur_id', transporteur_id)
      .order('date_prediction', { ascending: false })
      .limit(1)
      .maybeSingle();

    // Préparer le contexte pour l'IA
    const contextPrompt = `Analyse prédictive du transporteur "${transporteur.nom_affichage}" (${transporteur.code_service})

DONNÉES ACTUELLES:
- Taux de succès: ${stats?.taux_succes || 0}%
- Délai moyen: ${stats?.delai_moyen_jours || 'N/A'} jours
- Nombre de commandes: ${stats?.nombre_commandes || 0}
- Problèmes: ${stats?.nombre_problemes || 0}

ANALYSE PAR MOIS (derniers 6 mois):
${Object.entries(analyseParMois)
  .map(([mois, data]: [string, any]) => {
    const monthNames = ['Jan', 'Fév', 'Mar', 'Avr', 'Mai', 'Jun', 'Jul', 'Aoû', 'Sep', 'Oct', 'Nov', 'Déc'];
    const tauxSucces = data.total > 0 ? ((data.livrees / data.total) * 100).toFixed(1) : 0;
    return `  ${monthNames[parseInt(mois)]}: ${data.total} commandes, ${tauxSucces}% succès, ${data.problemes} problèmes`;
  })
  .join('\n')}

ANALYSE PAR ZONE GÉOGRAPHIQUE:
${Object.entries(analyseParZone)
  .map(([zone, data]: [string, any]) => {
    const tauxSucces = data.total > 0 ? ((data.livrees / data.total) * 100).toFixed(1) : 0;
    return `  ${zone}: ${data.total} commandes, ${tauxSucces}% succès, ${data.problemes} problèmes`;
  })
  .join('\n')}

${lastPrediction ? `PRÉDICTION PRÉCÉDENTE (${new Date(lastPrediction.date_prediction).toLocaleDateString()}):
- Score global prédit: ${lastPrediction.score_global_predit}
- Score actuel: ${stats?.taux_succes || 0}
- Différence: ${(stats?.taux_succes || 0) - lastPrediction.score_global_predit}
` : ''}

MISSION:
Prédis les performances pour les ${periode_jours} prochains jours en tenant compte:
1. Tendances saisonnières (mois actuel vs historique)
2. Performances par zone géographique
3. Évolution récente (30 derniers jours vs 90 derniers jours)
4. Facteurs externes possibles (météo, pics activité, etc.)

Fournis:
- Score global prédit (0-100)
- Score délai prédit (0-100)
- Score fiabilité prédit (0-100)
- Score coût prédit (0-100)
- Taux de succès prédit (%)
- Délai moyen prédit (jours)
- Nombre d'incidents prédits
- Facteurs d'influence identifiés
- Niveau de confiance (0-1)
- Alerte si dégradation prévue (true/false)
- Recommandations stratégiques

Sois précis, basé sur les données, et identifie les risques potentiels.`;

    // Appel à Lovable AI
    const aiResponse = await fetch('https://ai.gateway.lovable.dev/v1/chat/completions', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${LOVABLE_API_KEY}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        model: 'google/gemini-2.5-flash',
        messages: [
          { 
            role: 'system', 
            content: 'Tu es un expert en analyse prédictive logistique. Tu analyses les données historiques pour prédire les performances futures des transporteurs avec précision. Tu fournis des prédictions chiffrées et des recommandations actionnables.' 
          },
          { role: 'user', content: contextPrompt }
        ],
        temperature: 0.7,
        max_tokens: 2000,
      }),
    });

    if (!aiResponse.ok) {
      if (aiResponse.status === 429) {
        return new Response(
          JSON.stringify({ 
            error: 'Rate limit exceeded. Please try again later.',
            status: 429 
          }),
          { status: 429, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
      }
      if (aiResponse.status === 402) {
        return new Response(
          JSON.stringify({ 
            error: 'Payment required. Please add credits to your workspace.',
            status: 402 
          }),
          { status: 402, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
      }
      const errorText = await aiResponse.text();
      throw new Error(`AI Gateway error: ${aiResponse.status} - ${errorText}`);
    }

    const aiData = await aiResponse.json();
    const analyseIA = aiData.choices?.[0]?.message?.content || '';

    console.log('✅ AI Analysis generated:', analyseIA.substring(0, 200));

    // Parser l'analyse IA pour extraire les scores
    // Note: En production, utiliser tool calling pour structured output
    const scoreGlobal = parseFloat(analyseIA.match(/score global[^\d]*([\d.]+)/i)?.[1] || '75');
    const scoreDelai = parseFloat(analyseIA.match(/score délai[^\d]*([\d.]+)/i)?.[1] || '80');
    const scoreFiabilite = parseFloat(analyseIA.match(/score fiabilité[^\d]*([\d.]+)/i)?.[1] || '75');
    const scoreCout = parseFloat(analyseIA.match(/score coût[^\d]*([\d.]+)/i)?.[1] || '70');
    const tauxSuccesPredit = parseFloat(analyseIA.match(/taux de succès[^\d]*([\d.]+)/i)?.[1] || String(stats?.taux_succes || 75));
    const alerteDegradation = /dégradation|alerte|risque|danger/i.test(analyseIA);

    const periodeDebut = new Date();
    const periodeFin = new Date(Date.now() + periode_jours * 24 * 60 * 60 * 1000);

    // Calculer la variation par rapport à la dernière prédiction
    let variation = 0;
    if (lastPrediction) {
      variation = scoreGlobal - lastPrediction.score_global_predit;
    }

    // Déterminer le niveau d'alerte
    let niveauAlerte = 'aucune';
    if (alerteDegradation || variation < -10) {
      niveauAlerte = variation < -20 ? 'critique' : variation < -10 ? 'moyenne' : 'faible';
    }

    // Insérer la prédiction
    const { data: prediction, error: predError } = await supabase
      .from('prediction_performance_transporteur')
      .insert({
        transporteur_id,
        periode_debut: periodeDebut.toISOString(),
        periode_fin: periodeFin.toISOString(),
        score_global_predit: scoreGlobal,
        score_delai_predit: scoreDelai,
        score_fiabilite_predit: scoreFiabilite,
        score_cout_predit: scoreCout,
        taux_succes_predit: tauxSuccesPredit,
        delai_moyen_predit: stats?.delai_moyen_jours || null,
        analyse_ia: analyseIA,
        confiance_prediction: 0.75,
        alerte_degradation: alerteDegradation || variation < -10,
        niveau_alerte: niveauAlerte,
        raison_alerte: alerteDegradation ? 'Dégradation prévue par analyse IA' : null,
        variation_score: variation,
        modele_ia: 'google/gemini-2.5-flash',
        duree_calcul_ms: Date.now() - startTime,
        facteurs_saisonniers: { analyse_par_mois: analyseParMois },
        facteurs_geographiques: { analyse_par_zone: analyseParZone },
      })
      .select()
      .single();

    if (predError) {
      console.error('Error inserting prediction:', predError);
      throw predError;
    }

    // Détecter les dégradations et créer des alertes
    const { data: alerteResult } = await supabase.rpc('detecter_degradation_transporteur', {
      p_transporteur_id: transporteur_id,
    });

    const processingTime = Date.now() - startTime;

    console.log(`✅ Prediction saved in ${processingTime}ms`);

    return new Response(
      JSON.stringify({
        success: true,
        prediction,
        alerte_creee: alerteResult?.[0]?.alerte_creee || false,
        message_alerte: alerteResult?.[0]?.message || null,
        processing_time_ms: processingTime,
        stats: {
          score_global: scoreGlobal,
          variation,
          alerte_degradation: alerteDegradation || variation < -10,
          niveau_alerte: niveauAlerte,
        },
      }),
      { 
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        status: 200 
      }
    );

  } catch (error) {
    console.error('❌ Error in predict-carrier-performance:', error);
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
