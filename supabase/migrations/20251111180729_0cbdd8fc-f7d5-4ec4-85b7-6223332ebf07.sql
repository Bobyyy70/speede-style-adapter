-- Fonction de rollback de transition de statut
CREATE OR REPLACE FUNCTION rollback_transition(
  p_type TEXT,              -- 'commande' | 'retour' | 'attendu'
  p_transition_id UUID,     -- ID de la transition à annuler
  p_raison TEXT,            -- Raison du rollback
  p_user_id UUID            -- Utilisateur effectuant le rollback
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  v_transition RECORD;
  v_entity_id UUID;
  v_current_status TEXT;
  v_table_name TEXT;
  v_log_table TEXT;
  v_result JSONB;
  v_column_name TEXT;
BEGIN
  -- Vérification de la raison (minimum 10 caractères)
  IF LENGTH(TRIM(p_raison)) < 10 THEN
    RETURN jsonb_build_object('success', false, 'error', 'La raison doit contenir au moins 10 caractères');
  END IF;

  -- Déterminer les noms de tables et colonnes
  CASE p_type
    WHEN 'commande' THEN 
      v_table_name := 'commande';
      v_log_table := 'commande_transition_log';
      v_column_name := 'commande_id';
    WHEN 'retour' THEN 
      v_table_name := 'retour_produit';
      v_log_table := 'retour_transition_log';
      v_column_name := 'retour_id';
    WHEN 'attendu' THEN 
      v_table_name := 'attendu_reception';
      v_log_table := 'attendu_transition_log';
      v_column_name := 'attendu_id';
    ELSE
      RETURN jsonb_build_object('success', false, 'error', 'Type invalide: ' || p_type);
  END CASE;

  -- Récupérer la transition
  EXECUTE format('SELECT * FROM %I WHERE id = $1', v_log_table)
    INTO v_transition USING p_transition_id;
  
  IF v_transition IS NULL THEN
    RETURN jsonb_build_object('success', false, 'error', 'Transition introuvable');
  END IF;

  -- Vérifier que pas déjà rollback
  IF v_transition.metadata ? 'is_rolled_back' THEN
    RETURN jsonb_build_object('success', false, 'error', 'Cette transition a déjà été annulée');
  END IF;

  -- Récupérer l'entité et son ID
  EXECUTE format('SELECT %I FROM %I WHERE id = $1', v_column_name, v_log_table)
    INTO v_entity_id USING p_transition_id;

  -- Récupérer le statut actuel de l'entité
  IF p_type = 'commande' THEN
    EXECUTE format('SELECT statut_wms::TEXT FROM %I WHERE id = $1', v_table_name)
      INTO v_current_status USING v_entity_id;
  ELSIF p_type = 'retour' THEN
    EXECUTE format('SELECT statut FROM %I WHERE id = $1', v_table_name)
      INTO v_current_status USING v_entity_id;
  ELSE -- attendu
    EXECUTE format('SELECT statut::TEXT FROM %I WHERE id = $1', v_table_name)
      INTO v_current_status USING v_entity_id;
  END IF;

  -- Vérifier cohérence : statut actuel = statut_nouveau de la transition
  IF v_current_status != v_transition.statut_nouveau THEN
    RETURN jsonb_build_object(
      'success', false, 
      'error', format('Le statut actuel (%s) ne correspond pas au statut de la transition (%s)', 
                      v_current_status, v_transition.statut_nouveau)
    );
  END IF;

  -- Vérifier statuts bloquants (finaux)
  IF v_transition.statut_nouveau IN ('livre', 'annule', 'cloture', 'archive') THEN
    RETURN jsonb_build_object(
      'success', false, 
      'error', format('Impossible d''annuler une transition vers le statut final "%s"', v_transition.statut_nouveau)
    );
  END IF;

  -- Restaurer le statut précédent sur l'entité
  IF p_type = 'commande' THEN
    EXECUTE format('UPDATE %I SET statut_wms = $1::statut_commande_enum, date_modification = NOW() WHERE id = $2', v_table_name)
      USING v_transition.statut_precedent, v_entity_id;
  ELSIF p_type = 'retour' THEN
    EXECUTE format('UPDATE %I SET statut = $1, date_modification = NOW() WHERE id = $2', v_table_name)
      USING v_transition.statut_precedent, v_entity_id;
  ELSE -- attendu
    EXECUTE format('UPDATE %I SET statut = $1::statut_attendu_reception, date_modification = NOW() WHERE id = $2', v_table_name)
      USING v_transition.statut_precedent, v_entity_id;
  END IF;

  -- Créer l'entrée de rollback dans le log
  EXECUTE format(
    'INSERT INTO %I (%s, statut_precedent, statut_nouveau, utilisateur_id, raison, metadata, date_transition) 
     VALUES ($1, $2, $3, $4, $5, $6, NOW())',
    v_log_table,
    v_column_name
  ) USING 
    v_entity_id,
    v_transition.statut_nouveau,  -- Ce qui était "nouveau" devient "précédent"
    v_transition.statut_precedent, -- On revient au précédent
    p_user_id,
    'ROLLBACK: ' || p_raison,
    jsonb_build_object(
      'rollback_from', p_transition_id,
      'rollback_by', p_user_id,
      'rollback_date', NOW(),
      'is_rollback', true
    );

  -- Marquer la transition originale comme rollback
  EXECUTE format(
    'UPDATE %I SET metadata = COALESCE(metadata, ''{}''::jsonb) || $1 WHERE id = $2',
    v_log_table
  ) USING 
    jsonb_build_object('is_rolled_back', true, 'rolled_back_at', NOW(), 'rolled_back_by', p_user_id),
    p_transition_id;

  RETURN jsonb_build_object(
    'success', true,
    'message', format('Transition annulée : %s → %s', v_transition.statut_nouveau, v_transition.statut_precedent),
    'entity_id', v_entity_id,
    'old_status', v_transition.statut_nouveau,
    'new_status', v_transition.statut_precedent
  );
END;
$$;

-- Permissions
GRANT EXECUTE ON FUNCTION rollback_transition TO authenticated;