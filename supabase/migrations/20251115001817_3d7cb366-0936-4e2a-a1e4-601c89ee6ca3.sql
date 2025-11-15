-- Fonction pour obtenir le client_id de l'utilisateur courant
CREATE OR REPLACE FUNCTION public.current_client_id()
RETURNS UUID
LANGUAGE SQL
SECURITY DEFINER
STABLE
AS $$
  SELECT client_id FROM public.profiles WHERE id = auth.uid()
$$;

-- Trigger pour vérifier que client_id n'est jamais NULL à la création de profile
-- (Sauf pour les admins qui peuvent créer des profils sans client)
CREATE OR REPLACE FUNCTION public.validate_profile_client_id()
RETURNS TRIGGER
LANGUAGE plpgsql
AS $$
DECLARE
  v_is_admin BOOLEAN;
BEGIN
  -- Vérifier si l'utilisateur courant est admin
  SELECT EXISTS (
    SELECT 1 FROM public.user_roles 
    WHERE user_id = auth.uid() AND role = 'admin'
  ) INTO v_is_admin;
  
  -- Si pas admin et client_id NULL, bloquer
  IF NOT v_is_admin AND NEW.client_id IS NULL THEN
    RAISE EXCEPTION 'Le client_id est obligatoire pour les utilisateurs non-admin. Complétez l''onboarding.';
  END IF;
  
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_validate_profile_client_id ON public.profiles;
CREATE TRIGGER trg_validate_profile_client_id
BEFORE INSERT OR UPDATE ON public.profiles
FOR EACH ROW EXECUTE FUNCTION public.validate_profile_client_id();

-- RLS strictes sur les tables métier ayant directement client_id
DO $$
DECLARE 
  t TEXT;
  table_list TEXT[] := ARRAY[
    'commande', 'produit', 'retour_produit',
    'attendu_reception', 'contact_destinataire', 
    'configuration_expediteur', 'regle_expediteur_automatique'
  ];
BEGIN
  FOREACH t IN ARRAY table_list
  LOOP
    -- Enable RLS
    EXECUTE format('ALTER TABLE public.%I ENABLE ROW LEVEL SECURITY;', t);
    
    -- Drop existing client policies
    EXECUTE format('DROP POLICY IF EXISTS "client_read_%1$s" ON public.%1$s;', t);
    EXECUTE format('DROP POLICY IF EXISTS "client_write_%1$s" ON public.%1$s;', t);
    EXECUTE format('DROP POLICY IF EXISTS "client_update_%1$s" ON public.%1$s;', t);
    EXECUTE format('DROP POLICY IF EXISTS "admin_full_%1$s" ON public.%1$s;', t);
    
    -- Admin full access
    EXECUTE format($p$
      CREATE POLICY "admin_full_%1$s" ON public.%1$s
      FOR ALL
      USING (
        EXISTS (
          SELECT 1 FROM public.user_roles 
          WHERE user_id = auth.uid() AND role = 'admin'
        )
      );
    $p$, t);
    
    -- Client read: only their data
    EXECUTE format($p$
      CREATE POLICY "client_read_%1$s" ON public.%1$s
      FOR SELECT
      USING (
        client_id = public.current_client_id()
      );
    $p$, t);
    
    -- Client write: only their data
    EXECUTE format($p$
      CREATE POLICY "client_write_%1$s" ON public.%1$s
      FOR INSERT
      WITH CHECK (
        client_id = public.current_client_id()
      );
    $p$, t);
    
    -- Client update: only their data
    EXECUTE format($p$
      CREATE POLICY "client_update_%1$s" ON public.%1$s
      FOR UPDATE
      USING (client_id = public.current_client_id())
      WITH CHECK (client_id = public.current_client_id());
    $p$, t);
    
    RAISE NOTICE 'Politiques RLS appliquées sur %', t;
  END LOOP;
END $$;

-- RLS sur ligne_commande (via commande parente)
ALTER TABLE public.ligne_commande ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "admin_full_ligne_commande" ON public.ligne_commande;
CREATE POLICY "admin_full_ligne_commande" ON public.ligne_commande
FOR ALL
USING (
  EXISTS (
    SELECT 1 FROM public.user_roles 
    WHERE user_id = auth.uid() AND role = 'admin'
  )
);

DROP POLICY IF EXISTS "client_read_ligne_commande" ON public.ligne_commande;
CREATE POLICY "client_read_ligne_commande" ON public.ligne_commande
FOR SELECT
USING (
  commande_id IN (
    SELECT id FROM public.commande 
    WHERE client_id = public.current_client_id()
  )
);

DROP POLICY IF EXISTS "client_write_ligne_commande" ON public.ligne_commande;
CREATE POLICY "client_write_ligne_commande" ON public.ligne_commande
FOR INSERT
WITH CHECK (
  commande_id IN (
    SELECT id FROM public.commande 
    WHERE client_id = public.current_client_id()
  )
);

-- RLS sur ligne_attendu_reception (via attendu_reception parent)
ALTER TABLE public.ligne_attendu_reception ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "admin_full_ligne_attendu_reception" ON public.ligne_attendu_reception;
CREATE POLICY "admin_full_ligne_attendu_reception" ON public.ligne_attendu_reception
FOR ALL
USING (
  EXISTS (
    SELECT 1 FROM public.user_roles 
    WHERE user_id = auth.uid() AND role = 'admin'
  )
);

DROP POLICY IF EXISTS "client_read_ligne_attendu_reception" ON public.ligne_attendu_reception;
CREATE POLICY "client_read_ligne_attendu_reception" ON public.ligne_attendu_reception
FOR SELECT
USING (
  attendu_reception_id IN (
    SELECT id FROM public.attendu_reception 
    WHERE client_id = public.current_client_id()
  )
);

DROP POLICY IF EXISTS "client_write_ligne_attendu_reception" ON public.ligne_attendu_reception;
CREATE POLICY "client_write_ligne_attendu_reception" ON public.ligne_attendu_reception
FOR INSERT
WITH CHECK (
  attendu_reception_id IN (
    SELECT id FROM public.attendu_reception 
    WHERE client_id = public.current_client_id()
  )
);

-- RLS sur document_commande (via commande parente)
ALTER TABLE public.document_commande ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "admin_full_document_commande" ON public.document_commande;
CREATE POLICY "admin_full_document_commande" ON public.document_commande
FOR ALL
USING (
  EXISTS (
    SELECT 1 FROM public.user_roles 
    WHERE user_id = auth.uid() AND role = 'admin'
  )
);

DROP POLICY IF EXISTS "client_read_document_commande" ON public.document_commande;
CREATE POLICY "client_read_document_commande" ON public.document_commande
FOR SELECT
USING (
  commande_id IN (
    SELECT id FROM public.commande 
    WHERE client_id = public.current_client_id()
  )
);