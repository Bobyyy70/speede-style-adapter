-- =====================================================
-- RPC Function: forcer_transporteur_commande
-- Description: Force a specific carrier for a command (manual override)
-- Date: 2025-11-18
-- =====================================================

CREATE OR REPLACE FUNCTION forcer_transporteur_commande(
  p_commande_id UUID,
  p_transporteur_code TEXT,
  p_transporteur_nom TEXT,
  p_raison TEXT
)
RETURNS TABLE(
  success BOOLEAN,
  message TEXT,
  decision_id UUID
)
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  v_decision_id UUID;
  v_commande_numero TEXT;
BEGIN
  -- Get command number for logging
  SELECT numero_commande INTO v_commande_numero
  FROM commande
  WHERE id = p_commande_id;

  IF NOT FOUND THEN
    RETURN QUERY SELECT
      FALSE,
      'Commande introuvable'::TEXT,
      NULL::UUID;
    RETURN;
  END IF;

  -- Update command with forced carrier
  UPDATE commande
  SET
    transporteur_code = p_transporteur_code,
    transporteur_nom = p_transporteur_nom,
    date_modification = NOW()
  WHERE id = p_commande_id;

  -- Create decision record (manual/forced)
  INSERT INTO decision_transporteur (
    commande_id,
    transporteur_selectionne_code,
    transporteur_selectionne_nom,
    mode_decision,
    score_final,
    raison_selection,
    metadata,
    date_decision
  )
  VALUES (
    p_commande_id,
    p_transporteur_code,
    p_transporteur_nom,
    'manuel',  -- Mode forcé = manuel
    100.0,     -- Score maximal pour forçage manuel
    p_raison,
    jsonb_build_object(
      'force_manuel', true,
      'date_forcage', NOW(),
      'raison', p_raison
    ),
    NOW()
  )
  RETURNING id INTO v_decision_id;

  RAISE NOTICE 'Transporteur forcé pour commande %: % (%)', v_commande_numero, p_transporteur_nom, p_transporteur_code;

  RETURN QUERY SELECT
    TRUE,
    format('Transporteur %s forcé avec succès pour la commande %s', p_transporteur_nom, v_commande_numero)::TEXT,
    v_decision_id;

EXCEPTION
  WHEN OTHERS THEN
    RAISE NOTICE 'Error in forcer_transporteur_commande: %', SQLERRM;
    RETURN QUERY SELECT
      FALSE,
      ('Erreur: ' || SQLERRM)::TEXT,
      NULL::UUID;
END;
$$;

-- Grant execute permission to authenticated users with proper roles
GRANT EXECUTE ON FUNCTION forcer_transporteur_commande(UUID, TEXT, TEXT, TEXT) TO authenticated;

-- Add comment
COMMENT ON FUNCTION forcer_transporteur_commande IS 'Force a specific carrier for a command (manual override). Creates decision record with mode=manuel.';

-- =====================================================
-- Verification
-- =====================================================

DO $$
BEGIN
  RAISE NOTICE '====================================';
  RAISE NOTICE ' ✅ Fonction RPC créée avec succès';
  RAISE NOTICE '====================================';
  RAISE NOTICE 'Fonction: forcer_transporteur_commande(commande_id, code, nom, raison)';
  RAISE NOTICE 'Utilisable depuis: DecisionsTransporteurs.tsx';
  RAISE NOTICE 'Mode décision: manuel (forçage)';
  RAISE NOTICE '====================================';
END $$;
