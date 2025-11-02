
-- Sécuriser l'accès aux commandes pour les opérateurs
-- Ils ne verront que les commandes en statut de travail actif

-- 1. Supprimer l'ancienne politique opérateur trop permissive
DROP POLICY IF EXISTS "Operateur read commande" ON public.commande;

-- 2. Créer une nouvelle politique restrictive pour les opérateurs
-- Ils peuvent voir uniquement les commandes en cours de traitement
CREATE POLICY "Operateur read active commande"
ON public.commande
FOR SELECT
TO authenticated
USING (
  has_role(auth.uid(), 'operateur'::app_role)
  AND statut_wms IN (
    'Prêt à préparer',
    'En préparation', 
    'Réservé',
    'prete',
    'expediee'
  )
);

-- 3. Les admins et gestionnaires gardent l'accès complet
-- (leurs politiques existantes sont correctes)

-- 4. Ajouter un commentaire pour documenter la sécurité
COMMENT ON POLICY "Operateur read active commande" ON public.commande IS 
  'Les opérateurs peuvent uniquement voir les commandes en statut actif de préparation/expédition. 
   Cela limite l''exposition des données PII historiques en cas de compte compromis.';
