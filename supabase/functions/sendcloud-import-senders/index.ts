// SendCloud Import Sender Addresses - Importer les adresses expéditeur depuis SendCloud API
import { createClient } from "npm:@supabase/supabase-js@2";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

interface SendCloudSenderAddress {
  id: number;
  company_name: string;
  contact_name: string;
  email: string;
  telephone: string;
  street: string;
  house_number: string;
  postal_code: string;
  city: string;
  country: string;
  vat_number?: string;
  eori_number?: string;
  is_default: boolean;
  bank_account_number?: string;
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

    const sendCloudApiKey = Deno.env.get('SENDCLOUD_API_PUBLIC_KEY');
    const sendCloudSecretKey = Deno.env.get('SENDCLOUD_API_SECRET_KEY');

    if (!sendCloudApiKey || !sendCloudSecretKey) {
      throw new Error('SendCloud API credentials not configured');
    }

    const auth = btoa(`${sendCloudApiKey}:${sendCloudSecretKey}`);
    
    // Récupérer les adresses expéditeur depuis SendCloud
    console.log('[SendCloud Import Senders] Fetching sender addresses from SendCloud...');
    const response = await fetch('https://panel.sendcloud.sc/api/v2/user/sender-addresses', {
      method: 'GET',
      headers: {
        'Authorization': `Basic ${auth}`,
        'Content-Type': 'application/json',
      },
    });

    if (!response.ok) {
      const errorText = await response.text();
      console.error('[SendCloud Import Senders] API error:', response.status, errorText);
      throw new Error(`SendCloud API error: ${response.status} - ${errorText}`);
    }

    const data = await response.json();
    const senderAddresses = data.sender_addresses || [];

    console.log(`[SendCloud Import Senders] Found ${senderAddresses.length} sender addresses`);

    let importedCount = 0;
    let updatedCount = 0;
    const errors: any[] = [];

    // Insérer ou mettre à jour chaque adresse
    for (const address of senderAddresses as SendCloudSenderAddress[]) {
      try {
        // Vérifier si l'adresse existe déjà
        const { data: existing } = await supabase
          .from('sendcloud_sender_address')
          .select('id')
          .eq('sendcloud_id', address.id)
          .maybeSingle();

        const addressData = {
          sendcloud_id: address.id,
          company_name: address.company_name || null,
          contact_name: address.contact_name,
          email: address.email,
          telephone: address.telephone || null,
          street: address.street,
          house_number: address.house_number,
          postal_code: address.postal_code,
          city: address.city,
          country: address.country,
          vat_number: address.vat_number || null,
          eori_number: address.eori_number || null,
          is_default: address.is_default || false,
          bank_account_number: address.bank_account_number || null,
          raw_data: address,
        };

        if (existing) {
          // Mise à jour
          const { error } = await supabase
            .from('sendcloud_sender_address')
            .update(addressData)
            .eq('id', existing.id);

          if (error) throw error;
          updatedCount++;
          console.log(`[SendCloud Import Senders] Updated sender address: ${address.company_name || address.contact_name}`);
        } else {
          // Insertion
          const { error } = await supabase
            .from('sendcloud_sender_address')
            .insert(addressData);

          if (error) throw error;
          importedCount++;
          console.log(`[SendCloud Import Senders] Imported sender address: ${address.company_name || address.contact_name}`);
        }
      } catch (error) {
        console.error(`[SendCloud Import Senders] Error processing sender address ${address.id}:`, error);
        errors.push({
          sender_id: address.id,
          sender_name: address.company_name || address.contact_name,
          error: (error as Error).message,
        });
      }
    }

    console.log(`[SendCloud Import Senders] Import completed: ${importedCount} new, ${updatedCount} updated, ${errors.length} errors`);

    return new Response(
      JSON.stringify({
        success: true,
        imported: importedCount,
        updated: updatedCount,
        total: senderAddresses.length,
        errors: errors.length > 0 ? errors : undefined,
        message: `Importation réussie: ${importedCount} nouvelles adresses, ${updatedCount} mises à jour`,
      }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );

  } catch (error) {
    console.error('[SendCloud Import Senders] Fatal error:', error);
    return new Response(
      JSON.stringify({ 
        success: false,
        error: (error as Error).message 
      }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});
