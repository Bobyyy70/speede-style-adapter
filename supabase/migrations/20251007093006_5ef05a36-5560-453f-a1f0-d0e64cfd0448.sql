-- =====================================================
-- SECURITY FIX: Restrict access to commande_gestionnaire_secure view
-- =====================================================
-- Views cannot have RLS policies directly, but we can control access
-- through proper GRANT management. This view selects from the 'commande'
-- table which has RLS enabled, so it inherits that protection.
-- We need to ensure only authenticated users can access this view.

-- Revoke all existing grants from public roles
REVOKE ALL ON public.commande_gestionnaire_secure FROM anon;
REVOKE ALL ON public.commande_gestionnaire_secure FROM public;
REVOKE ALL ON public.commande_gestionnaire_secure FROM authenticated;

-- Grant SELECT only to authenticated users (views are read-only)
-- The underlying commande table's RLS policies will filter the results appropriately
GRANT SELECT ON public.commande_gestionnaire_secure TO authenticated;

-- Add a comment documenting the security model
COMMENT ON VIEW public.commande_gestionnaire_secure IS 
'Secure view of commande table with masked sensitive data. Access is restricted to authenticated users only. 
Row-level filtering is inherited from the underlying commande table RLS policies. 
Data masking is applied based on user role (admin sees full data, others see masked data).';
