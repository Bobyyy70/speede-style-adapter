-- Fix execute_sql_admin to accept CREATE OR REPLACE FUNCTION and improve reserved schema checks
CREATE OR REPLACE FUNCTION public.execute_sql_admin(statements text[])
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
DECLARE
  v_statement text;
  v_result jsonb := '{"ok": true, "executed": []}'::jsonb;
  v_executed jsonb := '[]'::jsonb;
  v_errors jsonb := '[]'::jsonb;
  v_statement_upper text;
  v_reserved_schemas text[] := ARRAY['auth','storage','realtime','supabase_functions','vault'];
  v_schema_name text;
  v_allowed boolean;
BEGIN
  -- Iterate each provided statement without splitting (caller must send full blocks when needed)
  FOREACH v_statement IN ARRAY statements LOOP
    BEGIN
      -- Normalize for validation
      v_statement_upper := UPPER(LTRIM(v_statement));

      -- Allowlist: CREATE [OR REPLACE] {TABLE|INDEX|VIEW|FUNCTION|TRIGGER|TYPE|SEQUENCE|POLICY}
      --            ALTER   {TABLE|INDEX|VIEW|FUNCTION|TRIGGER|TYPE|SEQUENCE|POLICY}
      --            DROP    {TABLE|INDEX|VIEW|FUNCTION|TRIGGER|TYPE|SEQUENCE|POLICY}
      --            GRANT / REVOKE / COMMENT ON
      v_allowed :=
        v_statement_upper ~ '^(CREATE( OR REPLACE)?\s+(TABLE|INDEX|VIEW|FUNCTION|TRIGGER|TYPE|SEQUENCE|POLICY))'
        OR v_statement_upper ~ '^(ALTER\s+(TABLE|INDEX|VIEW|FUNCTION|TRIGGER|TYPE|SEQUENCE|POLICY))'
        OR v_statement_upper ~ '^(DROP\s+(TABLE|INDEX|VIEW|FUNCTION|TRIGGER|TYPE|SEQUENCE|POLICY))'
        OR v_statement_upper ~ '^GRANT\s+'
        OR v_statement_upper ~ '^REVOKE\s+'
        OR v_statement_upper ~ '^COMMENT\s+ON';

      IF NOT v_allowed THEN
        v_errors := v_errors || jsonb_build_object(
          'statement', v_statement,
          'error', 'Statement type not allowed by whitelist'
        );
        CONTINUE;
      END IF;

      -- Block explicit operations on reserved schemas only when qualified (e.g., AUTH.*)
      FOREACH v_schema_name IN ARRAY v_reserved_schemas LOOP
        IF strpos(v_statement_upper, UPPER(v_schema_name) || '.') > 0 THEN
          v_errors := v_errors || jsonb_build_object(
            'statement', v_statement,
            'error', format('Operations on reserved schema "%s" are not allowed', v_schema_name)
          );
          CONTINUE;
        END IF;
      END LOOP;

      -- Block ALTER DATABASE
      IF v_statement_upper ~ '^ALTER\s+DATABASE' THEN
        v_errors := v_errors || jsonb_build_object(
          'statement', v_statement,
          'error', 'ALTER DATABASE is not allowed'
        );
        CONTINUE;
      END IF;

      -- Execute validated statement
      EXECUTE v_statement;

      v_executed := v_executed || jsonb_build_object(
        'statement', v_statement,
        'status', 'success'
      );

    EXCEPTION WHEN OTHERS THEN
      v_errors := v_errors || jsonb_build_object(
        'statement', v_statement,
        'error', SQLERRM,
        'sqlstate', SQLSTATE
      );
    END;
  END LOOP;

  -- Build result
  v_result := jsonb_build_object(
    'ok', jsonb_array_length(v_errors) = 0,
    'executed', v_executed,
    'errors', v_errors,
    'total_statements', array_length(statements, 1),
    'success_count', jsonb_array_length(v_executed),
    'error_count', jsonb_array_length(v_errors)
  );

  RETURN v_result;
END;
$function$;