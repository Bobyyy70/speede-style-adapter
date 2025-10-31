-- Migration 1: Machine à états pour les statuts de commande

-- Créer le type ENUM pour les statuts de commande
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

-- Table pour l'historique des transitions de statuts
CREATE TABLE IF NOT EXISTS commande_transition_log (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  commande_id UUID NOT NULL REFERENCES commande(id) ON DELETE CASCADE,
  statut_precedent TEXT,
  statut_nouveau TEXT NOT NULL,
  date_transition TIMESTAMP WITH TIME ZONE DEFAULT now(),
  effectue_par UUID REFERENCES auth.users(id),
  remarques TEXT,
  metadata JSONB DEFAULT '{}'::jsonb
);

-- Index pour optimiser les requêtes
CREATE INDEX idx_commande_transition_log_commande ON commande_transition_log(commande_id);
CREATE INDEX idx_commande_transition_log_date ON commande_transition_log(date_transition);

-- Fonction pour valider et exécuter les transitions de statuts
CREATE OR REPLACE FUNCTION transition_statut_commande(
  p_commande_id UUID,
  p_nouveau_statut TEXT,
  p_remarques TEXT DEFAULT NULL
) RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_statut_actuel TEXT;
  v_transition_valide BOOLEAN := FALSE;
  v_result JSONB;
BEGIN
  -- Récupérer le statut actuel
  SELECT statut_wms INTO v_statut_actuel
  FROM commande
  WHERE id = p_commande_id;

  IF v_statut_actuel IS NULL THEN
    RETURN jsonb_build_object(
      'success', false,
      'error', 'Commande non trouvée'
    );
  END IF;

  -- Valider la transition selon les règles métier
  v_transition_valide := CASE
    -- Depuis en_attente_reappro
    WHEN v_statut_actuel = 'En attente de réappro' AND p_nouveau_statut IN ('Réservé', 'Annulé') THEN TRUE
    -- Depuis stock_reserve (Réservé)
    WHEN v_statut_actuel = 'Réservé' AND p_nouveau_statut IN ('Prêt à préparer', 'Annulé') THEN TRUE
    -- Depuis en_picking (Prêt à préparer)
    WHEN v_statut_actuel = 'Prêt à préparer' AND p_nouveau_statut IN ('En préparation', 'Annulé') THEN TRUE
    -- Depuis en_preparation (En préparation)
    WHEN v_statut_actuel = 'En préparation' AND p_nouveau_statut IN ('Prêt pour expédition', 'Annulé', 'Archivé') THEN TRUE
    -- Depuis pret_expedition (Prêt pour expédition)
    WHEN v_statut_actuel = 'Prêt pour expédition' AND p_nouveau_statut IN ('Expédié', 'Annulé') THEN TRUE
    -- Depuis expedie (Expédié)
    WHEN v_statut_actuel = 'Expédié' AND p_nouveau_statut IN ('Livré', 'Archivé') THEN TRUE
    -- Depuis annule (Annulé)
    WHEN v_statut_actuel = 'Annulé' AND p_nouveau_statut = 'Archivé' THEN TRUE
    -- Toujours permettre Archivé ou Erreur
    WHEN p_nouveau_statut IN ('Archivé', 'Erreur') THEN TRUE
    ELSE FALSE
  END;

  IF NOT v_transition_valide THEN
    RETURN jsonb_build_object(
      'success', false,
      'error', format('Transition invalide de "%s" vers "%s"', v_statut_actuel, p_nouveau_statut),
      'statut_actuel', v_statut_actuel,
      'statut_demande', p_nouveau_statut
    );
  END IF;

  -- Enregistrer la transition dans le log
  INSERT INTO commande_transition_log (
    commande_id,
    statut_precedent,
    statut_nouveau,
    effectue_par,
    remarques
  ) VALUES (
    p_commande_id,
    v_statut_actuel,
    p_nouveau_statut,
    auth.uid(),
    p_remarques
  );

  -- Mettre à jour le statut de la commande
  UPDATE commande
  SET 
    statut_wms = p_nouveau_statut,
    date_modification = now()
  WHERE id = p_commande_id;

  RETURN jsonb_build_object(
    'success', true,
    'statut_precedent', v_statut_actuel,
    'statut_nouveau', p_nouveau_statut,
    'message', format('Transition de "%s" vers "%s" effectuée avec succès', v_statut_actuel, p_nouveau_statut)
  );
END;
$$;

-- RLS pour commande_transition_log
ALTER TABLE commande_transition_log ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Admin full access on commande_transition_log"
  ON commande_transition_log
  FOR ALL
  TO authenticated
  USING (has_role(auth.uid(), 'admin'::app_role))
  WITH CHECK (has_role(auth.uid(), 'admin'::app_role));

CREATE POLICY "Gestionnaire read commande_transition_log"
  ON commande_transition_log
  FOR SELECT
  TO authenticated
  USING (has_role(auth.uid(), 'gestionnaire'::app_role));

CREATE POLICY "Operateur read own transitions"
  ON commande_transition_log
  FOR SELECT
  TO authenticated
  USING (has_role(auth.uid(), 'operateur'::app_role));

-- Commentaires
COMMENT ON TABLE commande_transition_log IS 'Historique des transitions de statuts de commandes pour audit et traçabilité';
COMMENT ON FUNCTION transition_statut_commande IS 'Fonction pour valider et exécuter les transitions de statuts selon la machine à états';