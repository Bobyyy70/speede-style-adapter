import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.58.0';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type, x-n8n-api-key',
};

interface WorkflowData {
  nom: string;
  description?: string;
  webhook_url: string;
  config_json: any;
  categorie?: string;
  declencheur_auto?: any;
}

Deno.serve(async (req) => {
  // Handle CORS preflight
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const url = new URL(req.url);
    const path = url.pathname.replace('/n8n-gateway', '');
    const method = req.method;

    // Validate API Key
    const apiKey = req.headers.get('X-N8N-API-KEY');
    const N8N_API_KEY = Deno.env.get('N8N_API_KEY');
    
    if (!apiKey || apiKey !== N8N_API_KEY) {
      return new Response(
        JSON.stringify({ error: 'Unauthorized: Invalid or missing X-N8N-API-KEY' }),
        { status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Initialize Supabase client with service role
    const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
    const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
    const supabase = createClient(supabaseUrl, supabaseServiceKey);

    // Log request
    console.log(`[n8n-gateway] ${method} ${path}`);

    // ========== WORKFLOWS MANAGEMENT ==========
    
    // GET /workflows - Liste tous les workflows
    if (path === '/workflows' && method === 'GET') {
      const { data, error } = await supabase
        .from('n8n_workflows')
        .select('*')
        .order('date_creation', { ascending: false });

      if (error) throw error;
      
      return new Response(JSON.stringify({ workflows: data }), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    // POST /workflow - Créer un nouveau workflow
    if (path === '/workflow' && method === 'POST') {
      const body: WorkflowData = await req.json();
      
      const { data, error } = await supabase
        .from('n8n_workflows')
        .insert({
          nom: body.nom,
          description: body.description,
          webhook_url: body.webhook_url,
          config_json: body.config_json,
          categorie: body.categorie,
          declencheur_auto: body.declencheur_auto,
        })
        .select()
        .single();

      if (error) throw error;

      return new Response(JSON.stringify({ workflow: data }), {
        status: 201,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    // PATCH /workflow/:id - Mettre à jour un workflow
    if (path.startsWith('/workflow/') && method === 'PATCH') {
      const id = path.split('/')[2];
      const body = await req.json();

      const { data, error } = await supabase
        .from('n8n_workflows')
        .update(body)
        .eq('id', id)
        .select()
        .single();

      if (error) throw error;

      return new Response(JSON.stringify({ workflow: data }), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    // DELETE /workflow/:id - Supprimer un workflow
    if (path.startsWith('/workflow/') && method === 'DELETE') {
      const id = path.split('/')[2];

      const { error } = await supabase
        .from('n8n_workflows')
        .delete()
        .eq('id', id);

      if (error) throw error;

      return new Response(JSON.stringify({ success: true }), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    // POST /workflow/:id/execute - Déclencher manuellement un workflow
    if (path.match(/\/workflow\/[^\/]+\/execute$/) && method === 'POST') {
      const id = path.split('/')[2];
      const payload = await req.json();

      // Récupérer le workflow
      const { data: workflow, error: fetchError } = await supabase
        .from('n8n_workflows')
        .select('*')
        .eq('id', id)
        .single();

      if (fetchError) throw fetchError;

      // Déclencher le webhook n8n
      const startTime = Date.now();
      try {
        const response = await fetch(workflow.webhook_url, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(payload),
        });

        const responseData = await response.json();
        const duration = Date.now() - startTime;

        // Logger l'exécution
        await supabase.from('n8n_execution_log').insert({
          workflow_id: id,
          payload_envoye: payload,
          reponse_n8n: responseData,
          statut: response.ok ? 'success' : 'error',
          duree_ms: duration,
          declencheur: 'manuel',
        });

        return new Response(JSON.stringify({ 
          success: response.ok,
          response: responseData,
          duration_ms: duration 
        }), {
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        });
      } catch (error: any) {
        const duration = Date.now() - startTime;
        
        // Logger l'erreur
        await supabase.from('n8n_execution_log').insert({
          workflow_id: id,
          payload_envoye: payload,
          reponse_n8n: null,
          statut: 'error',
          duree_ms: duration,
          declencheur: 'manuel',
          error_message: error?.message || 'Unknown error',
        });

        throw error;
      }
    }

    // GET /workflow/:id/logs - Historique d'exécution d'un workflow
    if (path.match(/\/workflow\/[^\/]+\/logs$/) && method === 'GET') {
      const id = path.split('/')[2];
      const limit = parseInt(url.searchParams.get('limit') || '50');

      const { data, error } = await supabase
        .from('n8n_execution_log')
        .select('*')
        .eq('workflow_id', id)
        .order('date_execution', { ascending: false })
        .limit(limit);

      if (error) throw error;

      return new Response(JSON.stringify({ logs: data }), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    // ========== WMS ENDPOINTS (n8n → WMS) ==========

    // GET /commandes - Liste des commandes avec filtres
    if (path === '/commandes' && method === 'GET') {
      const statut = url.searchParams.get('statut');
      const clientId = url.searchParams.get('client');
      const limit = parseInt(url.searchParams.get('limite') || '50');
      const offset = parseInt(url.searchParams.get('offset') || '0');

      let query = supabase
        .from('commande')
        .select('*')
        .order('date_creation', { ascending: false })
        .range(offset, offset + limit - 1);

      if (statut) query = query.eq('statut_wms', statut);
      if (clientId) query = query.eq('client_id', clientId);

      const { data, error } = await query;
      if (error) throw error;

      return new Response(JSON.stringify({ commandes: data }), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    // GET /commande/:id - Détail d'une commande
    if (path.startsWith('/commande/') && method === 'GET') {
      const id = path.split('/')[2];

      const { data, error } = await supabase
        .from('commande')
        .select('*, ligne_commande(*)')
        .eq('id', id)
        .single();

      if (error) throw error;

      return new Response(JSON.stringify({ commande: data }), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    // POST /commande - Créer une commande
    if (path === '/commande' && method === 'POST') {
      const body = await req.json();

      const { data, error } = await supabase
        .from('commande')
        .insert(body)
        .select()
        .single();

      if (error) throw error;

      return new Response(JSON.stringify({ commande: data }), {
        status: 201,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    // PATCH /commande/:id - Mettre à jour une commande
    if (path.startsWith('/commande/') && method === 'PATCH') {
      const id = path.split('/')[2];
      const body = await req.json();

      const { data, error } = await supabase
        .from('commande')
        .update(body)
        .eq('id', id)
        .select()
        .single();

      if (error) throw error;

      return new Response(JSON.stringify({ commande: data }), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    // GET /produits - Liste des produits
    if (path === '/produits' && method === 'GET') {
      const clientId = url.searchParams.get('client');
      const stockBas = url.searchParams.get('stock_bas');
      const limit = parseInt(url.searchParams.get('limite') || '100');

      let query = supabase
        .from('produit')
        .select('*')
        .limit(limit);

      if (clientId) query = query.eq('client_id', clientId);
      if (stockBas === 'true') {
        query = query.or('stock_actuel.lt.stock_minimum');
      }

      const { data, error } = await query;
      if (error) throw error;

      return new Response(JSON.stringify({ produits: data }), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    // GET /produit/:id - Détail d'un produit
    if (path.startsWith('/produit/') && method === 'GET') {
      const id = path.split('/')[2];

      const { data, error } = await supabase
        .from('produit')
        .select('*')
        .eq('id', id)
        .single();

      if (error) throw error;

      return new Response(JSON.stringify({ produit: data }), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    // POST /produit - Créer un produit
    if (path === '/produit' && method === 'POST') {
      const body = await req.json();

      const { data, error } = await supabase
        .from('produit')
        .insert(body)
        .select()
        .single();

      if (error) throw error;

      return new Response(JSON.stringify({ produit: data }), {
        status: 201,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    // PATCH /produit/:id - Mettre à jour un produit
    if (path.startsWith('/produit/') && method === 'PATCH') {
      const id = path.split('/')[2];
      const body = await req.json();

      const { data, error } = await supabase
        .from('produit')
        .update(body)
        .eq('id', id)
        .select()
        .single();

      if (error) throw error;

      return new Response(JSON.stringify({ produit: data }), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    // GET /mouvements - Historique des mouvements
    if (path === '/mouvements' && method === 'GET') {
      const produitId = url.searchParams.get('produit');
      const type = url.searchParams.get('type');
      const limit = parseInt(url.searchParams.get('limite') || '100');

      let query = supabase
        .from('mouvement_stock')
        .select('*')
        .order('date_mouvement', { ascending: false })
        .limit(limit);

      if (produitId) query = query.eq('produit_id', produitId);
      if (type) query = query.eq('type_mouvement', type);

      const { data, error } = await query;
      if (error) throw error;

      return new Response(JSON.stringify({ mouvements: data }), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    // POST /mouvement - Créer un mouvement de stock
    if (path === '/mouvement' && method === 'POST') {
      const body = await req.json();

      const { data, error } = await supabase
        .from('mouvement_stock')
        .insert(body)
        .select()
        .single();

      if (error) throw error;

      return new Response(JSON.stringify({ mouvement: data }), {
        status: 201,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    // GET /retours - Liste des retours
    if (path === '/retours' && method === 'GET') {
      const clientId = url.searchParams.get('client');
      const statut = url.searchParams.get('statut');
      const limit = parseInt(url.searchParams.get('limite') || '50');

      let query = supabase
        .from('retour_produit')
        .select('*, ligne_retour_produit(*)')
        .order('date_creation', { ascending: false })
        .limit(limit);

      if (clientId) query = query.eq('client_id', clientId);
      if (statut) query = query.eq('statut_retour', statut);

      const { data, error } = await query;
      if (error) throw error;

      return new Response(JSON.stringify({ retours: data }), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    // POST /retour - Créer un retour
    if (path === '/retour' && method === 'POST') {
      const body = await req.json();

      const { data, error } = await supabase
        .from('retour_produit')
        .insert(body)
        .select()
        .single();

      if (error) throw error;

      return new Response(JSON.stringify({ retour: data }), {
        status: 201,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    // GET /emplacements - Liste des emplacements
    if (path === '/emplacements' && method === 'GET') {
      const zone = url.searchParams.get('zone');
      const type = url.searchParams.get('type');
      const disponible = url.searchParams.get('disponible');

      let query = supabase.from('emplacement').select('*');

      if (zone) query = query.eq('zone', zone);
      if (type) query = query.eq('type_emplacement', type);
      if (disponible === 'true') query = query.eq('statut_actuel', 'disponible');

      const { data, error } = await query;
      if (error) throw error;

      return new Response(JSON.stringify({ emplacements: data }), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    // PATCH /emplacement/:id - Mettre à jour un emplacement
    if (path.startsWith('/emplacement/') && method === 'PATCH') {
      const id = path.split('/')[2];
      const body = await req.json();

      const { data, error } = await supabase
        .from('emplacement')
        .update(body)
        .eq('id', id)
        .select()
        .single();

      if (error) throw error;

      return new Response(JSON.stringify({ emplacement: data }), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    // GET /sessions - Liste des sessions de préparation
    if (path === '/sessions' && method === 'GET') {
      const statut = url.searchParams.get('statut');

      let query = supabase
        .from('session_preparation')
        .select('*')
        .order('date_creation', { ascending: false });

      if (statut) query = query.eq('statut', statut);

      const { data, error } = await query;
      if (error) throw error;

      return new Response(JSON.stringify({ sessions: data }), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    // POST /session - Créer une session
    if (path === '/session' && method === 'POST') {
      const body = await req.json();

      const { data, error } = await supabase
        .from('session_preparation')
        .insert(body)
        .select()
        .single();

      if (error) throw error;

      return new Response(JSON.stringify({ session: data }), {
        status: 201,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    // Route non trouvée
    return new Response(
      JSON.stringify({ error: 'Route not found', path, method }),
      { status: 404, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );

  } catch (error: any) {
    console.error('[n8n-gateway] Error:', error);
    return new Response(
      JSON.stringify({ error: error?.message || 'Internal server error' }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});