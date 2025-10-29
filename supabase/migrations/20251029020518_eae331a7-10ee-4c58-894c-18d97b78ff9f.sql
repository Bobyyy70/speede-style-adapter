-- Fonction SECURITY DEFINER pour exécuter du SQL admin avec whitelist
CREATE OR REPLACE FUNCTION public.execute_sql_admin(statements text[])
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_statement text;
  v_result jsonb := '{"ok": true, "executed": []}'::jsonb;
  v_executed jsonb := '[]'::jsonb;
  v_errors jsonb := '[]'::jsonb;
  v_statement_upper text;
  v_reserved_schemas text[] := ARRAY['auth', 'storage', 'realtime', 'supabase_functions', 'vault'];
  v_schema_name text;
BEGIN
  -- Vérifier que l'utilisateur est authentifié (optionnel mais recommandé)
  IF auth.uid() IS NULL THEN
    RETURN jsonb_build_object(
      'ok', false,
      'error', 'Authentication required'
    );
  END IF;

  -- Boucler sur chaque statement
  FOREACH v_statement IN ARRAY statements
  LOOP
    BEGIN
      -- Normaliser le statement (trim + upper pour validation)
      v_statement_upper := UPPER(TRIM(v_statement));
      
      -- Whitelist: autoriser uniquement certaines opérations DDL
      IF v_statement_upper !~ '^(CREATE|ALTER|DROP)\s+(TABLE|INDEX|VIEW|FUNCTION|TRIGGER|TYPE|SEQUENCE|POLICY)' AND
         v_statement_upper !~ '^GRANT\s+' AND
         v_statement_upper !~ '^REVOKE\s+' AND
         v_statement_upper !~ '^COMMENT\s+ON' THEN
        v_errors := v_errors || jsonb_build_object(
          'statement', v_statement,
          'error', 'Statement type not allowed. Only CREATE/ALTER/DROP TABLE/INDEX/VIEW/FUNCTION/TRIGGER/TYPE/SEQUENCE/POLICY, GRANT, REVOKE, COMMENT allowed.'
        );
        CONTINUE;
      END IF;

      -- Bloquer les opérations sur les schémas réservés
      FOREACH v_schema_name IN ARRAY v_reserved_schemas
      LOOP
        IF v_statement_upper LIKE '%' || UPPER(v_schema_name) || '.%' OR
           v_statement_upper LIKE '%' || UPPER(v_schema_name) || '%' THEN
          v_errors := v_errors || jsonb_build_object(
            'statement', v_statement,
            'error', format('Operations on reserved schema "%s" are not allowed', v_schema_name)
          );
          CONTINUE;
        END IF;
      END LOOP;

      -- Bloquer ALTER DATABASE
      IF v_statement_upper LIKE 'ALTER DATABASE%' THEN
        v_errors := v_errors || jsonb_build_object(
          'statement', v_statement,
          'error', 'ALTER DATABASE is not allowed'
        );
        CONTINUE;
      END IF;

      -- Exécuter le statement si validé
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

  -- Construire le résultat
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
$$;