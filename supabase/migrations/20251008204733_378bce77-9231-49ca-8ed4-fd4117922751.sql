-- Supprimer la colonne capacite_max_unites qui n'est plus utilisée
ALTER TABLE public.emplacement DROP COLUMN IF EXISTS capacite_max_unites;

-- Mettre à jour la valeur par défaut de capacite_max_kg à 1500 kg (norme palette Europe)
ALTER TABLE public.emplacement 
ALTER COLUMN capacite_max_kg SET DEFAULT 1500;

-- Mettre à jour les emplacements existants qui n'ont pas de capacité définie
UPDATE public.emplacement 
SET capacite_max_kg = 1500 
WHERE capacite_max_kg IS NULL;

-- Créer une fonction pour supprimer les emplacements d'une zone
CREATE OR REPLACE FUNCTION public.supprimer_emplacements_zone(
  p_zone TEXT DEFAULT NULL
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_count INTEGER;
  v_occupes INTEGER;
BEGIN
  -- Compter les emplacements occupés
  IF p_zone IS NULL THEN
    SELECT COUNT(*) INTO v_occupes
    FROM public.emplacement
    WHERE quantite_actuelle > 0 OR statut_actuel = 'occupé';
  ELSE
    SELECT COUNT(*) INTO v_occupes
    FROM public.emplacement
    WHERE (quantite_actuelle > 0 OR statut_actuel = 'occupé')
    AND zone = p_zone;
  END IF;

  -- Si des emplacements sont occupés, retourner une erreur
  IF v_occupes > 0 THEN
    RETURN jsonb_build_object(
      'success', false,
      'error', format('%s emplacements contiennent encore du stock', v_occupes),
      'emplacements_occupes', v_occupes
    );
  END IF;

  -- Supprimer les emplacements
  IF p_zone IS NULL THEN
    DELETE FROM public.emplacement;
    GET DIAGNOSTICS v_count = ROW_COUNT;
  ELSE
    DELETE FROM public.emplacement WHERE zone = p_zone;
    GET DIAGNOSTICS v_count = ROW_COUNT;
  END IF;

  RETURN jsonb_build_object(
    'success', true,
    'emplacements_supprimes', v_count
  );
END;
$$;

-- Mettre à jour la fonction generer_emplacements_auto pour ne plus utiliser p_capacite_unites
CREATE OR REPLACE FUNCTION public.generer_emplacements_auto(
  p_allees TEXT DEFAULT 'A,B,C,D,E,F,G,H,I,J,K,L,M,N,O,P,Q,R,S,T,U,V,W,X,Y,Z',
  p_nb_racks INTEGER DEFAULT 50,
  p_positions TEXT DEFAULT 'a,b,c,d',
  p_capacite_kg NUMERIC DEFAULT 1500.0
)
RETURNS INTEGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_allee TEXT;
  v_rack INTEGER;
  v_position TEXT;
  v_code TEXT;
  v_count INTEGER := 0;
  v_allees TEXT[];
  v_positions TEXT[];
BEGIN
  v_allees := string_to_array(p_allees, ',');
  v_positions := string_to_array(p_positions, ',');
  
  FOREACH v_allee IN ARRAY v_allees
  LOOP
    FOR v_rack IN 1..p_nb_racks
    LOOP
      FOREACH v_position IN ARRAY v_positions
      LOOP
        v_code := TRIM(v_allee) || v_rack || '_' || TRIM(v_position);
        
        INSERT INTO public.emplacement (
          code_emplacement,
          zone,
          type_emplacement,
          statut_actuel,
          quantite_actuelle,
          capacite_max_kg
        )
        VALUES (
          v_code,
          TRIM(v_allee),
          'stock',
          'disponible',
          0,
          p_capacite_kg
        )
        ON CONFLICT (code_emplacement) DO NOTHING;
        
        v_count := v_count + 1;
      END LOOP;
    END LOOP;
  END LOOP;
  
  RETURN v_count;
END;
$$;