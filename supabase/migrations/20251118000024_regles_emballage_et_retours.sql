-- =====================================================
-- RÈGLES D'EMBALLAGE & GESTION RETOURS COMPLÈTE
-- Description: Automatisation emballage + workflow retours
-- Date: 2025-11-18
-- =====================================================

-- =====================================================
-- 1. RÈGLES D'EMBALLAGE
-- =====================================================

-- Table des types de cartons disponibles
CREATE TABLE IF NOT EXISTS public.type_carton (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  code TEXT UNIQUE NOT NULL,
  nom TEXT NOT NULL,
  longueur_cm DECIMAL(10,2) NOT NULL,
  largeur_cm DECIMAL(10,2) NOT NULL,
  hauteur_cm DECIMAL(10,2) NOT NULL,
  poids_max_kg DECIMAL(10,2) NOT NULL,
  volume_max_l DECIMAL(10,2) GENERATED ALWAYS AS (
    longueur_cm * largeur_cm * hauteur_cm / 1000
  ) STORED,
  cout_unitaire DECIMAL(10,2) DEFAULT 0,
  stock_disponible INTEGER DEFAULT 0,
  actif BOOLEAN DEFAULT TRUE,
  created_at TIMESTAMPTZ DEFAULT now()
);

-- Table des matériels d'emballage (bulles, chips, etc.)
CREATE TABLE IF NOT EXISTS public.materiel_emballage (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  code TEXT UNIQUE NOT NULL,
  nom TEXT NOT NULL,
  type_materiel TEXT NOT NULL, -- 'papier_bulle', 'chips_calage', 'papier_kraft', 'scotch', 'adhesif_fragile'
  unite TEXT NOT NULL, -- 'ml', 'kg', 'unite'
  cout_unitaire DECIMAL(10,2) DEFAULT 0,
  stock_disponible DECIMAL(10,2) DEFAULT 0,
  actif BOOLEAN DEFAULT TRUE,
  created_at TIMESTAMPTZ DEFAULT now()
);

-- Règles d'emballage par produit ou catégorie
CREATE TABLE IF NOT EXISTS public.regle_emballage (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  client_id UUID REFERENCES public.client(id) ON DELETE CASCADE,

  -- Critères de sélection
  produit_id UUID REFERENCES public.produit(id) ON DELETE CASCADE,
  categorie_produit TEXT, -- Si pas de produit spécifique
  poids_min_kg DECIMAL(10,2),
  poids_max_kg DECIMAL(10,2),
  volume_min_l DECIMAL(10,2),
  volume_max_l DECIMAL(10,2),
  fragile BOOLEAN DEFAULT FALSE,

  -- Emballage recommandé
  type_carton_id UUID REFERENCES public.type_carton(id),
  materiels_requis JSONB, -- Array de {materiel_id, quantite}
  -- Exemple: [{"materiel_id": "uuid", "quantite": 2, "unite": "ml"}]

  -- Instructions
  instructions_emballage TEXT,
  priorite INTEGER DEFAULT 1, -- Plus le chiffre est bas, plus prioritaire

  actif BOOLEAN DEFAULT TRUE,
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now()
);

-- =====================================================
-- 2. GESTION RETOURS COMPLÈTE
-- =====================================================

-- Table principale des retours
CREATE TABLE IF NOT EXISTS public.retour (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  numero_retour TEXT UNIQUE NOT NULL, -- RET-YYYYMMDD-XXXXX

  -- Commande origine
  commande_id UUID REFERENCES public.commande(id),
  client_id UUID NOT NULL REFERENCES public.client(id),

  -- Client final (celui qui retourne)
  client_final_nom TEXT,
  client_final_email TEXT,
  client_final_telephone TEXT,

  -- Statut workflow
  statut TEXT NOT NULL DEFAULT 'demande_recue',
  -- Statuts: 'demande_recue', 'validee', 'etiquette_generee', 'en_transit',
  --          'recue', 'en_controle', 'traitee', 'remboursee', 'refusee'

  -- Motif retour
  motif_retour TEXT NOT NULL,
  -- Motifs: 'produit_defectueux', 'erreur_commande', 'taille_inadaptee',
  --         'produit_endommage', 'delai_livraison', 'changement_avis', 'autre'
  details_motif TEXT,

  -- Photos/documents
  photos_urls JSONB, -- Array d'URLs des photos

  -- Dates workflow
  date_demande TIMESTAMPTZ DEFAULT now(),
  date_validation TIMESTAMPTZ,
  date_etiquette_generee TIMESTAMPTZ,
  date_reception TIMESTAMPTZ,
  date_controle TIMESTAMPTZ,
  date_traitement TIMESTAMPTZ,
  date_remboursement TIMESTAMPTZ,

  -- Transport retour
  transporteur_retour TEXT,
  numero_tracking_retour TEXT,
  frais_retour DECIMAL(10,2) DEFAULT 0,
  frais_retour_pris_en_charge_par TEXT, -- 'client_final', 'client_3pl', 'transporteur'

  -- Adresse retour (entrepôt)
  adresse_retour TEXT,

  -- Décision après contrôle
  decision_retour TEXT,
  -- Décisions: 'remis_en_stock', 'destruction', 'retour_fournisseur', 'en_attente_decision'
  etat_produits_recu TEXT,
  -- États: 'conforme', 'endommage_leger', 'endommage_grave', 'defectueux', 'non_conforme'

  -- Remboursement
  montant_rembourse DECIMAL(10,2),
  type_remboursement TEXT, -- 'integral', 'partiel', 'avoir', 'echange'
  reference_remboursement TEXT,

  -- Notes internes
  notes_internes TEXT,

  -- Opérateurs
  validee_par UUID REFERENCES auth.users(id),
  controle_par UUID REFERENCES auth.users(id),
  traitee_par UUID REFERENCES auth.users(id),

  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now()
);

-- Lignes de retour (produits retournés)
CREATE TABLE IF NOT EXISTS public.retour_ligne (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  retour_id UUID NOT NULL REFERENCES public.retour(id) ON DELETE CASCADE,

  produit_id UUID NOT NULL REFERENCES public.produit(id),
  ligne_commande_id UUID REFERENCES public.ligne_commande(id),

  quantite_demandee INTEGER NOT NULL,
  quantite_recue INTEGER DEFAULT 0,
  quantite_conforme INTEGER DEFAULT 0,
  quantite_non_conforme INTEGER DEFAULT 0,

  -- État par ligne
  etat_produit TEXT,
  motif_non_conformite TEXT,

  -- Remise en stock
  remis_en_stock BOOLEAN DEFAULT FALSE,
  emplacement_stockage_id UUID REFERENCES public.emplacement(id),
  mouvement_stock_id UUID REFERENCES public.mouvement_stock(id),

  created_at TIMESTAMPTZ DEFAULT now()
);

-- Historique des statuts de retour
CREATE TABLE IF NOT EXISTS public.historique_statut_retour (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  retour_id UUID NOT NULL REFERENCES public.retour(id) ON DELETE CASCADE,
  ancien_statut TEXT,
  nouveau_statut TEXT NOT NULL,
  commentaire TEXT,
  user_id UUID REFERENCES auth.users(id),
  created_at TIMESTAMPTZ DEFAULT now()
);

-- =====================================================
-- 3. TOKENS API POUR PORTAILS PUBLICS
-- =====================================================

-- Tokens d'accès pour portails tracking et retours
CREATE TABLE IF NOT EXISTS public.client_api_token (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  client_id UUID NOT NULL REFERENCES public.client(id) ON DELETE CASCADE,

  token TEXT UNIQUE NOT NULL, -- Token public (SHA-256)
  nom_token TEXT NOT NULL, -- Nom descriptif

  type_acces TEXT NOT NULL, -- 'tracking', 'retours', 'both'

  -- Restrictions
  domaines_autorises TEXT[], -- Whitelist domaines (CORS)
  ip_autorisees TEXT[], -- Whitelist IPs (optionnel)

  -- Limites
  rate_limit_par_heure INTEGER DEFAULT 1000,
  actif BOOLEAN DEFAULT TRUE,

  -- Personnalisation portail
  config_portail JSONB, -- Couleurs, logo, textes personnalisés

  -- Audit
  derniere_utilisation TIMESTAMPTZ,
  nb_requetes_total INTEGER DEFAULT 0,

  created_at TIMESTAMPTZ DEFAULT now(),
  expires_at TIMESTAMPTZ, -- Optionnel

  CONSTRAINT valid_type_acces CHECK (type_acces IN ('tracking', 'retours', 'both'))
);

-- Log des accès API publics
CREATE TABLE IF NOT EXISTS public.api_public_log (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  token_id UUID REFERENCES public.client_api_token(id) ON DELETE SET NULL,
  client_id UUID REFERENCES public.client(id) ON DELETE SET NULL,

  endpoint TEXT NOT NULL,
  methode TEXT NOT NULL,

  -- Requête
  numero_commande TEXT,
  numero_tracking TEXT,
  numero_retour TEXT,

  -- Réponse
  status_code INTEGER,
  temps_reponse_ms INTEGER,

  -- Origine
  ip_address TEXT,
  user_agent TEXT,
  referer TEXT,

  created_at TIMESTAMPTZ DEFAULT now()
);

-- =====================================================
-- 4. AMÉLIORATION SUIVI MOUVEMENTS STOCK
-- =====================================================

-- Enrichir la table mouvement_stock existante avec trigger automatique
-- pour capturer TOUS les mouvements (même ceux qu'on aurait oubliés)

-- Fonction pour logger automatiquement les mouvements lors des modifications de stock
CREATE OR REPLACE FUNCTION auto_log_mouvement_stock()
RETURNS TRIGGER AS $$
DECLARE
  v_ancien_stock INTEGER;
  v_nouveau_stock INTEGER;
  v_difference INTEGER;
  v_type_mouvement TEXT;
  v_reference_type TEXT;
  v_reference_numero TEXT;
BEGIN
  -- Récupérer les stocks
  IF TG_OP = 'UPDATE' THEN
    v_ancien_stock := OLD.quantite_disponible;
    v_nouveau_stock := NEW.quantite_disponible;
  ELSIF TG_OP = 'INSERT' THEN
    v_ancien_stock := 0;
    v_nouveau_stock := NEW.quantite_disponible;
  ELSE
    RETURN NULL;
  END IF;

  v_difference := v_nouveau_stock - v_ancien_stock;

  -- Ne rien faire si pas de changement
  IF v_difference = 0 THEN
    RETURN NEW;
  END IF;

  -- Déterminer le type de mouvement
  IF v_difference > 0 THEN
    v_type_mouvement := 'entree';
    v_reference_type := 'ajustement_auto';
  ELSE
    v_type_mouvement := 'sortie';
    v_reference_type := 'ajustement_auto';
  END IF;

  -- Insérer le mouvement SEULEMENT si aucun mouvement n'a été créé manuellement
  -- dans les 5 dernières secondes pour ce produit/emplacement
  IF NOT EXISTS (
    SELECT 1 FROM public.mouvement_stock
    WHERE produit_id = NEW.produit_id
    AND emplacement_id = NEW.emplacement_id
    AND created_at > now() - INTERVAL '5 seconds'
  ) THEN
    INSERT INTO public.mouvement_stock (
      produit_id,
      emplacement_id,
      type_mouvement,
      quantite,
      stock_avant,
      stock_apres,
      reference_type,
      reference_numero,
      notes,
      date_mouvement
    ) VALUES (
      NEW.produit_id,
      NEW.emplacement_id,
      v_type_mouvement,
      ABS(v_difference),
      v_ancien_stock,
      v_nouveau_stock,
      v_reference_type,
      'AUTO-' || gen_random_uuid()::TEXT,
      'Mouvement automatique détecté par trigger',
      now()
    );
  END IF;

  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Créer le trigger sur emplacement_stock
DROP TRIGGER IF EXISTS trigger_auto_log_stock ON public.emplacement_stock;
CREATE TRIGGER trigger_auto_log_stock
  AFTER INSERT OR UPDATE OF quantite_disponible
  ON public.emplacement_stock
  FOR EACH ROW
  EXECUTE FUNCTION auto_log_mouvement_stock();

-- =====================================================
-- 5. FONCTIONS UTILES
-- =====================================================

-- Générer numéro de retour
CREATE OR REPLACE FUNCTION generer_numero_retour()
RETURNS TEXT AS $$
DECLARE
  v_numero TEXT;
  v_sequence INTEGER;
  v_date TEXT;
BEGIN
  v_date := to_char(CURRENT_DATE, 'YYYYMMDD');

  SELECT COALESCE(MAX(
    CAST(SUBSTRING(numero_retour FROM '\d+$') AS INTEGER)
  ), 0) + 1
  INTO v_sequence
  FROM public.retour
  WHERE numero_retour LIKE 'RET-' || v_date || '%';

  v_numero := format('RET-%s-%s', v_date, LPAD(v_sequence::TEXT, 5, '0'));

  RETURN v_numero;
END;
$$ LANGUAGE plpgsql;

-- Générer token API sécurisé
CREATE OR REPLACE FUNCTION generer_api_token()
RETURNS TEXT AS $$
BEGIN
  RETURN 'spd_' || encode(gen_random_bytes(32), 'hex');
END;
$$ LANGUAGE plpgsql;

-- Fonction pour obtenir règle d'emballage recommandée
CREATE OR REPLACE FUNCTION get_regle_emballage_recommandee(
  p_produit_id UUID,
  p_poids_kg DECIMAL,
  p_volume_l DECIMAL,
  p_fragile BOOLEAN
)
RETURNS TABLE (
  regle_id UUID,
  type_carton_code TEXT,
  type_carton_nom TEXT,
  materiels JSONB,
  instructions TEXT
) AS $$
BEGIN
  RETURN QUERY
  SELECT
    re.id,
    tc.code,
    tc.nom,
    re.materiels_requis,
    re.instructions_emballage
  FROM public.regle_emballage re
  LEFT JOIN public.type_carton tc ON tc.id = re.type_carton_id
  WHERE re.actif = TRUE
  AND (
    re.produit_id = p_produit_id
    OR (
      re.produit_id IS NULL
      AND (re.poids_min_kg IS NULL OR p_poids_kg >= re.poids_min_kg)
      AND (re.poids_max_kg IS NULL OR p_poids_kg <= re.poids_max_kg)
      AND (re.volume_min_l IS NULL OR p_volume_l >= re.volume_min_l)
      AND (re.volume_max_l IS NULL OR p_volume_l <= re.volume_max_l)
      AND (NOT re.fragile OR re.fragile = p_fragile)
    )
  )
  ORDER BY re.priorite ASC, re.produit_id DESC NULLS LAST
  LIMIT 1;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- =====================================================
-- 6. INDEXES
-- =====================================================

CREATE INDEX IF NOT EXISTS idx_retour_client ON public.retour(client_id, date_demande DESC);
CREATE INDEX IF NOT EXISTS idx_retour_statut ON public.retour(statut, date_demande DESC);
CREATE INDEX IF NOT EXISTS idx_retour_numero ON public.retour(numero_retour);
CREATE INDEX IF NOT EXISTS idx_retour_commande ON public.retour(commande_id);

CREATE INDEX IF NOT EXISTS idx_retour_ligne_retour ON public.retour_ligne(retour_id);
CREATE INDEX IF NOT EXISTS idx_retour_ligne_produit ON public.retour_ligne(produit_id);

CREATE INDEX IF NOT EXISTS idx_api_token_client ON public.client_api_token(client_id);
CREATE INDEX IF NOT EXISTS idx_api_token_token ON public.client_api_token(token) WHERE actif = TRUE;

CREATE INDEX IF NOT EXISTS idx_regle_emballage_produit ON public.regle_emballage(produit_id) WHERE actif = TRUE;
CREATE INDEX IF NOT EXISTS idx_regle_emballage_client ON public.regle_emballage(client_id) WHERE actif = TRUE;

-- =====================================================
-- 7. TRIGGERS
-- =====================================================

-- Auto-update updated_at
CREATE TRIGGER trigger_retour_updated_at
  BEFORE UPDATE ON public.retour
  FOR EACH ROW
  EXECUTE FUNCTION update_facturation_updated_at();

CREATE TRIGGER trigger_regle_emballage_updated_at
  BEFORE UPDATE ON public.regle_emballage
  FOR EACH ROW
  EXECUTE FUNCTION update_facturation_updated_at();

-- Historique statuts retour
CREATE OR REPLACE FUNCTION log_retour_statut_change()
RETURNS TRIGGER AS $$
BEGIN
  IF (TG_OP = 'UPDATE' AND OLD.statut IS DISTINCT FROM NEW.statut) THEN
    INSERT INTO public.historique_statut_retour (
      retour_id,
      ancien_statut,
      nouveau_statut,
      user_id
    ) VALUES (
      NEW.id,
      OLD.statut,
      NEW.statut,
      auth.uid()
    );
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER trigger_log_retour_statut
  AFTER UPDATE ON public.retour
  FOR EACH ROW
  EXECUTE FUNCTION log_retour_statut_change();

-- =====================================================
-- 8. RLS POLICIES
-- =====================================================

ALTER TABLE public.type_carton ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.materiel_emballage ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.regle_emballage ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.retour ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.retour_ligne ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.historique_statut_retour ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.client_api_token ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.api_public_log ENABLE ROW LEVEL SECURITY;

-- Service role full access
CREATE POLICY "service_role_full_type_carton" ON public.type_carton
  FOR ALL TO service_role USING (true) WITH CHECK (true);

CREATE POLICY "service_role_full_materiel_emballage" ON public.materiel_emballage
  FOR ALL TO service_role USING (true) WITH CHECK (true);

CREATE POLICY "service_role_full_regle_emballage" ON public.regle_emballage
  FOR ALL TO service_role USING (true) WITH CHECK (true);

CREATE POLICY "service_role_full_retour" ON public.retour
  FOR ALL TO service_role USING (true) WITH CHECK (true);

CREATE POLICY "service_role_full_retour_ligne" ON public.retour_ligne
  FOR ALL TO service_role USING (true) WITH CHECK (true);

CREATE POLICY "service_role_full_historique_statut_retour" ON public.historique_statut_retour
  FOR ALL TO service_role USING (true) WITH CHECK (true);

CREATE POLICY "service_role_full_api_token" ON public.client_api_token
  FOR ALL TO service_role USING (true) WITH CHECK (true);

CREATE POLICY "service_role_full_api_log" ON public.api_public_log
  FOR ALL TO service_role USING (true) WITH CHECK (true);

-- Gestionnaire: full access
CREATE POLICY "gestionnaire_full_type_carton" ON public.type_carton
  FOR ALL TO authenticated
  USING (has_role(auth.uid(), 'gestionnaire'::app_role))
  WITH CHECK (has_role(auth.uid(), 'gestionnaire'::app_role));

CREATE POLICY "gestionnaire_full_materiel_emballage" ON public.materiel_emballage
  FOR ALL TO authenticated
  USING (has_role(auth.uid(), 'gestionnaire'::app_role))
  WITH CHECK (has_role(auth.uid(), 'gestionnaire'::app_role));

CREATE POLICY "gestionnaire_full_regle_emballage" ON public.regle_emballage
  FOR ALL TO authenticated
  USING (has_role(auth.uid(), 'gestionnaire'::app_role))
  WITH CHECK (has_role(auth.uid(), 'gestionnaire'::app_role));

CREATE POLICY "gestionnaire_full_retour" ON public.retour
  FOR ALL TO authenticated
  USING (has_role(auth.uid(), 'gestionnaire'::app_role))
  WITH CHECK (has_role(auth.uid(), 'gestionnaire'::app_role));

CREATE POLICY "gestionnaire_full_retour_ligne" ON public.retour_ligne
  FOR ALL TO authenticated
  USING (has_role(auth.uid(), 'gestionnaire'::app_role))
  WITH CHECK (has_role(auth.uid(), 'gestionnaire'::app_role));

CREATE POLICY "gestionnaire_read_api_token" ON public.client_api_token
  FOR SELECT TO authenticated
  USING (has_role(auth.uid(), 'gestionnaire'::app_role));

-- Client: read ses propres données
CREATE POLICY "client_read_own_retours" ON public.retour
  FOR SELECT TO authenticated
  USING (
    has_role(auth.uid(), 'client'::app_role) AND
    client_id IN (SELECT client_id FROM public.profiles WHERE id = auth.uid())
  );

CREATE POLICY "client_read_own_retour_lignes" ON public.retour_ligne
  FOR SELECT TO authenticated
  USING (
    has_role(auth.uid(), 'client'::app_role) AND
    EXISTS (
      SELECT 1 FROM public.retour r
      WHERE r.id = retour_id
      AND r.client_id IN (SELECT client_id FROM public.profiles WHERE id = auth.uid())
    )
  );

CREATE POLICY "client_read_own_api_tokens" ON public.client_api_token
  FOR SELECT TO authenticated
  USING (
    has_role(auth.uid(), 'client'::app_role) AND
    client_id IN (SELECT client_id FROM public.profiles WHERE id = auth.uid())
  );

-- =====================================================
-- 9. SUMMARY
-- =====================================================

DO $$
BEGIN
  RAISE NOTICE '';
  RAISE NOTICE '========================================';
  RAISE NOTICE '  RÈGLES EMBALLAGE & RETOURS';
  RAISE NOTICE '========================================';
  RAISE NOTICE 'Tables créées:';
  RAISE NOTICE '  ✅ type_carton';
  RAISE NOTICE '  ✅ materiel_emballage';
  RAISE NOTICE '  ✅ regle_emballage';
  RAISE NOTICE '  ✅ retour (workflow complet)';
  RAISE NOTICE '  ✅ retour_ligne';
  RAISE NOTICE '  ✅ historique_statut_retour';
  RAISE NOTICE '  ✅ client_api_token (portails publics)';
  RAISE NOTICE '  ✅ api_public_log';
  RAISE NOTICE '';
  RAISE NOTICE 'Fonctionnalités:';
  RAISE NOTICE '  ✅ Règles emballage automatique par produit';
  RAISE NOTICE '  ✅ Workflow retours complet (9 statuts)';
  RAISE NOTICE '  ✅ Tokens API pour portails publics';
  RAISE NOTICE '  ✅ Logging automatique tous mouvements stock';
  RAISE NOTICE '';
  RAISE NOTICE 'Fonctions:';
  RAISE NOTICE '  ✅ generer_numero_retour()';
  RAISE NOTICE '  ✅ generer_api_token()';
  RAISE NOTICE '  ✅ get_regle_emballage_recommandee()';
  RAISE NOTICE '  ✅ auto_log_mouvement_stock() [trigger]';
  RAISE NOTICE '';
  RAISE NOTICE 'Prochaines étapes:';
  RAISE NOTICE '  1. Créer API publiques tracking/retours';
  RAISE NOTICE '  2. Créer widgets embeddables';
  RAISE NOTICE '  3. Créer UI gestion retours';
  RAISE NOTICE '  4. Améliorer filtres commandes';
  RAISE NOTICE '========================================';
  RAISE NOTICE '';
END $$;
