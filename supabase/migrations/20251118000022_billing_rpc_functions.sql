-- =====================================================
-- SYSTÈME FACTURATION - RPC Functions & CRON
-- Description: Génération automatique factures mensuelles
-- Date: 2025-11-18
-- =====================================================

-- =====================================================
-- 1. calculer_prestations_stockage
-- =====================================================

CREATE OR REPLACE FUNCTION calculer_prestations_stockage(
  p_client_id UUID,
  p_date_debut DATE,
  p_date_fin DATE
)
RETURNS TABLE (
  type_prestation TEXT,
  description TEXT,
  quantite DECIMAL,
  unite TEXT,
  prix_unitaire DECIMAL,
  total DECIMAL
) AS $$
DECLARE
  v_tarif RECORD;
  v_nb_jours INTEGER;
  v_m2_stockes DECIMAL;
BEGIN
  -- Récupérer le tarif stockage du client
  SELECT * INTO v_tarif
  FROM public.tarification_client
  WHERE client_id = p_client_id
  AND type_prestation = 'stockage_m2_jour'
  AND actif = TRUE
  AND date_debut <= p_date_debut
  AND (date_fin IS NULL OR date_fin >= p_date_fin)
  LIMIT 1;

  IF v_tarif IS NULL THEN
    -- Pas de tarif défini pour ce client
    RETURN;
  END IF;

  -- Calculer le nombre de jours
  v_nb_jours := (p_date_fin - p_date_debut) + 1;

  -- Estimer les m² stockés (moyenne sur la période)
  -- TODO: Adapter selon votre logique métier exacte
  -- Ici on prend la moyenne des quantités stockées
  SELECT COALESCE(AVG(
    (SELECT SUM(quantite_disponible)
     FROM public.emplacement_stock es
     WHERE es.produit_id = p.id)
  ), 0) * 0.01 -- Conversion en m² (à adapter)
  INTO v_m2_stockes
  FROM public.produit p
  WHERE p.client_id = p_client_id;

  -- Retourner la ligne de prestation
  IF v_m2_stockes > 0 THEN
    RETURN QUERY SELECT
      'stockage_m2_jour'::TEXT,
      format('Stockage %s m² pendant %s jours', ROUND(v_m2_stockes, 2), v_nb_jours),
      ROUND(v_m2_stockes * v_nb_jours, 2),
      'jour'::TEXT,
      v_tarif.prix_unitaire,
      ROUND(v_m2_stockes * v_nb_jours * v_tarif.prix_unitaire, 2);
  END IF;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- =====================================================
-- 2. calculer_prestations_picking
-- =====================================================

CREATE OR REPLACE FUNCTION calculer_prestations_picking(
  p_client_id UUID,
  p_date_debut DATE,
  p_date_fin DATE
)
RETURNS TABLE (
  type_prestation TEXT,
  description TEXT,
  quantite DECIMAL,
  unite TEXT,
  prix_unitaire DECIMAL,
  total DECIMAL,
  reference_externe_type TEXT,
  reference_externe_id UUID
) AS $$
DECLARE
  v_tarif RECORD;
  v_nb_lignes INTEGER;
BEGIN
  -- Récupérer le tarif picking du client
  SELECT * INTO v_tarif
  FROM public.tarification_client
  WHERE client_id = p_client_id
  AND type_prestation = 'picking_ligne'
  AND actif = TRUE
  AND date_debut <= p_date_debut
  AND (date_fin IS NULL OR date_fin >= p_date_fin)
  LIMIT 1;

  IF v_tarif IS NULL THEN
    RETURN;
  END IF;

  -- Compter les lignes de commandes pickées pendant la période
  SELECT COUNT(*) INTO v_nb_lignes
  FROM public.ligne_commande lc
  JOIN public.commande c ON c.id = lc.commande_id
  WHERE c.client_id = p_client_id
  AND DATE(c.date_creation) BETWEEN p_date_debut AND p_date_fin
  AND c.statut_wms IN ('en_picking', 'picking_termine', 'en_preparation', 'pret_expedition', 'expedie', 'livre');

  IF v_nb_lignes > 0 THEN
    RETURN QUERY SELECT
      'picking_ligne'::TEXT,
      format('Picking de %s lignes de commande', v_nb_lignes),
      v_nb_lignes::DECIMAL,
      'ligne'::TEXT,
      v_tarif.prix_unitaire,
      ROUND(v_nb_lignes * v_tarif.prix_unitaire, 2),
      'commande'::TEXT,
      NULL::UUID;
  END IF;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- =====================================================
-- 3. calculer_prestations_preparation
-- =====================================================

CREATE OR REPLACE FUNCTION calculer_prestations_preparation(
  p_client_id UUID,
  p_date_debut DATE,
  p_date_fin DATE
)
RETURNS TABLE (
  type_prestation TEXT,
  description TEXT,
  quantite DECIMAL,
  unite TEXT,
  prix_unitaire DECIMAL,
  total DECIMAL
) AS $$
DECLARE
  v_tarif RECORD;
  v_nb_commandes INTEGER;
BEGIN
  SELECT * INTO v_tarif
  FROM public.tarification_client
  WHERE client_id = p_client_id
  AND type_prestation = 'preparation_commande'
  AND actif = TRUE
  AND date_debut <= p_date_debut
  AND (date_fin IS NULL OR date_fin >= p_date_fin)
  LIMIT 1;

  IF v_tarif IS NULL THEN
    RETURN;
  END IF;

  SELECT COUNT(*) INTO v_nb_commandes
  FROM public.commande c
  WHERE c.client_id = p_client_id
  AND DATE(c.date_creation) BETWEEN p_date_debut AND p_date_fin
  AND c.statut_wms IN ('en_preparation', 'pret_expedition', 'expedie', 'livre');

  IF v_nb_commandes > 0 THEN
    RETURN QUERY SELECT
      'preparation_commande'::TEXT,
      format('Préparation de %s commandes', v_nb_commandes),
      v_nb_commandes::DECIMAL,
      'commande'::TEXT,
      v_tarif.prix_unitaire,
      ROUND(v_nb_commandes * v_tarif.prix_unitaire, 2);
  END IF;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- =====================================================
-- 4. calculer_prestations_expedition
-- =====================================================

CREATE OR REPLACE FUNCTION calculer_prestations_expedition(
  p_client_id UUID,
  p_date_debut DATE,
  p_date_fin DATE
)
RETURNS TABLE (
  type_prestation TEXT,
  description TEXT,
  quantite DECIMAL,
  unite TEXT,
  prix_unitaire DECIMAL,
  total DECIMAL
) AS $$
DECLARE
  v_tarif RECORD;
  v_nb_colis INTEGER;
BEGIN
  SELECT * INTO v_tarif
  FROM public.tarification_client
  WHERE client_id = p_client_id
  AND type_prestation = 'expedition_colis'
  AND actif = TRUE
  AND date_debut <= p_date_debut
  AND (date_fin IS NULL OR date_fin >= p_date_fin)
  LIMIT 1;

  IF v_tarif IS NULL THEN
    RETURN;
  END IF;

  SELECT COUNT(*) INTO v_nb_colis
  FROM public.commande c
  WHERE c.client_id = p_client_id
  AND DATE(c.date_creation) BETWEEN p_date_debut AND p_date_fin
  AND c.statut_wms IN ('expedie', 'en_transit', 'en_livraison', 'livre');

  IF v_nb_colis > 0 THEN
    RETURN QUERY SELECT
      'expedition_colis'::TEXT,
      format('Expédition de %s colis', v_nb_colis),
      v_nb_colis::DECIMAL,
      'colis'::TEXT,
      v_tarif.prix_unitaire,
      ROUND(v_nb_colis * v_tarif.prix_unitaire, 2);
  END IF;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- =====================================================
-- 5. generer_facture_mensuelle - FONCTION PRINCIPALE
-- =====================================================

CREATE OR REPLACE FUNCTION generer_facture_mensuelle(
  p_client_id UUID,
  p_mois INTEGER,
  p_annee INTEGER
)
RETURNS UUID AS $$
DECLARE
  v_facture_id UUID;
  v_numero_facture TEXT;
  v_date_debut DATE;
  v_date_fin DATE;
  v_date_echeance DATE;
  v_montant_total DECIMAL := 0;
  v_ligne RECORD;
  v_ordre INTEGER := 0;
BEGIN
  -- Vérifier si facture existe déjà
  SELECT id INTO v_facture_id
  FROM public.facturation_mensuelle
  WHERE client_id = p_client_id
  AND periode_mois = p_mois
  AND periode_annee = p_annee;

  IF v_facture_id IS NOT NULL THEN
    RAISE EXCEPTION 'Facture déjà existante pour ce client et cette période';
  END IF;

  -- Calculer les dates
  v_date_debut := make_date(p_annee, p_mois, 1);
  v_date_fin := (v_date_debut + INTERVAL '1 month' - INTERVAL '1 day')::DATE;
  v_date_echeance := CURRENT_DATE + INTERVAL '30 days';

  -- Générer le numéro de facture
  v_numero_facture := generer_numero_facture(p_annee, p_mois);

  -- Créer la facture
  INSERT INTO public.facturation_mensuelle (
    numero_facture,
    client_id,
    periode_mois,
    periode_annee,
    date_emission,
    date_echeance,
    montant_ht,
    statut_paiement,
    created_by
  ) VALUES (
    v_numero_facture,
    p_client_id,
    p_mois,
    p_annee,
    CURRENT_DATE,
    v_date_echeance,
    0, -- Sera calculé après ajout des lignes
    'en_attente',
    auth.uid()
  ) RETURNING id INTO v_facture_id;

  -- Ajouter les prestations de stockage
  FOR v_ligne IN
    SELECT * FROM calculer_prestations_stockage(p_client_id, v_date_debut, v_date_fin)
  LOOP
    v_ordre := v_ordre + 1;
    INSERT INTO public.facturation_ligne (
      facture_id,
      type_prestation,
      description,
      quantite,
      unite,
      prix_unitaire,
      ordre
    ) VALUES (
      v_facture_id,
      v_ligne.type_prestation,
      v_ligne.description,
      v_ligne.quantite,
      v_ligne.unite,
      v_ligne.prix_unitaire,
      v_ordre
    );
    v_montant_total := v_montant_total + v_ligne.total;
  END LOOP;

  -- Ajouter les prestations de picking
  FOR v_ligne IN
    SELECT * FROM calculer_prestations_picking(p_client_id, v_date_debut, v_date_fin)
  LOOP
    v_ordre := v_ordre + 1;
    INSERT INTO public.facturation_ligne (
      facture_id,
      type_prestation,
      description,
      quantite,
      unite,
      prix_unitaire,
      reference_externe_type,
      reference_externe_id,
      ordre
    ) VALUES (
      v_facture_id,
      v_ligne.type_prestation,
      v_ligne.description,
      v_ligne.quantite,
      v_ligne.unite,
      v_ligne.prix_unitaire,
      v_ligne.reference_externe_type,
      v_ligne.reference_externe_id,
      v_ordre
    );
    v_montant_total := v_montant_total + v_ligne.total;
  END LOOP;

  -- Ajouter les prestations de préparation
  FOR v_ligne IN
    SELECT * FROM calculer_prestations_preparation(p_client_id, v_date_debut, v_date_fin)
  LOOP
    v_ordre := v_ordre + 1;
    INSERT INTO public.facturation_ligne (
      facture_id,
      type_prestation,
      description,
      quantite,
      unite,
      prix_unitaire,
      ordre
    ) VALUES (
      v_facture_id,
      v_ligne.type_prestation,
      v_ligne.description,
      v_ligne.quantite,
      v_ligne.unite,
      v_ligne.prix_unitaire,
      v_ordre
    );
    v_montant_total := v_montant_total + v_ligne.total;
  END LOOP;

  -- Ajouter les prestations d'expédition
  FOR v_ligne IN
    SELECT * FROM calculer_prestations_expedition(p_client_id, v_date_debut, v_date_fin)
  LOOP
    v_ordre := v_ordre + 1;
    INSERT INTO public.facturation_ligne (
      facture_id,
      type_prestation,
      description,
      quantite,
      unite,
      prix_unitaire,
      ordre
    ) VALUES (
      v_facture_id,
      v_ligne.type_prestation,
      v_ligne.description,
      v_ligne.quantite,
      v_ligne.unite,
      v_ligne.prix_unitaire,
      v_ordre
    );
    v_montant_total := v_montant_total + v_ligne.total;
  END LOOP;

  -- Mettre à jour le montant total de la facture
  UPDATE public.facturation_mensuelle
  SET montant_ht = v_montant_total
  WHERE id = v_facture_id;

  RAISE NOTICE 'Facture % générée pour client % : % € HT',
    v_numero_facture, p_client_id, v_montant_total;

  RETURN v_facture_id;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- =====================================================
-- 6. generer_toutes_factures_mensuelles - CRON
-- =====================================================

CREATE OR REPLACE FUNCTION generer_toutes_factures_mensuelles()
RETURNS JSONB AS $$
DECLARE
  v_client RECORD;
  v_mois INTEGER := EXTRACT(MONTH FROM (CURRENT_DATE - INTERVAL '1 day'));
  v_annee INTEGER := EXTRACT(YEAR FROM (CURRENT_DATE - INTERVAL '1 day'));
  v_nb_factures INTEGER := 0;
  v_nb_erreurs INTEGER := 0;
  v_facture_id UUID;
  v_results JSONB := '[]'::JSONB;
BEGIN
  -- Générer une facture pour chaque client actif
  FOR v_client IN
    SELECT c.id, c.nom_entreprise
    FROM public.client c
    WHERE c.actif = TRUE
  LOOP
    BEGIN
      v_facture_id := generer_facture_mensuelle(v_client.id, v_mois, v_annee);

      IF v_facture_id IS NOT NULL THEN
        v_nb_factures := v_nb_factures + 1;
        v_results := v_results || jsonb_build_object(
          'client_id', v_client.id,
          'client_nom', v_client.nom_entreprise,
          'facture_id', v_facture_id,
          'success', true
        );
      END IF;

    EXCEPTION WHEN OTHERS THEN
      v_nb_erreurs := v_nb_erreurs + 1;
      v_results := v_results || jsonb_build_object(
        'client_id', v_client.id,
        'client_nom', v_client.nom_entreprise,
        'success', false,
        'error', SQLERRM
      );
    END;
  END LOOP;

  RETURN jsonb_build_object(
    'success', true,
    'periode_mois', v_mois,
    'periode_annee', v_annee,
    'nb_factures_generees', v_nb_factures,
    'nb_erreurs', v_nb_erreurs,
    'details', v_results
  );
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- =====================================================
-- 7. get_factures_client - Récupération factures
-- =====================================================

CREATE OR REPLACE FUNCTION get_factures_client(
  p_client_id UUID,
  p_annee INTEGER DEFAULT NULL
)
RETURNS TABLE (
  facture_id UUID,
  numero_facture TEXT,
  periode_mois INTEGER,
  periode_annee INTEGER,
  date_emission DATE,
  date_echeance DATE,
  montant_ht DECIMAL,
  montant_ttc DECIMAL,
  statut_paiement TEXT,
  nb_lignes INTEGER
) AS $$
BEGIN
  RETURN QUERY
  SELECT
    fm.id,
    fm.numero_facture,
    fm.periode_mois,
    fm.periode_annee,
    fm.date_emission,
    fm.date_echeance,
    fm.montant_ht,
    fm.montant_ttc,
    fm.statut_paiement,
    (SELECT COUNT(*)::INTEGER FROM public.facturation_ligne WHERE facture_id = fm.id)
  FROM public.facturation_mensuelle fm
  WHERE fm.client_id = p_client_id
  AND (p_annee IS NULL OR fm.periode_annee = p_annee)
  ORDER BY fm.periode_annee DESC, fm.periode_mois DESC;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- =====================================================
-- 8. CRON Job - Génération automatique fin de mois
-- =====================================================

-- Désactiver le job existant si présent
SELECT cron.unschedule('generate-monthly-invoices') WHERE TRUE;

-- CRON: Premier jour du mois à 02:00 (génère factures du mois précédent)
SELECT cron.schedule(
  'generate-monthly-invoices',
  '0 2 1 * *', -- At 02:00 on day 1 of every month
  $$
  SELECT generer_toutes_factures_mensuelles();
  $$
);

-- =====================================================
-- 9. Summary
-- =====================================================

DO $$
DECLARE
  job_count INTEGER;
BEGIN
  SELECT COUNT(*) INTO job_count
  FROM cron.job
  WHERE jobname = 'generate-monthly-invoices';

  RAISE NOTICE '';
  RAISE NOTICE '========================================';
  RAISE NOTICE '  FACTURATION - RPC FUNCTIONS & CRON';
  RAISE NOTICE '========================================';
  RAISE NOTICE 'RPC Functions créées:';
  RAISE NOTICE '  ✅ calculer_prestations_stockage()';
  RAISE NOTICE '  ✅ calculer_prestations_picking()';
  RAISE NOTICE '  ✅ calculer_prestations_preparation()';
  RAISE NOTICE '  ✅ calculer_prestations_expedition()';
  RAISE NOTICE '  ✅ generer_facture_mensuelle()';
  RAISE NOTICE '  ✅ generer_toutes_factures_mensuelles()';
  RAISE NOTICE '  ✅ get_factures_client()';
  RAISE NOTICE '';
  RAISE NOTICE 'CRON Job:';
  IF job_count > 0 THEN
    RAISE NOTICE '  ✅ generate-monthly-invoices (1er du mois 02:00)';
  ELSE
    RAISE WARNING '  ⚠️  CRON job non créé - Vérifier pg_cron';
  END IF;
  RAISE NOTICE '';
  RAISE NOTICE 'Workflow:';
  RAISE NOTICE '  1. CRON déclenché le 1er du mois';
  RAISE NOTICE '  2. Calcul auto prestations mois précédent';
  RAISE NOTICE '  3. Génération factures tous clients actifs';
  RAISE NOTICE '  4. Numérotation auto (FACT-YYYYMM-XXXXX)';
  RAISE NOTICE '  5. Statut "en_attente" par défaut';
  RAISE NOTICE '';
  RAISE NOTICE 'Test manuel:';
  RAISE NOTICE '  SELECT generer_facture_mensuelle(';
  RAISE NOTICE '    ''client-uuid'', 11, 2025';
  RAISE NOTICE '  );';
  RAISE NOTICE '========================================';
  RAISE NOTICE '';
END $$;
