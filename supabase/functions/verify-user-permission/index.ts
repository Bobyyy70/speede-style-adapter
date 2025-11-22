import { createClient } from 'npm:@supabase/supabase-js@2';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const authHeader = req.headers.get('Authorization');
    if (!authHeader) {
      return new Response(
        JSON.stringify({ error: 'Missing authorization header', allowed: false }),
        { status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    const supabaseClient = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_ANON_KEY') ?? '',
      { global: { headers: { Authorization: authHeader } } }
    );

    const { data: { user }, error: authError } = await supabaseClient.auth.getUser();
    if (authError || !user) {
      console.error('[verify-permission] Auth error:', authError);
      return new Response(
        JSON.stringify({ error: 'Unauthorized', allowed: false }),
        { status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    const { required_role, resource_type, resource_id } = await req.json();

    // Get user role from database
    const { data: userRole, error: roleError } = await supabaseClient.rpc('get_user_role', {
      user_id: user.id
    });

    if (roleError) {
      console.error('[verify-permission] Role fetch error:', roleError);
      return new Response(
        JSON.stringify({ error: 'Failed to fetch role', allowed: false }),
        { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Check if user has required role
    let allowed = false;
    
    if (required_role === 'admin') {
      allowed = userRole === 'admin';
    } else if (required_role === 'gestionnaire') {
      allowed = userRole === 'admin' || userRole === 'gestionnaire';
    } else if (required_role === 'operateur') {
      allowed = userRole === 'admin' || userRole === 'gestionnaire' || userRole === 'operateur';
    } else if (required_role === 'client') {
      // For client access, verify client_id matches
      if (resource_type === 'client' && resource_id) {
        const { data: profile } = await supabaseClient
          .from('profiles')
          .select('client_id')
          .eq('id', user.id)
          .single();
        
        allowed = userRole === 'admin' || 
                  userRole === 'gestionnaire' || 
                  (userRole === 'client' && profile?.client_id === resource_id);
      } else {
        allowed = userRole === 'client' || userRole === 'admin' || userRole === 'gestionnaire';
      }
    }

    console.log(`[verify-permission] User ${user.id} (role: ${userRole}) - Permission ${required_role}: ${allowed ? 'GRANTED' : 'DENIED'}`);

    return new Response(
      JSON.stringify({ 
        allowed, 
        user_role: userRole,
        user_id: user.id
      }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );

  } catch (error: any) {
    console.error('[verify-permission] Error:', error);
    return new Response(
      JSON.stringify({ error: error.message, allowed: false }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});
