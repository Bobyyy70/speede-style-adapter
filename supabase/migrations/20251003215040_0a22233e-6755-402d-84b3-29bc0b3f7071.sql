-- Add unique constraint on profiles.client_id first
ALTER TABLE public.profiles ADD CONSTRAINT profiles_client_id_unique UNIQUE (client_id);

-- Add client_id to commande table
ALTER TABLE public.commande ADD COLUMN IF NOT EXISTS client_id UUID;
ALTER TABLE public.commande ADD CONSTRAINT commande_client_id_fkey 
  FOREIGN KEY (client_id) REFERENCES public.profiles(client_id);

-- Add client_id to produit table  
ALTER TABLE public.produit ADD COLUMN IF NOT EXISTS client_id UUID;
ALTER TABLE public.produit ADD CONSTRAINT produit_client_id_fkey 
  FOREIGN KEY (client_id) REFERENCES public.profiles(client_id);

-- Add client_id to retour_produit table
ALTER TABLE public.retour_produit ADD COLUMN IF NOT EXISTS client_id UUID;
ALTER TABLE public.retour_produit ADD CONSTRAINT retour_produit_client_id_fkey 
  FOREIGN KEY (client_id) REFERENCES public.profiles(client_id);

-- Create indexes for better performance
CREATE INDEX IF NOT EXISTS idx_commande_client_id ON public.commande(client_id);
CREATE INDEX IF NOT EXISTS idx_produit_client_id ON public.produit(client_id);
CREATE INDEX IF NOT EXISTS idx_retour_produit_client_id ON public.retour_produit(client_id);

-- Update RLS policies for client access to commande
DROP POLICY IF EXISTS "Client read own commande" ON public.commande;
CREATE POLICY "Client read own commande"
ON public.commande
FOR SELECT
TO authenticated
USING (
  has_role(auth.uid(), 'client'::app_role) 
  AND client_id IN (SELECT client_id FROM public.profiles WHERE id = auth.uid())
);

-- Update RLS policies for client access to produit
CREATE POLICY "Client read own produit"
ON public.produit
FOR SELECT
TO authenticated
USING (
  has_role(auth.uid(), 'client'::app_role)
  AND client_id IN (SELECT client_id FROM public.profiles WHERE id = auth.uid())
);

-- Update RLS policies for client access to retour_produit
CREATE POLICY "Client read own retour_produit"
ON public.retour_produit
FOR SELECT
TO authenticated
USING (
  has_role(auth.uid(), 'client'::app_role)
  AND client_id IN (SELECT client_id FROM public.profiles WHERE id = auth.uid())
);

-- Client access to ligne_commande (via commande)
DROP POLICY IF EXISTS "Client read own ligne_commande" ON public.ligne_commande;
CREATE POLICY "Client read own ligne_commande"
ON public.ligne_commande
FOR SELECT
TO authenticated
USING (
  has_role(auth.uid(), 'client'::app_role)
  AND commande_id IN (
    SELECT id FROM public.commande 
    WHERE client_id IN (SELECT client_id FROM public.profiles WHERE id = auth.uid())
  )
);

-- Client access to ligne_retour_produit (via retour_produit)
CREATE POLICY "Client read own ligne_retour_produit"
ON public.ligne_retour_produit
FOR SELECT
TO authenticated
USING (
  has_role(auth.uid(), 'client'::app_role)
  AND retour_id IN (
    SELECT id FROM public.retour_produit 
    WHERE client_id IN (SELECT client_id FROM public.profiles WHERE id = auth.uid())
  )
);

-- Client access to mouvement_stock (only for their products)
CREATE POLICY "Client read own mouvement_stock"
ON public.mouvement_stock
FOR SELECT
TO authenticated
USING (
  has_role(auth.uid(), 'client'::app_role)
  AND produit_id IN (
    SELECT id FROM public.produit 
    WHERE client_id IN (SELECT client_id FROM public.profiles WHERE id = auth.uid())
  )
);