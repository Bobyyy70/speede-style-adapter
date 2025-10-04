-- Clean up profiles table RLS policies to resolve security scanner concerns
-- Issue: Scanner detects "conflicting RLS policies" due to duplicate policies

-- Drop duplicate policies created in previous iterations
DROP POLICY IF EXISTS "admins_view_all_profiles" ON public.profiles;
DROP POLICY IF EXISTS "authenticated_view_own_profile" ON public.profiles;
DROP POLICY IF EXISTS "block_public_profiles_select" ON public.profiles;

-- Convert the anon blocking policy to RESTRICTIVE for stronger enforcement
DROP POLICY IF EXISTS "block_anon_profiles" ON public.profiles;

CREATE POLICY "block_anon_profiles"
ON public.profiles
AS RESTRICTIVE
FOR ALL
TO anon
USING (false);

-- Add a restrictive policy to block public role as well
CREATE POLICY "block_public_profiles"
ON public.profiles
AS RESTRICTIVE
FOR ALL
TO public
USING (false);

-- Verify table grants are properly restricted
REVOKE ALL ON TABLE public.profiles FROM anon;
REVOKE ALL ON TABLE public.profiles FROM public;

-- Grant only necessary privileges to authenticated role
GRANT SELECT, UPDATE ON TABLE public.profiles TO authenticated;

COMMENT ON POLICY "block_anon_profiles" ON public.profiles IS 
'RESTRICTIVE policy: blocks all anonymous access to profiles containing PII (emails, names). Cannot be overridden by permissive policies.';

COMMENT ON POLICY "block_public_profiles" ON public.profiles IS 
'RESTRICTIVE policy: blocks all public role access to profiles. Defense in depth against misconfiguration.';
