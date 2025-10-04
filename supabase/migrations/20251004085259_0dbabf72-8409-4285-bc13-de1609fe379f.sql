-- Harden commande table RLS to block public role access
-- Issue: Only anon role is explicitly blocked, public role needs blocking too

-- Add restrictive policy to block public role from all operations
CREATE POLICY "block_public_commande"
ON public.commande
AS RESTRICTIVE
FOR ALL
TO public
USING (false);

-- Ensure table grants are properly restricted (defense in depth)
REVOKE ALL ON TABLE public.commande FROM anon;
REVOKE ALL ON TABLE public.commande FROM public;

-- Grant only necessary privileges to authenticated role
GRANT SELECT, INSERT, UPDATE ON TABLE public.commande TO authenticated;

COMMENT ON POLICY "block_public_commande" ON public.commande IS 
'RESTRICTIVE policy: blocks all public role access to commande table containing customer PII (emails, phone numbers, shipping/billing addresses). Cannot be overridden by permissive policies.';

COMMENT ON POLICY "block_anon_commande_restrictive" ON public.commande IS 
'RESTRICTIVE policy: blocks all anonymous access to commande table containing sensitive customer contact information and addresses.';
