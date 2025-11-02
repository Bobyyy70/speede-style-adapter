-- Ajouter une colonne raison dans mouvement_stock si elle n'existe pas
DO $$ 
BEGIN
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns 
                 WHERE table_name = 'mouvement_stock' 
                 AND column_name = 'raison') THEN
    ALTER TABLE public.mouvement_stock 
    ADD COLUMN raison TEXT;
  END IF;
END $$;

-- Mettre à jour la fonction ajouter_stock_manuel pour capturer la raison et l'utilisateur
CREATE OR REPLACE FUNCTION public.ajouter_stock_manuel(
  p_emplacement_id UUID,
  p_produit_id UUID,
  p_quantite INTEGER,
  p_remarques TEXT DEFAULT NULL,
  p_raison TEXT DEFAULT 'Ajout manuel'
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_emplacement RECORD;
  v_produit RECORD;
  v_mouvement_id UUID;
BEGIN
  -- Récupérer l'emplacement
  SELECT * INTO v_emplacement FROM public.emplacement WHERE id = p_emplacement_id;
  IF NOT FOUND THEN
    RETURN jsonb_build_object('success', false, 'error', 'Emplacement introuvable');
  END IF;

  -- Récupérer le produit
  SELECT * INTO v_produit FROM public.produit WHERE id = p_produit_id;
  IF NOT FOUND THEN
    RETURN jsonb_build_object('success', false, 'error', 'Produit introuvable');
  END IF;

  -- Vérifier la capacité
  IF v_produit.poids_unitaire IS NOT NULL AND v_emplacement.capacite_max_kg IS NOT NULL THEN
    IF (COALESCE(v_emplacement.quantite_actuelle, 0) + p_quantite) * v_produit.poids_unitaire > v_emplacement.capacite_max_kg THEN
      RETURN jsonb_build_object('success', false, 'error', 'Capacité maximale dépassée');
    END IF;
  END IF;

  -- Créer le mouvement de stock
  INSERT INTO public.mouvement_stock (
    type_mouvement,
    produit_id,
    quantite,
    emplacement_destination_id,
    remarques,
    raison,
    created_by,
    date_mouvement
  ) VALUES (
    'entrée',
    p_produit_id,
    p_quantite,
    p_emplacement_id,
    p_remarques,
    p_raison,
    auth.uid(),
    NOW()
  ) RETURNING id INTO v_mouvement_id;

  -- Mettre à jour l'emplacement
  UPDATE public.emplacement
  SET 
    produit_actuel_id = p_produit_id,
    quantite_actuelle = COALESCE(quantite_actuelle, 0) + p_quantite,
    statut_actuel = 'occupé'
  WHERE id = p_emplacement_id;

  RETURN jsonb_build_object(
    'success', true,
    'mouvement_id', v_mouvement_id,
    'nouvelle_quantite', COALESCE(v_emplacement.quantite_actuelle, 0) + p_quantite
  );
END;
$$;

-- Mettre à jour la fonction retirer_stock_manuel
CREATE OR REPLACE FUNCTION public.retirer_stock_manuel(
  p_emplacement_id UUID,
  p_quantite INTEGER,
  p_remarques TEXT DEFAULT NULL,
  p_raison TEXT DEFAULT 'Retrait manuel'
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_emplacement RECORD;
  v_mouvement_id UUID;
BEGIN
  -- Récupérer l'emplacement
  SELECT * INTO v_emplacement FROM public.emplacement WHERE id = p_emplacement_id;
  IF NOT FOUND THEN
    RETURN jsonb_build_object('success', false, 'error', 'Emplacement introuvable');
  END IF;

  -- Vérifier le stock disponible
  IF COALESCE(v_emplacement.quantite_actuelle, 0) < p_quantite THEN
    RETURN jsonb_build_object('success', false, 'error', 'Stock insuffisant');
  END IF;

  -- Créer le mouvement de stock
  INSERT INTO public.mouvement_stock (
    type_mouvement,
    produit_id,
    quantite,
    emplacement_source_id,
    remarques,
    raison,
    created_by,
    date_mouvement
  ) VALUES (
    'sortie',
    v_emplacement.produit_actuel_id,
    -p_quantite,
    p_emplacement_id,
    p_remarques,
    p_raison,
    auth.uid(),
    NOW()
  ) RETURNING id INTO v_mouvement_id;

  -- Mettre à jour l'emplacement
  UPDATE public.emplacement
  SET 
    quantite_actuelle = quantite_actuelle - p_quantite,
    statut_actuel = CASE WHEN (quantite_actuelle - p_quantite) = 0 THEN 'disponible' ELSE 'occupé' END,
    produit_actuel_id = CASE WHEN (quantite_actuelle - p_quantite) = 0 THEN NULL ELSE produit_actuel_id END
  WHERE id = p_emplacement_id;

  RETURN jsonb_build_object(
    'success', true,
    'mouvement_id', v_mouvement_id,
    'nouvelle_quantite', v_emplacement.quantite_actuelle - p_quantite
  );
END;
$$;