import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.39.3";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
    const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
    
    const supabaseAdmin = createClient(supabaseUrl, supabaseServiceKey, {
      auth: {
        autoRefreshToken: false,
        persistSession: false
      }
    });

    console.log('[N8N Setup] Creating service account...');

    const email = 'f.almanzo@speedelog.net';
    const password = 'N8nService2025!SecureP@ssw0rd'; // Temporaire - à changer après première connexion
    const nomComplet = 'N8N Service Account';

    // 1. Créer l'utilisateur dans auth.users
    const { data: authData, error: authError } = await supabaseAdmin.auth.admin.createUser({
      email: email,
      password: password,
      email_confirm: true, // Auto-confirmer l'email
      user_metadata: {
        nom_complet: nomComplet
      }
    });

    if (authError) {
      console.error('[N8N Setup] Auth error:', authError);
      throw authError;
    }

    console.log('[N8N Setup] ✅ User created in auth.users:', authData.user.id);

    // 2. Créer le profil (sans client_id)
    const { error: profileError } = await supabaseAdmin
      .from('profiles')
      .insert({
        id: authData.user.id,
        email: email,
        nom_complet: nomComplet,
        client_id: null, // Pas de client associé
        tabs_access: [
          'tableau-de-bord',
          'commandes',
          'produits',
          'emplacements',
          'mouvements',
          'preparation',
          'reception',
          'retours',
          'expedition',
          'workflows',
          'connecteurs'
        ]
      });

    if (profileError) {
      console.error('[N8N Setup] Profile error:', profileError);
      throw profileError;
    }

    console.log('[N8N Setup] ✅ Profile created');

    // 3. Assigner le rôle gestionnaire
    const { error: roleError } = await supabaseAdmin
      .from('user_roles')
      .insert({
        user_id: authData.user.id,
        role: 'gestionnaire'
      });

    if (roleError) {
      console.error('[N8N Setup] Role error:', roleError);
      throw roleError;
    }

    console.log('[N8N Setup] ✅ Role "gestionnaire" assigned');

    // 4. Générer un JWT long-lived pour n8n
    const { data: sessionData, error: sessionError } = await supabaseAdmin.auth.admin.generateLink({
      type: 'magiclink',
      email: email
    });

    if (sessionError) {
      console.error('[N8N Setup] Session error:', sessionError);
    }

    console.log('[N8N Setup] ✅✅✅ Setup completed successfully!');

    return new Response(
      JSON.stringify({
        success: true,
        message: '✅ Compte service n8n créé avec succès',
        details: {
          user_id: authData.user.id,
          email: email,
          role: 'gestionnaire',
          client_id: null,
          temporary_password: password,
          note: '⚠️ Changez ce mot de passe après la première connexion'
        },
        next_steps: [
          '1. Connectez-vous avec ce compte pour générer un JWT',
          '2. Utilisez supabase.auth.signInWithPassword()',
          '3. Récupérez le access_token de la session',
          '4. Ajoutez-le comme secret N8N_JWT_TOKEN',
          '5. Modifiez n8n-gateway pour utiliser ce JWT'
        ]
      }),
      { 
        status: 200, 
        headers: { ...corsHeaders, 'Content-Type': 'application/json' } 
      }
    );

  } catch (error: any) {
    console.error('[N8N Setup] Fatal error:', error);
    return new Response(
      JSON.stringify({
        success: false,
        error: error.message,
        details: error
      }),
      { 
        status: 500, 
        headers: { ...corsHeaders, 'Content-Type': 'application/json' } 
      }
    );
  }
});
