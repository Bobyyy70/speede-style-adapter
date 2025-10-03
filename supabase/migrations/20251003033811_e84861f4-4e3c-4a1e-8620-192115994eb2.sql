-- Mettre à jour les statuts de mouvement_stock avec les 10 nouveaux statuts
-- Les 10 statuts reflètent la position exacte du produit à tout moment:
-- 1. En attente de réappro (commandé chez fournisseur)
-- 2. Mis en stock (en cours de mise en stock)
-- 3. Stock physique (en stock disponible)
-- 4. Réservé (réservé pour une commande)
-- 5. Picking (en cours de prélèvement)
-- 6. Préparation (au poste de préparation)
-- 7. Attente d'expédition (prêt à expédier)
-- 8. Expédié (pris par transporteur)
-- 9. Livré (livré au client)
-- 10. Bac de restockage (commande annulée, à remettre en stock)

-- Modifier la colonne statut_mouvement pour accepter les nouveaux statuts
ALTER TABLE mouvement_stock 
DROP CONSTRAINT IF EXISTS mouvement_stock_statut_mouvement_check;

ALTER TABLE mouvement_stock
ALTER COLUMN statut_mouvement SET DEFAULT 'stock_physique';

ALTER TABLE mouvement_stock
ADD CONSTRAINT mouvement_stock_statut_mouvement_check
CHECK (statut_mouvement IN (
  'en_attente_reappro',
  'mis_en_stock',
  'stock_physique',
  'reserve',
  'picking',
  'preparation',
  'attente_expedition',
  'expedie',
  'livre',
  'bac_restockage'
));

-- Table pour les sessions de préparation
-- Une session = configuration de filtres appliquée aux commandes
CREATE TABLE IF NOT EXISTS session_preparation (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  nom_session VARCHAR(255) NOT NULL,
  description TEXT,
  
  -- Configuration des filtres (structure JSON flexible)
  filtres JSONB NOT NULL DEFAULT '{}',
  
  -- Ordre de priorité pour "premier qui imprime gagne"
  ordre_priorite INTEGER NOT NULL DEFAULT 0,
  
  -- Limite de commandes par batch
  max_commandes INTEGER,
  
  -- Configuration cronjob optionnelle
  cron_enabled BOOLEAN DEFAULT false,
  cron_expression VARCHAR(100),
  derniere_execution TIMESTAMP WITH TIME ZONE,
  
  -- Statut de la session
  statut VARCHAR(50) DEFAULT 'active' CHECK (statut IN ('active', 'inactive', 'archive')),
  
  -- Métadonnées
  created_by UUID REFERENCES auth.users(id),
  date_creation TIMESTAMP WITH TIME ZONE DEFAULT now(),
  date_modification TIMESTAMP WITH TIME ZONE DEFAULT now()
);

-- Table de liaison many-to-many entre sessions et commandes
-- Une commande peut apparaître dans plusieurs sessions (filtres différents)
CREATE TABLE IF NOT EXISTS session_commande (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  session_id UUID NOT NULL REFERENCES session_preparation(id) ON DELETE CASCADE,
  commande_id UUID NOT NULL REFERENCES commande(id) ON DELETE CASCADE,
  
  -- Qui a "pris" cette commande dans cette session (premier qui imprime)
  pris_par UUID REFERENCES auth.users(id),
  date_prise TIMESTAMP WITH TIME ZONE,
  
  -- Statut de traitement dans cette session
  statut_session VARCHAR(50) DEFAULT 'a_preparer' CHECK (statut_session IN (
    'a_preparer',
    'en_cours',
    'termine',
    'annule'
  )),
  
  date_creation TIMESTAMP WITH TIME ZONE DEFAULT now(),
  
  UNIQUE(session_id, commande_id)
);

-- Table pour les listes de picking consolidées par session
-- Consolide tous les produits à picker pour une session donnée
CREATE TABLE IF NOT EXISTS session_picking_consolidee (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  session_id UUID NOT NULL REFERENCES session_preparation(id) ON DELETE CASCADE,
  produit_id UUID NOT NULL REFERENCES produit(id) ON DELETE CASCADE,
  
  -- Quantité totale à picker pour tous les commandes de la session
  quantite_totale INTEGER NOT NULL DEFAULT 0,
  
  -- Liste des emplacements où trouver le produit (JSONB array)
  emplacements JSONB DEFAULT '[]',
  
  -- Nombre de commandes différentes nécessitant ce produit
  nombre_commandes INTEGER NOT NULL DEFAULT 0,
  
  -- Statut du picking pour ce produit
  statut_picking VARCHAR(50) DEFAULT 'a_picker' CHECK (statut_picking IN (
    'a_picker',
    'en_cours',
    'termine',
    'manquant'
  )),
  
  date_creation TIMESTAMP WITH TIME ZONE DEFAULT now(),
  date_modification TIMESTAMP WITH TIME ZONE DEFAULT now(),
  
  UNIQUE(session_id, produit_id)
);

-- Indexes pour performance
CREATE INDEX idx_session_preparation_statut ON session_preparation(statut);
CREATE INDEX idx_session_preparation_ordre ON session_preparation(ordre_priorite);
CREATE INDEX idx_session_commande_session ON session_commande(session_id);
CREATE INDEX idx_session_commande_commande ON session_commande(commande_id);
CREATE INDEX idx_session_commande_statut ON session_commande(statut_session);
CREATE INDEX idx_session_picking_session ON session_picking_consolidee(session_id);
CREATE INDEX idx_session_picking_produit ON session_picking_consolidee(produit_id);
CREATE INDEX idx_mouvement_stock_statut ON mouvement_stock(statut_mouvement);

-- RLS Policies pour session_preparation
ALTER TABLE session_preparation ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Admin full access on session_preparation"
  ON session_preparation FOR ALL
  USING (has_role(auth.uid(), 'admin'));

CREATE POLICY "Operateur read session_preparation"
  ON session_preparation FOR SELECT
  USING (has_role(auth.uid(), 'operateur'));

CREATE POLICY "Operateur insert session_preparation"
  ON session_preparation FOR INSERT
  WITH CHECK (has_role(auth.uid(), 'operateur'));

CREATE POLICY "Operateur update session_preparation"
  ON session_preparation FOR UPDATE
  USING (has_role(auth.uid(), 'operateur'));

CREATE POLICY "Gestionnaire read session_preparation"
  ON session_preparation FOR SELECT
  USING (has_role(auth.uid(), 'gestionnaire'));

-- RLS Policies pour session_commande
ALTER TABLE session_commande ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Admin full access on session_commande"
  ON session_commande FOR ALL
  USING (has_role(auth.uid(), 'admin'));

CREATE POLICY "Operateur read session_commande"
  ON session_commande FOR SELECT
  USING (has_role(auth.uid(), 'operateur'));

CREATE POLICY "Operateur insert session_commande"
  ON session_commande FOR INSERT
  WITH CHECK (has_role(auth.uid(), 'operateur'));

CREATE POLICY "Operateur update session_commande"
  ON session_commande FOR UPDATE
  USING (has_role(auth.uid(), 'operateur'));

CREATE POLICY "Gestionnaire read session_commande"
  ON session_commande FOR SELECT
  USING (has_role(auth.uid(), 'gestionnaire'));

-- RLS Policies pour session_picking_consolidee
ALTER TABLE session_picking_consolidee ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Admin full access on session_picking_consolidee"
  ON session_picking_consolidee FOR ALL
  USING (has_role(auth.uid(), 'admin'));

CREATE POLICY "Operateur read session_picking_consolidee"
  ON session_picking_consolidee FOR SELECT
  USING (has_role(auth.uid(), 'operateur'));

CREATE POLICY "Operateur insert session_picking_consolidee"
  ON session_picking_consolidee FOR INSERT
  WITH CHECK (has_role(auth.uid(), 'operateur'));

CREATE POLICY "Operateur update session_picking_consolidee"
  ON session_picking_consolidee FOR UPDATE
  USING (has_role(auth.uid(), 'operateur'));

CREATE POLICY "Gestionnaire read session_picking_consolidee"
  ON session_picking_consolidee FOR SELECT
  USING (has_role(auth.uid(), 'gestionnaire'));

-- Trigger pour mettre à jour date_modification
CREATE OR REPLACE FUNCTION update_session_preparation_date_modification()
RETURNS TRIGGER AS $$
BEGIN
  NEW.date_modification = now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public;

CREATE TRIGGER update_session_preparation_date_modification
  BEFORE UPDATE ON session_preparation
  FOR EACH ROW
  EXECUTE FUNCTION update_session_preparation_date_modification();

CREATE TRIGGER update_session_picking_date_modification
  BEFORE UPDATE ON session_picking_consolidee
  FOR EACH ROW
  EXECUTE FUNCTION update_session_preparation_date_modification();