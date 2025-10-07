CREATE OR REPLACE FUNCTION public.generate_numero_mouvement()
 RETURNS trigger
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
BEGIN
  IF NEW.numero_mouvement IS NULL OR NEW.numero_mouvement = '' THEN
    NEW.numero_mouvement := 'MVT-' || TO_CHAR(now(), 'YYYYMMDD') || '-' || LPAD(nextval('mouvement_stock_seq')::TEXT, 6, '0');
  END IF;
  RETURN NEW;
END;
$function$;