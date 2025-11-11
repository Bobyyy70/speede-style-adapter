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
    
    console.log('📧 Carrier Notification System triggered');

    // 1. Récupérer les suggestions IA à haute confiance (>80%) créées dans les dernières 24h
    const { data: suggestionsHauteConfiance } = await supabase
      .from('suggestion_ajustement_regle')
      .select('*, regle:regle_cible_id(nom_regle)')
      .eq('statut', 'en_attente')
      .gte('confiance', 0.8)
      .gte('date_creation', new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString());

    // 2. Détecter les changements manuels répétitifs (>5 fois sur le même pattern)
    const { data: patternsRepetitifs } = await supabase
      .from('patterns_changements_transporteur' as any)
      .select('*')
      .gte('frequence', 5);

    // 3. Récupérer les alertes critiques actives
    const { data: alertesCritiques } = await supabase
      .from('alerte_performance_transporteur')
      .select('*')
      .eq('statut', 'active')
      .eq('severite', 'critical');

    // 4. Identifier les gestionnaires à notifier
    const { data: gestionnaires } = await supabase
      .from('profiles')
      .select('id, email, nom_complet')
      .in('id', 
        (await supabase
          .from('user_roles')
          .select('user_id')
          .in('role', ['admin', 'gestionnaire'])
        ).data?.map(r => r.user_id) || []
      );

    let notificationsCreated = 0;

    // 5. Créer notifications pour suggestions haute confiance
    if (suggestionsHauteConfiance && suggestionsHauteConfiance.length > 0) {
      for (const suggestion of suggestionsHauteConfiance) {
        await supabase.rpc('creer_notification', {
          p_user_ids: gestionnaires?.map(g => g.id) || [],
          p_type: 'suggestion_ia_haute_confiance',
          p_severite: 'warning',
          p_titre: '💡 Nouvelle suggestion IA prioritaire',
          p_message: `${suggestion.justification} (Confiance: ${Math.round(suggestion.confiance * 100)}%)`,
          p_lien_action: `/analytics/apprentissage-continu?suggestion=${suggestion.id}`,
          p_metadata: {
            suggestion_id: suggestion.id,
            type_ajustement: suggestion.type_ajustement,
            confiance: suggestion.confiance
          }
        });
        notificationsCreated++;
      }
    }

    // 6. Créer notifications pour patterns répétitifs
    if (patternsRepetitifs && patternsRepetitifs.length > 0) {
      for (const pattern of patternsRepetitifs.slice(0, 3)) {
        await supabase.rpc('creer_notification', {
          p_user_ids: gestionnaires?.map(g => g.id) || [],
          p_type: 'pattern_repetitif',
          p_severite: 'warning',
          p_titre: '🔄 Pattern de changements répétitifs détecté',
          p_message: `${pattern.frequence} changements de ${pattern.transporteur_initial} vers ${pattern.transporteur_modifie}. Raison: ${pattern.raison_changement}`,
          p_lien_action: '/analytics/apprentissage-continu',
          p_metadata: {
            pattern: pattern,
            frequence: pattern.frequence
          }
        });
        notificationsCreated++;
      }
    }

    // 7. Créer notifications pour alertes critiques
    if (alertesCritiques && alertesCritiques.length > 0) {
      for (const alerte of alertesCritiques) {
        await supabase.rpc('creer_notification', {
          p_user_ids: gestionnaires?.map(g => g.id) || [],
          p_type: 'alerte_critique_transporteur',
          p_severite: 'critical',
          p_titre: '⚠️ Dégradation critique transporteur',
          p_message: alerte.message,
          p_lien_action: '/analytics/scoring-predictif',
          p_metadata: {
            alerte_id: alerte.id,
            transporteur_code: alerte.transporteur_code,
            degradation: alerte.degradation_pourcentage
          }
        });
        notificationsCreated++;
      }
    }

    console.log(`✅ ${notificationsCreated} notification(s) créée(s)`);

    // 8. TODO: Envoyer emails récapitulatifs (intégration Resend/SendGrid)
    // Pour l'instant, les notifications in-app sont créées

    return new Response(
      JSON.stringify({
        success: true,
        notifications_created: notificationsCreated,
        stats: {
          suggestions_haute_confiance: suggestionsHauteConfiance?.length || 0,
          patterns_repetitifs: patternsRepetitifs?.length || 0,
          alertes_critiques: alertesCritiques?.length || 0
        }
      }),
      { 
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        status: 200 
      }
    );

  } catch (error) {
    console.error('❌ Error in send-carrier-notifications:', error);
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