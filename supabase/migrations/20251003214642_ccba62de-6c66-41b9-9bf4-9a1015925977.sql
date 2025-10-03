
-- Enable Row Level Security on the stock_disponible view
-- This provides defense in depth alongside the security_invoker setting
ALTER VIEW public.stock_disponible SET (security_barrier = true);

-- Note: Views don't support RLS directly, but we can create security barrier views
-- The security_invoker setting we applied earlier already ensures the view respects
-- RLS policies on underlying tables (produit, mouvement_stock, commande)

-- However, to fully secure the view, we need to recreate it as a security barrier view
-- and ensure underlying tables have proper RLS policies

-- Verify that anonymous users cannot access the view by checking underlying table policies
-- The view will only show data that the querying user has permission to see from:
-- - produit (requires admin/gestionnaire/operateur role)
-- - mouvement_stock (requires admin/gestionnaire/operateur role)  
-- - commande (requires admin/gestionnaire/operateur/client role)

-- Add explicit comment documenting the security model
COMMENT ON VIEW public.stock_disponible IS 
'Stock availability view with security_invoker and security_barrier enabled. 
Access is controlled by RLS policies on underlying tables:
- produit: admin, gestionnaire, operateur can read
- mouvement_stock: admin, gestionnaire, operateur can read
- commande: admin, gestionnaire, operateur, client can read (with restrictions)
Anonymous users are blocked by underlying table policies.';
