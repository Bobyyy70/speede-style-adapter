-- =====================================================
-- RPC Function: toggle_automation_client
-- Description: Toggle automation setting for a specific client
-- Date: 2025-11-18
-- =====================================================

CREATE OR REPLACE FUNCTION toggle_automation_client(
  p_client_id UUID,
  p_actif BOOLEAN
)
RETURNS TABLE(
  success BOOLEAN,
  config_id UUID,
  message TEXT
)
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  v_config_id UUID;
  v_exists BOOLEAN;
BEGIN
  -- Check if config exists for this client
  SELECT id INTO v_config_id
  FROM config_auto_selection_transporteur
  WHERE client_id = p_client_id;

  v_exists := FOUND;

  IF v_exists THEN
    -- Update existing config
    UPDATE config_auto_selection_transporteur
    SET
      actif = p_actif,
      date_modification = NOW()
    WHERE client_id = p_client_id
    RETURNING id INTO v_config_id;

    RETURN QUERY SELECT
      TRUE,
      v_config_id,
      'Configuration mise à jour avec succès'::TEXT;

  ELSE
    -- Create new config with default values
    INSERT INTO config_auto_selection_transporteur (
      client_id,
      actif,
      mode_selection,
      utiliser_ia,
      created_at,
      date_modification
    )
    VALUES (
      p_client_id,
      p_actif,
      'automatique',  -- mode par défaut
      FALSE,          -- IA désactivée par défaut
      NOW(),
      NOW()
    )
    RETURNING id INTO v_config_id;

    RETURN QUERY SELECT
      TRUE,
      v_config_id,
      'Nouvelle configuration créée avec succès'::TEXT;
  END IF;

EXCEPTION
  WHEN OTHERS THEN
    RAISE NOTICE 'Error in toggle_automation_client: %', SQLERRM;
    RETURN QUERY SELECT
      FALSE,
      NULL::UUID,
      ('Erreur: ' || SQLERRM)::TEXT;
END;
$$;

-- Grant execute permission to authenticated users
GRANT EXECUTE ON FUNCTION toggle_automation_client(UUID, BOOLEAN) TO authenticated;

-- Add comment
COMMENT ON FUNCTION toggle_automation_client IS 'Toggle automation setting for a specific client. Creates config if it doesn''t exist.';

-- =====================================================
-- Verification
-- =====================================================

DO $$
BEGIN
  RAISE NOTICE '====================================';
  RAISE NOTICE ' ✅ Fonction RPC créée avec succès';
  RAISE NOTICE '====================================';
  RAISE NOTICE 'Fonction: toggle_automation_client(client_id, actif)';
  RAISE NOTICE 'Utilisable depuis: AutomationTransporteurs.tsx';
  RAISE NOTICE '====================================';
END $$;
