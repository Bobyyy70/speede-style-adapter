-- ============================================
-- FONCTION: Réserver stock pour une commande
-- ============================================

-- 1. Créer séquence pour numéros de mouvement
CREATE SEQUENCE IF NOT EXISTS seq_mouvement START 1;

-- 2. Fonction principale
CREATE OR REPLACE FUNCTION public.reserver_stock_commande(
  p_commande_id uuid,
  p_lignes jsonb
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
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
      -- 1. Récupérer produit depuis SKU
      SELECT id, sku, nom INTO v_produit
      FROM produit
      WHERE sku = v_ligne->>'sku'
      LIMIT 1;
      
      IF v_produit.id IS NULL THEN
        v_errors := v_errors || jsonb_build_object(
          'sku', v_ligne->>'sku',
          'error', 'Produit non trouvé'
        );
        CONTINUE;
      END IF;
      
      v_quantite_demandee := (v_ligne->>'quantite')::integer;
      
      -- 2. Calculer stock disponible (total - réservé)
      SELECT COALESCE(SUM(
        CASE 
          WHEN type_mouvement = 'entrée' THEN quantite
          WHEN type_mouvement = 'sortie' THEN -quantite
          WHEN type_mouvement = 'réservation' THEN -quantite
          ELSE 0
        END
      ), 0) INTO v_stock_disponible
      FROM mouvement_stock
      WHERE produit_id = v_produit.id
        AND statut_mouvement = 'stock_physique';
      
      -- 3. Vérifier stock suffisant
      IF v_stock_disponible < v_quantite_demandee THEN
        v_errors := v_errors || jsonb_build_object(
          'sku', v_produit.sku,
          'nom', v_produit.nom,
          'error', 'Stock insuffisant',
          'disponible', v_stock_disponible,
          'demande', v_quantite_demandee
        );
        CONTINUE;
      END IF;
      
      -- 4. Créer numéro de mouvement unique
      v_numero_mouvement := 'RES-' || TO_CHAR(NOW(), 'YYYYMMDD') || '-' || 
                           LPAD(nextval('seq_mouvement')::text, 6, '0');
      
      -- 5. Créer réservation
      INSERT INTO mouvement_stock (
        numero_mouvement,
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
        v_numero_mouvement,
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
        'sku', v_ligne->>'sku',
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

-- 3. Fonction pour libérer stock (annulation commande)
CREATE OR REPLACE FUNCTION public.liberer_stock_commande(
  p_commande_id uuid
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  v_reservations_deleted integer;
BEGIN
  -- Supprimer toutes les réservations de cette commande
  DELETE FROM mouvement_stock
  WHERE commande_id = p_commande_id
    AND type_mouvement = 'réservation'
    AND statut_mouvement = 'stock_physique';
  
  GET DIAGNOSTICS v_reservations_deleted = ROW_COUNT;
  
  RETURN jsonb_build_object(
    'success', true,
    'reservations_deleted', v_reservations_deleted
  );
END;
$$;

-- 4. Fonction pour transformer réservation en sortie (expédition)
CREATE OR REPLACE FUNCTION public.expedier_commande_stock(
  p_commande_id uuid
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  v_reservation record;
  v_numero_mouvement text;
  v_sorties_created integer := 0;
BEGIN
  -- Pour chaque réservation, créer une sortie et supprimer la réservation
  FOR v_reservation IN 
    SELECT * FROM mouvement_stock
    WHERE commande_id = p_commande_id
      AND type_mouvement = 'réservation'
      AND statut_mouvement = 'stock_physique'
  LOOP
    -- Créer sortie
    v_numero_mouvement := 'SOR-' || TO_CHAR(NOW(), 'YYYYMMDD') || '-' || 
                         LPAD(nextval('seq_mouvement')::text, 6, '0');
    
    INSERT INTO mouvement_stock (
      numero_mouvement,
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
      v_numero_mouvement,
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