-- Grant SELECT on users_overview to authenticated users
GRANT SELECT ON public.users_overview TO authenticated;

-- Backfill missing profiles for all existing auth.users
SELECT public.backfill_missing_profiles();

-- Add console logging helper (optional, for debugging)
COMMENT ON VIEW public.users_overview IS 'View accessible to authenticated users showing user details with roles';