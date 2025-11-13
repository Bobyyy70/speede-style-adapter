import { serve } from "https://deno.land/std@0.168.0/http/server.ts"
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.38.4"
import { Resend } from "https://esm.sh/resend@3.2.0"

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

interface EmailRequest {
  commande_id: string
  send_to_client?: boolean
  send_to_carrier?: boolean
}

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const resendApiKey = Deno.env.get('RESEND_API_KEY');
    if (!resendApiKey) {
      throw new Error('RESEND_API_KEY non configuré');
    }

    const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
    const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
    const supabase = createClient(supabaseUrl, supabaseServiceKey);
    const resend = new Resend(resendApiKey);

    const { 
      commande_id, 
      send_to_client = true,
      send_to_carrier = false
    }: EmailRequest = await req.json();

    console.log('📧 Envoi des documents douaniers pour commande:', commande_id);

    // Récupérer les infos de la commande
    const { data: commande, error: commandeError } = await supabase
      .from('commande')
      .select(`
        *,
        client:client_id (
          nom_client,
          email,
          adresse
        ),
        lignes:ligne_commande (
          produit:produit_id (
            nom_produit
          ),
          quantite,
          prix_unitaire
        )
      `)
      .eq('id', commande_id)
      .single();

    if (commandeError || !commande) {
      throw new Error('Commande introuvable');
    }

    // Récupérer les documents douaniers depuis le storage
    const { data: documents, error: docsError } = await supabase
      .from('document_commande')
      .select('*')
      .eq('commande_id', commande_id)
      .in('type_document', ['cn23', 'packing_list'])
      .order('date_generation', { ascending: false });

    if (docsError || !documents || documents.length === 0) {
      throw new Error('Aucun document douanier trouvé');
    }

    const results = [];

    // Préparer les pièces jointes en téléchargeant depuis le storage
    const attachments = [];
    for (const doc of documents) {
      try {
        // Extraire le nom du fichier
        const fileName = doc.nom_fichier;
        
        // Télécharger le fichier depuis le storage
        const { data: fileData, error: downloadError } = await supabase.storage
          .from('documents-commande')
          .download(fileName);

        if (downloadError || !fileData) {
          console.error(`Erreur téléchargement ${fileName}:`, downloadError);
          continue;
        }

        // Convertir en base64
        const buffer = await fileData.arrayBuffer();
        const base64 = btoa(String.fromCharCode(...new Uint8Array(buffer)));

        const docLabel = doc.type_document === 'cn23' ? 'CN23' : 'PackingList';
        attachments.push({
          filename: `${docLabel}_${commande.numero_commande}.html`,
          content: base64,
        });
      } catch (error) {
        console.error(`Erreur traitement document ${doc.nom_fichier}:`, error);
      }
    }

    if (attachments.length === 0) {
      throw new Error('Impossible de préparer les pièces jointes');
    }

    // Variables pour remplacer dans les templates
    const variables = {
      '{{numero_commande}}': commande.numero_commande || '',
      '{{client_nom}}': commande.client?.nom_client || 'Client',
      '{{date}}': new Date().toLocaleDateString('fr-FR'),
      '{{transporteur}}': commande.transporteur_choisi || 'À définir',
    };

    // Fonction pour remplacer les variables dans un template
    const replaceVariables = (text: string) => {
      let result = text;
      for (const [key, value] of Object.entries(variables)) {
        result = result.replaceAll(key, value);
      }
      return result;
    };

    // 1. Envoyer au client
    if (send_to_client && commande.client?.email) {
      try {
        // Récupérer le template client
        const { data: template } = await supabase
          .from('customs_email_templates')
          .select('*')
          .eq('nom', 'cn23_client')
          .eq('actif', true)
          .single();

        if (template) {
          const sujet = replaceVariables(template.sujet);
          const html = replaceVariables(template.corps_html);

          console.log('📤 Envoi au client:', commande.client.email);

          const { data: emailData, error: emailError } = await resend.emails.send({
            from: 'WMS Logistics <onboarding@resend.dev>',
            to: [commande.client.email],
            subject: sujet,
            html: html,
            attachments: attachments,
          });

          // Logger l'envoi
          await supabase.from('customs_email_log').insert({
            commande_id: commande_id,
            destinataire_email: commande.client.email,
            destinataire_type: 'client',
            template_utilise: 'cn23_client',
            sujet: sujet,
            statut: emailError ? 'erreur' : 'envoye',
            erreur_message: emailError?.message,
            resend_id: emailData?.id,
            documents_joints: attachments.map(a => a.filename),
          });

          results.push({
            destinataire: 'client',
            email: commande.client.email,
            success: !emailError,
            error: emailError?.message,
            resend_id: emailData?.id,
          });
        }
      } catch (error: any) {
        console.error('Erreur envoi client:', error);
        results.push({
          destinataire: 'client',
          success: false,
          error: error.message,
        });
      }
    }

    // 2. Envoyer au transporteur
    if (send_to_carrier && commande.transporteur_email) {
      try {
        // Récupérer le template transporteur
        const { data: template } = await supabase
          .from('customs_email_templates')
          .select('*')
          .eq('nom', 'cn23_transporteur')
          .eq('actif', true)
          .single();

        if (template) {
          const sujet = replaceVariables(template.sujet);
          const html = replaceVariables(template.corps_html);

          console.log('📤 Envoi au transporteur:', commande.transporteur_email);

          const { data: emailData, error: emailError } = await resend.emails.send({
            from: 'WMS Logistics <onboarding@resend.dev>',
            to: [commande.transporteur_email],
            subject: sujet,
            html: html,
            attachments: attachments,
          });

          // Logger l'envoi
          await supabase.from('customs_email_log').insert({
            commande_id: commande_id,
            destinataire_email: commande.transporteur_email,
            destinataire_type: 'transporteur',
            template_utilise: 'cn23_transporteur',
            sujet: sujet,
            statut: emailError ? 'erreur' : 'envoye',
            erreur_message: emailError?.message,
            resend_id: emailData?.id,
            documents_joints: attachments.map(a => a.filename),
          });

          results.push({
            destinataire: 'transporteur',
            email: commande.transporteur_email,
            success: !emailError,
            error: emailError?.message,
            resend_id: emailData?.id,
          });
        }
      } catch (error: any) {
        console.error('Erreur envoi transporteur:', error);
        results.push({
          destinataire: 'transporteur',
          success: false,
          error: error.message,
        });
      }
    }

    console.log('✅ Résultats envoi:', results);

    return new Response(
      JSON.stringify({
        success: true,
        results: results,
        message: `${results.filter(r => r.success).length}/${results.length} email(s) envoyé(s)`,
      }),
      { 
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        status: 200 
      }
    );

  } catch (error: any) {
    console.error('❌ Erreur send-customs-documents:', error);
    return new Response(
      JSON.stringify({ 
        success: false, 
        error: error.message 
      }),
      { 
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        status: 500 
      }
    );
  }
})
