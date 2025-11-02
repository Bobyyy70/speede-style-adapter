-- Corriger la fonction supprimer_emplacements_zone pour éviter l'erreur DELETE sans WHERE
CREATE OR REPLACE FUNCTION public.supprimer_emplacements_zone(
  p_zone TEXT DEFAULT NULL
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_count INTEGER;
  v_occupes INTEGER;
BEGIN
  -- Compter les emplacements occupés
  IF p_zone IS NULL THEN
    SELECT COUNT(*) INTO v_occupes
    FROM public.emplacement
    WHERE quantite_actuelle > 0 OR statut_actuel = 'occupé';
  ELSE
    SELECT COUNT(*) INTO v_occupes
    FROM public.emplacement
    WHERE (quantite_actuelle > 0 OR statut_actuel = 'occupé')
    AND zone = p_zone;
  END IF;

  -- Si des emplacements sont occupés, retourner une erreur
  IF v_occupes > 0 THEN
    RETURN jsonb_build_object(
      'success', false,
      'error', format('%s emplacements contiennent encore du stock', v_occupes),
      'emplacements_occupes', v_occupes
    );
  END IF;

  -- Supprimer les emplacements (toujours avec une clause WHERE)
  IF p_zone IS NULL THEN
    DELETE FROM public.emplacement WHERE id IS NOT NULL;
    GET DIAGNOSTICS v_count = ROW_COUNT;
  ELSE
    DELETE FROM public.emplacement WHERE zone = p_zone;
    GET DIAGNOSTICS v_count = ROW_COUNT;
  END IF;

  RETURN jsonb_build_object(
    'success', true,
    'emplacements_supprimes', v_count
  );
END;
$$;