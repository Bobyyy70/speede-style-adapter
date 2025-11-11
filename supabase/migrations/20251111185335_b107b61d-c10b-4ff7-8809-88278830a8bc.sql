-- Ajouter le nouveau statut en_attente_validation dans l'ENUM
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_enum 
    WHERE enumlabel = 'en_attente_validation' 
    AND enumtypid = 'statut_commande_enum'::regtype
  ) THEN
    ALTER TYPE statut_commande_enum ADD VALUE 'en_attente_validation';
  END IF;
END$$;