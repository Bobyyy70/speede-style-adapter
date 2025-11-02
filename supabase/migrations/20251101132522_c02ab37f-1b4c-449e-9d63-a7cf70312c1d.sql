-- Migration: Mise à jour de la table de log des transitions de statut
-- Date: 2025-11-01
-- Description: Adaptation de la table existante pour la machine à états

-- 1. Convertir les colonnes statut de TEXT vers ENUM
ALTER TABLE public.commande_transition_log 
  ALTER COLUMN statut_precedent TYPE statut_commande_enum 
  USING statut_precedent::statut_commande_enum;

ALTER TABLE public.commande_transition_log 
  ALTER COLUMN statut_nouveau TYPE statut_commande_enum 
  USING statut_nouveau::statut_commande_enum;

-- 2. Renommer effectue_par vers utilisateur_id pour cohérence
ALTER TABLE public.commande_transition_log 
  RENAME COLUMN effectue_par TO utilisateur_id;

-- 3. Renommer remarques vers raison pour cohérence
ALTER TABLE public.commande_transition_log 
  RENAME COLUMN remarques TO raison;

-- 4. S'assurer que metadata existe et a une valeur par défaut
ALTER TABLE public.commande_transition_log 
  ALTER COLUMN metadata SET DEFAULT '{}'::jsonb;

-- 5. Ajouter la contrainte de transition différente
ALTER TABLE public.commande_transition_log
  DROP CONSTRAINT IF EXISTS ck_transition_differente;

ALTER TABLE public.commande_transition_log
  ADD CONSTRAINT ck_transition_differente CHECK (statut_precedent IS DISTINCT FROM statut_nouveau);

-- 6. Index pour les requêtes fréquentes (si n'existent pas)
CREATE INDEX IF NOT EXISTS idx_transition_log_commande 
  ON public.commande_transition_log(commande_id, date_transition DESC);
CREATE INDEX IF NOT EXISTS idx_transition_log_date 
  ON public.commande_transition_log(date_transition DESC);
CREATE INDEX IF NOT EXISTS idx_transition_log_statut 
  ON public.commande_transition_log(statut_nouveau);
CREATE INDEX IF NOT EXISTS idx_transition_log_utilisateur 
  ON public.commande_transition_log(utilisateur_id);

-- 7. Commentaires
COMMENT ON TABLE public.commande_transition_log IS 'Historique complet des transitions de statut des commandes';
COMMENT ON COLUMN public.commande_transition_log.metadata IS 'Données contextuelles supplémentaires (JSON)';

-- 8. Recréer la fonction get_commande_historique avec les bons noms de colonnes
CREATE OR REPLACE FUNCTION public.get_commande_historique(p_commande_id UUID)
RETURNS TABLE (
  date_transition TIMESTAMPTZ,
  statut_precedent TEXT,
  statut_nouveau TEXT,
  utilisateur_nom TEXT,
  raison TEXT,
  metadata JSONB
)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  RETURN QUERY
  SELECT
    ctl.date_transition,
    get_statut_label(ctl.statut_precedent) as statut_precedent,
    get_statut_label(ctl.statut_nouveau) as statut_nouveau,
    COALESCE(p.nom_complet, 'Système') as utilisateur_nom,
    ctl.raison,
    ctl.metadata
  FROM public.commande_transition_log ctl
  LEFT JOIN public.profiles p ON p.id = ctl.utilisateur_id
  WHERE ctl.commande_id = p_commande_id
  ORDER BY ctl.date_transition DESC;
END;
$$;

-- 9. RLS Policies (supprimer les anciennes et recréer)
DROP POLICY IF EXISTS "Admin full access on commande_transition_log" ON public.commande_transition_log;
DROP POLICY IF EXISTS "Gestionnaire read commande_transition_log" ON public.commande_transition_log;
DROP POLICY IF EXISTS "Operateur read own transitions" ON public.commande_transition_log;
DROP POLICY IF EXISTS "Client read own transition log" ON public.commande_transition_log;

-- Policy: Les admins peuvent tout faire
CREATE POLICY "Admin full access on commande_transition_log"
ON public.commande_transition_log
FOR ALL
TO authenticated
USING (has_role(auth.uid(), 'admin'::app_role))
WITH CHECK (has_role(auth.uid(), 'admin'::app_role));

-- Policy: Les gestionnaires peuvent lire tous les logs
CREATE POLICY "Gestionnaire read commande_transition_log"
ON public.commande_transition_log
FOR SELECT
TO authenticated
USING (has_role(auth.uid(), 'gestionnaire'::app_role));

-- Policy: Les opérateurs peuvent lire tous les logs
CREATE POLICY "Operateur read own transitions"
ON public.commande_transition_log
FOR SELECT
TO authenticated
USING (has_role(auth.uid(), 'operateur'::app_role));

-- Policy: Les clients peuvent voir les logs de leurs commandes
CREATE POLICY "Client read own transition log"
ON public.commande_transition_log
FOR SELECT
TO authenticated
USING (
  has_role(auth.uid(), 'client'::app_role) AND
  EXISTS (
    SELECT 1 FROM public.commande c
    INNER JOIN public.profiles p ON p.client_id = c.client_id
    WHERE c.id = commande_transition_log.commande_id
    AND p.id = auth.uid()
  )
);