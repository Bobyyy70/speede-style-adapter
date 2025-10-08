-- Ajouter les colonnes de capacité manquantes à la table emplacement
ALTER TABLE public.emplacement 
ADD COLUMN IF NOT EXISTS capacite_max_kg NUMERIC,
ADD COLUMN IF NOT EXISTS capacite_max_unites INTEGER;

-- Migrer les données existantes de capacite_maximale vers capacite_max_kg
UPDATE public.emplacement 
SET capacite_max_kg = capacite_maximale 
WHERE capacite_maximale IS NOT NULL AND capacite_max_kg IS NULL;

-- Optionnellement, supprimer l'ancienne colonne capacite_maximale si elle n'est plus utilisée
-- ALTER TABLE public.emplacement DROP COLUMN IF EXISTS capacite_maximale;