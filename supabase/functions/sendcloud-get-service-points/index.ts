import { createClient } from 'npm:@supabase/supabase-js@2';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

interface ServicePoint {
  id: string;
  code: string;
  name: string;
  street: string;
  house_number: string;
  postal_code: string;
  city: string;
  country: string;
  latitude: string;
  longitude: string;
  phone: string;
  email: string;
  opening_hours: {
    monday?: string;
    tuesday?: string;
    wednesday?: string;
    thursday?: string;
    friday?: string;
    saturday?: string;
    sunday?: string;
  };
  distance?: number;
}

interface ServicePointsRequest {
  shipping_method_id: number;
  country: string;
  postal_code: string;
  carrier?: string;
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const sendcloudPublicKey = Deno.env.get('SENDCLOUD_API_PUBLIC_KEY');
    const sendcloudSecretKey = Deno.env.get('SENDCLOUD_API_SECRET_KEY');

    if (!sendcloudPublicKey || !sendcloudSecretKey) {
      throw new Error('SendCloud API credentials not configured');
    }

    const { shipping_method_id, country, postal_code, carrier }: ServicePointsRequest = await req.json();

    // Validation des paramètres
    if (!shipping_method_id || !country || !postal_code) {
      return new Response(
        JSON.stringify({
          success: false,
          error: 'Missing required parameters: shipping_method_id, country, postal_code',
        }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' }, status: 400 }
      );
    }

    console.log(`📍 Fetching service points for ${postal_code}, ${country} (shipping_method: ${shipping_method_id})`);

    // Authentification SendCloud (Basic Auth)
    const sendcloudAuth = btoa(`${sendcloudPublicKey}:${sendcloudSecretKey}`);

    // Construction de l'URL avec paramètres de requête
    const url = new URL(
      `https://panel.sendcloud.sc/api/v2/shipping_methods/${shipping_method_id}/service_points`
    );
    url.searchParams.append('country', country);
    url.searchParams.append('postal_code', postal_code);

    if (carrier) {
      url.searchParams.append('carrier', carrier);
    }

    console.log(`🔗 SendCloud API URL: ${url.toString()}`);

    // Appel API SendCloud
    const response = await fetch(url.toString(), {
      method: 'GET',
      headers: {
        'Authorization': `Basic ${sendcloudAuth}`,
        'Accept': 'application/json',
        'Content-Type': 'application/json',
      },
    });

    const data = await response.json();

    if (!response.ok) {
      console.error('❌ SendCloud API Error:', data);
      return new Response(
        JSON.stringify({
          success: false,
          error: 'SendCloud API error',
          details: data,
          status: response.status,
        }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' }, status: response.status }
      );
    }

    // Les points de service sont dans data.service_points (ou data selon l'API)
    const servicePoints = data.service_points || data || [];

    console.log(`✅ Found ${servicePoints.length} service points`);

    // Transformation des données au format du composant
    const transformedPoints = servicePoints.map((point: ServicePoint) => ({
      id: point.code || point.id,
      name: point.name,
      address: `${point.house_number} ${point.street}`.trim(),
      city: point.city,
      postal_code: point.postal_code,
      country: point.country,
      latitude: parseFloat(point.latitude),
      longitude: parseFloat(point.longitude),
      phone: point.phone || null,
      email: point.email || null,
      opening_hours: formatOpeningHours(point.opening_hours),
      distance: point.distance,
      raw_data: point, // Conserver les données brutes pour usage futur
    }));

    return new Response(
      JSON.stringify({
        success: true,
        service_points: transformedPoints,
        count: transformedPoints.length,
      }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' }, status: 200 }
    );

  } catch (error) {
    console.error('❌ Error fetching service points:', error);
    return new Response(
      JSON.stringify({
        success: false,
        error: error instanceof Error ? error.message : 'Unknown error',
      }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' }, status: 500 }
    );
  }
});

// Formatter les horaires d'ouverture pour l'affichage
function formatOpeningHours(hours: any): string | null {
  if (!hours || typeof hours !== 'object') return null;

  const days = ['monday', 'tuesday', 'wednesday', 'thursday', 'friday', 'saturday', 'sunday'];
  const frenchDays = ['Lun', 'Mar', 'Mer', 'Jeu', 'Ven', 'Sam', 'Dim'];

  const formatted: string[] = [];

  days.forEach((day, index) => {
    if (hours[day]) {
      formatted.push(`${frenchDays[index]}: ${hours[day]}`);
    }
  });

  return formatted.length > 0 ? formatted.join(', ') : null;
}
