-- Corriger la fonction supprimer_emplacements_zone pour vérifier le stock et logger

-- 1. Supprimer l'ancienne fonction
DROP FUNCTION IF EXISTS public.supprimer_emplacements_zone(text);

-- 2. Créer la nouvelle fonction avec vérification de stock et logging
CREATE OR REPLACE FUNCTION public.supprimer_emplacements_zone(p_zone text DEFAULT NULL)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_count INTEGER;
  v_occupes INTEGER;
  v_emplacement RECORD;
BEGIN
  -- Compter les emplacements occupés (quantite_actuelle > 0)
  IF p_zone IS NULL THEN
    SELECT COUNT(*) INTO v_occupes
    FROM public.emplacement
    WHERE quantite_actuelle > 0;
  ELSE
    SELECT COUNT(*) INTO v_occupes
    FROM public.emplacement
    WHERE zone = p_zone AND quantite_actuelle > 0;
  END IF;

  -- Si des emplacements sont occupés, retourner une erreur
  IF v_occupes > 0 THEN
    RETURN jsonb_build_object(
      'success', false,
      'error', 'Stock présent, suppression bloquée',
      'emplacements_occupes', v_occupes,
      'message', format('%s emplacement(s) contiennent encore du stock et ne peuvent pas être supprimés', v_occupes)
    );
  END IF;

  -- Logger les suppressions dans mouvement_stock avant suppression
  IF p_zone IS NULL THEN
    -- Logger tous les emplacements à supprimer
    FOR v_emplacement IN 
      SELECT id, code_emplacement FROM public.emplacement WHERE quantite_actuelle = 0
    LOOP
      INSERT INTO public.mouvement_stock (
        type_mouvement,
        produit_id,
        quantite,
        remarques,
        raison,
        reference_origine,
        type_origine,
        date_mouvement
      ) VALUES (
        'suppression_emplacement',
        NULL,  -- Pas de produit car emplacement vide
        0,
        format('Suppression emplacement vide: %s', v_emplacement.code_emplacement),
        'Suppression administrative emplacement',
        v_emplacement.id::text,
        'emplacement',
        NOW()
      );
    END LOOP;
  ELSE
    -- Logger les emplacements de la zone à supprimer
    FOR v_emplacement IN 
      SELECT id, code_emplacement FROM public.emplacement WHERE zone = p_zone AND quantite_actuelle = 0
    LOOP
      INSERT INTO public.mouvement_stock (
        type_mouvement,
        produit_id,
        quantite,
        remarques,
        raison,
        reference_origine,
        type_origine,
        date_mouvement
      ) VALUES (
        'suppression_emplacement',
        NULL,
        0,
        format('Suppression emplacement vide zone %s: %s', p_zone, v_emplacement.code_emplacement),
        'Suppression administrative emplacement',
        v_emplacement.id::text,
        'emplacement',
        NOW()
      );
    END LOOP;
  END IF;

  -- Supprimer les emplacements vides (avec WHERE clause obligatoire)
  IF p_zone IS NULL THEN
    DELETE FROM public.emplacement WHERE quantite_actuelle = 0;
    GET DIAGNOSTICS v_count = ROW_COUNT;
  ELSE
    DELETE FROM public.emplacement WHERE zone = p_zone AND quantite_actuelle = 0;
    GET DIAGNOSTICS v_count = ROW_COUNT;
  END IF;

  RETURN jsonb_build_object(
    'success', true,
    'emplacements_supprimes', v_count,
    'message', format('%s emplacement(s) vide(s) supprimé(s) avec succès', v_count)
  );
END;
$$;

COMMENT ON FUNCTION public.supprimer_emplacements_zone IS 
  'Supprime les emplacements vides (quantite_actuelle = 0) d''une zone spécifique ou de toutes les zones. Vérifie le stock avant suppression et logue dans mouvement_stock.';