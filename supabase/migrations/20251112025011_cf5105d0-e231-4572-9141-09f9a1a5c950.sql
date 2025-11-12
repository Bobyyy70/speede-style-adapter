-- Table de configuration des alertes poids volumétrique
CREATE TABLE IF NOT EXISTS alerte_poids_volumetrique_config (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  seuil_ecart_pourcentage numeric(5,2) NOT NULL DEFAULT 20.00,
  seuil_poids_minimum_kg numeric(10,2) DEFAULT 1.00,
  actif boolean DEFAULT true,
  notification_email boolean DEFAULT false,
  emails_notification text[],
  frequence_verification varchar(50) DEFAULT 'immediate',
  description text,
  date_creation timestamp with time zone DEFAULT now(),
  date_modification timestamp with time zone DEFAULT now(),
  CONSTRAINT seuil_ecart_positif CHECK (seuil_ecart_pourcentage > 0 AND seuil_ecart_pourcentage <= 1000)
);

-- Table des alertes générées
CREATE TABLE IF NOT EXISTS alerte_poids_volumetrique (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  commande_id uuid NOT NULL REFERENCES commande(id) ON DELETE CASCADE,
  numero_commande text NOT NULL,
  client_id uuid REFERENCES client(id),
  poids_reel_kg numeric(10,2) NOT NULL,
  poids_volumetrique_kg numeric(10,2) NOT NULL,
  ecart_kg numeric(10,2) NOT NULL,
  ecart_pourcentage numeric(5,2) NOT NULL,
  transporteur_code varchar(100),
  facteur_division_utilise integer,
  recommandations jsonb,
  statut varchar(50) DEFAULT 'nouveau',
  traite_par uuid REFERENCES auth.users(id),
  date_traitement timestamp with time zone,
  notes_traitement text,
  date_creation timestamp with time zone DEFAULT now(),
  CONSTRAINT ecart_positif CHECK (ecart_kg >= 0 AND ecart_pourcentage >= 0)
);

-- Insert config par défaut
INSERT INTO alerte_poids_volumetrique_config (
  seuil_ecart_pourcentage,
  seuil_poids_minimum_kg,
  description
) VALUES (
  20.00,
  1.00,
  'Configuration par défaut: alerte si poids volumétrique > poids réel de +20%'
) ON CONFLICT DO NOTHING;

-- Fonction pour calculer les recommandations d'optimisation
CREATE OR REPLACE FUNCTION generer_recommandations_optimisation(
  p_commande_id uuid,
  p_poids_reel_kg numeric,
  p_poids_volumetrique_kg numeric,
  p_ecart_pourcentage numeric
)
RETURNS jsonb AS $$
DECLARE
  v_recommandations jsonb := '[]'::jsonb;
  v_produits_volumineux RECORD;
  v_count_produits integer;
BEGIN
  -- Recommandation 1: Optimiser l'emballage si écart > 30%
  IF p_ecart_pourcentage > 30 THEN
    v_recommandations := v_recommandations || jsonb_build_object(
      'type', 'emballage',
      'priorite', 'haute',
      'titre', 'Optimisation emballage critique',
      'description', format('Écart de %s%% détecté. Considérez un emballage plus compact pour réduire les dimensions.', 
                           ROUND(p_ecart_pourcentage, 1)),
      'economies_estimees_pct', ROUND((p_ecart_pourcentage / 2), 1),
      'action', 'Choisir carton plus adapté aux dimensions réelles'
    );
  ELSIF p_ecart_pourcentage > 20 THEN
    v_recommandations := v_recommandations || jsonb_build_object(
      'type', 'emballage',
      'priorite', 'moyenne',
      'titre', 'Opportunité d''optimisation emballage',
      'description', format('Écart de %s%% détecté. Une optimisation de l''emballage pourrait réduire les coûts.', 
                           ROUND(p_ecart_pourcentage, 1)),
      'economies_estimees_pct', ROUND((p_ecart_pourcentage / 3), 1),
      'action', 'Évaluer des options d''emballage plus compactes'
    );
  END IF;

  -- Recommandation 2: Identifier produits volumineux mais légers
  SELECT COUNT(*) INTO v_count_produits
  FROM ligne_commande lc
  JOIN produit p ON lc.produit_id = p.id
  WHERE lc.commande_id = p_commande_id
    AND p.longueur_cm IS NOT NULL
    AND p.largeur_cm IS NOT NULL
    AND p.hauteur_cm IS NOT NULL
    AND p.poids_unitaire IS NOT NULL
    AND (p.longueur_cm * p.largeur_cm * p.hauteur_cm) / NULLIF(p.poids_unitaire, 0) > 5000;

  IF v_count_produits > 0 THEN
    v_recommandations := v_recommandations || jsonb_build_object(
      'type', 'produits_volumineux',
      'priorite', 'moyenne',
      'titre', 'Produits volumineux détectés',
      'description', format('%s produit(s) ont un ratio volume/poids très élevé', v_count_produits),
      'action', 'Grouper ces produits ou négocier tarifs spéciaux avec transporteur',
      'nombre_produits', v_count_produits
    );
  END IF;

  -- Recommandation 3: Changement de transporteur si facteur division différent
  IF p_ecart_pourcentage > 25 THEN
    v_recommandations := v_recommandations || jsonb_build_object(
      'type', 'transporteur',
      'priorite', 'basse',
      'titre', 'Évaluer transporteurs alternatifs',
      'description', 'Certains transporteurs utilisent des facteurs de division plus avantageux (ex: 6000 vs 5000)',
      'action', 'Comparer les tarifs avec GLS (6000) ou DPD (6000) qui ont des facteurs plus favorables',
      'economies_potentielles', 'Jusqu''à 20% sur poids volumétrique'
    );
  END IF;

  -- Recommandation 4: Consolidation si plusieurs commandes même client
  SELECT COUNT(DISTINCT c.id) INTO v_count_produits
  FROM commande c
  WHERE c.client_id = (SELECT client_id FROM commande WHERE id = p_commande_id)
    AND c.statut_wms IN ('en_attente_reappro', 'stock_reserve')
    AND c.date_creation >= NOW() - INTERVAL '24 hours'
    AND c.id != p_commande_id;

  IF v_count_produits > 0 THEN
    v_recommandations := v_recommandations || jsonb_build_object(
      'type', 'consolidation',
      'priorite', 'haute',
      'titre', 'Opportunité de consolidation',
      'description', format('%s autre(s) commande(s) pour ce client peuvent être consolidées', v_count_produits),
      'action', 'Grouper les expéditions pour optimiser le poids volumétrique global',
      'nombre_commandes', v_count_produits
    );
  END IF;

  RETURN v_recommandations;
END;
$$ LANGUAGE plpgsql STABLE;

-- Fonction principale de vérification et génération d'alerte
CREATE OR REPLACE FUNCTION verifier_alerte_poids_volumetrique()
RETURNS TRIGGER AS $$
DECLARE
  v_config RECORD;
  v_ecart_kg numeric;
  v_ecart_pct numeric;
  v_recommandations jsonb;
  v_alerte_existante uuid;
BEGIN
  -- Ne traiter que si poids volumétrique et réel sont renseignés
  IF NEW.poids_volumetrique_kg IS NULL OR NEW.poids_reel_kg IS NULL THEN
    RETURN NEW;
  END IF;

  -- Ne traiter que si poids volumétrique > poids réel
  IF NEW.poids_volumetrique_kg <= NEW.poids_reel_kg THEN
    RETURN NEW;
  END IF;

  -- Récupérer la config active
  SELECT * INTO v_config
  FROM alerte_poids_volumetrique_config
  WHERE actif = true
  ORDER BY date_creation DESC
  LIMIT 1;

  -- Si pas de config, utiliser défaut 20%
  IF v_config IS NULL THEN
    v_config.seuil_ecart_pourcentage := 20.00;
    v_config.seuil_poids_minimum_kg := 1.00;
  END IF;

  -- Calculer l'écart
  v_ecart_kg := NEW.poids_volumetrique_kg - NEW.poids_reel_kg;
  v_ecart_pct := (v_ecart_kg / NULLIF(NEW.poids_reel_kg, 0)) * 100;

  -- Vérifier les seuils
  IF v_ecart_pct >= v_config.seuil_ecart_pourcentage 
     AND NEW.poids_reel_kg >= v_config.seuil_poids_minimum_kg THEN
    
    -- Vérifier si alerte existe déjà pour cette commande (éviter doublons)
    SELECT id INTO v_alerte_existante
    FROM alerte_poids_volumetrique
    WHERE commande_id = NEW.id
      AND statut IN ('nouveau', 'en_cours');

    -- Si pas d'alerte existante, en créer une
    IF v_alerte_existante IS NULL THEN
      -- Générer recommandations
      v_recommandations := generer_recommandations_optimisation(
        NEW.id,
        NEW.poids_reel_kg,
        NEW.poids_volumetrique_kg,
        v_ecart_pct
      );

      -- Créer l'alerte
      INSERT INTO alerte_poids_volumetrique (
        commande_id,
        numero_commande,
        client_id,
        poids_reel_kg,
        poids_volumetrique_kg,
        ecart_kg,
        ecart_pourcentage,
        transporteur_code,
        facteur_division_utilise,
        recommandations,
        statut
      ) VALUES (
        NEW.id,
        NEW.numero_commande,
        NEW.client_id,
        NEW.poids_reel_kg,
        NEW.poids_volumetrique_kg,
        v_ecart_kg,
        v_ecart_pct,
        NEW.transporteur_choisi,
        (SELECT facteur_division 
         FROM transporteur_facteur_division 
         WHERE transporteur_code = UPPER(COALESCE(NEW.transporteur_choisi, 'DEFAULT')) 
         LIMIT 1),
        v_recommandations,
        'nouveau'
      );

      -- TODO: Si notification_email activée, envoyer email via edge function
    END IF;
  END IF;

  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Créer le trigger sur commande
DROP TRIGGER IF EXISTS trigger_alerte_poids_volumetrique ON commande;
CREATE TRIGGER trigger_alerte_poids_volumetrique
AFTER INSERT OR UPDATE OF poids_volumetrique_kg, poids_reel_kg
ON commande
FOR EACH ROW
EXECUTE FUNCTION verifier_alerte_poids_volumetrique();

-- Index pour performances
CREATE INDEX IF NOT EXISTS idx_alerte_poids_volumetrique_commande 
ON alerte_poids_volumetrique(commande_id);

CREATE INDEX IF NOT EXISTS idx_alerte_poids_volumetrique_statut 
ON alerte_poids_volumetrique(statut, date_creation DESC);

CREATE INDEX IF NOT EXISTS idx_alerte_poids_volumetrique_client 
ON alerte_poids_volumetrique(client_id, date_creation DESC);

-- RLS policies
ALTER TABLE alerte_poids_volumetrique_config ENABLE ROW LEVEL SECURITY;
ALTER TABLE alerte_poids_volumetrique ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Admin full access alerte_config"
ON alerte_poids_volumetrique_config
FOR ALL
TO authenticated
USING (has_role(auth.uid(), 'admin'::app_role))
WITH CHECK (has_role(auth.uid(), 'admin'::app_role));

CREATE POLICY "Gestionnaire read alerte_config"
ON alerte_poids_volumetrique_config
FOR SELECT
TO authenticated
USING (has_role(auth.uid(), 'gestionnaire'::app_role));

CREATE POLICY "Admin full access alertes"
ON alerte_poids_volumetrique
FOR ALL
TO authenticated
USING (has_role(auth.uid(), 'admin'::app_role))
WITH CHECK (has_role(auth.uid(), 'admin'::app_role));

CREATE POLICY "Gestionnaire manage alertes"
ON alerte_poids_volumetrique
FOR ALL
TO authenticated
USING (has_role(auth.uid(), 'gestionnaire'::app_role))
WITH CHECK (has_role(auth.uid(), 'gestionnaire'::app_role));

CREATE POLICY "Client read own alertes"
ON alerte_poids_volumetrique
FOR SELECT
TO authenticated
USING (
  has_role(auth.uid(), 'client'::app_role) 
  AND client_id IN (
    SELECT client_id FROM profiles WHERE id = auth.uid()
  )
);

-- Commentaires
COMMENT ON TABLE alerte_poids_volumetrique_config IS 'Configuration des seuils d''alerte pour le poids volumétrique';
COMMENT ON TABLE alerte_poids_volumetrique IS 'Alertes générées quand poids volumétrique dépasse trop le poids réel, indiquant opportunités d''optimisation';
COMMENT ON FUNCTION generer_recommandations_optimisation IS 'Génère des recommandations personnalisées d''optimisation basées sur l''analyse de la commande';
COMMENT ON FUNCTION verifier_alerte_poids_volumetrique IS 'Trigger function qui vérifie si une alerte doit être générée après calcul poids volumétrique';
