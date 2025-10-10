-- Backfill client_id on produits: assign all existing products without client_id to HEATZY
DO $$
DECLARE
  v_client_id uuid;
  v_count_before bigint;
  v_count_after bigint;
BEGIN
  -- Find HEATZY client id (case-insensitive, supports prefixes like 'HEATZY ...')
  SELECT id INTO v_client_id
  FROM public.client
  WHERE lower(nom_entreprise) LIKE 'heatzy%'
  ORDER BY date_creation ASC
  LIMIT 1;

  IF v_client_id IS NULL THEN
    RAISE EXCEPTION 'Client HEATZY introuvable: créez d''abord le client puis relancez.';
  END IF;

  -- Count rows to update for logging
  SELECT COUNT(*) INTO v_count_before FROM public.produit WHERE client_id IS NULL;

  -- Perform the update
  UPDATE public.produit
  SET client_id = v_client_id
  WHERE client_id IS NULL;

  -- Optional: verify
  SELECT COUNT(*) INTO v_count_after FROM public.produit WHERE client_id IS NULL;

  RAISE NOTICE 'Produits mis à jour: %; Restants sans client: %', v_count_before, v_count_after;
END $$;