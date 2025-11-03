-- Ajouter colonne de vérification pour mapping SendCloud
ALTER TABLE commande 
ADD COLUMN IF NOT EXISTS sendcloud_reference TEXT;

-- Index pour recherche rapide par référence SendCloud
CREATE INDEX IF NOT EXISTS idx_commande_sendcloud_ref ON commande(sendcloud_reference);

-- Commentaire explicatif
COMMENT ON COLUMN commande.sendcloud_reference IS 'ID interne de la commande utilisé comme external_reference chez SendCloud pour garantir le bon mapping des trackings';