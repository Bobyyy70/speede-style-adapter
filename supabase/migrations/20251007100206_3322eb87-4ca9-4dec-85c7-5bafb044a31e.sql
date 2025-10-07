-- Phase 1: RLS policies for produit to allow CSV imports
-- Do NOT change grants; rely on RLS with authenticated users

-- Ensure RLS is enabled (usually already enabled); keep existing policies
-- Add insert/update/delete policies for roles

-- 1) Gestionnaire full write on produit
CREATE POLICY "Gestionnaire insert produit"
ON public.produit
FOR INSERT
TO authenticated
WITH CHECK (has_role(auth.uid(), 'gestionnaire'::app_role));

CREATE POLICY "Gestionnaire update produit"
ON public.produit
FOR UPDATE
TO authenticated
USING (has_role(auth.uid(), 'gestionnaire'::app_role))
WITH CHECK (has_role(auth.uid(), 'gestionnaire'::app_role));

CREATE POLICY "Gestionnaire delete produit"
ON public.produit
FOR DELETE
TO authenticated
USING (has_role(auth.uid(), 'gestionnaire'::app_role));

-- 2) Operateur write (insert/update) on produit
CREATE POLICY "Operateur insert produit"
ON public.produit
FOR INSERT
TO authenticated
WITH CHECK (has_role(auth.uid(), 'operateur'::app_role));

CREATE POLICY "Operateur update produit"
ON public.produit
FOR UPDATE
TO authenticated
USING (has_role(auth.uid(), 'operateur'::app_role))
WITH CHECK (has_role(auth.uid(), 'operateur'::app_role));

-- 3) Client can insert/update own products (client_id must match their profile)
CREATE POLICY "Client insert own produit"
ON public.produit
FOR INSERT
TO authenticated
WITH CHECK (
  has_role(auth.uid(), 'client'::app_role)
  AND client_id IN (
    SELECT profiles.client_id FROM profiles WHERE profiles.id = auth.uid()
  )
);

CREATE POLICY "Client update own produit"
ON public.produit
FOR UPDATE
TO authenticated
USING (
  has_role(auth.uid(), 'client'::app_role)
  AND client_id IN (
    SELECT profiles.client_id FROM profiles WHERE profiles.id = auth.uid()
  )
)
WITH CHECK (
  has_role(auth.uid(), 'client'::app_role)
  AND client_id IN (
    SELECT profiles.client_id FROM profiles WHERE profiles.id = auth.uid()
  )
);

-- Note: Admin full access and read policies already exist; keep them intact

-- Optional: Create a lightweight view for import validations (no, keep minimal for speed)
