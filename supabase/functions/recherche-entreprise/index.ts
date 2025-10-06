import "https://deno.land/x/xhr@0.1.0/mod.ts";
import { serve } from "https://deno.land/std@0.168.0/http/server.ts";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

interface EntrepriseSearchResult {
  nom_complet: string;
  siege: {
    siret: string;
    adresse: string;
    code_postal: string;
    commune: string;
  };
  siren: string;
}

interface EntrepriseDetails {
  nom_entreprise: string;
  siret: string;
  adresse: string;
  telephone?: string;
  email?: string;
}

serve(async (req) => {
  // Handle CORS preflight requests
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const { action, query, siret } = await req.json();

    console.log(`[recherche-entreprise] Action: ${action}, Query: ${query}, SIRET: ${siret}`);

    // Action: Recherche par nom d'entreprise
    if (action === 'search' && query) {
      const searchUrl = `https://recherche-entreprises.api.gouv.fr/search?q=${encodeURIComponent(query)}&per_page=10`;
      
      console.log(`[recherche-entreprise] Calling API: ${searchUrl}`);
      
      const response = await fetch(searchUrl, {
        headers: {
          'Accept': 'application/json',
        },
      });

      if (!response.ok) {
        console.error(`[recherche-entreprise] API error: ${response.status}`);
        throw new Error(`API search error: ${response.statusText}`);
      }

      const data = await response.json();
      console.log(`[recherche-entreprise] Found ${data.results?.length || 0} results`);

      const results = (data.results || []).map((result: EntrepriseSearchResult) => ({
        nom: result.nom_complet,
        siret: result.siege?.siret || result.siren,
        siren: result.siren,
        adresse_simple: `${result.siege?.code_postal || ''} ${result.siege?.commune || ''}`.trim(),
      }));

      return new Response(
        JSON.stringify({ results }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Action: Récupération des détails par SIRET
    if (action === 'details' && siret) {
      // L'API utilise le SIREN (9 premiers chiffres du SIRET)
      const siren = siret.substring(0, 9);
      const detailsUrl = `https://recherche-entreprises.api.gouv.fr/siren/${siren}`;
      
      console.log(`[recherche-entreprise] Fetching details: ${detailsUrl}`);
      
      const response = await fetch(detailsUrl, {
        headers: {
          'Accept': 'application/json',
        },
      });

      if (!response.ok) {
        console.error(`[recherche-entreprise] API details error: ${response.status}`);
        throw new Error(`API details error: ${response.statusText}`);
      }

      const data = await response.json();
      console.log(`[recherche-entreprise] Details retrieved successfully`);

      // Trouver l'établissement correspondant au SIRET demandé
      const etablissement = data.etablissements?.find((e: any) => e.siret === siret) || data.siege;

      const details: EntrepriseDetails = {
        nom_entreprise: data.nom_complet || data.nom_raison_sociale || '',
        siret: etablissement?.siret || siret,
        adresse: [
          etablissement?.numero_voie,
          etablissement?.type_voie,
          etablissement?.libelle_voie,
          etablissement?.code_postal,
          etablissement?.libelle_commune,
        ]
          .filter(Boolean)
          .join(' ')
          .trim(),
        telephone: etablissement?.telephone || undefined,
        email: etablissement?.email || undefined,
      };

      return new Response(
        JSON.stringify({ details }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    console.error(`[recherche-entreprise] Invalid action or missing parameters`);
    return new Response(
      JSON.stringify({ error: 'Invalid action or missing parameters' }),
      { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );

  } catch (error) {
    console.error('[recherche-entreprise] Error:', error);
    return new Response(
      JSON.stringify({ error: error.message }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});
