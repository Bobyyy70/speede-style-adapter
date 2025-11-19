-- Fix RLS pour produits - Accès simplifié
DROP POLICY IF EXISTS "Client read produit" ON public.produit;
DROP POLICY IF EXISTS "Admin full access produit" ON public.produit;
DROP POLICY IF EXISTS "Gestionnaire full access produit" ON public.produit;
DROP POLICY IF EXISTS "Operateur read produit" ON public.produit;
DROP POLICY IF EXISTS "Service role full access produit" ON public.produit;

CREATE POLICY "Allow all authenticated produit"
  ON public.produit
  FOR ALL
  TO authenticated
  USING (true)
  WITH CHECK (true);

CREATE POLICY "Allow service role produit"
  ON public.produit
  FOR ALL
  TO service_role
  USING (true)
  WITH CHECK (true);