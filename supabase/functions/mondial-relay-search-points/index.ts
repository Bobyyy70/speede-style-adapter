import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.39.3';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

interface SearchRequest {
  postal_code: string;
  country_code?: string;
  max_results?: number;
}

interface MondialRelayPoint {
  Num: string;
  LgAdr1: string;
  LgAdr2?: string;
  CP: string;
  Ville: string;
  Pays: string;
  Latitude: string;
  Longitude: string;
  Tél: string;
  Horaires_Lundi?: string;
  Horaires_Mardi?: string;
  Horaires_Mercredi?: string;
  Horaires_Jeudi?: string;
  Horaires_Vendredi?: string;
  Horaires_Samedi?: string;
  Horaires_Dimanche?: string;
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const { postal_code, country_code = 'FR', max_results = 10 } = await req.json() as SearchRequest;

    console.log('🔍 Recherche points relais Mondial Relay:', { postal_code, country_code });

    const mondialRelayApiKey = Deno.env.get('MONDIAL_RELAY_API_KEY');
    
    if (!mondialRelayApiKey) {
      // Mode démo sans clé API
      console.log('⚠️ Pas de clé API Mondial Relay - Mode démo');
      
      const mockPoints = generateMockPoints(postal_code, country_code, max_results);
      
      return new Response(
        JSON.stringify({
          success: true,
          points: mockPoints,
          count: mockPoints.length,
          demo_mode: true,
        }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' }, status: 200 }
      );
    }

    // Appel réel à l'API Mondial Relay
    // Format d'appel selon leur documentation SOAP/REST
    const mondialRelayUrl = 'https://api.mondialrelay.com/Web_Services.asmx/WSI3_PointRelais_Recherche';
    
    const params = new URLSearchParams({
      Enseigne: mondialRelayApiKey.split(':')[0] || mondialRelayApiKey,
      CP: postal_code,
      Pays: country_code,
      NbResultats: max_results.toString(),
      Action: 'REC',
      DelaiEnvoi: '0',
      RayonRecherche: '20', // 20km
    });

    const response = await fetch(`${mondialRelayUrl}?${params.toString()}`, {
      method: 'GET',
      headers: {
        'Accept': 'application/json',
      },
    });

    if (!response.ok) {
      console.error('❌ Erreur API Mondial Relay:', response.status);
      // Fallback sur données démo en cas d'erreur
      const mockPoints = generateMockPoints(postal_code, country_code, max_results);
      return new Response(
        JSON.stringify({
          success: true,
          points: mockPoints,
          count: mockPoints.length,
          demo_mode: true,
          api_error: true,
        }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' }, status: 200 }
      );
    }

    const data = await response.json();
    
    // Parser les points relais depuis la réponse Mondial Relay
    const points = parseMondalRelayPoints(data.PointsRelais || []);
    
    console.log(`✅ ${points.length} points relais trouvés`);

    return new Response(
      JSON.stringify({
        success: true,
        points,
        count: points.length,
        demo_mode: false,
      }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' }, status: 200 }
    );

  } catch (error) {
    console.error('❌ Erreur:', error);
    
    // En cas d'erreur, retourner des données démo
    const { postal_code = '75001', country_code = 'FR', max_results = 10 } = await req.json().catch(() => ({}));
    const mockPoints = generateMockPoints(postal_code, country_code, max_results);
    
    return new Response(
      JSON.stringify({
        success: true,
        points: mockPoints,
        count: mockPoints.length,
        demo_mode: true,
        error: error instanceof Error ? error.message : 'Unknown error',
      }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' }, status: 200 }
    );
  }
});

function parseMondalRelayPoints(apiPoints: MondialRelayPoint[]): any[] {
  return apiPoints.map(point => {
    const opening_hours = [];
    if (point.Horaires_Lundi) opening_hours.push(`Lun: ${point.Horaires_Lundi}`);
    if (point.Horaires_Mardi) opening_hours.push(`Mar: ${point.Horaires_Mardi}`);
    if (point.Horaires_Mercredi) opening_hours.push(`Mer: ${point.Horaires_Mercredi}`);
    if (point.Horaires_Jeudi) opening_hours.push(`Jeu: ${point.Horaires_Jeudi}`);
    if (point.Horaires_Vendredi) opening_hours.push(`Ven: ${point.Horaires_Vendredi}`);
    if (point.Horaires_Samedi) opening_hours.push(`Sam: ${point.Horaires_Samedi}`);
    
    return {
      id: `MR_${point.Num}`,
      service_point_id: point.Num,
      name: `Mondial Relay - ${point.LgAdr1}`,
      address: `${point.LgAdr1}${point.LgAdr2 ? ' ' + point.LgAdr2 : ''}`,
      city: point.Ville,
      postal_code: point.CP,
      country: point.Pays,
      latitude: parseFloat(point.Latitude.replace(',', '.')),
      longitude: parseFloat(point.Longitude.replace(',', '.')),
      phone: point.Tél,
      opening_hours: opening_hours.join(', '),
      distance: null, // Calculé par le client si nécessaire
    };
  });
}

function generateMockPoints(postal_code: string, country_code: string, max_results: number): any[] {
  const baseNames = [
    'Mondial Relay - Tabac Presse',
    'Mondial Relay - Supermarché',
    'Mondial Relay - Commerce de proximité',
    'Mondial Relay - Station service',
    'Mondial Relay - Point relais',
  ];

  // Coordonnées approximatives selon le code postal
  let baseLat = 48.8566; // Paris par défaut
  let baseLng = 2.3522;

  if (postal_code.startsWith('13')) { // Marseille
    baseLat = 43.2965;
    baseLng = 5.3698;
  } else if (postal_code.startsWith('69')) { // Lyon
    baseLat = 45.7640;
    baseLng = 4.8357;
  } else if (postal_code.startsWith('31')) { // Toulouse
    baseLat = 43.6047;
    baseLng = 1.4442;
  } else if (postal_code.startsWith('33')) { // Bordeaux
    baseLat = 44.8378;
    baseLng = -0.5792;
  }

  const points = [];
  for (let i = 0; i < Math.min(max_results, 10); i++) {
    points.push({
      id: `relay_demo_${i + 1}`,
      service_point_id: `MR${postal_code}${String(i + 1).padStart(3, '0')}`,
      name: baseNames[i % baseNames.length],
      address: `${100 + i * 50} Rue ${['de la République', 'Victor Hugo', 'Jean Jaurès', 'du Commerce', 'des Fleurs'][i % 5]}`,
      city: `Ville ${postal_code}`,
      postal_code,
      country: country_code,
      latitude: baseLat + (Math.random() * 0.02 - 0.01),
      longitude: baseLng + (Math.random() * 0.02 - 0.01),
      phone: `0${Math.floor(Math.random() * 9) + 1} ${Math.floor(Math.random() * 90) + 10} ${Math.floor(Math.random() * 90) + 10} ${Math.floor(Math.random() * 90) + 10} ${Math.floor(Math.random() * 90) + 10}`,
      opening_hours: 'Lun-Ven: 9h-18h, Sam: 9h-12h',
      distance: Math.round(Math.random() * 5 * 100) / 100,
    });
  }

  return points;
}
