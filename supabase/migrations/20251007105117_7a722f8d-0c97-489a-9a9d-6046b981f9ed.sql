-- Phase 1: privileges de base
DO $$ BEGIN
  GRANT USAGE ON SCHEMA public TO authenticated;
EXCEPTION WHEN OTHERS THEN NULL; END $$;

GRANT SELECT, INSERT ON TABLE public.mouvement_stock TO authenticated;
GRANT SELECT ON TABLE public.produit TO authenticated;

-- Phase 2: RLS complémentaires
-- Autoriser les gestionnaires à insérer des mouvements de stock
DO $$ BEGIN
  CREATE POLICY "Gestionnaire insert mouvement_stock"
  ON public.mouvement_stock
  FOR INSERT
  TO authenticated
  WITH CHECK (public.has_role(auth.uid(), 'gestionnaire'));
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

-- S'assurer que la policy opérateur insert existe (sinon la créer de manière idempotente)
DO $$ BEGIN
  CREATE POLICY "Operateur insert mouvement_stock"
  ON public.mouvement_stock
  FOR INSERT
  TO authenticated
  WITH CHECK (public.has_role(auth.uid(), 'operateur'));
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

-- Phase 3: Triggers pour numéro auto et mise à jour du stock
-- 3.1 Trigger pour générer automatiquement numero_mouvement si NULL
DO $$ BEGIN
  CREATE TRIGGER trg_generate_numero_mouvement
  BEFORE INSERT ON public.mouvement_stock
  FOR EACH ROW
  EXECUTE FUNCTION public.generate_numero_mouvement();
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

-- 3.2 Fonction pour mettre à jour le stock du produit après insertion d'un mouvement
CREATE OR REPLACE FUNCTION public.update_stock_actuel_after_mouvement()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  -- Ne mettre à jour que les mouvements de stock physique
  IF NEW.statut_mouvement IS NULL OR NEW.statut_mouvement = 'stock_physique' THEN
    UPDATE public.produit p
    SET stock_actuel = COALESCE(p.stock_actuel, 0) + COALESCE(NEW.quantite, 0)
    WHERE p.id = NEW.produit_id;
  END IF;
  RETURN NEW;
END;
$$;

-- 3.3 Trigger qui appelle la fonction après insertion
DO $$ BEGIN
  CREATE TRIGGER trg_update_stock_actuel_after_insert
  AFTER INSERT ON public.mouvement_stock
  FOR EACH ROW
  EXECUTE FUNCTION public.update_stock_actuel_after_mouvement();
EXCEPTION WHEN duplicate_object THEN NULL; END $$;