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
    const supabase = createClient(supabaseUrl, supabaseKey);
    
    const LOVABLE_API_KEY = Deno.env.get('LOVABLE_API_KEY');
    if (!LOVABLE_API_KEY) {
      throw new Error('LOVABLE_API_KEY not configured');
    }

    const { context, type = 'suggest' } = await req.json();
    
    console.log('🤖 AI Carrier Rules Request:', { type, context });

    // Récupérer les stats des transporteurs pour contexte
    const { data: carrierStats } = await supabase
      .from('stats_performance_transporteur')
      .select('*')
      .order('taux_succes', { ascending: false })
      .limit(10);

    // Récupérer les règles existantes
    const { data: existingRules } = await supabase
      .from('regle_selection_transporteur')
      .select('*')
      .eq('actif', true)
      .order('priorite', { ascending: true });

    let systemPrompt = '';
    let userPrompt = '';

    if (type === 'suggest') {
      systemPrompt = `Tu es un expert en logistique et optimisation de transport. 
Tu dois analyser les données fournies et suggérer des règles intelligentes de sélection de transporteurs.
Prends en compte: le poids, la destination, le délai souhaité, le coût et l'historique de performance.
Sois précis et actionnable dans tes recommandations.`;

      userPrompt = `Voici les statistiques des transporteurs disponibles:
${JSON.stringify(carrierStats || [], null, 2)}

Règles existantes:
${JSON.stringify(existingRules || [], null, 2)}

Contexte supplémentaire: ${context || 'Aucun'}

Suggère 3-5 règles de sélection de transporteurs optimales basées sur ces données.
Pour chaque règle, fournis:
- Un nom clair et descriptif
- Les conditions (poids, pays, délai, coût)
- Le transporteur recommandé avec justification
- Le critère principal (coût, délai, performance, eco)
- Une estimation du taux de succès
- Des conseils d'optimisation`;

    } else if (type === 'analyze') {
      systemPrompt = `Tu es un analyste de données logistiques expert.
Tu analyses les règles de transporteurs existantes et identifies les opportunités d'amélioration.`;

      userPrompt = `Analyse ces règles de transporteurs:
${JSON.stringify(context.rules || [], null, 2)}

Stats transporteurs:
${JSON.stringify(carrierStats || [], null, 2)}

Identifie:
1. Les règles qui se chevauchent ou sont redondantes
2. Les opportunités d'optimisation (coût/délai)
3. Les zones géographiques mal couvertes
4. Les améliorations possibles basées sur les performances réelles`;

    } else if (type === 'optimize') {
      systemPrompt = `Tu es un optimiseur de règles logistiques.
Tu proposes des améliorations concrètes pour une règle spécifique.`;

      userPrompt = `Optimise cette règle:
${JSON.stringify(context.rule || {}, null, 2)}

Stats du transporteur:
${JSON.stringify(context.stats || {}, null, 2)}

Propose des améliorations pour:
1. Réduire les coûts
2. Améliorer les délais
3. Augmenter le taux de succès
4. Mieux couvrir les besoins`;
    }

    // Call Lovable AI Gateway
    const aiResponse = await fetch('https://ai.gateway.lovable.dev/v1/chat/completions', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${LOVABLE_API_KEY}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        model: 'google/gemini-2.5-flash',
        messages: [
          { role: 'system', content: systemPrompt },
          { role: 'user', content: userPrompt }
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
          { 
            status: 429, 
            headers: { ...corsHeaders, 'Content-Type': 'application/json' } 
          }
        );
      }
      if (aiResponse.status === 402) {
        return new Response(
          JSON.stringify({ 
            error: 'Payment required. Please add credits to your workspace.',
            status: 402 
          }),
          { 
            status: 402, 
            headers: { ...corsHeaders, 'Content-Type': 'application/json' } 
          }
        );
      }
      const errorText = await aiResponse.text();
      throw new Error(`AI Gateway error: ${aiResponse.status} - ${errorText}`);
    }

    const aiData = await aiResponse.json();
    const suggestion = aiData.choices?.[0]?.message?.content || '';

    console.log('✅ AI Suggestion generated:', suggestion.substring(0, 200));

    return new Response(
      JSON.stringify({
        success: true,
        suggestion,
        carrier_stats: carrierStats,
        existing_rules_count: existingRules?.length || 0,
        type,
      }),
      { 
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        status: 200 
      }
    );

  } catch (error) {
    console.error('❌ Error in suggest-carrier-rules:', error);
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
