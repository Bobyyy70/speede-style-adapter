import { createClient } from 'npm:@supabase/supabase-js@2';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type, x-mcp-key',
};

interface SqlRequest {
  statements?: string[];
  sql?: string;
}

Deno.serve(async (req) => {
  // Handle CORS preflight requests
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  // Healthcheck GET endpoint
  if (req.method === 'GET') {
    return new Response(
      JSON.stringify({ 
        ok: true, 
        service: 'admin-sql',
        version: '1.0',
        timestamp: new Date().toISOString()
      }),
      { 
        status: 200,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' } 
      }
    );
  }

  try {
    // Vérifier l'authentification JWT
    const authHeader = req.headers.get('Authorization');
    if (!authHeader) {
      return new Response(
        JSON.stringify({ ok: false, error: 'Missing authorization header' }),
        { status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    const supabaseClient = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_ANON_KEY') ?? '',
      { global: { headers: { Authorization: authHeader } } }
    );

    // Vérifier que l'utilisateur est authentifié
    const { data: { user }, error: authError } = await supabaseClient.auth.getUser();
    if (authError || !user) {
      return new Response(
        JSON.stringify({ ok: false, error: 'Unauthorized' }),
        { status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Vérifier que l'utilisateur a le rôle admin
    const { data: userRole, error: roleError } = await supabaseClient
      .from('user_roles')
      .select('role')
      .eq('user_id', user.id)
      .single();

    if (roleError || !userRole || userRole.role !== 'admin') {
      console.error(`[admin-sql] Unauthorized access attempt by user ${user.id}`);
      return new Response(
        JSON.stringify({ ok: false, error: 'Admin role required' }),
        { status: 403, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Log de sécurité
    console.log(`[admin-sql] Admin ${user.email} executing SQL statements`);

    // Initialiser le client avec service role pour les opérations
    const supabaseAdmin = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? ''
    );

    // Parse le body
    const body: SqlRequest = await req.json();
    
    let statements: string[] = [];
    
    // Accepter soit "statements" (array), soit "sql" (string à splitter)
    if (body.statements && Array.isArray(body.statements)) {
      statements = body.statements;
    } else if (body.sql && typeof body.sql === 'string') {
      // Split sur ";" pour permettre plusieurs statements dans une seule string
      statements = body.sql
        .split(';')
        .map(s => s.trim())
        .filter(s => s.length > 0);
    } else {
      return new Response(
        JSON.stringify({ 
          ok: false, 
          error: 'Missing "statements" array or "sql" string in request body' 
        }),
        { 
          status: 400, 
          headers: { ...corsHeaders, 'Content-Type': 'application/json' } 
        }
      );
    }

    if (statements.length === 0) {
      return new Response(
        JSON.stringify({ 
          ok: false, 
          error: 'No SQL statements provided' 
        }),
        { 
          status: 400, 
          headers: { ...corsHeaders, 'Content-Type': 'application/json' } 
        }
      );
    }

    // Limiter à 50 statements par batch pour éviter les runaways
    if (statements.length > 50) {
      return new Response(
        JSON.stringify({ 
          ok: false, 
          error: 'Too many statements in one batch (max 50)' 
        }),
        { 
          status: 400, 
          headers: { ...corsHeaders, 'Content-Type': 'application/json' } 
        }
      );
    }

    // Validation des statements SQL - rejeter les opérations dangereuses
    const dangerousPatterns = [
      /DROP\s+DATABASE/i,
      /DROP\s+SCHEMA/i, 
      /ALTER\s+DATABASE/i,
      /GRANT\s+/i,
      /REVOKE\s+/i,
      /CREATE\s+USER/i,
      /CREATE\s+ROLE/i,
      /DROP\s+USER/i,
      /DROP\s+ROLE/i,
    ];

    for (const stmt of statements) {
      for (const pattern of dangerousPatterns) {
        if (pattern.test(stmt)) {
          console.error(`[admin-sql] Blocked dangerous SQL by ${user.email}: ${stmt.substring(0, 50)}...`);
          return new Response(
            JSON.stringify({ 
              ok: false, 
              error: 'Dangerous SQL operation blocked',
              details: 'DROP DATABASE, GRANT, CREATE USER and similar operations are not allowed'
            }),
            { status: 403, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
          );
        }
      }
    }

    const startTime = Date.now();
    console.log(`[admin-sql] Executing ${statements.length} SQL statement(s) for ${user.email}...`);

    // Appeler la fonction SQL SECURITY DEFINER
    const { data, error } = await supabaseAdmin.rpc('execute_sql_admin', {
      statements
    });

    const duration = Date.now() - startTime;

    if (error) {
      console.error('[admin-sql] Error calling execute_sql_admin:', error);
      return new Response(
        JSON.stringify({ 
          ok: false, 
          error: error.message,
          details: error.details,
          hint: error.hint
        }),
        { 
          status: 500, 
          headers: { ...corsHeaders, 'Content-Type': 'application/json' } 
        }
      );
    }

    console.log(`[admin-sql] ✅ Execution completed in ${duration}ms`);
    console.log(`[admin-sql] Success: ${data.success_count}/${data.total_statements} statements | Errors: ${data.error_count}`);

    return new Response(
      JSON.stringify({
        ...data,
        duration_ms: duration
      }),
      { 
        status: data.ok ? 200 : 400,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' } 
      }
    );

  } catch (error: any) {
    console.error('[admin-sql] Unexpected error:', error);
    const isProd = Deno.env.get('ENVIRONMENT') === 'production';
    
    return new Response(
      JSON.stringify({ 
        ok: false, 
        error: isProd ? 'Internal server error' : error?.message,
        ...(isProd ? {} : { stack: error?.stack })
      }),
      { 
        status: 500, 
        headers: { ...corsHeaders, 'Content-Type': 'application/json' } 
      }
    );
  }
});
