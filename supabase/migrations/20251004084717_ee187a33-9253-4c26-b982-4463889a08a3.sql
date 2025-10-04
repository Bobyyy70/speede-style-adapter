-- Ensure RLS is enabled and public/anon privileges are revoked for defense in depth
ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY;

REVOKE ALL ON TABLE public.profiles FROM anon;
REVOKE ALL ON TABLE public.profiles FROM public;

-- Explicitly block any public (including anon) reads unless another policy allows it
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies 
    WHERE schemaname = 'public' 
      AND tablename = 'profiles' 
      AND policyname = 'block_public_profiles_select'
  ) THEN
    CREATE POLICY "block_public_profiles_select"
    ON public.profiles
    FOR SELECT
    TO public
    USING (false);
  END IF;
END $$;

-- Ensure authenticated users can only read their own profile
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies 
    WHERE schemaname = 'public' 
      AND tablename = 'profiles' 
      AND policyname = 'authenticated_view_own_profile'
  ) THEN
    CREATE POLICY "authenticated_view_own_profile"
    ON public.profiles
    FOR SELECT
    TO authenticated
    USING (auth.uid() = id);
  END IF;
END $$;

-- Ensure admins can read all profiles explicitly (limited to authenticated role)
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies 
    WHERE schemaname = 'public' 
      AND tablename = 'profiles' 
      AND policyname = 'admins_view_all_profiles'
  ) THEN
    CREATE POLICY "admins_view_all_profiles"
    ON public.profiles
    FOR SELECT
    TO authenticated
    USING (public.has_role(auth.uid(), 'admin'));
  END IF;
END $$;

-- Optional hardening: force RLS so even table owners go through policies
ALTER TABLE public.profiles FORCE ROW LEVEL SECURITY;

COMMENT ON POLICY "block_public_profiles_select" ON public.profiles IS 'Blocks any public/anon reads to profiles to prevent PII scraping.';
COMMENT ON POLICY "authenticated_view_own_profile" ON public.profiles IS 'Authenticated users can only read their own profile row.';
COMMENT ON POLICY "admins_view_all_profiles" ON public.profiles IS 'Admins (via user_roles) can read all profiles.';
