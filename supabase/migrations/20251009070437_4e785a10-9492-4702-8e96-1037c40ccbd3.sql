-- Restaurer les onglets pour tous les clients existants

-- 1. Initialiser tabs_access pour tous les profils clients existants qui ont NULL
UPDATE public.profiles
SET tabs_access = ARRAY[
  'tableau-de-bord',
  'commandes', 
  'creer-commande',
  'retours',
  'produits',
  'stock-attendu',
  'mouvements',
  'connecteurs',
  'import-export',
  'parametres'
]
WHERE client_id IS NOT NULL 
  AND (tabs_access IS NULL OR array_length(tabs_access, 1) IS NULL);

-- 2. Définir une valeur par défaut pour la colonne tabs_access
ALTER TABLE public.profiles 
ALTER COLUMN tabs_access 
SET DEFAULT ARRAY[
  'tableau-de-bord',
  'commandes',
  'creer-commande', 
  'retours',
  'produits',
  'stock-attendu',
  'mouvements',
  'connecteurs',
  'import-export',
  'parametres'
];

-- 3. Créer une fonction trigger pour assigner automatiquement les onglets aux nouveaux clients
CREATE OR REPLACE FUNCTION public.assign_default_client_tabs()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  -- Si c'est un profil client et que tabs_access est NULL, assigner les onglets par défaut
  IF NEW.client_id IS NOT NULL AND (NEW.tabs_access IS NULL OR array_length(NEW.tabs_access, 1) IS NULL) THEN
    NEW.tabs_access := ARRAY[
      'tableau-de-bord',
      'commandes',
      'creer-commande',
      'retours', 
      'produits',
      'stock-attendu',
      'mouvements',
      'connecteurs',
      'import-export',
      'parametres'
    ];
  END IF;
  RETURN NEW;
END;
$$;

-- 4. Créer le trigger sur INSERT et UPDATE
DROP TRIGGER IF EXISTS set_default_client_tabs ON public.profiles;
CREATE TRIGGER set_default_client_tabs
  BEFORE INSERT OR UPDATE ON public.profiles
  FOR EACH ROW
  EXECUTE FUNCTION public.assign_default_client_tabs();

COMMENT ON FUNCTION public.assign_default_client_tabs() IS 
  'Auto-assigne les onglets par défaut aux profils clients lors de la création ou modification';
