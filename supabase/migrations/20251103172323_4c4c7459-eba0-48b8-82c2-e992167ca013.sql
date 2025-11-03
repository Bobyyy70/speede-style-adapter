-- Rendre numero_mouvement optionnel avec auto-génération
ALTER TABLE mouvement_stock 
ALTER COLUMN numero_mouvement SET DEFAULT 'MVT-' || to_char(now(), 'YYYYMMDD') || '-' || substring(gen_random_uuid()::text, 1, 8);

-- Rendre la colonne nullable pour éviter les erreurs d'insertion
ALTER TABLE mouvement_stock 
ALTER COLUMN numero_mouvement DROP NOT NULL;