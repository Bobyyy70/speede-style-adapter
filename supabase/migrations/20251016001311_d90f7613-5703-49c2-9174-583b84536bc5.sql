-- Fonction pour réintégrer automatiquement les produits retournés dans le stock
CREATE OR REPLACE FUNCTION public.reintegrer_produits_retour(p_retour_id UUID)
RETURNS JSONB AS $$
DECLARE
  v_ligne RECORD;
  v_mouvement_id UUID;
  v_count INTEGER := 0;
BEGIN
  -- Vérifier que le retour existe et est en statut 'traite'
  IF NOT EXISTS (
    SELECT 1 FROM public.retour_produit 
    WHERE id = p_retour_id AND statut_retour = 'traite'
  ) THEN
    RAISE EXCEPTION 'Retour non trouvé ou pas en statut "traité"';
  END IF;

  -- Parcourir toutes les lignes du retour avec action 'reintegration_stock'
  FOR v_ligne IN 
    SELECT lrp.*, rp.client_id
    FROM public.ligne_retour_produit lrp
    JOIN public.retour_produit rp ON rp.id = lrp.retour_id
    WHERE lrp.retour_id = p_retour_id 
      AND (lrp.action_souhaitee = 'reintegration_stock' OR lrp.action_a_faire = 'Réintégrer')
      AND lrp.statut_produit != 'traite'
  LOOP
    -- Créer un mouvement de stock d'entrée
    INSERT INTO public.mouvement_stock (
      type_mouvement,
      produit_id,
      quantite,
      reference_origine,
      type_origine,
      remarques,
      statut_mouvement,
      date_mouvement
    ) VALUES (
      'entrée',
      v_ligne.produit_id,
      v_ligne.quantite_retournee,
      p_retour_id::TEXT,
      'retour',
      format('Réintégration automatique depuis retour - État: %s', COALESCE(v_ligne.etat_produit, 'non spécifié')),
      'stock_physique',
      NOW()
    ) RETURNING id INTO v_mouvement_id;

    -- Marquer la ligne comme traitée
    UPDATE public.ligne_retour_produit
    SET statut_produit = 'traite'
    WHERE id = v_ligne.id;

    v_count := v_count + 1;
  END LOOP;

  RETURN jsonb_build_object(
    'success', true,
    'produits_reintegres', v_count,
    'message', format('%s produit(s) réintégré(s) au stock', v_count)
  );
EXCEPTION
  WHEN OTHERS THEN
    RETURN jsonb_build_object(
      'success', false,
      'error', SQLERRM
    );
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public;