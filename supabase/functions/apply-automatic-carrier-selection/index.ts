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

    const { commande_id } = await req.json();
    
    console.log('🤖 Automatic Carrier Selection for Order:', commande_id);

    if (!commande_id) {
      throw new Error('commande_id is required');
    }

    // Récupérer la commande
    const { data: commande, error: cmdError } = await supabase
      .from('commande')
      .select('*, client:client_id(*)')
      .eq('id', commande_id)
      .single();

    if (cmdError || !commande) {
      throw new Error('Commande not found');
    }

    // Récupérer les règles actives qui matchent
    const { data: regles } = await supabase
      .from('regle_selection_transporteur')
      .select('*')
      .eq('active', true)
      .order('priorite', { ascending: false });

    // Filtrer les règles qui matchent la commande
    const reglesMatchees = (regles || []).filter(regle => {
      let match = true;
      
      const conditions = regle.conditions || {};
      
      // Vérifier poids
      if (conditions.poids_min && commande.poids_total < conditions.poids_min) match = false;
      if (conditions.poids_max && commande.poids_total > conditions.poids_max) match = false;
      
      // Vérifier destination
      if (conditions.pays && !conditions.pays.includes(commande.pays_code)) match = false;
      
      // Vérifier délai
      if (conditions.delai_souhaite && commande.priorite_expedition !== conditions.delai_souhaite) match = false;
      
      // Vérifier coût max
      if (conditions.cout_max && commande.montant_expedition > conditions.cout_max) match = false;
      
      return match;
    });

    console.log(`✅ ${reglesMatchees.length} règle(s) matchée(s)`);

    // Récupérer tous les transporteurs disponibles avec leurs stats
    const { data: transporteurs } = await supabase
      .from('transporteur_service')
      .select('*')
      .eq('actif', true);

    if (!transporteurs || transporteurs.length === 0) {
      throw new Error('No active carriers found');
    }

    // Calculer les scores pour chaque transporteur
    const transporteursScores: any[] = [];
    
    for (const transporteur of transporteurs) {
      const { data: scoreData } = await supabase.rpc('calculer_score_pondere_transporteur', {
        p_code_service: transporteur.code_service,
        p_poids: commande.poids_total || 0,
        p_pays: commande.pays_code || 'FR',
        p_delai: commande.priorite_expedition || 'standard',
        p_cout: commande.montant_expedition || 0,
      });

      transporteursScores.push({
        code_service: transporteur.code_service,
        nom: transporteur.nom_affichage,
        score: scoreData?.score_final || 50,
        details: scoreData,
      });
    }

    // Trier par score décroissant
    transporteursScores.sort((a, b) => b.score - a.score);

    // Si des règles strictes matchent, forcer leur choix
    const regleStricte = reglesMatchees.find(r => r.force_transporteur);
    let transporteurChoisi;
    let modeDecision = 'automatique';
    let analyseIA = '';

    if (regleStricte) {
      transporteurChoisi = transporteursScores.find(t => t.code_service === regleStricte.transporteur_code);
      modeDecision = 'regle_stricte';
      analyseIA = `Règle stricte appliquée: ${regleStricte.nom}. Transporteur forcé selon les conditions définies.`;
      console.log('🔒 Règle stricte appliquée:', regleStricte.nom);
    } else {
      // Sinon, demander à l'IA de choisir le meilleur
      const contextPrompt = `Sélection intelligente du transporteur pour la commande ${commande.numero_commande}

INFORMATIONS COMMANDE:
- Poids: ${commande.poids_total || 0} kg
- Destination: ${commande.pays_code} (${commande.ville})
- Délai souhaité: ${commande.priorite_expedition || 'standard'}
- Budget expédition: ${commande.montant_expedition || 'N/A'} €
- Client: ${commande.client?.nom_client || 'N/A'}

RÈGLES MÉTIER MATCHÉES (${reglesMatchees.length}):
${reglesMatchees.map(r => `- ${r.nom} (priorité ${r.priorite}): ${r.description || 'N/A'}`).join('\n')}

TRANSPORTEURS DISPONIBLES AVEC SCORES:
${transporteursScores.map(t => `
- ${t.nom} (${t.code_service})
  Score global: ${t.score}/100
  Taux succès: ${t.details?.taux_succes || 'N/A'}%
  Délai moyen: ${t.details?.delai_moyen || 'N/A'} jours
  Nombre commandes: ${t.details?.nombre_commandes || 0}
  Alerte active: ${t.details?.alerte_active ? 'OUI ⚠️' : 'Non'}
`).join('\n')}

MISSION:
Analyse les données et recommande le meilleur transporteur. Considère:
1. Scores prédictifs et stats de performance
2. Règles métier qui s'appliquent
3. Rapport qualité/coût/délai
4. Alertes de dégradation

Fournis:
- Transporteur recommandé (code_service)
- Justification détaillée (2-3 phrases)
- Confiance (0-1)
- Alternatives si pertinent`;

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
              content: 'Tu es un expert en logistique et optimisation des transporteurs. Tu analyses les données de performance et recommandes le meilleur choix.' 
            },
            { role: 'user', content: contextPrompt }
          ],
          temperature: 0.7,
          max_tokens: 1500,
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
      analyseIA = aiData.choices?.[0]?.message?.content || '';

      console.log('🤖 AI Analysis:', analyseIA.substring(0, 200));

      // Parser la recommandation IA
      const codeMatch = analyseIA.match(/code[_\s]service[:\s]+([a-zA-Z0-9_-]+)/i);
      const confMatch = analyseIA.match(/confiance[:\s]+([\d.]+)/i);
      
      const codeRecommande = codeMatch?.[1];
      const confiance = confMatch ? parseFloat(confMatch[1]) : 0.75;

      if (codeRecommande) {
        transporteurChoisi = transporteursScores.find(t => 
          t.code_service.toLowerCase().includes(codeRecommande.toLowerCase())
        );
      }

      // Fallback sur le meilleur score si l'IA n'a pas pu parser
      if (!transporteurChoisi && transporteursScores.length > 0) {
        transporteurChoisi = transporteursScores[0];
        modeDecision = 'automatique';
      } else {
        modeDecision = 'ia_suggere';
      }
    }

    if (!transporteurChoisi) {
      throw new Error('No suitable carrier found');
    }

    // Mettre à jour la commande
    await supabase
      .from('commande')
      .update({
        transporteur_choisi: transporteurChoisi.code_service,
        nom_transporteur: transporteurChoisi.nom,
        date_modification: new Date().toISOString(),
      })
      .eq('id', commande_id);

    // Enregistrer la décision
    const { data: decision, error: decError } = await supabase
      .from('decision_transporteur')
      .insert({
        commande_id,
        transporteur_choisi_code: transporteurChoisi.code_service,
        transporteur_choisi_nom: transporteurChoisi.nom,
        score_transporteur: transporteurChoisi.score,
        poids_colis: commande.poids_total,
        pays_destination: commande.pays_code,
        delai_souhaite: commande.priorite_expedition,
        cout_estime: commande.montant_expedition,
        regles_appliquees: JSON.stringify(reglesMatchees.map(r => ({
          id: r.id,
          nom: r.nom,
          priorite: r.priorite,
        }))),
        nombre_regles_matchees: reglesMatchees.length,
        analyse_ia: analyseIA,
        recommandation_ia: analyseIA,
        confiance_decision: 0.85,
        mode_decision: modeDecision,
        transporteurs_alternatives: JSON.stringify(transporteursScores.slice(1, 4)),
        duree_calcul_ms: Date.now() - startTime,
        facteurs_decision: {
          scores_calcules: transporteursScores.length,
          regles_matchees: reglesMatchees.length,
          mode: modeDecision,
        },
      })
      .select()
      .single();

    if (decError) {
      console.error('Error saving decision:', decError);
    }

    const processingTime = Date.now() - startTime;
    console.log(`✅ Carrier selected in ${processingTime}ms: ${transporteurChoisi.nom}`);

    // Mettre à jour le log si c'est un appel automatique
    if (req.headers.get('x-trigger-source') === 'postgres_auto') {
      await supabase
        .from('log_auto_selection_transporteur')
        .update({
          transporteur_selectionne_code: transporteurChoisi.code_service,
          transporteur_selectionne_nom: transporteurChoisi.nom,
          score_selection: transporteurChoisi.score,
          reponse_edge_function: {
            success: true,
            mode: modeDecision,
            regles_matchees: reglesMatchees.length,
          },
        })
        .eq('commande_id', commande_id)
        .order('date_declenchement', { ascending: false })
        .limit(1);
    }

    return new Response(
      JSON.stringify({
        success: true,
        commande_id,
        transporteur_choisi: {
          code: transporteurChoisi.code_service,
          nom: transporteurChoisi.nom,
          score: transporteurChoisi.score,
        },
        mode_decision: modeDecision,
        regles_matchees: reglesMatchees.length,
        analyse_ia: analyseIA.substring(0, 500),
        alternatives: transporteursScores.slice(1, 4),
        decision_id: decision?.id,
        processing_time_ms: processingTime,
      }),
      { 
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        status: 200 
      }
    );

  } catch (error) {
    console.error('❌ Error in apply-automatic-carrier-selection:', error);
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
