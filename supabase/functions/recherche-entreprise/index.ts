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
      // Rechercher l'entreprise par SIRET complet
      const detailsUrl = `https://recherche-entreprises.api.gouv.fr/search?q=${encodeURIComponent(siret)}&per_page=1`;
      
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
      
      if (!data.results || data.results.length === 0) {
        console.error(`[recherche-entreprise] No results for SIRET: ${siret}`);
        throw new Error(`No company found for SIRET: ${siret}`);
      }

      console.log(`[recherche-entreprise] Details retrieved successfully`);

      const result = data.results[0];
      const siege = result.siege;

      const details: EntrepriseDetails = {
        nom_entreprise: result.nom_complet || result.nom_raison_sociale || '',
        siret: siege?.siret || siret,
        adresse: [
          siege?.numero_voie,
          siege?.type_voie,
          siege?.libelle_voie,
          siege?.code_postal,
          siege?.libelle_commune,
        ]
          .filter(Boolean)
          .join(' ')
          .trim(),
        telephone: siege?.telephone || undefined,
        email: siege?.email || undefined,
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
    const errorMessage = error instanceof Error ? error.message : 'An unknown error occurred';
    return new Response(
      JSON.stringify({ error: errorMessage }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});
