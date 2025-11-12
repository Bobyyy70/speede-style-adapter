-- Ajouter les champs de dimensions aux produits si manquants
ALTER TABLE produit 
ADD COLUMN IF NOT EXISTS longueur_cm numeric(10,2),
ADD COLUMN IF NOT EXISTS largeur_cm numeric(10,2),
ADD COLUMN IF NOT EXISTS hauteur_cm numeric(10,2),
ADD COLUMN IF NOT EXISTS volume_cm3 numeric(15,2) GENERATED ALWAYS AS (
  CASE 
    WHEN longueur_cm IS NOT NULL AND largeur_cm IS NOT NULL AND hauteur_cm IS NOT NULL 
    THEN longueur_cm * largeur_cm * hauteur_cm 
    ELSE NULL 
  END
) STORED;

-- Créer une table pour les facteurs de division par transporteur
CREATE TABLE IF NOT EXISTS transporteur_facteur_division (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  transporteur_code varchar(100) NOT NULL UNIQUE,
  transporteur_nom varchar(255) NOT NULL,
  facteur_division integer NOT NULL DEFAULT 5000,
  unite varchar(10) NOT NULL DEFAULT 'cm3/kg',
  description text,
  actif boolean DEFAULT true,
  date_creation timestamp with time zone DEFAULT now(),
  date_modification timestamp with time zone DEFAULT now()
);

-- Insérer les facteurs standards des principaux transporteurs
INSERT INTO transporteur_facteur_division (transporteur_code, transporteur_nom, facteur_division, description)
VALUES 
  ('DHL', 'DHL Express', 5000, 'Standard DHL Express - diviseur volumétrique 5000'),
  ('FEDEX', 'FedEx', 5000, 'Standard FedEx International - diviseur volumétrique 5000'),
  ('UPS', 'UPS', 5000, 'Standard UPS - diviseur volumétrique 5000'),
  ('TNT', 'TNT', 5000, 'Standard TNT - diviseur volumétrique 5000'),
  ('CHRONOPOST', 'Chronopost', 5000, 'Standard Chronopost - diviseur volumétrique 5000'),
  ('COLISSIMO', 'Colissimo', 5000, 'Standard Colissimo - diviseur volumétrique 5000'),
  ('GLS', 'GLS', 6000, 'Standard GLS Europe - diviseur volumétrique 6000'),
  ('DPD', 'DPD', 6000, 'Standard DPD - diviseur volumétrique 6000'),
  ('MONDIAL_RELAY', 'Mondial Relay', 4000, 'Standard Mondial Relay - diviseur volumétrique 4000'),
  ('COLIS_PRIVE', 'Colis Privé', 4000, 'Standard Colis Privé - diviseur volumétrique 4000'),
  ('DEFAULT', 'Par défaut', 5000, 'Facteur par défaut si transporteur non spécifié')
ON CONFLICT (transporteur_code) DO NOTHING;

-- Fonction pour calculer le poids volumétrique d'un produit
CREATE OR REPLACE FUNCTION calculer_poids_volumetrique_produit(
  p_longueur_cm numeric,
  p_largeur_cm numeric,
  p_hauteur_cm numeric,
  p_facteur_division integer DEFAULT 5000
)
RETURNS numeric AS $$
BEGIN
  IF p_longueur_cm IS NULL OR p_largeur_cm IS NULL OR p_hauteur_cm IS NULL THEN
    RETURN NULL;
  END IF;
  
  -- Formule: (L × l × h) / facteur_division
  RETURN ROUND((p_longueur_cm * p_largeur_cm * p_hauteur_cm) / p_facteur_division, 2);
END;
$$ LANGUAGE plpgsql IMMUTABLE;

-- Fonction pour calculer le poids volumétrique d'une commande
CREATE OR REPLACE FUNCTION calculer_poids_volumetrique_commande(
  p_commande_id uuid,
  p_transporteur_code varchar DEFAULT 'DEFAULT'
)
RETURNS TABLE(
  poids_reel_total numeric,
  poids_volumetrique_total numeric,
  poids_facturable numeric,
  facteur_utilise integer,
  details jsonb
) AS $$
DECLARE
  v_facteur_division integer;
  v_poids_reel numeric := 0;
  v_poids_volumetrique numeric := 0;
  v_details jsonb := '[]'::jsonb;
  v_ligne RECORD;
BEGIN
  -- Récupérer le facteur de division pour le transporteur
  SELECT facteur_division INTO v_facteur_division
  FROM transporteur_facteur_division
  WHERE transporteur_code = UPPER(p_transporteur_code) AND actif = true;
  
  -- Si transporteur non trouvé, utiliser le facteur par défaut
  IF v_facteur_division IS NULL THEN
    SELECT facteur_division INTO v_facteur_division
    FROM transporteur_facteur_division
    WHERE transporteur_code = 'DEFAULT';
  END IF;
  
  -- Parcourir toutes les lignes de commande
  FOR v_ligne IN
    SELECT 
      lc.quantite,
      p.reference,
      p.nom,
      p.poids_unitaire,
      p.longueur_cm,
      p.largeur_cm,
      p.hauteur_cm
    FROM ligne_commande lc
    JOIN produit p ON lc.produit_id = p.id
    WHERE lc.commande_id = p_commande_id
  LOOP
    -- Calculer poids réel ligne
    IF v_ligne.poids_unitaire IS NOT NULL THEN
      v_poids_reel := v_poids_reel + (v_ligne.quantite * v_ligne.poids_unitaire);
    END IF;
    
    -- Calculer poids volumétrique ligne
    IF v_ligne.longueur_cm IS NOT NULL AND v_ligne.largeur_cm IS NOT NULL AND v_ligne.hauteur_cm IS NOT NULL THEN
      v_poids_volumetrique := v_poids_volumetrique + (
        v_ligne.quantite * calculer_poids_volumetrique_produit(
          v_ligne.longueur_cm,
          v_ligne.largeur_cm,
          v_ligne.hauteur_cm,
          v_facteur_division
        )
      );
      
      -- Ajouter détails
      v_details := v_details || jsonb_build_object(
        'reference', v_ligne.reference,
        'nom', v_ligne.nom,
        'quantite', v_ligne.quantite,
        'poids_unitaire_kg', v_ligne.poids_unitaire,
        'dimensions_cm', jsonb_build_object(
          'longueur', v_ligne.longueur_cm,
          'largeur', v_ligne.largeur_cm,
          'hauteur', v_ligne.hauteur_cm
        ),
        'poids_volumetrique_unitaire_kg', calculer_poids_volumetrique_produit(
          v_ligne.longueur_cm,
          v_ligne.largeur_cm,
          v_ligne.hauteur_cm,
          v_facteur_division
        )
      );
    END IF;
  END LOOP;
  
  -- Retourner le résultat
  RETURN QUERY SELECT
    ROUND(v_poids_reel, 2) as poids_reel_total,
    ROUND(v_poids_volumetrique, 2) as poids_volumetrique_total,
    ROUND(GREATEST(v_poids_reel, v_poids_volumetrique), 2) as poids_facturable,
    v_facteur_division as facteur_utilise,
    v_details as details;
END;
$$ LANGUAGE plpgsql STABLE;

-- Trigger pour mettre à jour automatiquement les poids de la commande
CREATE OR REPLACE FUNCTION update_commande_poids()
RETURNS TRIGGER AS $$
DECLARE
  v_result RECORD;
  v_transporteur_code varchar;
BEGIN
  -- Récupérer le code transporteur de la commande
  SELECT transporteur_choisi INTO v_transporteur_code
  FROM commande
  WHERE id = COALESCE(NEW.commande_id, OLD.commande_id);
  
  -- Calculer les poids
  SELECT * INTO v_result
  FROM calculer_poids_volumetrique_commande(
    COALESCE(NEW.commande_id, OLD.commande_id),
    COALESCE(v_transporteur_code, 'DEFAULT')
  );
  
  -- Mettre à jour la commande
  UPDATE commande
  SET 
    poids_reel_kg = v_result.poids_reel_total,
    poids_volumetrique_kg = v_result.poids_volumetrique_total,
    poids_total = v_result.poids_facturable,
    date_modification = now()
  WHERE id = COALESCE(NEW.commande_id, OLD.commande_id);
  
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Créer le trigger sur ligne_commande
DROP TRIGGER IF EXISTS trigger_update_commande_poids ON ligne_commande;
CREATE TRIGGER trigger_update_commande_poids
AFTER INSERT OR UPDATE OR DELETE ON ligne_commande
FOR EACH ROW
EXECUTE FUNCTION update_commande_poids();

-- RLS pour transporteur_facteur_division
ALTER TABLE transporteur_facteur_division ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Admin full access on transporteur_facteur_division"
ON transporteur_facteur_division
FOR ALL
TO authenticated
USING (has_role(auth.uid(), 'admin'::app_role))
WITH CHECK (has_role(auth.uid(), 'admin'::app_role));

CREATE POLICY "All authenticated read transporteur_facteur_division"
ON transporteur_facteur_division
FOR SELECT
TO authenticated
USING (actif = true);

-- Commentaires
COMMENT ON TABLE transporteur_facteur_division IS 'Facteurs de division volumétrique par transporteur pour le calcul du poids facturable';
COMMENT ON FUNCTION calculer_poids_volumetrique_produit IS 'Calcule le poids volumétrique d''un produit selon la formule (L×l×h)/facteur';
COMMENT ON FUNCTION calculer_poids_volumetrique_commande IS 'Calcule les poids réel, volumétrique et facturable d''une commande complète';
