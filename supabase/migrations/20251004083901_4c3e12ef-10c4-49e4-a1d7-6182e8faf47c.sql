-- ============================================
-- Security Fix: Block Anonymous Access to Sensitive Tables
-- ============================================
-- This migration fixes three critical security issues:
-- 1. Profiles table publicly readable (emails/names exposed)
-- 2. Commande_gestionnaire_secure view has no RLS
-- 3. Audit_log lacks explicit anonymous blocking

-- ============================================
-- Fix 1: Block Anonymous Access to Profiles
-- ============================================
-- Drop the existing restrictive policy that isn't working for anon role
DROP POLICY IF EXISTS "block_anon_profiles_restrictive" ON public.profiles;

-- Create explicit policy to block anonymous role from all operations
CREATE POLICY "block_anon_profiles" 
ON public.profiles 
FOR ALL 
TO anon 
USING (false);

COMMENT ON POLICY "block_anon_profiles" ON public.profiles IS 
'Blocks all anonymous access to profiles table containing PII (emails, names)';

-- ============================================
-- Fix 2: Enable RLS on commande_gestionnaire_secure View
-- ============================================
-- Note: This is a view, not a table. We need to grant proper access.
-- Revoke all public access first
REVOKE ALL ON public.commande_gestionnaire_secure FROM anon;
REVOKE ALL ON public.commande_gestionnaire_secure FROM public;

-- Grant SELECT only to authenticated users (role-based access will be checked via underlying commande table)
GRANT SELECT ON public.commande_gestionnaire_secure TO authenticated;

COMMENT ON VIEW public.commande_gestionnaire_secure IS 
'Secure view with PII masking for non-admin users. Access controlled via underlying commande table RLS policies.';

-- ============================================
-- Fix 3: Block Anonymous Access to Audit Log
-- ============================================
-- Create explicit policy to block all non-admin access
CREATE POLICY "block_non_admin_audit" 
ON public.audit_log 
FOR ALL 
USING (has_role(auth.uid(), 'admin'::app_role));

COMMENT ON POLICY "block_non_admin_audit" ON public.audit_log IS 
'Only admins can access audit logs. Blocks all anonymous and non-admin authenticated access.';