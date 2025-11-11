import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.39.3';

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

    const { periode_jours = 30 } = await req.json();
    
    console.log('💰 Cost Optimization Analysis:', { periode_jours });

    const periodeDebut = new Date(Date.now() - periode_jours * 24 * 60 * 60 * 1000);
    const periodeFin = new Date();

    // Récupérer les économies détaillées
    const { data: economies } = await supabase.rpc('calculer_economies_detaillees', {
      p_periode_jours: periode_jours,
    });

    // Récupérer la comparaison par transporteur
    const { data: comparaison } = await supabase
      .from('comparaison_couts_transporteurs' as any)
      .select('*');

    // Récupérer l'évolution temporelle
    const { data: evolution } = await supabase
      .from('evolution_couts_temporelle' as any)
      .select('*')
      .limit(30);

    // Récupérer les règles actuelles
    const { data: regles } = await supabase
      .from('regle_selection_transporteur' as any)
      .select('*')
      .eq('active', true);

    // Préparer le contexte pour l'IA
    const contextPrompt = `Analyse d'optimisation des coûts transporteurs - ${periode_jours} derniers jours

SYNTHÈSE FINANCIÈRE:
- Économies potentielles totales: ${economies?.economies_totales || 0} €
- Nombre de commandes optimisables: ${economies?.nombre_commandes_optimisables || 0}
- Économie moyenne par commande: ${economies?.economie_moyenne || 0} €

ANALYSE PAR TRANSPORTEUR (Top 5):
${(comparaison || []).slice(0, 5).map((t: any) => `
- ${t.transporteur_choisi_nom}:
  * Utilisations: ${t.nombre_utilisations}
  * Coût total réel: ${t.cout_total_reel} €
  * Coût optimal estimé: ${t.cout_optimal_estime} €
  * Économies potentielles: ${t.economies_potentielles} €
  * Score moyen: ${t.score_moyen}/100
`).join('\n')}

ÉVOLUTION TEMPORELLE (derniers 7 jours):
${(evolution || []).slice(0, 7).map((e: any) => `
- ${new Date(e.jour).toLocaleDateString('fr-FR')}: ${e.nombre_commandes} commandes, ${e.cout_total_jour} € (moy: ${e.cout_moyen_jour?.toFixed(2)} €)
`).join('\n')}

RÈGLES DE SÉLECTION ACTUELLES (${regles?.length || 0} règles actives):
${(regles || []).map((r: any) => `
- ${r.nom} (priorité ${r.priorite}):
  ${r.description || 'Pas de description'}
  Transporteur: ${r.transporteur_code || 'variable'}
  Force: ${r.force_transporteur ? 'OUI' : 'NON'}
`).join('\n')}

EXEMPLES DE COMMANDES OPTIMISABLES:
${(economies?.details || []).slice(0, 5).map((d: any) => `
- ${d.numero_commande}: ${d.transporteur_utilise} (${d.cout_reel}€) → ${d.transporteur_optimal} (${d.cout_optimal}€) = ${d.economie?.toFixed(2)}€ économie
`).join('\n')}

MISSION:
Analyse approfondie et fournis 3-5 suggestions concrètes pour optimiser les coûts avec:

1. Type de suggestion (ajuster_regle, ajouter_regle, desactiver_transporteur, ajuster_priorite, changer_mode_selection)
2. Titre court et actionnable
3. Description détaillée (2-3 phrases)
4. Justification basée sur les données (pourquoi cette suggestion)
5. Impact financier mensuel estimé en euros
6. Confiance dans la suggestion (0-1)
7. Actions concrètes recommandées

Priorise les suggestions avec le plus fort impact financier et la meilleure confiance.
Sois précis, chiffré, et actionnable.`;

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
            content: 'Tu es un expert en optimisation logistique et analyse financière. Tu analyses les données de coûts transporteurs et fournis des recommandations précises et chiffrées pour réduire les dépenses.' 
          },
          { role: 'user', content: contextPrompt }
        ],
        temperature: 0.7,
        max_tokens: 3000,
      }),
    });

    if (!aiResponse.ok) {
      if (aiResponse.status === 429) {
        return new Response(
          JSON.stringify({ error: 'Rate limit exceeded', status: 429 }),
          { status: 429, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
      }
      if (aiResponse.status === 402) {
        return new Response(
          JSON.stringify({ error: 'Payment required', status: 402 }),
          { status: 402, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
      }
      throw new Error(`AI Gateway error: ${aiResponse.status}`);
    }

    const aiData = await aiResponse.json();
    const analyseIA = aiData.choices?.[0]?.message?.content || '';

    console.log('✅ AI Analysis generated:', analyseIA.substring(0, 300));

    // Parser les suggestions de l'IA
    const suggestions: any[] = [];
    const suggestionBlocks = analyseIA.match(/\d+\.\s*Type[^]*?(?=\d+\.\s*Type|$)/gi) || [];
    
    suggestionBlocks.forEach((block: string) => {
      const typeMatch = block.match(/type[:\s]+([a-z_]+)/i);
      const titreMatch = block.match(/titre[:\s]+([^\n]+)/i);
      const descMatch = block.match(/description[:\s]+([^\n]+(?:\n(?!\w+:)[^\n]+)*)/i);
      const impactMatch = block.match(/impact[^\d]*([\d.]+)/i);
      const confianceMatch = block.match(/confiance[:\s]+([\d.]+)/i);
      
      if (typeMatch && titreMatch) {
        suggestions.push({
          type_suggestion: typeMatch[1],
          titre: titreMatch[1].trim(),
          description: descMatch?.[1].trim() || '',
          justification_ia: block.match(/justification[:\s]+([^\n]+(?:\n(?!\w+:)[^\n]+)*)/i)?.[1].trim() || '',
          impact_estime_mensuel: parseFloat(impactMatch?.[1] || '0'),
          confiance_suggestion: parseFloat(confianceMatch?.[1] || '0.75'),
        });
      }
    });

    // Si parsing a échoué, créer des suggestions génériques
    if (suggestions.length === 0) {
      suggestions.push({
        type_suggestion: 'ajuster_regle',
        titre: 'Optimiser les règles de sélection',
        description: analyseIA.substring(0, 200),
        justification_ia: analyseIA,
        impact_estime_mensuel: economies?.economies_totales || 0,
        confiance_suggestion: 0.70,
      });
    }

    const impactTotal = suggestions.reduce((sum, s) => sum + (s.impact_estime_mensuel || 0), 0);

    // Créer l'analyse
    const { data: analyse, error: analyseError } = await supabase
      .from('analyse_optimisation_couts')
      .insert({
        periode_debut: periodeDebut.toISOString().split('T')[0],
        periode_fin: periodeFin.toISOString().split('T')[0],
        nombre_commandes_analysees: economies?.nombre_commandes_optimisables || 0,
        cout_total_reel: (comparaison || []).reduce((sum: number, t: any) => sum + (t.cout_total_reel || 0), 0),
        cout_total_optimal: (comparaison || []).reduce((sum: number, t: any) => sum + (t.cout_optimal_estime || 0), 0),
        economies_potentielles: economies?.economies_totales || 0,
        pourcentage_economie: economies?.economies_totales && comparaison ? 
          ((economies.economies_totales / comparaison.reduce((sum: number, t: any) => sum + (t.cout_total_reel || 0), 0)) * 100) : 0,
        analyse_par_transporteur: JSON.stringify(comparaison),
        suggestions_ia: JSON.stringify(suggestions),
        nombre_suggestions: suggestions.length,
        impact_financier_total: impactTotal,
        commandes_details: JSON.stringify(economies?.details || []),
        facteurs_optimisation: {
          periode_jours,
          nombre_transporteurs: (comparaison || []).length,
          evolution: (evolution || []).length,
        },
        duree_analyse_ms: Date.now() - startTime,
        created_by: null, // Analyse automatique
      })
      .select()
      .single();

    if (analyseError) {
      console.error('Error saving analysis:', analyseError);
      throw analyseError;
    }

    // Créer les suggestions individuelles
    for (const suggestion of suggestions) {
      await supabase
        .from('suggestion_optimisation')
        .insert({
          analyse_id: analyse.id,
          ...suggestion,
        });
    }

    const processingTime = Date.now() - startTime;
    console.log(`✅ Analysis completed in ${processingTime}ms`);

    return new Response(
      JSON.stringify({
        success: true,
        analyse_id: analyse.id,
        economies_potentielles: economies?.economies_totales || 0,
        nombre_suggestions: suggestions.length,
        impact_total: impactTotal,
        suggestions: suggestions.slice(0, 3), // Top 3 pour réponse
        stats: {
          commandes_analysees: economies?.nombre_commandes_optimisables || 0,
          cout_total: (comparaison || []).reduce((sum: number, t: any) => sum + (t.cout_total_reel || 0), 0),
          pourcentage_economie: analyse.pourcentage_economie,
        },
        processing_time_ms: processingTime,
      }),
      { 
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        status: 200 
      }
    );

  } catch (error) {
    console.error('❌ Error in analyze-cost-optimization:', error);
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
