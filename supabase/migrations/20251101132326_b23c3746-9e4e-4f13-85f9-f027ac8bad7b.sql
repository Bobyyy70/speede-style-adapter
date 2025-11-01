-- Migration: Création du type ENUM statut_commande
-- Date: 2025-11-01
-- Description: Définit les statuts de commande avec ENUM PostgreSQL

-- 1. Créer le type ENUM (si n'existe pas déjà)
DO $$ 
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'statut_commande_enum') THEN
    CREATE TYPE public.statut_commande_enum AS ENUM (
      'en_attente_reappro',
      'stock_reserve',
      'en_preparation',
      'en_picking',
      'picking_termine',
      'pret_expedition',
      'etiquette_generee',
      'expedie',
      'livre',
      'annule',
      'erreur'
    );
  END IF;
END $$;

-- 2. Ajouter un commentaire descriptif
COMMENT ON TYPE public.statut_commande_enum IS 'Statuts possibles pour une commande dans le système WMS';

-- 3. Créer une fonction helper pour obtenir le label français
CREATE OR REPLACE FUNCTION public.get_statut_label(statut statut_commande_enum)
RETURNS TEXT
LANGUAGE plpgsql
IMMUTABLE
AS $$
BEGIN
  RETURN CASE statut
    WHEN 'en_attente_reappro' THEN 'En attente de réappro'
    WHEN 'stock_reserve' THEN 'Stock réservé'
    WHEN 'en_preparation' THEN 'En préparation'
    WHEN 'en_picking' THEN 'En picking'
    WHEN 'picking_termine' THEN 'Picking terminé'
    WHEN 'pret_expedition' THEN 'Prêt à expédier'
    WHEN 'etiquette_generee' THEN 'Étiquette générée'
    WHEN 'expedie' THEN 'Expédié'
    WHEN 'livre' THEN 'Livré'
    WHEN 'annule' THEN 'Annulé'
    WHEN 'erreur' THEN 'Erreur'
    ELSE statut::TEXT
  END;
END;
$$;

-- 4. Créer une table de mapping pour les anciennes valeurs
CREATE TABLE IF NOT EXISTS public.statut_migration_map (
  ancien_statut TEXT PRIMARY KEY,
  nouveau_statut statut_commande_enum NOT NULL,
  date_migration TIMESTAMPTZ DEFAULT NOW()
);

-- 5. Insérer les mappings de migration
INSERT INTO public.statut_migration_map (ancien_statut, nouveau_statut) VALUES
  ('En attente de réappro', 'en_attente_reappro'),
  ('Prêt à préparer', 'stock_reserve'),
  ('Réservé', 'stock_reserve'),
  ('En préparation', 'en_preparation'),
  ('prete', 'pret_expedition'),
  ('expediee', 'expedie'),
  ('Expédié', 'expedie'),
  ('Livré', 'livre'),
  ('Annulée', 'annule'),
  ('Annulé', 'annule')
ON CONFLICT (ancien_statut) DO NOTHING;