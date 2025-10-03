-- Ajouter le champ protection_individuelle à la table produit
ALTER TABLE public.produit 
ADD COLUMN protection_individuelle boolean DEFAULT false;

COMMENT ON COLUMN public.produit.protection_individuelle IS 'Indique si le produit nécessite une protection individuelle lors de l''emballage';

-- La categorie_emballage sera calculée automatiquement:
-- protection_individuelle = true -> categorie 2
-- protection_individuelle = false -> categorie 1
-- (catégories 3 et 4 seront gérées selon d'autres critères internes)