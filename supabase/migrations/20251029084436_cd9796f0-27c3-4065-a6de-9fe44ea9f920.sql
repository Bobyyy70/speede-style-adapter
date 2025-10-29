-- Fix search_path security warning on process_commande_services
CREATE OR REPLACE FUNCTION public.process_commande_services(
  p_commande_id uuid,
  p_services jsonb
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $func$
DECLARE
  v_service jsonb;
  v_result jsonb := '{"created":0,"errors":[]}'::jsonb;
BEGIN
  FOR v_service IN SELECT * FROM jsonb_array_elements(p_services)
  LOOP
    BEGIN
      INSERT INTO ligne_service_commande (
        commande_id, 
        service_id, 
        quantite, 
        prix_unitaire, 
        prix_total,
        genere_automatiquement, 
        remarques, 
        date_creation
      ) VALUES (
        p_commande_id,
        (v_service->>'service_id')::uuid,
        (v_service->>'quantite')::integer,
        (v_service->>'prix_unitaire')::numeric,
        (v_service->>'prix_total')::numeric,
        COALESCE((v_service->>'genere_automatiquement')::boolean, false),
        v_service->>'remarques',
        NOW()
      );
      v_result := jsonb_set(v_result, '{created}', to_jsonb((v_result->>'created')::integer + 1));
    EXCEPTION WHEN OTHERS THEN
      v_result := jsonb_set(v_result, '{errors}', (v_result->'errors') || jsonb_build_object('service_id', v_service->>'service_id', 'error', SQLERRM));
    END;
  END LOOP;
  RETURN v_result;
END;
$func$;