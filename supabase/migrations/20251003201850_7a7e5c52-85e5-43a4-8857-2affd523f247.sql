-- Add restrictive policy to block all anonymous access to commande table
-- This provides explicit protection against unauthenticated access to customer data
CREATE POLICY "Block anonymous access to commande"
ON public.commande
AS RESTRICTIVE
FOR ALL
USING (auth.role() != 'anon');

COMMENT ON POLICY "Block anonymous access to commande" ON public.commande IS 
'Restrictive policy that explicitly blocks all anonymous access to customer contact information and order data. This works alongside existing role-based policies to provide defense in depth.';