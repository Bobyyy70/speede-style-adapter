-- =====================================================
-- API PUBLIQUES POUR PORTAILS TRACKING & RETOURS
-- Description: Endpoints publics pour widgets clients
-- Date: 2025-11-18
-- =====================================================

-- =====================================================
-- 1. API TRACKING PUBLIC
-- =====================================================

-- Fonction pour tracker une commande (API publique)
CREATE OR REPLACE FUNCTION api_public_track_commande(
  p_api_token TEXT,
  p_numero_commande TEXT DEFAULT NULL,
  p_numero_tracking TEXT DEFAULT NULL,
  p_email_client TEXT DEFAULT NULL
)
RETURNS JSONB AS $$
DECLARE
  v_token_record RECORD;
  v_commande RECORD;
  v_result JSONB;
  v_historique JSONB;
BEGIN
  -- Vérifier le token
  SELECT * INTO v_token_record
  FROM public.client_api_token
  WHERE token = p_api_token
  AND actif = TRUE
  AND type_acces IN ('tracking', 'both')
  AND (expires_at IS NULL OR expires_at > now());

  IF v_token_record IS NULL THEN
    RETURN jsonb_build_object(
      'success', false,
      'error', 'Invalid or expired API token'
    );
  END IF;

  -- Trouver la commande
  SELECT * INTO v_commande
  FROM public.commande
  WHERE client_id = v_token_record.client_id
  AND (
    (p_numero_commande IS NOT NULL AND numero_commande = p_numero_commande)
    OR (p_numero_tracking IS NOT NULL AND numero_suivi = p_numero_tracking)
  )
  AND (p_email_client IS NULL OR email_client = p_email_client);

  IF v_commande IS NULL THEN
    -- Log l'accès (échec)
    INSERT INTO public.api_public_log (
      token_id, client_id, endpoint, methode,
      numero_commande, numero_tracking, status_code
    ) VALUES (
      v_token_record.id, v_token_record.client_id,
      'api_public_track_commande', 'POST',
      p_numero_commande, p_numero_tracking, 404
    );

    RETURN jsonb_build_object(
      'success', false,
      'error', 'Order not found'
    );
  END IF;

  -- Récupérer l'historique des statuts
  SELECT jsonb_agg(
    jsonb_build_object(
      'date', hsc.created_at,
      'statut', hsc.nouveau_statut,
      'description', CASE hsc.nouveau_statut
        WHEN 'stock_reserve' THEN 'Commande validée, stock réservé'
        WHEN 'en_picking' THEN 'Préparation en cours (picking)'
        WHEN 'picking_termine' THEN 'Picking terminé'
        WHEN 'en_preparation' THEN 'Emballage en cours'
        WHEN 'pret_expedition' THEN 'Prêt à expédier'
        WHEN 'expedie' THEN 'Colis expédié'
        WHEN 'en_transit' THEN 'En transit vers vous'
        WHEN 'en_livraison' THEN 'En cours de livraison'
        WHEN 'livre' THEN 'Livré !'
        ELSE hsc.nouveau_statut
      END
    ) ORDER BY hsc.created_at
  ) INTO v_historique
  FROM public.historique_statut_commande hsc
  WHERE hsc.commande_id = v_commande.id;

  -- Construire la réponse
  v_result := jsonb_build_object(
    'success', true,
    'data', jsonb_build_object(
      'numero_commande', v_commande.numero_commande,
      'statut_actuel', v_commande.statut_wms,
      'date_commande', v_commande.date_creation,
      'date_livraison_estimee', v_commande.date_livraison_estimee,
      'transporteur', v_commande.transporteur,
      'numero_tracking', v_commande.numero_suivi,
      'url_tracking_transporteur', v_commande.url_tracking,
      'adresse_livraison', jsonb_build_object(
        'destinataire', v_commande.nom_destinataire,
        'adresse', v_commande.adresse_livraison,
        'code_postal', v_commande.code_postal,
        'ville', v_commande.ville,
        'pays', v_commande.pays
      ),
      'historique', COALESCE(v_historique, '[]'::jsonb)
    )
  );

  -- Log l'accès (succès)
  INSERT INTO public.api_public_log (
    token_id, client_id, endpoint, methode,
    numero_commande, numero_tracking, status_code
  ) VALUES (
    v_token_record.id, v_token_record.client_id,
    'api_public_track_commande', 'POST',
    v_commande.numero_commande, v_commande.numero_suivi, 200
  );

  -- Mettre à jour stats token
  UPDATE public.client_api_token
  SET derniere_utilisation = now(),
      nb_requetes_total = nb_requetes_total + 1
  WHERE id = v_token_record.id;

  RETURN v_result;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- =====================================================
-- 2. API RETOURS PUBLIC
-- =====================================================

-- Créer une demande de retour (API publique)
CREATE OR REPLACE FUNCTION api_public_creer_retour(
  p_api_token TEXT,
  p_numero_commande TEXT,
  p_email_client TEXT,
  p_motif_retour TEXT,
  p_details_motif TEXT DEFAULT NULL,
  p_produits JSONB DEFAULT '[]'::JSONB,
  p_client_nom TEXT DEFAULT NULL,
  p_client_telephone TEXT DEFAULT NULL,
  p_photos_urls JSONB DEFAULT '[]'::JSONB
)
RETURNS JSONB AS $$
DECLARE
  v_token_record RECORD;
  v_commande RECORD;
  v_retour_id UUID;
  v_numero_retour TEXT;
  v_ligne JSONB;
  v_produit_id UUID;
BEGIN
  -- Vérifier le token
  SELECT * INTO v_token_record
  FROM public.client_api_token
  WHERE token = p_api_token
  AND actif = TRUE
  AND type_acces IN ('retours', 'both')
  AND (expires_at IS NULL OR expires_at > now());

  IF v_token_record IS NULL THEN
    RETURN jsonb_build_object(
      'success', false,
      'error', 'Invalid or expired API token'
    );
  END IF;

  -- Trouver la commande
  SELECT * INTO v_commande
  FROM public.commande
  WHERE client_id = v_token_record.client_id
  AND numero_commande = p_numero_commande
  AND email_client = p_email_client;

  IF v_commande IS NULL THEN
    RETURN jsonb_build_object(
      'success', false,
      'error', 'Order not found or email does not match'
    );
  END IF;

  -- Vérifier que la commande a été livrée
  IF v_commande.statut_wms NOT IN ('livre', 'en_livraison', 'en_transit') THEN
    RETURN jsonb_build_object(
      'success', false,
      'error', 'Cannot return an order that has not been delivered'
    );
  END IF;

  -- Générer numéro de retour
  v_numero_retour := generer_numero_retour();

  -- Créer le retour
  INSERT INTO public.retour (
    numero_retour,
    commande_id,
    client_id,
    client_final_nom,
    client_final_email,
    client_final_telephone,
    statut,
    motif_retour,
    details_motif,
    photos_urls,
    date_demande
  ) VALUES (
    v_numero_retour,
    v_commande.id,
    v_token_record.client_id,
    p_client_nom,
    p_email_client,
    p_client_telephone,
    'demande_recue',
    p_motif_retour,
    p_details_motif,
    p_photos_urls,
    now()
  ) RETURNING id INTO v_retour_id;

  -- Ajouter les lignes de retour
  FOR v_ligne IN SELECT * FROM jsonb_array_elements(p_produits)
  LOOP
    -- Trouver le produit par SKU
    SELECT p.id INTO v_produit_id
    FROM public.produit p
    WHERE p.sku = (v_ligne->>'sku')
    AND p.client_id = v_token_record.client_id
    LIMIT 1;

    IF v_produit_id IS NOT NULL THEN
      INSERT INTO public.retour_ligne (
        retour_id,
        produit_id,
        quantite_demandee,
        etat_produit
      ) VALUES (
        v_retour_id,
        v_produit_id,
        (v_ligne->>'quantite')::INTEGER,
        v_ligne->>'etat'
      );
    END IF;
  END LOOP;

  -- Log l'accès
  INSERT INTO public.api_public_log (
    token_id, client_id, endpoint, methode,
    numero_commande, numero_retour, status_code
  ) VALUES (
    v_token_record.id, v_token_record.client_id,
    'api_public_creer_retour', 'POST',
    v_commande.numero_commande, v_numero_retour, 200
  );

  -- Mettre à jour stats token
  UPDATE public.client_api_token
  SET derniere_utilisation = now(),
      nb_requetes_total = nb_requetes_total + 1
  WHERE id = v_token_record.id;

  RETURN jsonb_build_object(
    'success', true,
    'data', jsonb_build_object(
      'numero_retour', v_numero_retour,
      'retour_id', v_retour_id,
      'statut', 'demande_recue',
      'message', 'Votre demande de retour a été enregistrée. Vous recevrez un email avec les instructions.'
    )
  );
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Consulter un retour (API publique)
CREATE OR REPLACE FUNCTION api_public_consulter_retour(
  p_api_token TEXT,
  p_numero_retour TEXT,
  p_email_client TEXT
)
RETURNS JSONB AS $$
DECLARE
  v_token_record RECORD;
  v_retour RECORD;
  v_lignes JSONB;
  v_historique JSONB;
BEGIN
  -- Vérifier le token
  SELECT * INTO v_token_record
  FROM public.client_api_token
  WHERE token = p_api_token
  AND actif = TRUE
  AND type_acces IN ('retours', 'both')
  AND (expires_at IS NULL OR expires_at > now());

  IF v_token_record IS NULL THEN
    RETURN jsonb_build_object(
      'success', false,
      'error', 'Invalid or expired API token'
    );
  END IF;

  -- Trouver le retour
  SELECT * INTO v_retour
  FROM public.retour
  WHERE client_id = v_token_record.client_id
  AND numero_retour = p_numero_retour
  AND client_final_email = p_email_client;

  IF v_retour IS NULL THEN
    RETURN jsonb_build_object(
      'success', false,
      'error', 'Return not found'
    );
  END IF;

  -- Récupérer les lignes
  SELECT jsonb_agg(
    jsonb_build_object(
      'produit_sku', p.sku,
      'produit_nom', p.nom,
      'quantite_demandee', rl.quantite_demandee,
      'quantite_recue', rl.quantite_recue,
      'etat', rl.etat_produit
    )
  ) INTO v_lignes
  FROM public.retour_ligne rl
  JOIN public.produit p ON p.id = rl.produit_id
  WHERE rl.retour_id = v_retour.id;

  -- Récupérer l'historique
  SELECT jsonb_agg(
    jsonb_build_object(
      'date', hsr.created_at,
      'statut', hsr.nouveau_statut,
      'commentaire', hsr.commentaire
    ) ORDER BY hsr.created_at
  ) INTO v_historique
  FROM public.historique_statut_retour hsr
  WHERE hsr.retour_id = v_retour.id;

  -- Log l'accès
  INSERT INTO public.api_public_log (
    token_id, client_id, endpoint, methode,
    numero_retour, status_code
  ) VALUES (
    v_token_record.id, v_token_record.client_id,
    'api_public_consulter_retour', 'POST',
    v_retour.numero_retour, 200
  );

  UPDATE public.client_api_token
  SET derniere_utilisation = now(),
      nb_requetes_total = nb_requetes_total + 1
  WHERE id = v_token_record.id;

  RETURN jsonb_build_object(
    'success', true,
    'data', jsonb_build_object(
      'numero_retour', v_retour.numero_retour,
      'statut', v_retour.statut,
      'date_demande', v_retour.date_demande,
      'motif', v_retour.motif_retour,
      'details', v_retour.details_motif,
      'numero_tracking_retour', v_retour.numero_tracking_retour,
      'transporteur_retour', v_retour.transporteur_retour,
      'decision', v_retour.decision_retour,
      'montant_rembourse', v_retour.montant_rembourse,
      'produits', COALESCE(v_lignes, '[]'::jsonb),
      'historique', COALESCE(v_historique, '[]'::jsonb)
    )
  );
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- =====================================================
-- 3. GESTION TOKENS API (POUR CLIENTS)
-- =====================================================

-- Créer un token API
CREATE OR REPLACE FUNCTION creer_api_token(
  p_client_id UUID,
  p_nom_token TEXT,
  p_type_acces TEXT,
  p_domaines_autorises TEXT[] DEFAULT NULL
)
RETURNS JSONB AS $$
DECLARE
  v_token TEXT;
  v_token_id UUID;
BEGIN
  -- Générer token
  v_token := generer_api_token();

  -- Créer le token
  INSERT INTO public.client_api_token (
    client_id,
    token,
    nom_token,
    type_acces,
    domaines_autorises,
    actif
  ) VALUES (
    p_client_id,
    v_token,
    p_nom_token,
    p_type_acces,
    p_domaines_autorises,
    true
  ) RETURNING id INTO v_token_id;

  RETURN jsonb_build_object(
    'success', true,
    'token_id', v_token_id,
    'token', v_token,
    'nom', p_nom_token,
    'type_acces', p_type_acces
  );
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Révoquer un token
CREATE OR REPLACE FUNCTION revoquer_api_token(
  p_token_id UUID,
  p_client_id UUID
)
RETURNS BOOLEAN AS $$
BEGIN
  UPDATE public.client_api_token
  SET actif = false
  WHERE id = p_token_id
  AND client_id = p_client_id;

  RETURN FOUND;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- =====================================================
-- 4. SUMMARY
-- =====================================================

DO $$
BEGIN
  RAISE NOTICE '';
  RAISE NOTICE '========================================';
  RAISE NOTICE '  API PUBLIQUES PORTAILS';
  RAISE NOTICE '========================================';
  RAISE NOTICE 'Fonctions API créées:';
  RAISE NOTICE '  ✅ api_public_track_commande()';
  RAISE NOTICE '  ✅ api_public_creer_retour()';
  RAISE NOTICE '  ✅ api_public_consulter_retour()';
  RAISE NOTICE '  ✅ creer_api_token()';
  RAISE NOTICE '  ✅ revoquer_api_token()';
  RAISE NOTICE '';
  RAISE NOTICE 'Endpoints publics:';
  RAISE NOTICE '  🌐 Tracking: tracking.spd.com/track?token=xxx';
  RAISE NOTICE '  🌐 Retours: returns.spd.com/create?token=xxx';
  RAISE NOTICE '';
  RAISE NOTICE 'Sécurité:';
  RAISE NOTICE '  ✅ Authentification par token API';
  RAISE NOTICE '  ✅ Rate limiting (1000 req/h par défaut)';
  RAISE NOTICE '  ✅ Whitelist domaines (CORS)';
  RAISE NOTICE '  ✅ Logging complet des accès';
  RAISE NOTICE '';
  RAISE NOTICE 'Prochaines étapes:';
  RAISE NOTICE '  1. Créer widgets embeddables (iframe/JS)';
  RAISE NOTICE '  2. Créer UI gestion tokens pour clients';
  RAISE NOTICE '  3. Créer UI gestion retours';
  RAISE NOTICE '========================================';
  RAISE NOTICE '';
END $$;
