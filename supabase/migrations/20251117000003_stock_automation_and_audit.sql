-- ============================================================
-- MIGRATION: Gestion automatique des stocks + Audit des transitions
-- ============================================================
-- Cette migration implémente :
-- 1. Décrémentation automatique du stock lors des changements de statut
-- 2. Audit automatique de toutes les transitions de statut
-- 3. Réservation/Libération automatique du stock
-- 4. Gestion des retours avec réintégration du stock
-- ============================================================

-- ============================================================
-- PARTIE 1: FONCTION D'AUDIT DES TRANSITIONS
-- ============================================================

CREATE OR REPLACE FUNCTION public.log_commande_transition()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_utilisateur_id UUID;
  v_raison TEXT;
  v_metadata JSONB;
BEGIN
  -- Récupérer l'ID utilisateur du contexte (si disponible)
  v_utilisateur_id := auth.uid();

  -- Ne logger que si le statut a changé
  IF OLD.statut_wms IS DISTINCT FROM NEW.statut_wms THEN

    -- Construire les métadonnées
    v_metadata := jsonb_build_object(
      'numero_commande', NEW.numero_commande,
      'client_id', NEW.client_id,
      'tracking_number', NEW.tracking_number,
      'transporteur', NEW.transporteur,
      'poids_total', NEW.poids_total,
      'valeur_totale', NEW.valeur_totale
    );

    -- Déterminer la raison automatique du changement
    v_raison := CASE
      WHEN NEW.statut_wms = 'stock_reserve' THEN 'Stock réservé automatiquement'
      WHEN NEW.statut_wms = 'en_preparation' THEN 'Commande passée en préparation'
      WHEN NEW.statut_wms = 'en_picking' THEN 'Picking démarré'
      WHEN NEW.statut_wms = 'pret_expedition' THEN 'Préparation terminée'
      WHEN NEW.statut_wms = 'etiquette_generee' THEN 'Étiquette générée'
      WHEN NEW.statut_wms = 'expedie' THEN 'Colis expédié'
      WHEN NEW.statut_wms = 'livre' THEN 'Livraison confirmée'
      WHEN NEW.statut_wms = 'annule' THEN 'Commande annulée'
      WHEN NEW.statut_wms = 'erreur' THEN 'Erreur détectée'
      ELSE 'Changement de statut'
    END;

    -- Insérer dans la table de log des transitions
    INSERT INTO public.commande_transition_log (
      commande_id,
      statut_precedent,
      statut_nouveau,
      date_transition,
      utilisateur_id,
      raison,
      metadata
    ) VALUES (
      NEW.id,
      OLD.statut_wms,
      NEW.statut_wms,
      NOW(),
      v_utilisateur_id,
      v_raison,
      v_metadata
    );

    RAISE NOTICE 'Transition logged: % → % pour commande %',
      OLD.statut_wms, NEW.statut_wms, NEW.numero_commande;
  END IF;

  RETURN NEW;
END;
$$;

-- Créer le trigger sur la table commande
DROP TRIGGER IF EXISTS trigger_log_commande_transition ON public.commande;
CREATE TRIGGER trigger_log_commande_transition
  AFTER UPDATE ON public.commande
  FOR EACH ROW
  EXECUTE FUNCTION public.log_commande_transition();

-- ============================================================
-- PARTIE 2: GESTION AUTOMATIQUE DES STOCKS
-- ============================================================

CREATE OR REPLACE FUNCTION public.manage_stock_on_status_change()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_ligne RECORD;
  v_mouvement_type TEXT;
  v_statut_mouvement TEXT;
  v_raison TEXT;
  v_stock_disponible INTEGER;
BEGIN
  -- Ne traiter que si le statut a changé
  IF OLD.statut_wms IS DISTINCT FROM NEW.statut_wms THEN

    RAISE NOTICE 'Gestion stock pour commande % : % → %',
      NEW.numero_commande, OLD.statut_wms, NEW.statut_wms;

    -- ======================================================
    -- RÉSERVATION DU STOCK (stock_reserve)
    -- ======================================================
    IF NEW.statut_wms = 'stock_reserve' AND OLD.statut_wms != 'stock_reserve' THEN
      RAISE NOTICE 'Réservation du stock pour commande %', NEW.numero_commande;

      FOR v_ligne IN
        SELECT lc.*, p.stock_actuel, p.nom as produit_nom
        FROM public.ligne_commande lc
        JOIN public.produit p ON p.id = lc.produit_id
        WHERE lc.commande_id = NEW.id
      LOOP
        -- Vérifier si suffisamment de stock
        IF v_ligne.stock_actuel < v_ligne.quantite_commandee THEN
          RAISE WARNING 'Stock insuffisant pour % (dispo: %, besoin: %)',
            v_ligne.produit_nom, v_ligne.stock_actuel, v_ligne.quantite_commandee;

          -- Ne pas bloquer, juste logger
          INSERT INTO public.mouvement_stock (
            produit_id,
            type_mouvement,
            quantite,
            statut_mouvement,
            commande_id,
            reference_externe,
            raison,
            utilisateur_id
          ) VALUES (
            v_ligne.produit_id,
            'sortie',
            0, -- Quantité 0 pour indiquer un problème
            'erreur',
            NEW.id,
            NEW.numero_commande,
            format('ERREUR: Stock insuffisant (dispo: %s, besoin: %s)',
              v_ligne.stock_actuel, v_ligne.quantite_commandee),
            auth.uid()
          );
        ELSE
          -- Créer un mouvement de réservation (stock réservé, pas encore physiquement sorti)
          INSERT INTO public.mouvement_stock (
            produit_id,
            type_mouvement,
            quantite,
            statut_mouvement,
            commande_id,
            reference_externe,
            raison,
            utilisateur_id
          ) VALUES (
            v_ligne.produit_id,
            'sortie',
            -v_ligne.quantite_commandee, -- Négatif pour sortie
            'stock_reserve',
            NEW.id,
            NEW.numero_commande,
            format('Réservation pour commande %s', NEW.numero_commande),
            auth.uid()
          );

          RAISE NOTICE 'Stock réservé: % unités de produit %',
            v_ligne.quantite_commandee, v_ligne.produit_nom;
        END IF;
      END LOOP;
    END IF;

    -- ======================================================
    -- SORTIE PHYSIQUE DU STOCK (en_picking ou expedie)
    -- ======================================================
    IF NEW.statut_wms IN ('en_picking', 'expedie')
       AND OLD.statut_wms NOT IN ('en_picking', 'expedie')
       AND OLD.statut_wms != 'stock_reserve' THEN

      RAISE NOTICE 'Sortie physique du stock pour commande %', NEW.numero_commande;

      FOR v_ligne IN
        SELECT lc.*, p.stock_actuel, p.nom as produit_nom
        FROM public.ligne_commande lc
        JOIN public.produit p ON p.id = lc.produit_id
        WHERE lc.commande_id = NEW.id
      LOOP
        -- Créer un mouvement de sortie physique
        INSERT INTO public.mouvement_stock (
          produit_id,
          type_mouvement,
          quantite,
          statut_mouvement,
          commande_id,
          reference_externe,
          raison,
          utilisateur_id
        ) VALUES (
          v_ligne.produit_id,
          'sortie',
          -v_ligne.quantite_commandee,
          'stock_physique', -- Sortie réelle du stock
          NEW.id,
          NEW.numero_commande,
          format('Sortie physique - %s',
            CASE
              WHEN NEW.statut_wms = 'en_picking' THEN 'Picking'
              WHEN NEW.statut_wms = 'expedie' THEN 'Expédition'
              ELSE 'Sortie'
            END),
          auth.uid()
        );

        RAISE NOTICE 'Stock sorti: % unités de produit %',
          v_ligne.quantite_commandee, v_ligne.produit_nom;
      END LOOP;
    END IF;

    -- ======================================================
    -- LIBÉRATION DU STOCK (annule depuis stock_reserve)
    -- ======================================================
    IF NEW.statut_wms = 'annule' AND OLD.statut_wms = 'stock_reserve' THEN
      RAISE NOTICE 'Libération du stock réservé pour commande %', NEW.numero_commande;

      FOR v_ligne IN
        SELECT lc.*, p.nom as produit_nom
        FROM public.ligne_commande lc
        JOIN public.produit p ON p.id = lc.produit_id
        WHERE lc.commande_id = NEW.id
      LOOP
        -- Créer un mouvement de libération (annulation de réservation)
        INSERT INTO public.mouvement_stock (
          produit_id,
          type_mouvement,
          quantite,
          statut_mouvement,
          commande_id,
          reference_externe,
          raison,
          utilisateur_id
        ) VALUES (
          v_ligne.produit_id,
          'entree',
          v_ligne.quantite_commandee, -- Positif pour remettre en stock
          'stock_physique',
          NEW.id,
          NEW.numero_commande,
          format('Libération réservation - Commande annulée: %s', NEW.numero_commande),
          auth.uid()
        );

        RAISE NOTICE 'Stock libéré: % unités de produit %',
          v_ligne.quantite_commandee, v_ligne.produit_nom;
      END LOOP;
    END IF;

    -- ======================================================
    -- RÉINTÉGRATION DU STOCK (retour après livraison)
    -- ======================================================
    IF NEW.statut_wms = 'retour' AND OLD.statut_wms IN ('expedie', 'livre') THEN
      RAISE NOTICE 'Réintégration du stock pour retour commande %', NEW.numero_commande;

      FOR v_ligne IN
        SELECT lc.*, p.nom as produit_nom
        FROM public.ligne_commande lc
        JOIN public.produit p ON p.id = lc.produit_id
        WHERE lc.commande_id = NEW.id
      LOOP
        -- Créer un mouvement de retour
        INSERT INTO public.mouvement_stock (
          produit_id,
          type_mouvement,
          quantite,
          statut_mouvement,
          commande_id,
          reference_externe,
          raison,
          utilisateur_id
        ) VALUES (
          v_ligne.produit_id,
          'entree',
          v_ligne.quantite_commandee, -- Positif pour remettre en stock
          'stock_physique',
          NEW.id,
          NEW.numero_commande,
          format('Retour produit - Commande: %s', NEW.numero_commande),
          auth.uid()
        );

        RAISE NOTICE 'Stock réintégré: % unités de produit %',
          v_ligne.quantite_commandee, v_ligne.produit_nom;
      END LOOP;
    END IF;

  END IF;

  RETURN NEW;
END;
$$;

-- Créer le trigger pour la gestion automatique des stocks
DROP TRIGGER IF EXISTS trigger_manage_stock_on_status_change ON public.commande;
CREATE TRIGGER trigger_manage_stock_on_status_change
  AFTER UPDATE ON public.commande
  FOR EACH ROW
  EXECUTE FUNCTION public.manage_stock_on_status_change();

-- ============================================================
-- PARTIE 3: FONCTIONS UTILITAIRES
-- ============================================================

-- Fonction pour obtenir le stock disponible (physique - réservé)
CREATE OR REPLACE FUNCTION public.get_stock_disponible(p_produit_id UUID)
RETURNS INTEGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_stock_physique INTEGER;
  v_stock_reserve INTEGER;
BEGIN
  -- Stock physique réel
  SELECT COALESCE(stock_actuel, 0) INTO v_stock_physique
  FROM public.produit
  WHERE id = p_produit_id;

  -- Stock réservé (non encore sorti physiquement)
  SELECT COALESCE(SUM(ABS(quantite)), 0) INTO v_stock_reserve
  FROM public.mouvement_stock
  WHERE produit_id = p_produit_id
    AND statut_mouvement = 'stock_reserve'
    AND type_mouvement = 'sortie';

  RETURN v_stock_physique - v_stock_reserve;
END;
$$;

-- Fonction pour vérifier si une commande peut être préparée
CREATE OR REPLACE FUNCTION public.can_prepare_commande(p_commande_id UUID)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_ligne RECORD;
  v_result JSONB := '{"can_prepare": true, "issues": []}'::jsonb;
  v_issues JSONB := '[]'::jsonb;
  v_stock_disponible INTEGER;
BEGIN
  FOR v_ligne IN
    SELECT lc.*, p.nom as produit_nom, p.stock_actuel
    FROM public.ligne_commande lc
    JOIN public.produit p ON p.id = lc.produit_id
    WHERE lc.commande_id = p_commande_id
  LOOP
    -- Vérifier le stock disponible
    v_stock_disponible := public.get_stock_disponible(v_ligne.produit_id);

    IF v_stock_disponible < v_ligne.quantite_commandee THEN
      v_issues := v_issues || jsonb_build_object(
        'produit_id', v_ligne.produit_id,
        'produit_nom', v_ligne.produit_nom,
        'quantite_requise', v_ligne.quantite_commandee,
        'stock_disponible', v_stock_disponible,
        'manquant', v_ligne.quantite_commandee - v_stock_disponible
      );
    END IF;
  END LOOP;

  IF jsonb_array_length(v_issues) > 0 THEN
    v_result := jsonb_set(v_result, '{can_prepare}', 'false'::jsonb);
    v_result := jsonb_set(v_result, '{issues}', v_issues);
  END IF;

  RETURN v_result;
END;
$$;

-- ============================================================
-- PARTIE 4: VUES POUR MONITORING
-- ============================================================

-- Vue pour voir les stocks réservés par produit
CREATE OR REPLACE VIEW public.v_stock_reserves AS
SELECT
  p.id as produit_id,
  p.reference,
  p.nom as produit_nom,
  p.stock_actuel,
  COALESCE(SUM(ABS(ms.quantite)), 0) as stock_reserve,
  p.stock_actuel - COALESCE(SUM(ABS(ms.quantite)), 0) as stock_disponible
FROM public.produit p
LEFT JOIN public.mouvement_stock ms ON ms.produit_id = p.id
  AND ms.statut_mouvement = 'stock_reserve'
  AND ms.type_mouvement = 'sortie'
GROUP BY p.id, p.reference, p.nom, p.stock_actuel
ORDER BY p.nom;

COMMENT ON VIEW public.v_stock_reserves IS
  'Vue montrant les stocks physiques, réservés et disponibles par produit';

-- Vue pour les transitions récentes
CREATE OR REPLACE VIEW public.v_recent_transitions AS
SELECT
  ctl.id,
  ctl.date_transition,
  c.numero_commande,
  cl.nom_entreprise as client,
  ctl.statut_precedent,
  ctl.statut_nouveau,
  ctl.raison,
  u.nom_complet as utilisateur,
  ctl.metadata
FROM public.commande_transition_log ctl
JOIN public.commande c ON c.id = ctl.commande_id
LEFT JOIN public.client cl ON cl.id = c.client_id
LEFT JOIN public.profiles u ON u.id = ctl.utilisateur_id
ORDER BY ctl.date_transition DESC
LIMIT 100;

COMMENT ON VIEW public.v_recent_transitions IS
  'Vue des 100 dernières transitions de statut de commandes';

-- ============================================================
-- PARTIE 5: PERMISSIONS RLS
-- ============================================================

-- Permettre aux utilisateurs authentifiés de consulter les vues
GRANT SELECT ON public.v_stock_reserves TO authenticated;
GRANT SELECT ON public.v_recent_transitions TO authenticated;

-- ============================================================
-- COMMENTAIRES
-- ============================================================

COMMENT ON FUNCTION public.log_commande_transition() IS
  'Fonction trigger pour auditer automatiquement tous les changements de statut de commande';

COMMENT ON FUNCTION public.manage_stock_on_status_change() IS
  'Fonction trigger pour gérer automatiquement les stocks lors des changements de statut: '
  'réservation, sortie physique, libération, réintégration';

COMMENT ON FUNCTION public.get_stock_disponible(UUID) IS
  'Retourne le stock disponible (physique - réservé) pour un produit donné';

COMMENT ON FUNCTION public.can_prepare_commande(UUID) IS
  'Vérifie si une commande peut être préparée en fonction du stock disponible';

-- ============================================================
-- RÉSUMÉ
-- ============================================================

DO $$
BEGIN
  RAISE NOTICE '';
  RAISE NOTICE '========================================';
  RAISE NOTICE '   GESTION AUTOMATIQUE STOCKS + AUDIT';
  RAISE NOTICE '========================================';
  RAISE NOTICE 'Triggers créés:';
  RAISE NOTICE '  ✅ trigger_log_commande_transition';
  RAISE NOTICE '  ✅ trigger_manage_stock_on_status_change';
  RAISE NOTICE '';
  RAISE NOTICE 'Fonctions utilitaires:';
  RAISE NOTICE '  ✅ get_stock_disponible(produit_id)';
  RAISE NOTICE '  ✅ can_prepare_commande(commande_id)';
  RAISE NOTICE '';
  RAISE NOTICE 'Vues monitoring:';
  RAISE NOTICE '  ✅ v_stock_reserves';
  RAISE NOTICE '  ✅ v_recent_transitions';
  RAISE NOTICE '';
  RAISE NOTICE 'Fonctionnalités:';
  RAISE NOTICE '  ✅ Audit auto des transitions';
  RAISE NOTICE '  ✅ Réservation stock automatique';
  RAISE NOTICE '  ✅ Sortie physique automatique';
  RAISE NOTICE '  ✅ Libération stock annulation';
  RAISE NOTICE '  ✅ Réintégration retours';
  RAISE NOTICE '========================================';
  RAISE NOTICE '';
END $$;
