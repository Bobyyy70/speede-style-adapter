// SendCloud Fetch Documents - Récupérer automatiquement les documents (labels, CN23, etc.)
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

interface FetchDocumentsPayload {
  commandeId: string;
  documentTypes?: string[]; // ['label', 'cn23', 'commercial_invoice']
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const supabase = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? ''
    );

    const { commandeId, documentTypes = ['label', 'cn23', 'commercial_invoice'] } = await req.json() as FetchDocumentsPayload;

    if (!commandeId) {
      throw new Error('commandeId is required');
    }

    console.log(`[SendCloud Fetch Docs] Fetching documents for commande ${commandeId}`);

    // Récupérer la commande
    const { data: commande, error: commandeError } = await supabase
      .from('commande')
      .select('*')
      .eq('id', commandeId)
      .single();

    if (commandeError) throw commandeError;
    if (!commande) throw new Error('Commande not found');

    if (!commande.sendcloud_shipment_id) {
      throw new Error('No SendCloud shipment ID found for this order');
    }

    const sendCloudApiKey = Deno.env.get('SENDCLOUD_API_PUBLIC_KEY');
    const sendCloudSecretKey = Deno.env.get('SENDCLOUD_API_SECRET_KEY');

    if (!sendCloudApiKey || !sendCloudSecretKey) {
      throw new Error('SendCloud API credentials not configured');
    }

    const auth = btoa(`${sendCloudApiKey}:${sendCloudSecretKey}`);
    
    // Récupérer les détails du parcel depuis SendCloud
    const parcelResponse = await fetch(
      `https://panel.sendcloud.sc/api/v2/parcels/${commande.sendcloud_shipment_id}`,
      {
        method: 'GET',
        headers: {
          'Authorization': `Basic ${auth}`,
          'Content-Type': 'application/json',
        },
      }
    );

    if (!parcelResponse.ok) {
      const errorText = await parcelResponse.text();
      throw new Error(`SendCloud API error: ${parcelResponse.status} - ${errorText}`);
    }

    const parcelData = await parcelResponse.json();
    const parcel = parcelData.parcel;

    console.log(`[SendCloud Fetch Docs] Parcel found: ${parcel.id}`);

    const documents: any[] = [];
    const errors: any[] = [];

    // Récupérer le label
    if (documentTypes.includes('label') && parcel.label?.label_printer) {
      try {
        const labelUrl = parcel.label.label_printer;
        const labelResponse = await fetch(labelUrl);
        
        if (labelResponse.ok) {
          const labelBlob = await labelResponse.blob();
          const labelBuffer = await labelBlob.arrayBuffer();
          
          // Upload to storage
          const fileName = `label_${commande.numero_commande}_${Date.now()}.pdf`;
          const { data: uploadData, error: uploadError } = await supabase.storage
            .from('documents-commande')
            .upload(fileName, labelBuffer, {
              contentType: 'application/pdf',
              upsert: false,
            });

          if (uploadError) throw uploadError;

          // Get public URL
          const { data: urlData } = supabase.storage
            .from('documents-commande')
            .getPublicUrl(fileName);

          // Enregistrer dans document_commande
          const { error: docError } = await supabase
            .from('document_commande')
            .insert({
              commande_id: commandeId,
              type_document: 'label',
              categorie: 'transport',
              nom_fichier: fileName,
              url_fichier: uploadData.path,
              format: 'PDF',
            });

          if (docError) throw docError;

          documents.push({ type: 'label', url: urlData.publicUrl });
          
          // Mettre à jour le label_url de la commande
          await supabase
            .from('commande')
            .update({ label_url: urlData.publicUrl })
            .eq('id', commandeId);
        }
      } catch (error) {
        console.error('[SendCloud Fetch Docs] Error fetching label:', error);
        errors.push({ type: 'label', error: (error as Error).message });
      }
    }

    // Récupérer la déclaration douanière (CN23) si disponible
    if (documentTypes.includes('cn23') && parcel.customs_declaration?.item_value) {
      try {
        // Générer le CN23 via notre edge function
        const { data: cn23Data, error: cn23Error } = await supabase.functions.invoke('generate-cn23', {
          body: { commandeId },
        });

        if (cn23Error) throw cn23Error;

        documents.push({ type: 'cn23', url: cn23Data.publicUrl });
      } catch (error) {
        console.error('[SendCloud Fetch Docs] Error generating CN23:', error);
        errors.push({ type: 'cn23', error: (error as Error).message });
      }
    }

    // Récupérer la facture commerciale
    if (documentTypes.includes('commercial_invoice')) {
      try {
        // Générer la packing list (facture commerciale) via notre edge function
        const { data: packingData, error: packingError } = await supabase.functions.invoke('generate-packing-list', {
          body: { commandeId },
        });

        if (packingError) throw packingError;

        documents.push({ type: 'packing_list', url: packingData.publicUrl });
      } catch (error) {
        console.error('[SendCloud Fetch Docs] Error generating packing list:', error);
        errors.push({ type: 'packing_list', error: (error as Error).message });
      }
    }

    console.log(`[SendCloud Fetch Docs] Fetched ${documents.length} documents, ${errors.length} errors`);

    return new Response(
      JSON.stringify({
        success: true,
        documents,
        errors: errors.length > 0 ? errors : undefined,
        message: `${documents.length} document(s) récupéré(s) avec succès`,
      }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );

  } catch (error) {
    console.error('[SendCloud Fetch Docs] Fatal error:', error);
    return new Response(
      JSON.stringify({ 
        success: false,
        error: (error as Error).message 
      }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});
