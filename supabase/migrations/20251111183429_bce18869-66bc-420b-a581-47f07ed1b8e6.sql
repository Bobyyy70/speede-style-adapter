-- Création de la table regle_validation_commande
CREATE TABLE IF NOT EXISTS regle_validation_commande (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  nom_regle VARCHAR(255) NOT NULL,
  description TEXT,
  
  -- Configuration
  conditions JSONB NOT NULL,
  action_a_effectuer VARCHAR(50) NOT NULL CHECK (action_a_effectuer IN ('bloquer', 'exiger_validation', 'alerter')),
  niveau_validation VARCHAR(50) CHECK (niveau_validation IN ('gestionnaire', 'admin', 'client_specifique')),
  
  -- Statut de blocage
  statut_bloque VARCHAR(50) DEFAULT 'validation_requise',
  message_utilisateur TEXT,
  
  -- Approbateurs
  approbateurs_autorises UUID[],
  client_id UUID REFERENCES client(id) ON DELETE CASCADE,
  
  -- Métadonnées
  priorite INTEGER DEFAULT 100,
  actif BOOLEAN DEFAULT true,
  delai_max_jours INTEGER,
  
  -- Audit
  date_creation TIMESTAMPTZ DEFAULT NOW(),
  date_modification TIMESTAMPTZ DEFAULT NOW(),
  created_by UUID REFERENCES auth.users(id)
);

-- Création de la table commande_validation_log
CREATE TABLE IF NOT EXISTS commande_validation_log (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  commande_id UUID NOT NULL REFERENCES commande(id) ON DELETE CASCADE,
  regle_id UUID REFERENCES regle_validation_commande(id) ON DELETE SET NULL,
  
  -- Validation
  statut_validation VARCHAR(50) NOT NULL CHECK (statut_validation IN ('en_attente', 'approuve', 'refuse', 'expire')),
  validateur_id UUID REFERENCES auth.users(id),
  date_demande TIMESTAMPTZ DEFAULT NOW(),
  date_reponse TIMESTAMPTZ,
  
  -- Détails
  raison_blocage TEXT,
  commentaire_validateur TEXT,
  metadata JSONB DEFAULT '{}',
  
  -- Notifications
  notification_envoyee BOOLEAN DEFAULT false,
  destinataires_notification UUID[]
);

-- Ajout de colonnes à la table commande
ALTER TABLE commande 
  ADD COLUMN IF NOT EXISTS validation_requise BOOLEAN DEFAULT false,
  ADD COLUMN IF NOT EXISTS validation_statut VARCHAR(50),
  ADD COLUMN IF NOT EXISTS validation_message TEXT;

-- Index pour performances
CREATE INDEX IF NOT EXISTS idx_regle_validation_actif ON regle_validation_commande(actif, priorite);
CREATE INDEX IF NOT EXISTS idx_regle_validation_client ON regle_validation_commande(client_id) WHERE client_id IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_commande_validation_commande ON commande_validation_log(commande_id);
CREATE INDEX IF NOT EXISTS idx_commande_validation_statut ON commande_validation_log(statut_validation);
CREATE INDEX IF NOT EXISTS idx_commande_validation_validateur ON commande_validation_log(validateur_id);

-- RLS Policies pour regle_validation_commande
ALTER TABLE regle_validation_commande ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Admin full access validation rules"
ON regle_validation_commande FOR ALL
TO authenticated
USING (has_role(auth.uid(), 'admin'))
WITH CHECK (has_role(auth.uid(), 'admin'));

CREATE POLICY "Gestionnaire read validation rules"
ON regle_validation_commande FOR SELECT
TO authenticated
USING (has_role(auth.uid(), 'gestionnaire') OR has_role(auth.uid(), 'admin'));

-- RLS Policies pour commande_validation_log
ALTER TABLE commande_validation_log ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Admin full access validation log"
ON commande_validation_log FOR ALL
TO authenticated
USING (has_role(auth.uid(), 'admin'))
WITH CHECK (has_role(auth.uid(), 'admin'));

CREATE POLICY "Gestionnaire read validation log"
ON commande_validation_log FOR SELECT
TO authenticated
USING (has_role(auth.uid(), 'gestionnaire') OR has_role(auth.uid(), 'admin'));

CREATE POLICY "Approbateurs can see assigned validations"
ON commande_validation_log FOR SELECT
TO authenticated
USING (
  auth.uid() = ANY(destinataires_notification) OR
  has_role(auth.uid(), 'admin') OR
  has_role(auth.uid(), 'gestionnaire')
);

CREATE POLICY "Approbateurs can update validations"
ON commande_validation_log FOR UPDATE
TO authenticated
USING (
  auth.uid() = ANY(destinataires_notification) OR
  has_role(auth.uid(), 'admin') OR
  has_role(auth.uid(), 'gestionnaire')
)
WITH CHECK (statut_validation IN ('approuve', 'refuse'));

-- Fonction pour mettre à jour date_modification
CREATE OR REPLACE FUNCTION update_regle_validation_date_modification()
RETURNS TRIGGER AS $$
BEGIN
  NEW.date_modification = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER trigger_update_regle_validation_date_modification
BEFORE UPDATE ON regle_validation_commande
FOR EACH ROW
EXECUTE FUNCTION update_regle_validation_date_modification();