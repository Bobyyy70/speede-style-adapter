-- Migration: Migration de la colonne statut_wms vers ENUM
-- Date: 2025-11-01
-- Description: Convertit statut_wms de TEXT vers statut_commande_enum

-- 1. Vérifier si la colonne est déjà de type ENUM
DO $$
DECLARE
  v_column_type TEXT;
BEGIN
  SELECT data_type INTO v_column_type
  FROM information_schema.columns
  WHERE table_schema = 'public'
    AND table_name = 'commande'
    AND column_name = 'statut_wms';

  -- Si c'est déjà un ENUM, on skip la migration
  IF v_column_type = 'USER-DEFINED' THEN
    RAISE NOTICE 'La colonne statut_wms est déjà de type ENUM';
    RETURN;
  END IF;

  -- 2. Ajouter une colonne temporaire avec le type ENUM
  ALTER TABLE public.commande
  ADD COLUMN IF NOT EXISTS statut_wms_new statut_commande_enum;

  -- 3. Migrer les données en utilisant la table de mapping
  UPDATE public.commande c
  SET statut_wms_new = m.nouveau_statut
  FROM public.statut_migration_map m
  WHERE c.statut_wms = m.ancien_statut;

  -- 4. Pour les valeurs qui matchent directement l'ENUM
  UPDATE public.commande
  SET statut_wms_new = statut_wms::statut_commande_enum
  WHERE statut_wms_new IS NULL
    AND statut_wms IN (
      'en_attente_reappro', 'stock_reserve', 'en_preparation',
      'en_picking', 'picking_termine', 'pret_expedition',
      'etiquette_generee', 'expedie', 'livre', 'annule', 'erreur'
    );

  -- 5. Valeur par défaut pour les cas non mappés
  UPDATE public.commande
  SET statut_wms_new = 'en_attente_reappro'
  WHERE statut_wms_new IS NULL;

  -- 6. Vérifier qu'il n'y a plus de NULL
  IF EXISTS (SELECT 1 FROM public.commande WHERE statut_wms_new IS NULL) THEN
    RAISE EXCEPTION 'Migration incomplète : des statuts ne sont pas mappés';
  END IF;

  -- 7. Supprimer l'ancienne colonne et renommer la nouvelle
  ALTER TABLE public.commande DROP COLUMN statut_wms;
  ALTER TABLE public.commande RENAME COLUMN statut_wms_new TO statut_wms;

  -- 8. Définir la valeur par défaut
  ALTER TABLE public.commande
  ALTER COLUMN statut_wms SET DEFAULT 'en_attente_reappro'::statut_commande_enum;

  -- 9. Ajouter une contrainte NOT NULL
  ALTER TABLE public.commande
  ALTER COLUMN statut_wms SET NOT NULL;

  -- 10. Créer un index pour les requêtes par statut
  CREATE INDEX IF NOT EXISTS idx_commande_statut_wms
  ON public.commande(statut_wms);

  -- 11. Ajouter un commentaire
  COMMENT ON COLUMN public.commande.statut_wms IS 'Statut actuel de la commande (machine à états)';

  RAISE NOTICE 'Migration de la colonne statut_wms terminée avec succès';
END $$;