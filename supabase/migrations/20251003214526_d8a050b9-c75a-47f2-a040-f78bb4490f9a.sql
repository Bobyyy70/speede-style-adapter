
-- Drop and recreate the stock_disponible view with security_invoker option
-- This makes the view execute with the querying user's privileges, respecting RLS policies
DROP VIEW IF EXISTS public.stock_disponible;

CREATE VIEW public.stock_disponible
WITH (security_invoker = true)
AS
SELECT 
  p.id AS produit_id,
  p.reference,
  p.nom,
  p.stock_actuel,
  COALESCE(
    SUM(
      CASE
        WHEN m.type_mouvement = 'réservation'::text THEN m.quantite
        ELSE 0
      END
    ), 
    0::bigint
  ) AS stock_reserve,
  (
    p.stock_actuel - COALESCE(
      SUM(
        CASE
          WHEN m.type_mouvement = 'réservation'::text THEN m.quantite
          ELSE 0
        END
      ), 
      0::bigint
    )
  ) AS stock_disponible
FROM produit p
LEFT JOIN mouvement_stock m 
  ON p.id = m.produit_id 
  AND m.type_mouvement = 'réservation'::text 
  AND m.commande_id IN (
    SELECT commande.id
    FROM commande
    WHERE commande.statut_wms = ANY (
      ARRAY[
        'En attente de réappro'::text, 
        'Prêt à préparer'::text, 
        'En préparation'::text, 
        'Réservé'::text
      ]
    )
  )
WHERE p.statut_actif = true
GROUP BY p.id, p.reference, p.nom, p.stock_actuel;

COMMENT ON VIEW public.stock_disponible IS 
'Stock availability view with security_invoker - respects RLS policies of querying user on underlying tables (produit, mouvement_stock, commande)';
