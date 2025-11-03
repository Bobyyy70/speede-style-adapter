-- Amélioration de la fonction reserver_stock pour gestion atomique
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
  v_numero_mouvement text;
  v_errors jsonb := '[]'::jsonb;
BEGIN
  -- Vérifier que la commande existe
  IF NOT EXISTS (SELECT 1 FROM commande WHERE id = p_commande_id) THEN
    RAISE EXCEPTION 'Commande non trouvée: %', p_commande_id;
  END IF;

  -- Traiter chaque ligne
  FOR v_ligne IN SELECT * FROM jsonb_array_elements(p_lignes)
  LOOP
    BEGIN
      -- 1. Récupérer produit depuis ID
      SELECT id, reference, nom, stock_actuel INTO v_produit
      FROM produit
      WHERE id = (v_ligne->>'produit_id')::uuid
      LIMIT 1;
      
      IF v_produit.id IS NULL THEN
        v_errors := v_errors || jsonb_build_object(
          'produit_id', v_ligne->>'produit_id',
          'error', 'Produit non trouvé'
        );
        CONTINUE;
      END IF;
      
      v_quantite_demandee := (v_ligne->>'quantite')::integer;
      
      -- 2. Calculer stock disponible (physique - réservé)
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
      
      -- 3. Vérifier stock suffisant
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
      
      -- 4. Créer réservation
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
  
  -- Si des erreurs critiques (stock insuffisant), ÉCHEC
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

-- Amélioration libération stock avec meilleure traçabilité
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
BEGIN
  -- Récupérer le numéro de commande
  SELECT numero_commande INTO v_commande_numero
  FROM commande
  WHERE id = p_commande_id;

  -- Pour chaque réservation, créer un ajustement positif
  FOR v_reservation IN 
    SELECT * FROM mouvement_stock
    WHERE commande_id = p_commande_id
      AND type_mouvement = 'réservation'
      AND statut_mouvement = 'stock_physique'
  LOOP
    -- Créer ajustement positif pour annuler la réservation
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

  -- Supprimer les réservations (tracées par les ajustements)
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

-- Fonction pour expédition stock (convertir réservations en sorties)
CREATE OR REPLACE FUNCTION public.expedier_commande_stock(p_commande_id uuid)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  v_reservation record;
  v_sorties_created integer := 0;
BEGIN
  -- Pour chaque réservation, créer une sortie
  FOR v_reservation IN 
    SELECT * FROM mouvement_stock
    WHERE commande_id = p_commande_id
      AND type_mouvement = 'réservation'
      AND statut_mouvement = 'stock_physique'
  LOOP
    -- Créer sortie
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