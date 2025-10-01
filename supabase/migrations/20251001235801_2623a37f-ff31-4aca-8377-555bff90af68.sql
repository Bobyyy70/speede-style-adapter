-- Ajouter une contrainte unique sur numero_commande pour éviter les doublons
ALTER TABLE public.commande 
ADD CONSTRAINT commande_numero_commande_unique UNIQUE (numero_commande);

-- Créer un index pour optimiser les recherches par numero_commande
CREATE INDEX IF NOT EXISTS idx_commande_numero_commande ON public.commande(numero_commande);