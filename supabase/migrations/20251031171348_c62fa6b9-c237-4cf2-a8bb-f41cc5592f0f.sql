-- ============================================================================
-- PHASE 1.1: Machine à États & Statuts ENUM
-- ============================================================================

-- ÉTAPE 1: Créer le type ENUM pour les statuts
DO $$ BEGIN
  CREATE TYPE statut_commande_enum AS ENUM (
    'en_attente_reappro',
    'stock_reserve',
    'en_picking',
    'picking_termine',
    'en_preparation',
    'pret_expedition',
    'etiquette_generee',
    'expedie',
    'livre',
    'annule',
    'erreur'
  );
EXCEPTION
  WHEN duplicate_object THEN
    RAISE NOTICE 'Type statut_commande_enum existe déjà';
END $$;

-- ÉTAPE 2: Migrer la colonne statut_wms vers le nouveau type ENUM
ALTER TABLE commande ADD COLUMN IF NOT EXISTS statut_enum statut_commande_enum;

UPDATE commande SET statut_enum =
  CASE
    WHEN LOWER(statut_wms) = 'en attente de réappro' THEN 'en_attente_reappro'
    WHEN LOWER(statut_wms) = 'prêt à préparer' THEN 'stock_reserve'
    WHEN LOWER(statut_wms) = 'réservé' THEN 'stock_reserve'
    WHEN LOWER(statut_wms) = 'en picking' THEN 'en_picking'
    WHEN LOWER(statut_wms) = 'en préparation' THEN 'en_preparation'
    WHEN LOWER(statut_wms) = 'en attente d''expédition' THEN 'pret_expedition'
    WHEN LOWER(statut_wms) = 'pret_expedition' THEN 'pret_expedition'
    WHEN LOWER(statut_wms) = 'étiquette générée' THEN 'etiquette_generee'
    WHEN LOWER(statut_wms) = 'expédié' THEN 'expedie'
    WHEN LOWER(statut_wms) = 'expédiée' THEN 'expedie'
    WHEN LOWER(statut_wms) IN ('prete', 'expediee') THEN 'expedie'
    WHEN LOWER(statut_wms) = 'livré' THEN 'livre'
    WHEN LOWER(statut_wms) = 'annulée' THEN 'annule'
    ELSE 'en_attente_reappro'
  END::statut_commande_enum
WHERE statut_enum IS NULL;

-- Basculer les colonnes
ALTER TABLE commande RENAME COLUMN statut_wms TO statut_wms_old;
ALTER TABLE commande RENAME COLUMN statut_enum TO statut_wms;
ALTER TABLE commande ALTER COLUMN statut_wms SET NOT NULL;
ALTER TABLE commande ALTER COLUMN statut_wms SET DEFAULT 'en_attente_reappro';

DROP INDEX IF EXISTS idx_commande_statut_wms;
CREATE INDEX idx_commande_statut_wms ON commande(statut_wms);

-- ÉTAPE 3: Fonction RPC - Valider et exécuter transition de statut
CREATE OR REPLACE FUNCTION transition_statut_commande(
  p_commande_id UUID,
  p_nouveau_statut statut_commande_enum,
  p_utilisateur_id UUID DEFAULT NULL,
  p_raison TEXT DEFAULT NULL,
  p_metadata JSONB DEFAULT '{}'::jsonb
)
RETURNS JSON
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_statut_actuel statut_commande_enum;
  v_transition_valide BOOLEAN := false;
  v_message TEXT;
  v_numero_commande TEXT;
BEGIN
  SELECT statut_wms, numero_commande
  INTO v_statut_actuel, v_numero_commande
  FROM commande
  WHERE id = p_commande_id
  FOR UPDATE;

  IF NOT FOUND THEN
    RETURN json_build_object(
      'success', false,
      'error', 'Commande non trouvée',
      'commande_id', p_commande_id
    );
  END IF;

  IF v_statut_actuel = p_nouveau_statut THEN
    RETURN json_build_object(
      'success', true,
      'message', 'Statut déjà à jour',
      'statut_actuel', v_statut_actuel,
      'no_change', true
    );
  END IF;

  v_transition_valide := CASE
    WHEN v_statut_actuel = 'en_attente_reappro' AND p_nouveau_statut IN ('stock_reserve', 'annule')
      THEN true
    WHEN v_statut_actuel = 'stock_reserve' AND p_nouveau_statut IN ('en_picking', 'annule')
      THEN true
    WHEN v_statut_actuel = 'en_picking' AND p_nouveau_statut IN ('picking_termine', 'en_attente_reappro', 'erreur', 'annule')
      THEN true
    WHEN v_statut_actuel = 'picking_termine' AND p_nouveau_statut IN ('en_preparation', 'en_picking')
      THEN true
    WHEN v_statut_actuel = 'en_preparation' AND p_nouveau_statut IN ('pret_expedition', 'picking_termine', 'erreur', 'annule')
      THEN true
    WHEN v_statut_actuel = 'pret_expedition' AND p_nouveau_statut IN ('etiquette_generee', 'expedie', 'en_preparation', 'annule')
      THEN true
    WHEN v_statut_actuel = 'etiquette_generee' AND p_nouveau_statut IN ('expedie', 'pret_expedition', 'annule')
      THEN true
    WHEN v_statut_actuel = 'expedie' AND p_nouveau_statut IN ('livre', 'erreur')
      THEN true
    WHEN v_statut_actuel = 'livre' AND p_nouveau_statut = 'erreur'
      THEN true
    WHEN v_statut_actuel = 'erreur' AND p_nouveau_statut IN ('en_attente_reappro', 'stock_reserve', 'en_picking', 'en_preparation', 'pret_expedition', 'annule')
      THEN true
    WHEN p_nouveau_statut = 'annule' AND v_statut_actuel NOT IN ('annule', 'livre')
      THEN true
    ELSE false
  END;

  IF NOT v_transition_valide THEN
    RETURN json_build_object(
      'success', false,
      'error', format('Transition invalide: %s → %s', v_statut_actuel, p_nouveau_statut),
      'statut_actuel', v_statut_actuel,
      'statut_demande', p_nouveau_statut,
      'numero_commande', v_numero_commande
    );
  END IF;

  UPDATE commande
  SET statut_wms = p_nouveau_statut,
      date_modification = now()
  WHERE id = p_commande_id;

  INSERT INTO commande_transition_log (
    commande_id,
    statut_precedent,
    statut_nouveau,
    utilisateur_id,
    raison,
    metadata
  ) VALUES (
    p_commande_id,
    v_statut_actuel,
    p_nouveau_statut,
    p_utilisateur_id,
    p_raison,
    p_metadata
  );

  v_message := format('Commande %s: %s → %s', v_numero_commande, v_statut_actuel, p_nouveau_statut);

  RETURN json_build_object(
    'success', true,
    'statut_precedent', v_statut_actuel,
    'statut_nouveau', p_nouveau_statut,
    'numero_commande', v_numero_commande,
    'message', v_message
  );
END;
$$;

-- ÉTAPE 4: Fonction helper pour obtenir l'historique d'une commande
CREATE OR REPLACE FUNCTION get_commande_historique(p_commande_id UUID)
RETURNS TABLE (
  date_transition TIMESTAMP WITH TIME ZONE,
  statut_precedent TEXT,
  statut_nouveau TEXT,
  utilisateur_nom TEXT,
  raison TEXT,
  metadata JSONB
)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  RETURN QUERY
  SELECT
    ctl.date_transition,
    ctl.statut_precedent::TEXT,
    ctl.statut_nouveau::TEXT,
    COALESCE(p.nom_complet, 'Système') AS utilisateur_nom,
    ctl.raison,
    ctl.metadata
  FROM commande_transition_log ctl
  LEFT JOIN profiles p ON p.id = ctl.utilisateur_id
  WHERE ctl.commande_id = p_commande_id
  ORDER BY ctl.date_transition DESC;
END;
$$;

-- ÉTAPE 5: Fonction helper pour vérifier si une transition est valide
CREATE OR REPLACE FUNCTION peut_transitionner(
  p_statut_actuel statut_commande_enum,
  p_statut_cible statut_commande_enum
)
RETURNS BOOLEAN
LANGUAGE plpgsql
IMMUTABLE
AS $$
BEGIN
  RETURN CASE
    WHEN p_statut_actuel = 'en_attente_reappro' AND p_statut_cible IN ('stock_reserve', 'annule') THEN true
    WHEN p_statut_actuel = 'stock_reserve' AND p_statut_cible IN ('en_picking', 'annule') THEN true
    WHEN p_statut_actuel = 'en_picking' AND p_statut_cible IN ('picking_termine', 'en_attente_reappro', 'erreur', 'annule') THEN true
    WHEN p_statut_actuel = 'picking_termine' AND p_statut_cible IN ('en_preparation', 'en_picking') THEN true
    WHEN p_statut_actuel = 'en_preparation' AND p_statut_cible IN ('pret_expedition', 'picking_termine', 'erreur', 'annule') THEN true
    WHEN p_statut_actuel = 'pret_expedition' AND p_statut_cible IN ('etiquette_generee', 'expedie', 'en_preparation', 'annule') THEN true
    WHEN p_statut_actuel = 'etiquette_generee' AND p_statut_cible IN ('expedie', 'pret_expedition', 'annule') THEN true
    WHEN p_statut_actuel = 'expedie' AND p_statut_cible IN ('livre', 'erreur') THEN true
    WHEN p_statut_actuel = 'livre' AND p_statut_cible = 'erreur' THEN true
    WHEN p_statut_actuel = 'erreur' AND p_statut_cible IN ('en_attente_reappro', 'stock_reserve', 'en_picking', 'en_preparation', 'pret_expedition', 'annule') THEN true
    WHEN p_statut_cible = 'annule' AND p_statut_actuel NOT IN ('annule', 'livre') THEN true
    ELSE false
  END;
END;
$$;

-- ÉTAPE 6: Vue pour faciliter les requêtes sur les commandes avec statut
CREATE OR REPLACE VIEW v_commandes_avec_statut AS
SELECT
  c.*,
  c.statut_wms::TEXT as statut_libelle,
  CASE c.statut_wms
    WHEN 'en_attente_reappro' THEN 'En attente de réappro'
    WHEN 'stock_reserve' THEN 'Stock réservé'
    WHEN 'en_picking' THEN 'En picking'
    WHEN 'picking_termine' THEN 'Picking terminé'
    WHEN 'en_preparation' THEN 'En préparation'
    WHEN 'pret_expedition' THEN 'Prêt à expédier'
    WHEN 'etiquette_generee' THEN 'Étiquette générée'
    WHEN 'expedie' THEN 'Expédié'
    WHEN 'livre' THEN 'Livré'
    WHEN 'annule' THEN 'Annulé'
    WHEN 'erreur' THEN 'Erreur'
  END as statut_affichage_fr,
  (SELECT COUNT(*) FROM commande_transition_log WHERE commande_id = c.id) as nb_transitions
FROM commande c;