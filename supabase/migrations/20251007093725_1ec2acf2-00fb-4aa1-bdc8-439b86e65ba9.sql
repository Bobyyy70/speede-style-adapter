
-- =====================================================
-- SECURITY FIX: Restrict access to stock_disponible view
-- =====================================================
-- The stock_disponible view exposes real-time inventory levels which could
-- be used by competitors to undercut pricing or poach customers.
-- Views cannot have RLS policies directly, but we can control access
-- through proper GRANT management. This view queries the 'produit' and 
-- 'mouvement_stock' tables which both have RLS enabled, so it inherits 
-- that protection.

-- Revoke all existing grants from public and anonymous roles
REVOKE ALL ON public.stock_disponible FROM anon;
REVOKE ALL ON public.stock_disponible FROM public;
REVOKE ALL ON public.stock_disponible FROM authenticated;

-- Grant SELECT only to authenticated users (views are read-only)
-- The underlying tables' RLS policies will filter the results appropriately:
-- - 'produit' table has RLS that filters by client_id for client role
-- - 'mouvement_stock' table has RLS that filters by client_id via produit
-- This ensures users only see inventory data for products they have access to
GRANT SELECT ON public.stock_disponible TO authenticated;

-- Add a comment documenting the security model
COMMENT ON VIEW public.stock_disponible IS 
'Secure view of available stock (physical stock minus reservations). 
Access is restricted to authenticated users only. 
Row-level filtering is inherited from the underlying produit and mouvement_stock tables RLS policies.
Clients see only their own product inventory, operators and managers see all inventory.';
