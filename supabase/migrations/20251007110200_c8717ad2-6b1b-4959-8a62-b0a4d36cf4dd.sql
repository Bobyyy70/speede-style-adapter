-- Phase 1: Permissions de base pour authenticated
GRANT USAGE ON SCHEMA public TO authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON TABLE public.produit TO authenticated;
GRANT USAGE ON SEQUENCE public.mouvement_stock_seq TO authenticated;

-- Phase 2: Policy pour lire son propre profil (idempotent)
DO $$ BEGIN
  CREATE POLICY "Users read own profile"
  ON public.profiles
  FOR SELECT
  TO authenticated
  USING (id = auth.uid());
EXCEPTION WHEN duplicate_object THEN NULL; END $$;