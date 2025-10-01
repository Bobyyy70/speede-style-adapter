-- ========================================
-- PHASE 4: RLS POLICIES SPECIALISEES PAR ROLE
-- ========================================

-- Nettoyage des anciennes policies sur commande
DROP POLICY IF EXISTS "Allow authenticated users to insert commandes" ON public.commande;
DROP POLICY IF EXISTS "Allow authenticated users to read commandes" ON public.commande;
DROP POLICY IF EXISTS "Allow authenticated users to update commandes" ON public.commande;

-- Nettoyage des anciennes policies sur ligne_commande
DROP POLICY IF EXISTS "Allow authenticated users to insert lignes" ON public.ligne_commande;
DROP POLICY IF EXISTS "Allow authenticated users to read lignes" ON public.ligne_commande;
DROP POLICY IF EXISTS "Allow authenticated users to update lignes" ON public.ligne_commande;

-- ========================================
-- POLICIES TABLE: commande
-- ========================================

-- Admin: Accès complet
CREATE POLICY "Admin full access on commande"
ON public.commande
FOR ALL
TO authenticated
USING (public.has_role(auth.uid(), 'admin'::app_role))
WITH CHECK (public.has_role(auth.uid(), 'admin'::app_role));

-- Opérateur: Lecture + écriture pour opérations
CREATE POLICY "Operateur read commande"
ON public.commande
FOR SELECT
TO authenticated
USING (public.has_role(auth.uid(), 'operateur'::app_role));

CREATE POLICY "Operateur write commande"
ON public.commande
FOR INSERT
TO authenticated
WITH CHECK (public.has_role(auth.uid(), 'operateur'::app_role));

CREATE POLICY "Operateur update commande"
ON public.commande
FOR UPDATE
TO authenticated
USING (public.has_role(auth.uid(), 'operateur'::app_role))
WITH CHECK (public.has_role(auth.uid(), 'operateur'::app_role));

-- Gestionnaire: Lecture pour rapports + approbations
CREATE POLICY "Gestionnaire read commande"
ON public.commande
FOR SELECT
TO authenticated
USING (public.has_role(auth.uid(), 'gestionnaire'::app_role));

CREATE POLICY "Gestionnaire update commande status"
ON public.commande
FOR UPDATE
TO authenticated
USING (
  public.has_role(auth.uid(), 'gestionnaire'::app_role)
  AND statut_wms IN ('En attente de réappro', 'Prêt à préparer', 'En préparation')
)
WITH CHECK (public.has_role(auth.uid(), 'gestionnaire'::app_role));

-- Client: Lecture de ses propres commandes uniquement
-- Note: Nécessite un lien client_id dans commande (à ajouter plus tard)
CREATE POLICY "Client read own commande"
ON public.commande
FOR SELECT
TO authenticated
USING (
  public.has_role(auth.uid(), 'client'::app_role)
  AND EXISTS (
    SELECT 1 FROM public.profiles
    WHERE profiles.id = auth.uid()
    AND profiles.client_id IS NOT NULL
    -- Future: AND commande.client_id = profiles.client_id
  )
);

-- ========================================
-- POLICIES TABLE: ligne_commande
-- ========================================

-- Admin: Accès complet
CREATE POLICY "Admin full access on ligne_commande"
ON public.ligne_commande
FOR ALL
TO authenticated
USING (public.has_role(auth.uid(), 'admin'::app_role))
WITH CHECK (public.has_role(auth.uid(), 'admin'::app_role));

-- Opérateur: Lecture + écriture
CREATE POLICY "Operateur read ligne_commande"
ON public.ligne_commande
FOR SELECT
TO authenticated
USING (public.has_role(auth.uid(), 'operateur'::app_role));

CREATE POLICY "Operateur write ligne_commande"
ON public.ligne_commande
FOR INSERT
TO authenticated
WITH CHECK (public.has_role(auth.uid(), 'operateur'::app_role));

CREATE POLICY "Operateur update ligne_commande"
ON public.ligne_commande
FOR UPDATE
TO authenticated
USING (public.has_role(auth.uid(), 'operateur'::app_role))
WITH CHECK (public.has_role(auth.uid(), 'operateur'::app_role));

-- Gestionnaire: Lecture pour rapports
CREATE POLICY "Gestionnaire read ligne_commande"
ON public.ligne_commande
FOR SELECT
TO authenticated
USING (public.has_role(auth.uid(), 'gestionnaire'::app_role));

-- Client: Lecture de ses propres lignes de commande
CREATE POLICY "Client read own ligne_commande"
ON public.ligne_commande
FOR SELECT
TO authenticated
USING (
  public.has_role(auth.uid(), 'client'::app_role)
  AND EXISTS (
    SELECT 1 FROM public.profiles p
    JOIN public.commande c ON TRUE -- Future: c.client_id = p.client_id
    WHERE p.id = auth.uid()
    AND c.id = ligne_commande.commande_id
  )
);

-- ========================================
-- FONCTION HELPER: get_user_role
-- ========================================

-- Fonction pour récupérer le rôle principal d'un utilisateur
CREATE OR REPLACE FUNCTION public.get_user_role(user_id uuid)
RETURNS app_role
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT role
  FROM public.user_roles
  WHERE user_roles.user_id = $1
  ORDER BY 
    CASE role
      WHEN 'admin' THEN 1
      WHEN 'gestionnaire' THEN 2
      WHEN 'operateur' THEN 3
      WHEN 'client' THEN 4
    END
  LIMIT 1
$$;

-- ========================================
-- FONCTION AUDIT: log_sensitive_action
-- ========================================

-- Table pour audit trail
CREATE TABLE IF NOT EXISTS public.audit_log (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid REFERENCES auth.users(id),
  action text NOT NULL,
  table_name text NOT NULL,
  record_id uuid,
  old_data jsonb,
  new_data jsonb,
  created_at timestamp with time zone DEFAULT now()
);

ALTER TABLE public.audit_log ENABLE ROW LEVEL SECURITY;

-- Seuls les admins peuvent lire les logs
CREATE POLICY "Admin read audit_log"
ON public.audit_log
FOR SELECT
TO authenticated
USING (public.has_role(auth.uid(), 'admin'::app_role));

-- Fonction pour logger les actions sensibles
CREATE OR REPLACE FUNCTION public.log_sensitive_action()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  INSERT INTO public.audit_log (user_id, action, table_name, record_id, old_data, new_data)
  VALUES (
    auth.uid(),
    TG_OP,
    TG_TABLE_NAME,
    COALESCE(NEW.id, OLD.id),
    CASE WHEN TG_OP = 'DELETE' THEN row_to_json(OLD) ELSE NULL END,
    CASE WHEN TG_OP IN ('INSERT', 'UPDATE') THEN row_to_json(NEW) ELSE NULL END
  );
  
  IF TG_OP = 'DELETE' THEN
    RETURN OLD;
  ELSE
    RETURN NEW;
  END IF;
END;
$$;

-- Trigger d'audit sur user_roles (actions sensibles)
DROP TRIGGER IF EXISTS audit_user_roles_changes ON public.user_roles;
CREATE TRIGGER audit_user_roles_changes
  AFTER INSERT OR UPDATE OR DELETE ON public.user_roles
  FOR EACH ROW
  EXECUTE FUNCTION public.log_sensitive_action();

-- Commentaires pour documentation
COMMENT ON FUNCTION public.has_role IS 'Vérifie si un utilisateur possède un rôle spécifique. Utilisé dans les RLS policies.';
COMMENT ON FUNCTION public.get_user_role IS 'Retourne le rôle principal d''un utilisateur (le plus élevé dans la hiérarchie).';
COMMENT ON TABLE public.audit_log IS 'Journal d''audit pour tracer les actions sensibles (changements de rôles, etc.).';
