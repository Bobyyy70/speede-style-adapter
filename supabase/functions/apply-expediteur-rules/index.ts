import { createClient } from 'npm:@supabase/supabase-js@2';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

interface RegleExpediteur {
  id: string;
  nom_regle: string;
  condition_type: string;
  condition_value: string;
  configuration_expediteur_id: string;
  priorite: number;
}

interface ConfigurationExpediteur {
  id: string;
  nom: string;
  entreprise: string;
  email: string;
  telephone: string;
  adresse_ligne_1: string;
  adresse_ligne_2: string | null;
  code_postal: string;
  ville: string;
  pays_code: string;
  eori_number: string | null;
  vat_number: string | null;
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

    const { commandeId, clientId, nomClient, tagsCommande, sousClient } = await req.json();

    if (!commandeId || !clientId) {
      throw new Error('commandeId et clientId requis');
    }

    console.log('[apply-expediteur-rules] Recherche règles pour:', { commandeId, clientId, nomClient, tagsCommande, sousClient });

    // Récupérer toutes les règles actives pour ce client, triées par priorité
    const { data: regles, error: reglesError } = await supabaseClient
      .from('regle_expediteur_automatique')
      .select('*')
      .eq('client_id', clientId)
      .eq('actif', true)
      .order('priorite', { ascending: false });

    if (reglesError) throw reglesError;

    if (!regles || regles.length === 0) {
      console.log('[apply-expediteur-rules] Aucune règle trouvée, utilisation config par défaut');
      return new Response(
        JSON.stringify({ success: true, matched: false, message: 'Aucune règle applicable' }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Trouver la première règle qui matche
    let matchedRegle: RegleExpediteur | null = null;

    for (const regle of regles as RegleExpediteur[]) {
      let isMatch = false;

      switch (regle.condition_type) {
        case 'nom_client_exact':
          isMatch = nomClient?.toLowerCase() === regle.condition_value.toLowerCase();
          break;
        case 'nom_client_contient':
          isMatch = nomClient?.toLowerCase().includes(regle.condition_value.toLowerCase()) || false;
          break;
        case 'tags_commande':
          const requiredTags = regle.condition_value.split(',').map(t => t.trim().toLowerCase());
          const commandeTags = (tagsCommande || []).map((t: string) => t.toLowerCase());
          isMatch = requiredTags.some(tag => commandeTags.includes(tag));
          break;
        case 'sous_client_exact':
          isMatch = sousClient?.toLowerCase() === regle.condition_value.toLowerCase();
          break;
        default:
          console.warn(`[apply-expediteur-rules] Type de condition inconnu: ${regle.condition_type}`);
      }

      if (isMatch) {
        matchedRegle = regle;
        console.log(`[apply-expediteur-rules] Règle matchée: ${regle.nom_regle} (priorité ${regle.priorite})`);
        break;
      }
    }

    if (!matchedRegle) {
      console.log('[apply-expediteur-rules] Aucune règle ne matche');
      return new Response(
        JSON.stringify({ success: true, matched: false, message: 'Aucune règle applicable' }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Récupérer la configuration expéditeur associée
    const { data: config, error: configError } = await supabaseClient
      .from('configuration_expediteur')
      .select('*')
      .eq('id', matchedRegle.configuration_expediteur_id)
      .single();

    if (configError || !config) {
      throw new Error(`Configuration expéditeur non trouvée: ${matchedRegle.configuration_expediteur_id}`);
    }

    const configExpediteur = config as ConfigurationExpediteur;

    // Mettre à jour la commande avec les données expéditeur
    const { error: updateError } = await supabaseClient
      .from('commande')
      .update({
        expediteur_nom: configExpediteur.nom,
        expediteur_entreprise: configExpediteur.entreprise,
        expediteur_email: configExpediteur.email,
        expediteur_telephone: configExpediteur.telephone,
        expediteur_adresse_ligne_1: configExpediteur.adresse_ligne_1,
        expediteur_adresse_ligne_2: configExpediteur.adresse_ligne_2,
        expediteur_code_postal: configExpediteur.code_postal,
        expediteur_ville: configExpediteur.ville,
        expediteur_pays_code: configExpediteur.pays_code,
      })
      .eq('id', commandeId);

    if (updateError) throw updateError;

    console.log(`[apply-expediteur-rules] Commande ${commandeId} mise à jour avec config ${configExpediteur.entreprise}`);

    return new Response(
      JSON.stringify({
        success: true,
        matched: true,
        regle_appliquee: matchedRegle.nom_regle,
        expediteur_entreprise: configExpediteur.entreprise,
      }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  } catch (error: any) {
    console.error('[apply-expediteur-rules] Erreur:', error);
    return new Response(
      JSON.stringify({ success: false, error: error.message }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' }, status: 400 }
    );
  }
});
