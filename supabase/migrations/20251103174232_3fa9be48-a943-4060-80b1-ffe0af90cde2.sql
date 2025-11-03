-- Améliorer la fonction liberer_stock_commande pour créer des mouvements de traçabilité
-- au lieu de simplement supprimer les réservations

CREATE OR REPLACE FUNCTION public.liberer_stock_commande(p_commande_id uuid)
 RETURNS jsonb
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
DECLARE
  v_reservation RECORD;
  v_commande_numero TEXT;
  v_mouvements_created INTEGER := 0;
BEGIN
  -- Récupérer le numéro de commande pour les remarques
  SELECT numero_commande INTO v_commande_numero
  FROM commande
  WHERE id = p_commande_id;

  -- Pour chaque réservation, créer un mouvement d'ajustement inverse
  FOR v_reservation IN 
    SELECT * FROM mouvement_stock
    WHERE commande_id = p_commande_id
      AND type_mouvement = 'réservation'
      AND statut_mouvement = 'stock_physique'
  LOOP
    -- Créer un mouvement d'ajustement positif pour annuler la réservation
    INSERT INTO mouvement_stock (
      type_mouvement,
      produit_id,
      quantite,
      commande_id,
      reference_origine,
      type_origine,
      remarques,
      raison,
      statut_mouvement,
      date_mouvement,
      created_by
    ) VALUES (
      'ajustement_inventaire_positif',
      v_reservation.produit_id,
      v_reservation.quantite,
      p_commande_id,
      v_commande_numero,
      'annulation_commande',
      format('Libération stock suite annulation commande %s', v_commande_numero),
      'Annulation commande',
      'stock_physique',
      NOW(),
      v_reservation.created_by
    );
    
    v_mouvements_created := v_mouvements_created + 1;
  END LOOP;

  -- Maintenant supprimer les réservations (elles sont tracées par les ajustements)
  DELETE FROM mouvement_stock
  WHERE commande_id = p_commande_id
    AND type_mouvement = 'réservation'
    AND statut_mouvement = 'stock_physique';
  
  RETURN jsonb_build_object(
    'success', true,
    'reservations_liberees', v_mouvements_created,
    'message', format('%s réservation(s) libérée(s) avec traçabilité', v_mouvements_created)
  );
END;
$function$;