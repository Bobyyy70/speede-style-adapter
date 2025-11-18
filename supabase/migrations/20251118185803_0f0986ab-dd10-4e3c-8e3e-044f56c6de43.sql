-- Ajouter les valeurs manquantes à l'enum statut_commande_enum
ALTER TYPE statut_commande_enum ADD VALUE IF NOT EXISTS 'En attente de réappro';
ALTER TYPE statut_commande_enum ADD VALUE IF NOT EXISTS 'Prêt à préparer';
ALTER TYPE statut_commande_enum ADD VALUE IF NOT EXISTS 'Réservé';
ALTER TYPE statut_commande_enum ADD VALUE IF NOT EXISTS 'En préparation';
ALTER TYPE statut_commande_enum ADD VALUE IF NOT EXISTS 'En attente d''expédition';
ALTER TYPE statut_commande_enum ADD VALUE IF NOT EXISTS 'Expédié';
ALTER TYPE statut_commande_enum ADD VALUE IF NOT EXISTS 'Livré';
ALTER TYPE statut_commande_enum ADD VALUE IF NOT EXISTS 'Annulée';
ALTER TYPE statut_commande_enum ADD VALUE IF NOT EXISTS 'prete';
ALTER TYPE statut_commande_enum ADD VALUE IF NOT EXISTS 'expediee';
ALTER TYPE statut_commande_enum ADD VALUE IF NOT EXISTS 'pret_expedition';
ALTER TYPE statut_commande_enum ADD VALUE IF NOT EXISTS 'retour';

-- Fix RLS policies NULL-safe
DROP POLICY IF EXISTS "Client read own commande" ON public.commande;

CREATE POLICY "Client read own commande"
  ON public.commande FOR SELECT TO authenticated
  USING (
    has_role(auth.uid(), 'client'::app_role)
    AND (
      (client_id IS NOT NULL AND client_id IN (
        SELECT client_id FROM public.profiles WHERE id = auth.uid()
      ))
      OR (
        client_id IS NULL
        AND NOT EXISTS (SELECT 1 FROM public.profiles WHERE id = auth.uid() AND client_id IS NOT NULL)
      )
    )
  );

-- Fix Service role access
DROP POLICY IF EXISTS "Service role full access on commande" ON public.commande;
CREATE POLICY "Service role full access on commande"
  ON public.commande FOR ALL TO service_role
  USING (true) WITH CHECK (true);