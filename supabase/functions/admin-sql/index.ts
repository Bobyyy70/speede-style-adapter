import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.58.0';

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
    // Vérifier la clé MCP dans le header
    const mcpKey = req.headers.get('x-mcp-key');
    const expectedKey = Deno.env.get('MCP_API_KEY');

    if (!mcpKey || !expectedKey) {
      console.error('[admin-sql] Missing MCP_API_KEY configuration or header');
      return new Response(
        JSON.stringify({ 
          ok: false, 
          error: 'Missing authentication key' 
        }),
        { 
          status: 401, 
          headers: { ...corsHeaders, 'Content-Type': 'application/json' } 
        }
      );
    }

    if (mcpKey !== expectedKey) {
      console.error('[admin-sql] Invalid MCP_API_KEY provided');
      return new Response(
        JSON.stringify({ 
          ok: false, 
          error: 'Invalid authentication key' 
        }),
        { 
          status: 403, 
          headers: { ...corsHeaders, 'Content-Type': 'application/json' } 
        }
      );
    }

    // Initialiser le client Supabase avec service role
    const supabaseClient = createClient(
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

    const startTime = Date.now();
    console.log(`[admin-sql] Executing ${statements.length} SQL statement(s)...`);

    // Appeler la fonction SQL SECURITY DEFINER
    const { data, error } = await supabaseClient.rpc('execute_sql_admin', {
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
    return new Response(
      JSON.stringify({ 
        ok: false, 
        error: error?.message || 'Internal server error' 
      }),
      { 
        status: 500, 
        headers: { ...corsHeaders, 'Content-Type': 'application/json' } 
      }
    );
  }
});
