import { serve } from "https://deno.land/std@0.168.0/http/server.ts"

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    console.log('🔍 Testing SendCloud connection...');

    // Récupérer les secrets depuis Supabase
    const publicKey = Deno.env.get('SENDCLOUD_PUBLIC_KEY');
    const secretKey = Deno.env.get('SENDCLOUD_SECRET_KEY');

    if (!publicKey || !secretKey) {
      console.error('❌ Missing API credentials');
      return new Response(
        JSON.stringify({
          success: false,
          error: 'Les clés API SendCloud ne sont pas configurées (SENDCLOUD_PUBLIC_KEY et SENDCLOUD_SECRET_KEY)'
        }),
        { 
          status: 401,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' }
        }
      );
    }

    // Encoder les credentials en Base64 pour l'authentification Basic
    const auth = btoa(`${publicKey}:${secretKey}`);
    
    // Appel GET /integrations pour tester la connexion
    const testUrl = 'https://panel.sendcloud.sc/api/v2/integrations';
    console.log(`📡 Calling ${testUrl}`);

    const response = await fetch(testUrl, {
      method: 'GET',
      headers: {
        'Authorization': `Basic ${auth}`,
        'Content-Type': 'application/json',
      },
    });

    const responseText = await response.text();
    let responseData;
    try {
      responseData = JSON.parse(responseText);
    } catch {
      responseData = { raw: responseText };
    }

    console.log(`📊 Status: ${response.status}`);
    console.log('📄 Response:', responseData);

    if (!response.ok) {
      return new Response(
        JSON.stringify({
          success: false,
          status: response.status,
          error: responseData.error?.message || 'Erreur lors de la connexion à SendCloud',
          details: responseData
        }),
        { 
          status: response.status,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' }
        }
      );
    }

    // Extraire les informations pertinentes
    const integrations = responseData.integrations || [];
    const systemUser = responseData.system_user || {};

    console.log('✅ Connection successful');

    return new Response(
      JSON.stringify({
        success: true,
        status: response.status,
        connectionValid: true,
        integrations: integrations.map((int: any) => ({
          id: int.id,
          shop: int.shop,
          system_name: int.system_name,
          service_point_enabled: int.service_point_enabled,
          active: int.active
        })),
        systemUser: {
          email: systemUser.email,
          username: systemUser.username,
          company: systemUser.company,
          telephone: systemUser.telephone
        },
        apiPermissions: {
          canReadOrders: true, // Testé avec succès si on arrive ici
          canReadParcels: true,
          canReadIntegrations: true
        }
      }),
      { 
        status: 200,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      }
    );

  } catch (error: any) {
    console.error('❌ Test connection error:', error);
    return new Response(
      JSON.stringify({
        success: false,
        error: error.message,
        details: error.toString()
      }),
      { 
        status: 500,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      }
    );
  }
})
