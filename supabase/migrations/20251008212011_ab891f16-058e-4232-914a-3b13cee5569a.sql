-- Supprimer toutes les versions de la fonction generer_emplacements_auto
DROP FUNCTION IF EXISTS public.generer_emplacements_auto(text, integer, text, numeric);
DROP FUNCTION IF EXISTS public.generer_emplacements_auto(text, integer, text, numeric, integer);

-- Recréer uniquement la version simplifiée (sans capacite_unites)
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
  -- Convertir les listes CSV en tableaux
  v_allees := string_to_array(p_allees, ',');
  v_positions := string_to_array(p_positions, ',');
  
  -- Boucle sur toutes les allées
  FOREACH v_allee IN ARRAY v_allees
  LOOP
    -- Boucle sur tous les racks (1 à p_nb_racks)
    FOR v_rack IN 1..p_nb_racks
    LOOP
      -- Boucle sur toutes les positions (a, b, c, d)
      FOREACH v_position IN ARRAY v_positions
      LOOP
        -- Construire le code emplacement (ex: A1_a, A1_b, etc.)
        v_code := TRIM(v_allee) || v_rack || '_' || TRIM(v_position);
        
        -- Insérer l'emplacement s'il n'existe pas déjà
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
          TRIM(v_allee), -- Zone = allée
          'stock', -- Type par défaut
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