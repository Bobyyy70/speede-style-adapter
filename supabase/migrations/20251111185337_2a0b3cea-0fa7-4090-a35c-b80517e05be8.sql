-- Index pour optimiser les requêtes de validations
CREATE INDEX IF NOT EXISTS idx_commande_validation_required 
ON commande(statut_wms) 
WHERE statut_wms = 'en_attente_validation';

-- Index pour validation_statut
CREATE INDEX IF NOT EXISTS idx_commande_validation_statut
ON commande(validation_statut)
WHERE validation_requise = true;