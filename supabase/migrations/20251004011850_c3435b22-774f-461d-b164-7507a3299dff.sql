-- Drop the existing view
DROP VIEW IF EXISTS public.stock_disponible;

-- Recreate the view with SECURITY INVOKER to respect underlying table RLS
CREATE VIEW public.stock_disponible
WITH (security_invoker = true, security_barrier = true)
AS
SELECT 
  p.id AS produit_id,
  p.reference,
  p.nom,
  p.stock_actuel,
  COALESCE(sum(
    CASE
      WHEN m.type_mouvement = 'réservation'::text THEN m.quantite
      ELSE 0
    END), 0::bigint) AS stock_reserve,
  p.stock_actuel - COALESCE(sum(
    CASE
      WHEN m.type_mouvement = 'réservation'::text THEN m.quantite
      ELSE 0
    END), 0::bigint) AS stock_disponible
FROM produit p
LEFT JOIN mouvement_stock m ON p.id = m.produit_id 
  AND m.type_mouvement = 'réservation'::text 
  AND (m.commande_id IN (
    SELECT commande.id
    FROM commande
    WHERE commande.statut_wms = ANY (ARRAY[
      'En attente de réappro'::text, 
      'Prêt à préparer'::text, 
      'En préparation'::text, 
      'Réservé'::text
    ])
  ))
WHERE p.statut_actif = true
GROUP BY p.id, p.reference, p.nom, p.stock_actuel;

-- Grant access to authenticated users (RLS will control actual access)
GRANT SELECT ON public.stock_disponible TO authenticated;

-- Revoke access from anonymous users
REVOKE ALL ON public.stock_disponible FROM anon;