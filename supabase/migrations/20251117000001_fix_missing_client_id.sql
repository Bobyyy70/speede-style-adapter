-- Migration pour corriger le problème des utilisateurs sans client_id
-- Cette migration résout le problème critique où 80% des utilisateurs
-- ne peuvent pas voir leurs données car client_id est NULL

-- ============================================================
-- ÉTAPE 1: Créer un client par défaut pour les tests
-- ============================================================
DO $$
DECLARE
  default_client_id UUID;
  users_without_client INTEGER;
BEGIN
  -- Compter les utilisateurs sans client_id
  SELECT COUNT(*) INTO users_without_client
  FROM public.profiles p
  WHERE p.client_id IS NULL
    AND EXISTS (
      SELECT 1 FROM public.user_roles ur
      WHERE ur.user_id = p.id AND ur.role = 'client'
    );

  RAISE NOTICE 'Nombre d''utilisateurs clients sans client_id: %', users_without_client;

  -- Si aucun utilisateur sans client_id, ne rien faire
  IF users_without_client = 0 THEN
    RAISE NOTICE 'Aucun utilisateur à migrer, migration terminée.';
    RETURN;
  END IF;

  -- Créer un client par défaut s'il n'existe pas déjà
  INSERT INTO public.client (
    nom_entreprise,
    email_contact,
    remarques,
    actif
  ) VALUES (
    'Client Test - Migration Automatique',
    'test@speedelog.com',
    'Client créé automatiquement lors de la migration pour résoudre le problème des utilisateurs sans client_id. Vous devez assigner les vrais clients via l''interface admin.',
    true
  )
  ON CONFLICT DO NOTHING
  RETURNING id INTO default_client_id;

  -- Si le client existait déjà, le récupérer
  IF default_client_id IS NULL THEN
    SELECT id INTO default_client_id
    FROM public.client
    WHERE nom_entreprise = 'Client Test - Migration Automatique'
    LIMIT 1;
  END IF;

  RAISE NOTICE 'Client par défaut créé/récupéré: %', default_client_id;

  -- ============================================================
  -- ÉTAPE 2: Assigner le client par défaut à tous les utilisateurs
  -- qui ont le rôle 'client' et qui n'ont pas de client_id
  -- ============================================================
  UPDATE public.profiles
  SET client_id = default_client_id
  WHERE client_id IS NULL
    AND id IN (
      SELECT user_id
      FROM public.user_roles
      WHERE role = 'client'
    );

  GET DIAGNOSTICS users_without_client = ROW_COUNT;
  RAISE NOTICE '% utilisateurs mis à jour avec le client par défaut', users_without_client;

  RAISE NOTICE 'Migration terminée avec succès !';
END $$;

-- ============================================================
-- ÉTAPE 3: Créer un trigger pour assigner automatiquement
-- un client_id aux nouveaux utilisateurs clients
-- ============================================================
CREATE OR REPLACE FUNCTION public.auto_assign_client_id()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  default_client_id UUID;
BEGIN
  -- Si le profil a déjà un client_id, ne rien faire
  IF NEW.client_id IS NOT NULL THEN
    RETURN NEW;
  END IF;

  -- Vérifier si l'utilisateur a le rôle 'client'
  IF EXISTS (
    SELECT 1 FROM public.user_roles
    WHERE user_id = NEW.id AND role = 'client'
  ) THEN
    -- Récupérer le client par défaut
    SELECT id INTO default_client_id
    FROM public.client
    WHERE nom_entreprise = 'Client Test - Migration Automatique'
      AND actif = true
    LIMIT 1;

    -- Si un client par défaut existe, l'assigner
    IF default_client_id IS NOT NULL THEN
      NEW.client_id := default_client_id;
      RAISE NOTICE 'Client_id % assigné automatiquement à l''utilisateur %', default_client_id, NEW.id;
    END IF;
  END IF;

  RETURN NEW;
END;
$$;

-- Supprimer le trigger s'il existe déjà
DROP TRIGGER IF EXISTS trigger_auto_assign_client_id ON public.profiles;

-- Créer le trigger sur INSERT ET UPDATE
CREATE TRIGGER trigger_auto_assign_client_id
  BEFORE INSERT OR UPDATE ON public.profiles
  FOR EACH ROW
  EXECUTE FUNCTION public.auto_assign_client_id();

-- ============================================================
-- ÉTAPE 4: Créer une vue pour faciliter le monitoring
-- ============================================================
CREATE OR REPLACE VIEW public.v_users_client_status AS
SELECT
  p.id,
  p.email,
  p.nom_complet,
  p.client_id,
  c.nom_entreprise as client_nom,
  COALESCE(
    (SELECT array_agg(role::text) FROM public.user_roles WHERE user_id = p.id),
    ARRAY[]::text[]
  ) as roles,
  CASE
    WHEN p.client_id IS NULL AND EXISTS (
      SELECT 1 FROM public.user_roles WHERE user_id = p.id AND role = 'client'
    ) THEN 'MISSING_CLIENT_ID'
    WHEN p.client_id IS NOT NULL THEN 'OK'
    ELSE 'NOT_A_CLIENT'
  END as status
FROM public.profiles p
LEFT JOIN public.client c ON c.id = p.client_id
ORDER BY status DESC, p.email;

COMMENT ON VIEW public.v_users_client_status IS
  'Vue pour monitorer le statut client_id des utilisateurs. '
  'Permet d''identifier rapidement les utilisateurs clients sans client_id assigné.';

-- ============================================================
-- ÉTAPE 5: Afficher un résumé de la migration
-- ============================================================
DO $$
DECLARE
  total_users INTEGER;
  users_with_client INTEGER;
  users_without_client INTEGER;
  client_users_ok INTEGER;
  client_users_missing INTEGER;
BEGIN
  SELECT COUNT(*) INTO total_users FROM public.profiles;
  SELECT COUNT(*) INTO users_with_client FROM public.profiles WHERE client_id IS NOT NULL;
  SELECT COUNT(*) INTO users_without_client FROM public.profiles WHERE client_id IS NULL;

  SELECT COUNT(*) INTO client_users_ok
  FROM public.profiles p
  WHERE p.client_id IS NOT NULL
    AND EXISTS (SELECT 1 FROM public.user_roles WHERE user_id = p.id AND role = 'client');

  SELECT COUNT(*) INTO client_users_missing
  FROM public.profiles p
  WHERE p.client_id IS NULL
    AND EXISTS (SELECT 1 FROM public.user_roles WHERE user_id = p.id AND role = 'client');

  RAISE NOTICE '';
  RAISE NOTICE '========================================';
  RAISE NOTICE '   RÉSUMÉ DE LA MIGRATION';
  RAISE NOTICE '========================================';
  RAISE NOTICE 'Total utilisateurs: %', total_users;
  RAISE NOTICE 'Avec client_id: %', users_with_client;
  RAISE NOTICE 'Sans client_id: %', users_without_client;
  RAISE NOTICE '';
  RAISE NOTICE 'Utilisateurs CLIENTS avec client_id: %', client_users_ok;
  RAISE NOTICE 'Utilisateurs CLIENTS sans client_id: %', client_users_missing;
  RAISE NOTICE '';

  IF client_users_missing = 0 THEN
    RAISE NOTICE '✅ SUCCÈS: Tous les utilisateurs clients ont un client_id !';
  ELSE
    RAISE WARNING '⚠️  ATTENTION: % utilisateurs clients n''ont toujours pas de client_id', client_users_missing;
  END IF;

  RAISE NOTICE '========================================';
  RAISE NOTICE '';
END $$;
