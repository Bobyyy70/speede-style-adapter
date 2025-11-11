import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

interface RegleValidation {
  id: string;
  nom_regle: string;
  conditions: any;
  action_a_effectuer: 'bloquer' | 'exiger_validation' | 'alerter';
  niveau_validation?: string;
  message_utilisateur?: string;
  approbateurs_autorises?: string[];
  priorite: number;
}

// Fonction pour évaluer une condition simple
function evaluateCondition(commande: any, condition: any): boolean {
  const { field, operator, value } = condition;
  
  // Récupérer la valeur du champ (supporte les champs imbriqués comme "client.nom_entreprise")
  const fieldParts = field.split('.');
  let fieldValue = commande;
  for (const part of fieldParts) {
    fieldValue = fieldValue?.[part];
  }
  
  switch (operator) {
    case 'equals':
      return fieldValue === value;
    case 'notEquals':
      return fieldValue !== value;
    case 'greaterThan':
      return Number(fieldValue) > Number(value);
    case 'lessThan':
      return Number(fieldValue) < Number(value);
    case 'greaterThanOrEqual':
      return Number(fieldValue) >= Number(value);
    case 'lessThanOrEqual':
      return Number(fieldValue) <= Number(value);
    case 'contains':
      return String(fieldValue).toLowerCase().includes(String(value).toLowerCase());
    case 'notContains':
      return !String(fieldValue).toLowerCase().includes(String(value).toLowerCase());
    case 'in':
      return Array.isArray(value) && value.includes(fieldValue);
    case 'notIn':
      return Array.isArray(value) && !value.includes(fieldValue);
    case 'isEmpty':
      return !fieldValue || (Array.isArray(fieldValue) && fieldValue.length === 0);
    case 'isNotEmpty':
      return fieldValue && (!Array.isArray(fieldValue) || fieldValue.length > 0);
    default:
      return false;
  }
}

// Fonction pour évaluer toutes les conditions (AND logic)
function evaluateConditions(commande: any, conditions: any[]): boolean {
  if (!conditions || conditions.length === 0) return false;
  return conditions.every(condition => evaluateCondition(commande, condition));
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
    const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
    const supabase = createClient(supabaseUrl, supabaseServiceKey);

    const { commandeId } = await req.json();

    if (!commandeId) {
      throw new Error('commandeId est requis');
    }

    console.log(`[check-validation-rules] Vérification des règles pour commande: ${commandeId}`);

    // 1. Récupérer la commande avec ses relations
    const { data: commande, error: commandeError } = await supabase
      .from('commande')
      .select(`
        *,
        client:client_id(*)
      `)
      .eq('id', commandeId)
      .single();

    if (commandeError) throw commandeError;
    if (!commande) throw new Error('Commande non trouvée');

    console.log(`[check-validation-rules] Commande chargée: ${commande.numero_commande}`);

    // 2. Récupérer les règles actives par priorité
    const { data: regles, error: reglesError } = await supabase
      .from('regle_validation_commande')
      .select('*')
      .eq('actif', true)
      .or(`client_id.is.null,client_id.eq.${commande.client_id}`)
      .order('priorite', { ascending: true });

    if (reglesError) throw reglesError;

    console.log(`[check-validation-rules] ${regles?.length || 0} règles actives trouvées`);

    let regleAppliquee = false;

    // 3. Évaluer chaque règle
    for (const regle of regles || []) {
      const conditionsMatch = evaluateConditions(commande, regle.conditions);
      
      console.log(`[check-validation-rules] Règle "${regle.nom_regle}": ${conditionsMatch ? 'MATCH' : 'NO MATCH'}`);

      if (conditionsMatch) {
        console.log(`[check-validation-rules] Application de la règle: ${regle.nom_regle} (action: ${regle.action_a_effectuer})`);

        switch (regle.action_a_effectuer) {
          case 'bloquer': {
            // Bloquer immédiatement
            const { error: updateError } = await supabase
              .from('commande')
              .update({
                validation_requise: true,
                validation_statut: 'refuse',
                validation_message: regle.message_utilisateur,
                date_modification: new Date().toISOString()
              })
              .eq('id', commandeId);

            if (updateError) throw updateError;

            // Logger
            await supabase
              .from('commande_validation_log')
              .insert({
                commande_id: commandeId,
                regle_id: regle.id,
                statut_validation: 'refuse',
                raison_blocage: regle.message_utilisateur
              });

            console.log(`[check-validation-rules] Commande bloquée: ${regle.message_utilisateur}`);
            break;
          }

          case 'exiger_validation': {
            // Mettre en attente de validation
            const { error: updateError } = await supabase
              .from('commande')
              .update({
                validation_requise: true,
                validation_statut: 'en_attente_validation',
                statut_wms: 'en_attente_validation',
                validation_message: regle.message_utilisateur || `Règle: ${regle.nom_regle}`,
                date_modification: new Date().toISOString()
              })
              .eq('id', commandeId);

            if (updateError) throw updateError;

            // Logger avec destinataires
            await supabase
              .from('commande_validation_log')
              .insert({
                commande_id: commandeId,
                regle_id: regle.id,
                statut_validation: 'en_attente',
                raison_blocage: regle.message_utilisateur,
                destinataires_notification: regle.approbateurs_autorises || []
              });

            console.log(`[check-validation-rules] Validation requise: ${regle.message_utilisateur}`);
            break;
          }

          case 'alerter': {
            // Juste logger sans bloquer
            await supabase
              .from('commande_validation_log')
              .insert({
                commande_id: commandeId,
                regle_id: regle.id,
                statut_validation: 'en_attente',
                raison_blocage: regle.message_utilisateur,
                metadata: { alert_only: true }
              });

            console.log(`[check-validation-rules] Alerte créée: ${regle.message_utilisateur}`);
            break;
          }
        }

        regleAppliquee = true;
        // Appliquer seulement la première règle qui matche
        break;
      }
    }

    if (!regleAppliquee) {
      console.log(`[check-validation-rules] Aucune règle ne s'applique, commande libre`);
    }

    return new Response(
      JSON.stringify({
        success: true,
        regleAppliquee,
        commandeId
      }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );

  } catch (error: any) {
    console.error('[check-validation-rules] Erreur:', error.message);
    return new Response(
      JSON.stringify({ success: false, error: error.message }),
      { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});