import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';

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
    const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
    const supabase = createClient(supabaseUrl, supabaseServiceKey);

    // Récupérer l'utilisateur authentifié
    const authHeader = req.headers.get('Authorization')!;
    const token = authHeader.replace('Bearer ', '');
    const { data: { user }, error: userError } = await supabase.auth.getUser(token);

    if (userError || !user) {
      throw new Error('Non authentifié');
    }

    const { validationLogId, decision, commentaire } = await req.json();

    if (!validationLogId || !decision || !['approuve', 'refuse'].includes(decision)) {
      throw new Error('Paramètres invalides');
    }

    if (decision === 'refuse' && !commentaire?.trim()) {
      throw new Error('Un commentaire est obligatoire pour refuser une validation');
    }

    console.log(`[approve-commande] Décision ${decision} par ${user.email} pour validation ${validationLogId}`);

    // 1. Récupérer la demande de validation
    const { data: validationLog, error: logError } = await supabase
      .from('commande_validation_log')
      .select(`
        *,
        regle:regle_id(*),
        commande:commande_id(*)
      `)
      .eq('id', validationLogId)
      .single();

    if (logError) throw logError;
    if (!validationLog) throw new Error('Validation introuvable');

    if (validationLog.statut_validation !== 'en_attente') {
      throw new Error('Cette validation a déjà été traitée');
    }

    // 2. Vérifier les autorisations
    const { data: userRoles } = await supabase
      .from('user_roles')
      .select('role')
      .eq('user_id', user.id);

    const roles = userRoles?.map(r => r.role) || [];
    const isAdmin = roles.includes('admin');
    const isGestionnaire = roles.includes('gestionnaire');
    const isAuthorized = isAdmin || isGestionnaire || 
                        validationLog.destinataires_notification?.includes(user.id);

    if (!isAuthorized) {
      throw new Error('Vous n\'êtes pas autorisé à valider cette commande');
    }

    console.log(`[approve-commande] Utilisateur autorisé (admin: ${isAdmin}, gestionnaire: ${isGestionnaire})`);

    // 3. Mettre à jour le log de validation
    const { error: updateLogError } = await supabase
      .from('commande_validation_log')
      .update({
        statut_validation: decision,
        validateur_id: user.id,
        date_reponse: new Date().toISOString(),
        commentaire_validateur: commentaire
      })
      .eq('id', validationLogId);

    if (updateLogError) throw updateLogError;

    // 4. Mettre à jour la commande
    if (decision === 'approuve') {
      const { error: updateCommandeError } = await supabase
        .from('commande')
        .update({
          validation_requise: false,
          validation_statut: 'approuve',
          validation_message: null,
          date_modification: new Date().toISOString()
        })
        .eq('id', validationLog.commande_id);

      if (updateCommandeError) throw updateCommandeError;

      console.log(`[approve-commande] Commande ${validationLog.commande.numero_commande} approuvée`);

    } else {
      // Refuser = annuler la commande
      const { error: updateCommandeError } = await supabase
        .from('commande')
        .update({
          validation_statut: 'refuse',
          statut_wms: 'annule',
          date_modification: new Date().toISOString()
        })
        .eq('id', validationLog.commande_id);

      if (updateCommandeError) throw updateCommandeError;

      console.log(`[approve-commande] Commande ${validationLog.commande.numero_commande} refusée et annulée`);
    }

    return new Response(
      JSON.stringify({
        success: true,
        decision,
        numero_commande: validationLog.commande.numero_commande,
        message: decision === 'approuve' 
          ? 'Commande approuvée avec succès'
          : 'Commande refusée et annulée'
      }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );

  } catch (error: any) {
    console.error('[approve-commande] Erreur:', error.message);
    return new Response(
      JSON.stringify({ success: false, error: error.message }),
      { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});