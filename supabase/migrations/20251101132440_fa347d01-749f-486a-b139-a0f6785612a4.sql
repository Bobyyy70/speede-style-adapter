-- Migration: Triggers pour la machine à états
-- Date: 2025-11-01
-- Description: Triggers automatiques pour date_modification et validation

-- 1. Trigger pour mettre à jour date_modification (si n'existe pas déjà)
CREATE OR REPLACE FUNCTION public.update_commande_date_modification()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  NEW.date_modification = NOW();
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trigger_update_commande_date_modification ON public.commande;

CREATE TRIGGER trigger_update_commande_date_modification
  BEFORE UPDATE ON public.commande
  FOR EACH ROW
  WHEN (OLD.* IS DISTINCT FROM NEW.*)
  EXECUTE FUNCTION public.update_commande_date_modification();

-- 2. Trigger pour valider les transitions manuelles (si quelqu'un bypass la fonction RPC)
CREATE OR REPLACE FUNCTION public.validate_statut_transition()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  -- Si le statut change
  IF OLD.statut_wms IS DISTINCT FROM NEW.statut_wms THEN
    -- Vérifier que la transition est autorisée
    IF NOT public.peut_transitionner(OLD.statut_wms, NEW.statut_wms) THEN
      RAISE EXCEPTION 'Transition de statut interdite : % → %. Utilisez la fonction transition_statut_commande().',
        get_statut_label(OLD.statut_wms),
        get_statut_label(NEW.statut_wms);
    END IF;
  END IF;

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trigger_validate_statut_transition ON public.commande;

CREATE TRIGGER trigger_validate_statut_transition
  BEFORE UPDATE ON public.commande
  FOR EACH ROW
  WHEN (OLD.statut_wms IS DISTINCT FROM NEW.statut_wms)
  EXECUTE FUNCTION public.validate_statut_transition();

-- 3. Commentaires
COMMENT ON FUNCTION public.update_commande_date_modification IS 'Met à jour automatiquement date_modification';
COMMENT ON FUNCTION public.validate_statut_transition IS 'Valide les transitions de statut même en cas de bypass de la fonction RPC';