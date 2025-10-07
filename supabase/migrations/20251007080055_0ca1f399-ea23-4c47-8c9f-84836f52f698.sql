
-- =====================================================
-- SECURITY FIX: Strengthen client table RLS policies
-- =====================================================
-- This migration adds explicit restrictive policies to prevent
-- anonymous or public access to customer contact information.

-- Add explicit RESTRICTIVE policies for anon role (denies all operations)
CREATE POLICY "block_anon_select_client"
ON public.client
AS RESTRICTIVE
FOR SELECT
TO anon
USING (false);

CREATE POLICY "block_anon_insert_client"
ON public.client
AS RESTRICTIVE
FOR INSERT
TO anon
WITH CHECK (false);

CREATE POLICY "block_anon_update_client"
ON public.client
AS RESTRICTIVE
FOR UPDATE
TO anon
USING (false)
WITH CHECK (false);

CREATE POLICY "block_anon_delete_client"
ON public.client
AS RESTRICTIVE
FOR DELETE
TO anon
USING (false);

-- Add explicit RESTRICTIVE policies for public role (denies all operations)
CREATE POLICY "block_public_select_client"
ON public.client
AS RESTRICTIVE
FOR SELECT
TO public
USING (false);

CREATE POLICY "block_public_insert_client"
ON public.client
AS RESTRICTIVE
FOR INSERT
TO public
WITH CHECK (false);

CREATE POLICY "block_public_update_client"
ON public.client
AS RESTRICTIVE
FOR UPDATE
TO public
USING (false)
WITH CHECK (false);

CREATE POLICY "block_public_delete_client"
ON public.client
AS RESTRICTIVE
FOR DELETE
TO public
USING (false);

-- Ensure authentication is required for all operations
CREATE POLICY "require_authentication_client"
ON public.client
AS RESTRICTIVE
FOR ALL
TO authenticated
USING (auth.uid() IS NOT NULL);

-- Only admins can delete clients
CREATE POLICY "Only admins can delete clients"
ON public.client
AS RESTRICTIVE
FOR DELETE
TO authenticated
USING (has_role(auth.uid(), 'admin'::app_role));

-- Strengthen the "Client read own data" policy to be restrictive
-- This ensures clients CANNOT see other clients' data
DROP POLICY IF EXISTS "Client read own data" ON public.client;

CREATE POLICY "Client read own data"
ON public.client
AS RESTRICTIVE
FOR SELECT
TO authenticated
USING (
  has_role(auth.uid(), 'client'::app_role) 
  AND id IN (
    SELECT client_id 
    FROM profiles 
    WHERE id = auth.uid() 
    AND client_id IS NOT NULL
  )
);

-- Revoke any public grants on the table
REVOKE ALL ON public.client FROM anon;
REVOKE ALL ON public.client FROM public;

-- Grant only necessary permissions to authenticated users
GRANT SELECT ON public.client TO authenticated;
GRANT INSERT, UPDATE, DELETE ON public.client TO authenticated;
