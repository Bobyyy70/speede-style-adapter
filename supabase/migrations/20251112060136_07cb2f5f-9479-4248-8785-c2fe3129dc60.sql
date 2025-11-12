-- Add client_id validation to stock reservation functions for security

-- 1. Secure reserver_stock_commande with client_id validation
CREATE OR REPLACE FUNCTION public.reserver_stock_commande(
  p_commande_id uuid,
  p_lignes jsonb
) RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE
  v_ligne jsonb;
  v_produit record;
  v_quantite_demandee integer;
  v_stock_disponible integer;
  v_reservations_created integer := 0;
  v_errors jsonb := '[]'::jsonb;
  v_commande_client_id uuid;
  v_user_client_id uuid;
BEGIN
  -- SECURITY: Validate commande exists and belongs to authenticated user's client
  SELECT client_id INTO v_commande_client_id
  FROM commande
  WHERE id = p_commande_id;
  
  IF v_commande_client_id IS NULL THEN
    RAISE EXCEPTION 'Commande non trouvée: %', p_commande_id;
  END IF;
  
  -- Get user's client_id if authenticated
  IF auth.uid() IS NOT NULL THEN
    SELECT client_id INTO v_user_client_id
    FROM profiles
    WHERE id = auth.uid();
    
    -- Verify user's client matches commande's client
    IF v_user_client_id IS NOT NULL AND v_user_client_id != v_commande_client_id THEN
      RAISE EXCEPTION 'Unauthorized: Commande belongs to different client';
    END IF;
  END IF;

  -- Traiter chaque ligne
  FOR v_ligne IN SELECT * FROM jsonb_array_elements(p_lignes)
  LOOP
    BEGIN
      -- Récupérer produit et vérifier qu'il appartient au même client
      SELECT id, reference, nom, stock_actuel INTO v_produit
      FROM produit
      WHERE id = (v_ligne->>'produit_id')::uuid
        AND client_id = v_commande_client_id
      LIMIT 1;
      
      IF v_produit.id IS NULL THEN
        v_errors := v_errors || jsonb_build_object(
          'produit_id', v_ligne->>'produit_id',
          'error', 'Produit non trouvé ou appartient à un autre client'
        );
        CONTINUE;
      END IF;
      
      v_quantite_demandee := (v_ligne->>'quantite')::integer;
      
      -- Calculer stock disponible (physique - réservé)
      SELECT COALESCE(SUM(
        CASE 
          WHEN type_mouvement = 'entrée' THEN quantite
          WHEN type_mouvement = 'sortie' THEN -quantite
          WHEN type_mouvement = 'réservation' THEN -quantite
          WHEN type_mouvement = 'ajustement_inventaire_positif' THEN quantite
          WHEN type_mouvement = 'ajustement_inventaire_negatif' THEN -quantite
          ELSE 0
        END
      ), 0) INTO v_stock_disponible
      FROM mouvement_stock
      WHERE produit_id = v_produit.id
        AND statut_mouvement = 'stock_physique';
      
      -- Vérifier stock suffisant
      IF v_stock_disponible < v_quantite_demandee THEN
        v_errors := v_errors || jsonb_build_object(
          'reference', v_produit.reference,
          'nom', v_produit.nom,
          'error', 'Stock insuffisant',
          'disponible', v_stock_disponible,
          'demande', v_quantite_demandee
        );
        CONTINUE;
      END IF;
      
      -- Créer réservation
      INSERT INTO mouvement_stock (
        date_mouvement,
        type_mouvement,
        produit_id,
        quantite,
        commande_id,
        remarques,
        statut_mouvement,
        type_origine,
        reference_origine
      ) VALUES (
        NOW(),
        'réservation',
        v_produit.id,
        v_quantite_demandee,
        p_commande_id,
        'Réservation automatique - ' || v_produit.nom,
        'stock_physique',
        'commande',
        p_commande_id::text
      );
      
      v_reservations_created := v_reservations_created + 1;
      
    EXCEPTION WHEN OTHERS THEN
      v_errors := v_errors || jsonb_build_object(
        'produit_id', v_ligne->>'produit_id',
        'error', SQLERRM
      );
    END;
  END LOOP;
  
  -- Si des erreurs critiques, ÉCHEC
  IF jsonb_array_length(v_errors) > 0 THEN
    RAISE EXCEPTION 'Erreurs lors de la réservation: %', v_errors::text;
  END IF;
  
  -- Succès
  RETURN jsonb_build_object(
    'success', true,
    'reservations_created', v_reservations_created,
    'commande_id', p_commande_id
  );
END;
$$;

-- 2. Secure liberer_stock_commande with client_id validation
CREATE OR REPLACE FUNCTION public.liberer_stock_commande(p_commande_id uuid)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE
  v_reservation RECORD;
  v_commande_numero TEXT;
  v_mouvements_created INTEGER := 0;
  v_commande_client_id uuid;
  v_user_client_id uuid;
BEGIN
  -- SECURITY: Validate commande exists and belongs to authenticated user's client
  SELECT numero_commande, client_id INTO v_commande_numero, v_commande_client_id
  FROM commande
  WHERE id = p_commande_id;
  
  IF v_commande_client_id IS NULL THEN
    RAISE EXCEPTION 'Commande non trouvée: %', p_commande_id;
  END IF;
  
  -- Get user's client_id if authenticated
  IF auth.uid() IS NOT NULL THEN
    SELECT client_id INTO v_user_client_id
    FROM profiles
    WHERE id = auth.uid();
    
    -- Verify user's client matches commande's client
    IF v_user_client_id IS NOT NULL AND v_user_client_id != v_commande_client_id THEN
      RAISE EXCEPTION 'Unauthorized: Commande belongs to different client';
    END IF;
  END IF;

  -- Pour chaque réservation, créer un ajustement positif
  FOR v_reservation IN 
    SELECT * FROM mouvement_stock
    WHERE commande_id = p_commande_id
      AND type_mouvement = 'réservation'
      AND statut_mouvement = 'stock_physique'
  LOOP
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

  -- Supprimer les réservations
  DELETE FROM mouvement_stock
  WHERE commande_id = p_commande_id
    AND type_mouvement = 'réservation'
    AND statut_mouvement = 'stock_physique';
  
  RETURN jsonb_build_object(
    'success', true,
    'reservations_liberees', v_mouvements_created,
    'message', format('%s réservation(s) libérée(s)', v_mouvements_created)
  );
END;
$$;

-- 3. Secure expedier_commande_stock with client_id validation
CREATE OR REPLACE FUNCTION public.expedier_commande_stock(p_commande_id uuid)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE
  v_reservation record;
  v_sorties_created integer := 0;
  v_commande_client_id uuid;
  v_user_client_id uuid;
BEGIN
  -- SECURITY: Validate commande exists and belongs to authenticated user's client
  SELECT client_id INTO v_commande_client_id
  FROM commande
  WHERE id = p_commande_id;
  
  IF v_commande_client_id IS NULL THEN
    RAISE EXCEPTION 'Commande non trouvée: %', p_commande_id;
  END IF;
  
  -- Get user's client_id if authenticated
  IF auth.uid() IS NOT NULL THEN
    SELECT client_id INTO v_user_client_id
    FROM profiles
    WHERE id = auth.uid();
    
    -- Verify user's client matches commande's client
    IF v_user_client_id IS NOT NULL AND v_user_client_id != v_commande_client_id THEN
      RAISE EXCEPTION 'Unauthorized: Commande belongs to different client';
    END IF;
  END IF;

  -- Pour chaque réservation, créer une sortie
  FOR v_reservation IN 
    SELECT * FROM mouvement_stock
    WHERE commande_id = p_commande_id
      AND type_mouvement = 'réservation'
      AND statut_mouvement = 'stock_physique'
  LOOP
    INSERT INTO mouvement_stock (
      date_mouvement,
      type_mouvement,
      produit_id,
      quantite,
      commande_id,
      remarques,
      statut_mouvement,
      type_origine,
      reference_origine
    ) VALUES (
      NOW(),
      'sortie',
      v_reservation.produit_id,
      v_reservation.quantite,
      p_commande_id,
      'Sortie suite expédition',
      'stock_physique',
      'commande',
      p_commande_id::text
    );
    
    -- Supprimer réservation
    DELETE FROM mouvement_stock WHERE id = v_reservation.id;
    
    v_sorties_created := v_sorties_created + 1;
  END LOOP;
  
  RETURN jsonb_build_object(
    'success', true,
    'sorties_created', v_sorties_created
  );
END;
$$;