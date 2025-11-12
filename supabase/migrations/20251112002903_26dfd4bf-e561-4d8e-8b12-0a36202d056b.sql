-- Corriger le trigger auto_complete_commande_fields qui utilise la mauvaise colonne
CREATE OR REPLACE FUNCTION public.auto_complete_commande_fields()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  v_client RECORD;
  v_expediteur RECORD;
BEGIN
  -- Récupérer les infos client si client_id existe
  IF NEW.client_id IS NOT NULL THEN
    SELECT * INTO v_client
    FROM public.client
    WHERE id = NEW.client_id;
    
    -- Remplir nom_client si vide
    IF NEW.nom_client IS NULL AND v_client IS NOT NULL THEN
      NEW.nom_client := v_client.nom_entreprise; -- CORRECTION ICI
    END IF;
    
    -- Remplir expediteur si vide et si config par défaut existe
    IF NEW.expediteur_entreprise IS NULL THEN
      SELECT ce.* INTO v_expediteur
      FROM public.configuration_expediteur ce
      WHERE (ce.client_id = NEW.client_id OR ce.est_defaut = true)
      AND ce.actif = true
      ORDER BY ce.est_defaut ASC, ce.date_creation DESC
      LIMIT 1;
      
      IF v_expediteur IS NOT NULL THEN
        NEW.expediteur_entreprise := v_expediteur.entreprise;
        NEW.expediteur_nom := v_expediteur.nom;
        NEW.expediteur_email := v_expediteur.email;
        NEW.expediteur_telephone := v_expediteur.telephone;
        NEW.expediteur_adresse_ligne_1 := v_expediteur.adresse_ligne_1;
        NEW.expediteur_adresse_ligne_2 := v_expediteur.adresse_ligne_2;
        NEW.expediteur_code_postal := v_expediteur.code_postal;
        NEW.expediteur_ville := v_expediteur.ville;
        NEW.expediteur_pays_code := v_expediteur.pays_code;
      END IF;
    END IF;
  END IF;
  
  -- Remplir date_modification
  NEW.date_modification := now();
  
  RETURN NEW;
END;
$$;