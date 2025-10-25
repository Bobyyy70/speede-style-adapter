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

    // Initialize Supabase client with service account authentication
    const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
    const supabaseAnonKey = Deno.env.get('SUPABASE_ANON_KEY')!;
    const serviceEmail = Deno.env.get('N8N_SERVICE_EMAIL')!;
    const servicePassword = Deno.env.get('N8N_SERVICE_PASSWORD')!;
    
    // Create client with anon key
    const supabase = createClient(supabaseUrl, supabaseAnonKey);
    
    // Authenticate with service account (gestionnaire role)
    const { data: authData, error: authError } = await supabase.auth.signInWithPassword({
      email: serviceEmail,
      password: servicePassword,
    });

    if (authError || !authData?.session) {
      console.error('[n8n-gateway] Service account auth failed:', authError);
      return new Response(
        JSON.stringify({ error: 'Service account authentication failed' }),
        { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    console.log('[n8n-gateway] Service account authenticated:', serviceEmail);

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

    // ========== CHATBOT IA ENDPOINTS ==========

    // POST /ia/chat - Envoyer un message au chatbot IA
    if (path === '/ia/chat' && method === 'POST') {
      const body = await req.json();
      const { message, session_id, contexte_wms } = body;

      // Récupérer l'userId depuis le token JWT
      const authHeader = req.headers.get('Authorization');
      const token = authHeader?.replace('Bearer ', '');
      const { data: { user }, error: userError } = await supabase.auth.getUser(token);

      if (userError || !user) {
        return new Response(JSON.stringify({ error: 'Unauthorized' }), {
          status: 401,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        });
      }

      // Vérifier que l'utilisateur est admin ou gestionnaire
      const { data: userRole } = await supabase
        .from('user_roles')
        .select('role')
        .eq('user_id', user.id)
        .single();

      if (!userRole || !['admin', 'gestionnaire'].includes(userRole.role)) {
        return new Response(JSON.stringify({ error: 'Forbidden: Admins/Gestionnaires only' }), {
          status: 403,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        });
      }

      // Vérifier que l'utilisateur n'est PAS bloqué
      const { data: blocage } = await supabase
        .from('ia_user_blocked')
        .select('*')
        .eq('user_id', user.id)
        .eq('actif', true)
        .single();

      if (blocage) {
        return new Response(JSON.stringify({
          error: 'Accès bloqué',
          raison: blocage.raison,
          contact_admin: true
        }), {
          status: 403,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        });
      }

      // Vérifier les quotas (gratuit vs payant)
      let { data: quota } = await supabase
        .from('ia_usage_quotas')
        .select('*')
        .eq('user_id', user.id)
        .single();

      // Créer quota si inexistant
      if (!quota) {
        const { data: newQuota } = await supabase
          .from('ia_usage_quotas')
          .insert({ user_id: user.id })
          .select()
          .single();
        quota = newQuota;
      }

      // Reset mensuel si nécessaire
      if (quota && new Date(quota.reset_date) < new Date()) {
        await supabase
          .from('ia_usage_quotas')
          .update({
            messages_gratuits_restants: 50,
            reset_date: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000).toISOString()
          })
          .eq('user_id', user.id);
        quota.messages_gratuits_restants = 50;
      }

      // Vérifier si l'utilisateur a dépassé son quota
      const mode_gratuit = quota && quota.messages_gratuits_restants > 0;
      const mode_paye = quota && quota.messages_payes_restants > 0;

      if (!mode_gratuit && !mode_paye) {
        return new Response(JSON.stringify({
          error: 'Quota épuisé',
          messages_restants: 0,
          upgrade_required: true,
          message: 'Vous avez épuisé vos messages gratuits. Passez à un forfait payant pour continuer.'
        }), {
          status: 402,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        });
      }

      // Sauvegarder le message utilisateur
      await supabase.from('ia_conversation').insert({
        user_id: user.id,
        session_id,
        role: 'user',
        message,
        contexte_wms,
      });

      // Appeler l'orchestrateur n8n/Flowise
      const ORCHESTRATOR_WEBHOOK = Deno.env.get('ORCHESTRATOR_WEBHOOK_URL');

      if (!ORCHESTRATOR_WEBHOOK) {
        // Réponse par défaut si pas encore configuré
        const defaultResponse = "🤖 Chatbot en configuration. L'administrateur doit configurer le webhook orchestrateur.";

        await supabase.from('ia_conversation').insert({
          user_id: user.id,
          session_id,
          role: 'assistant',
          message: defaultResponse,
        });

        return new Response(JSON.stringify({
          response: defaultResponse,
          configured: false,
          mode_gratuit,
          messages_restants: mode_gratuit ? quota.messages_gratuits_restants : quota.messages_payes_restants
        }), {
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        });
      }

      // Appeler l'orchestrateur
      try {
        const orchestratorResponse = await fetch(ORCHESTRATOR_WEBHOOK, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'X-N8N-API-KEY': N8N_API_KEY,
          },
          body: JSON.stringify({
            message,
            session_id,
            user_id: user.id,
            contexte_wms,
            mode_gratuit,
          }),
        });

        const responseData = await orchestratorResponse.json();
        const assistantMessage = responseData.message || responseData.response || "Erreur de réponse";
        const tokens_utilises = responseData.tokens_utilises || 0;
        const cout_estimation = mode_gratuit ? 0 : (tokens_utilises * 0.0001);

        // Sauvegarder la réponse
        await supabase.from('ia_conversation').insert({
          user_id: user.id,
          session_id,
          role: 'assistant',
          message: assistantMessage,
          workflow_genere_id: responseData.workflow_id || null,
          tokens_utilises,
          cout_estimation,
        });

        // Décrémenter le quota
        if (mode_gratuit) {
          await supabase
            .from('ia_usage_quotas')
            .update({
              messages_gratuits_restants: quota.messages_gratuits_restants - 1,
              derniere_utilisation: new Date().toISOString()
            })
            .eq('user_id', user.id);
        } else {
          await supabase
            .from('ia_usage_quotas')
            .update({
              messages_payes_restants: quota.messages_payes_restants - 1,
              derniere_utilisation: new Date().toISOString()
            })
            .eq('user_id', user.id);
        }

        return new Response(JSON.stringify({
          response: assistantMessage,
          workflow_created: !!responseData.workflow_id,
          configured: true,
          mode_gratuit,
          messages_restants: mode_gratuit
            ? quota.messages_gratuits_restants - 1
            : quota.messages_payes_restants - 1,
          tokens_utilises,
          cout_estimation
        }), {
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        });

      } catch (error: any) {
        console.error('Error calling orchestrator:', error);

        const errorMessage = "Désolé, je rencontre un problème technique. Veuillez réessayer.";
        await supabase.from('ia_conversation').insert({
          user_id: user.id,
          session_id,
          role: 'assistant',
          message: errorMessage,
        });

        return new Response(JSON.stringify({
          response: errorMessage,
          error: error.message
        }), {
          status: 500,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        });
      }
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