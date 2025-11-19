import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "npm:@supabase/supabase-js@2";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const supabaseClient = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_ANON_KEY') ?? '',
    );

    const { periode_jours = 30 } = await req.json();
    
    console.log(`[analyze-carrier-learning] Analyse sur ${periode_jours} jours`);

    // 1. Récupérer les feedbacks (changements manuels)
    const dateDebut = new Date();
    dateDebut.setDate(dateDebut.getDate() - periode_jours);
    
    const { data: feedbacks, error: feedbackError } = await supabaseClient
      .from('feedback_decision_transporteur')
      .select('*')
      .gte('date_feedback', dateDebut.toISOString());

    if (feedbackError) {
      console.error('[analyze-carrier-learning] Erreur feedbacks:', feedbackError);
      throw feedbackError;
    }

    console.log(`[analyze-carrier-learning] ${feedbacks?.length || 0} feedbacks récupérés`);

    // 2. Récupérer les performances réelles
    const { data: performances, error: perfError } = await supabaseClient
      .from('performance_reelle_transporteur')
      .select('*')
      .gte('date_enregistrement', dateDebut.toISOString());

    if (perfError) {
      console.error('[analyze-carrier-learning] Erreur performances:', perfError);
      throw perfError;
    }

    console.log(`[analyze-carrier-learning] ${performances?.length || 0} performances récupérées`);

    // 3. Récupérer les patterns de changements
    const { data: patterns, error: patternError } = await supabaseClient
      .from('patterns_changements_transporteur')
      .select('*');

    if (patternError) {
      console.error('[analyze-carrier-learning] Erreur patterns:', patternError);
    }

    // 4. Récupérer les règles actuelles
    const { data: regles, error: reglesError } = await supabaseClient
      .from('regle_selection_transporteur')
      .select('*')
      .eq('actif', true);

    if (reglesError) {
      console.error('[analyze-carrier-learning] Erreur règles:', reglesError);
      throw reglesError;
    }

    // 5. Préparer le contexte pour l'IA
    const contextAnalyse = {
      periode_jours,
      nb_feedbacks: feedbacks?.length || 0,
      nb_performances: performances?.length || 0,
      feedbacks_resume: feedbacks?.slice(0, 20).map((f: any) => ({
        transporteur_initial: f.transporteur_initial,
        transporteur_modifie: f.transporteur_modifie,
        raison_changement: f.raison_changement,
        commentaire: f.commentaire
      })),
      patterns_frequents: patterns?.slice(0, 10),
      performances_problematiques: performances?.filter((p: any) => 
        p.statut_livraison === 'retard' || p.statut_livraison === 'perdu'
      ).slice(0, 10),
      regles_actuelles: regles?.map((r: any) => ({
        id: r.id,
        nom: r.nom_regle,
        conditions: r.conditions,
        transporteur_force_id: r.transporteur_force_id,
        priorite: r.priorite
      }))
    };

    // 6. Appeler l'IA Lovable pour générer des suggestions
    const LOVABLE_API_KEY = Deno.env.get('LOVABLE_API_KEY');
    if (!LOVABLE_API_KEY) {
      throw new Error('LOVABLE_API_KEY non configurée');
    }

    const prompt = `Tu es un expert en logistique et optimisation de transporteurs. Analyse les données suivantes et génère 3 à 5 suggestions concrètes d'amélioration des règles de sélection de transporteurs.

Contexte d'analyse (${periode_jours} derniers jours):
- ${contextAnalyse.nb_feedbacks} changements manuels détectés
- ${contextAnalyse.nb_performances} livraisons trackées
- ${contextAnalyse.performances_problematiques?.length || 0} incidents de livraison

Feedbacks récents (changements manuels):
${JSON.stringify(contextAnalyse.feedbacks_resume, null, 2)}

Patterns fréquents détectés:
${JSON.stringify(contextAnalyse.patterns_frequents, null, 2)}

Performances problématiques:
${JSON.stringify(contextAnalyse.performances_problematiques, null, 2)}

Règles actuelles:
${JSON.stringify(contextAnalyse.regles_actuelles, null, 2)}

Génère 3-5 suggestions CONCRÈTES et ACTIONNABLES pour améliorer le système. Pour chaque suggestion, fournis:
1. Type (modifier_poids, ajouter_condition, desactiver_regle, creer_regle, ajuster_seuil)
2. Titre court (max 80 caractères)
3. Description détaillée (2-3 phrases)
4. Justification basée sur les données (cite les chiffres)
5. Impact estimé sur les coûts (en €, positif = économie)
6. Impact estimé sur les délais (en heures, positif = amélioration)
7. Score de confiance (0-1)
8. Modifications proposées (objet JSON avec les changements spécifiques)

Priorise les suggestions ayant le plus fort impact et la plus haute confiance.`;

    console.log('[analyze-carrier-learning] Appel IA pour analyse...');

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
            content: 'Tu es un expert en logistique et optimisation de chaîne d\'approvisionnement. Tu analyses des données de performance de transporteurs et suggères des améliorations concrètes et mesurables.'
          },
          {
            role: 'user',
            content: prompt
          }
        ],
        tools: [{
          type: 'function',
          function: {
            name: 'generer_suggestions_amelioration',
            description: 'Génère des suggestions d\'amélioration des règles de sélection de transporteurs',
            parameters: {
              type: 'object',
              properties: {
                suggestions: {
                  type: 'array',
                  items: {
                    type: 'object',
                    properties: {
                      type_suggestion: {
                        type: 'string',
                        enum: ['modifier_poids', 'ajouter_condition', 'desactiver_regle', 'creer_regle', 'ajuster_seuil']
                      },
                      titre: { type: 'string' },
                      description: { type: 'string' },
                      justification: { type: 'string' },
                      impact_estime_cout: { type: 'number' },
                      impact_estime_delai: { type: 'number' },
                      confiance_score: { type: 'number' },
                      regle_cible_id: { type: 'string', nullable: true },
                      transporteur_id: { type: 'string', nullable: true },
                      modifications_proposees: { type: 'object' }
                    },
                    required: ['type_suggestion', 'titre', 'description', 'justification', 'confiance_score', 'modifications_proposees']
                  }
                }
              },
              required: ['suggestions']
            }
          }
        }],
        tool_choice: { type: 'function', function: { name: 'generer_suggestions_amelioration' } }
      }),
    });

    if (!aiResponse.ok) {
      const errorText = await aiResponse.text();
      console.error('[analyze-carrier-learning] Erreur IA:', aiResponse.status, errorText);
      throw new Error(`Erreur IA: ${aiResponse.status}`);
    }

    const aiData = await aiResponse.json();
    console.log('[analyze-carrier-learning] Réponse IA reçue');

    let suggestions = [];
    if (aiData.choices?.[0]?.message?.tool_calls?.[0]?.function?.arguments) {
      const args = JSON.parse(aiData.choices[0].message.tool_calls[0].function.arguments);
      suggestions = args.suggestions || [];
    }

    console.log(`[analyze-carrier-learning] ${suggestions.length} suggestions générées par IA`);

    // 7. Insérer les suggestions dans la base de données
    const dateDebutAnalyse = new Date();
    dateDebutAnalyse.setDate(dateDebutAnalyse.getDate() - periode_jours);
    
    const suggestionsInsert = suggestions.map((s: any) => ({
      type_suggestion: s.type_suggestion,
      regle_cible_id: s.regle_cible_id || null,
      transporteur_id: s.transporteur_id || null,
      titre: s.titre,
      description: s.description,
      justification: s.justification,
      impact_estime_cout: s.impact_estime_cout || 0,
      impact_estime_delai: s.impact_estime_delai || 0,
      confiance_score: s.confiance_score,
      base_sur_commandes: contextAnalyse.nb_feedbacks,
      periode_analyse_debut: dateDebutAnalyse.toISOString().split('T')[0],
      periode_analyse_fin: new Date().toISOString().split('T')[0],
      modifications_proposees: s.modifications_proposees,
      statut: 'en_attente',
      metadata: {
        analyse_context: {
          nb_feedbacks: contextAnalyse.nb_feedbacks,
          nb_performances: contextAnalyse.nb_performances,
          periode_jours
        }
      }
    }));

    const { data: insertedSuggestions, error: insertError } = await supabaseClient
      .from('suggestion_ajustement_regle')
      .insert(suggestionsInsert)
      .select();

    if (insertError) {
      console.error('[analyze-carrier-learning] Erreur insertion suggestions:', insertError);
      throw insertError;
    }

    console.log(`[analyze-carrier-learning] ${insertedSuggestions?.length || 0} suggestions insérées`);

    // 8. Calculer les métriques d'apprentissage pour aujourd'hui
    const { error: metricsError } = await supabaseClient
      .rpc('calculer_metriques_apprentissage', {
        p_date: new Date().toISOString().split('T')[0]
      });

    if (metricsError) {
      console.error('[analyze-carrier-learning] Erreur calcul métriques:', metricsError);
    }

    return new Response(
      JSON.stringify({
        success: true,
        suggestions: insertedSuggestions,
        analyse: {
          periode_jours,
          nb_feedbacks: contextAnalyse.nb_feedbacks,
          nb_performances: contextAnalyse.nb_performances,
          nb_suggestions_generees: insertedSuggestions?.length || 0
        }
      }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );

  } catch (error) {
    console.error('[analyze-carrier-learning] Erreur:', error);
    return new Response(
      JSON.stringify({
        success: false,
        error: error instanceof Error ? error.message : 'Erreur inconnue'
      }),
      {
        status: 500,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      }
    );
  }
});