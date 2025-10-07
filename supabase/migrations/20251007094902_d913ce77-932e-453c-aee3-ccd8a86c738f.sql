-- =====================================================
-- COMPREHENSIVE SECURITY FIX: Lock down profiles, client, and commande tables
-- =====================================================
-- This migration applies defense-in-depth security to all tables containing PII:
-- 1. Restrictive RLS policies that explicitly deny anon/public access
-- 2. Explicit REVOKE statements to remove any default grants
-- 3. Explicit GRANT statements for authenticated role only
-- 4. Documentation comments for security posture

-- =====================================================
-- FIX 1: commande table - Add restrictive policies
-- =====================================================
-- The commande table currently has 9 permissive policies but lacks
-- the comprehensive restrictive policies that profiles and client have.

-- Drop existing block_anon policy if exists (less comprehensive version)
DROP POLICY IF EXISTS "block_anon_commande_restrictive" ON public.commande;

-- Block all anonymous access (SELECT)
CREATE POLICY "block_anon_select_commande"
ON public.commande
AS RESTRICTIVE
FOR SELECT
TO anon
USING (false);

-- Block all anonymous access (INSERT)
CREATE POLICY "block_anon_insert_commande"
ON public.commande
AS RESTRICTIVE
FOR INSERT
TO anon
WITH CHECK (false);

-- Block all anonymous access (UPDATE)
CREATE POLICY "block_anon_update_commande"
ON public.commande
AS RESTRICTIVE
FOR UPDATE
TO anon
USING (false)
WITH CHECK (false);

-- Block all anonymous access (DELETE)
CREATE POLICY "block_anon_delete_commande"
ON public.commande
AS RESTRICTIVE
FOR DELETE
TO anon
USING (false);

-- Block all public role access (SELECT)
CREATE POLICY "block_public_select_commande"
ON public.commande
AS RESTRICTIVE
FOR SELECT
TO public
USING (false);

-- Block all public role access (INSERT)
CREATE POLICY "block_public_insert_commande"
ON public.commande
AS RESTRICTIVE
FOR INSERT
TO public
WITH CHECK (false);

-- Block all public role access (UPDATE)
CREATE POLICY "block_public_update_commande"
ON public.commande
AS RESTRICTIVE
FOR UPDATE
TO public
USING (false)
WITH CHECK (false);

-- Block all public role access (DELETE)
CREATE POLICY "block_public_delete_commande"
ON public.commande
AS RESTRICTIVE
FOR DELETE
TO public
USING (false);

-- Require authentication for any access
CREATE POLICY "require_authentication_commande"
ON public.commande
AS RESTRICTIVE
FOR ALL
TO authenticated
USING (auth.uid() IS NOT NULL);

-- =====================================================
-- FIX 2: Explicit REVOKE and GRANT for profiles table
-- =====================================================
-- Even with RLS policies, explicit privilege management provides defense-in-depth

REVOKE ALL ON public.profiles FROM anon;
REVOKE ALL ON public.profiles FROM public;
REVOKE ALL ON public.profiles FROM authenticated;

-- Grant only necessary privileges to authenticated users
-- RLS policies will further filter what they can access
GRANT SELECT, INSERT, UPDATE, DELETE ON public.profiles TO authenticated;

-- Document the security model
COMMENT ON TABLE public.profiles IS 
'User profile information table. Contains email addresses and personal data.
SECURITY MODEL:
- RLS enabled with restrictive policies blocking anon/public access
- Only authenticated users can access via explicit grant
- Users can only view/update their own profile (per permissive policies)
- Admins have full access (per permissive policies)
- Defense-in-depth: RLS + explicit privilege management';

-- =====================================================
-- FIX 3: Explicit REVOKE and GRANT for client table
-- =====================================================

REVOKE ALL ON public.client FROM anon;
REVOKE ALL ON public.client FROM public;
REVOKE ALL ON public.client FROM authenticated;

-- Grant only necessary privileges to authenticated users
GRANT SELECT, INSERT, UPDATE, DELETE ON public.client TO authenticated;

-- Document the security model
COMMENT ON TABLE public.client IS 
'Business client information table. Contains contact details, emails, phone numbers, and addresses.
SECURITY MODEL:
- RLS enabled with restrictive policies blocking anon/public access
- Only authenticated users can access via explicit grant
- Client role users can only view their own client record (per permissive policies)
- Admins and gestionnaires have appropriate access levels (per permissive policies)
- Defense-in-depth: RLS + explicit privilege management';

-- =====================================================
-- FIX 4: Explicit REVOKE and GRANT for commande table
-- =====================================================

REVOKE ALL ON public.commande FROM anon;
REVOKE ALL ON public.commande FROM public;
REVOKE ALL ON public.commande FROM authenticated;

-- Grant only necessary privileges to authenticated users
GRANT SELECT, INSERT, UPDATE, DELETE ON public.commande TO authenticated;

-- Document the security model
COMMENT ON TABLE public.commande IS 
'Customer order table. Contains highly sensitive PII: names, emails, phone numbers, addresses, and order values.
SECURITY MODEL:
- RLS enabled with restrictive policies blocking anon/public access
- Only authenticated users can access via explicit grant
- Client role users can only view their own orders (per permissive policies)
- Operateurs can read/update orders (per permissive policies)
- Gestionnaires can manage order statuses (per permissive policies)
- Admins have full access (per permissive policies)
- Defense-in-depth: RLS + explicit privilege management
COMPLIANCE: Critical for GDPR and customer data protection';

-- =====================================================
-- VERIFICATION QUERIES (commented out, for manual testing)
-- =====================================================
-- Run these as different roles to verify security:
--
-- As anon user (should fail):
-- SELECT * FROM profiles LIMIT 1;
-- SELECT * FROM client LIMIT 1;
-- SELECT * FROM commande LIMIT 1;
--
-- As authenticated user without proper role (should see no rows or only own data):
-- SELECT * FROM profiles WHERE id = auth.uid();
-- SELECT * FROM client WHERE id IN (SELECT client_id FROM profiles WHERE id = auth.uid());
-- SELECT * FROM commande WHERE client_id IN (SELECT client_id FROM profiles WHERE id = auth.uid());
--
-- As admin (should see all data):
-- SELECT COUNT(*) FROM profiles;
-- SELECT COUNT(*) FROM client;
-- SELECT COUNT(*) FROM commande;