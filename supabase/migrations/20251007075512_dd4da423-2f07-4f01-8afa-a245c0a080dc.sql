
-- =====================================================
-- SECURITY FIX: Strengthen profiles table RLS policies
-- =====================================================
-- This migration adds explicit restrictive policies to prevent
-- any possible anonymous or public access to the profiles table.

-- Drop existing blocking policies (we'll replace with more specific ones)
DROP POLICY IF EXISTS "block_anon_profiles" ON public.profiles;
DROP POLICY IF EXISTS "block_public_profiles" ON public.profiles;

-- Add explicit RESTRICTIVE policies for anon role (denies all operations)
CREATE POLICY "block_anon_select_profiles"
ON public.profiles
AS RESTRICTIVE
FOR SELECT
TO anon
USING (false);

CREATE POLICY "block_anon_insert_profiles"
ON public.profiles
AS RESTRICTIVE
FOR INSERT
TO anon
WITH CHECK (false);

CREATE POLICY "block_anon_update_profiles"
ON public.profiles
AS RESTRICTIVE
FOR UPDATE
TO anon
USING (false)
WITH CHECK (false);

CREATE POLICY "block_anon_delete_profiles"
ON public.profiles
AS RESTRICTIVE
FOR DELETE
TO anon
USING (false);

-- Add explicit RESTRICTIVE policies for public role (denies all operations)
CREATE POLICY "block_public_select_profiles"
ON public.profiles
AS RESTRICTIVE
FOR SELECT
TO public
USING (false);

CREATE POLICY "block_public_insert_profiles"
ON public.profiles
AS RESTRICTIVE
FOR INSERT
TO public
WITH CHECK (false);

CREATE POLICY "block_public_update_profiles"
ON public.profiles
AS RESTRICTIVE
FOR UPDATE
TO public
USING (false)
WITH CHECK (false);

CREATE POLICY "block_public_delete_profiles"
ON public.profiles
AS RESTRICTIVE
FOR DELETE
TO public
USING (false);

-- Ensure no DELETE is allowed except by admin
CREATE POLICY "Only admins can delete profiles"
ON public.profiles
AS RESTRICTIVE
FOR DELETE
TO authenticated
USING (has_role(auth.uid(), 'admin'::app_role));

-- Add a final catch-all restrictive policy to ensure authentication is required
CREATE POLICY "require_authentication_profiles"
ON public.profiles
AS RESTRICTIVE
FOR ALL
TO authenticated
USING (auth.uid() IS NOT NULL);

-- Revoke any public grants on the table (if they exist)
REVOKE ALL ON public.profiles FROM anon;
REVOKE ALL ON public.profiles FROM public;

-- Grant only necessary permissions to authenticated users
GRANT SELECT, UPDATE ON public.profiles TO authenticated;
GRANT INSERT ON public.profiles TO authenticated;
GRANT DELETE ON public.profiles TO authenticated;
