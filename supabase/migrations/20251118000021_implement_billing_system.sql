-- =====================================================
-- SYSTÈME DE FACTURATION MENSUELLE COMPLET
-- Description: Facturation automatique clients 3PL/WMS
-- Impact: CRITIQUE pour business - Récupération données facturation
-- Date: 2025-11-18
-- =====================================================

-- =====================================================
-- 1. Table TARIFICATION_CLIENT
-- =====================================================

CREATE TABLE IF NOT EXISTS public.tarification_client (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  client_id UUID NOT NULL REFERENCES public.client(id) ON DELETE CASCADE,

  -- Type de prestation
  type_prestation TEXT NOT NULL,
  -- Types: 'stockage_m2_jour', 'picking_ligne', 'preparation_commande',
  --        'expedition_colis', 'service_personnalise', 'autre'

  -- Tarif
  prix_unitaire DECIMAL(10,2) NOT NULL,
  unite TEXT NOT NULL,
  -- Unités: 'm2_jour', 'ligne', 'commande', 'colis', 'forfait', 'heure'

  -- Description
  description TEXT,
  code_interne TEXT, -- Code comptabilité

  -- Période de validité
  actif BOOLEAN DEFAULT TRUE,
  date_debut DATE NOT NULL DEFAULT CURRENT_DATE,
  date_fin DATE,

  -- Audit
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now(),

  CONSTRAINT valid_type_prestation CHECK (
    type_prestation IN (
      'stockage_m2_jour',
      'picking_ligne',
      'preparation_commande',
      'expedition_colis',
      'service_personnalise',
      'manutention',
      'emballage',
      'autre'
    )
  )
);

-- =====================================================
-- 2. Table FACTURATION_MENSUELLE
-- =====================================================

CREATE TABLE IF NOT EXISTS public.facturation_mensuelle (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),

  -- Identification
  numero_facture TEXT UNIQUE NOT NULL,
  -- Format: FACT-YYYYMM-XXXXX (ex: FACT-202511-00001)

  client_id UUID NOT NULL REFERENCES public.client(id),

  -- Période
  periode_mois INTEGER NOT NULL, -- 1-12
  periode_annee INTEGER NOT NULL, -- 2025, 2026, etc.

  -- Dates
  date_emission DATE NOT NULL DEFAULT CURRENT_DATE,
  date_echeance DATE NOT NULL,

  -- Montants
  montant_ht DECIMAL(10,2) NOT NULL DEFAULT 0,
  taux_tva DECIMAL(5,2) NOT NULL DEFAULT 20.0,
  montant_tva DECIMAL(10,2) GENERATED ALWAYS AS (
    ROUND(montant_ht * taux_tva / 100, 2)
  ) STORED,
  montant_ttc DECIMAL(10,2) GENERATED ALWAYS AS (
    montant_ht + ROUND(montant_ht * taux_tva / 100, 2)
  ) STORED,

  -- Statut paiement
  statut_paiement TEXT DEFAULT 'en_attente',
  -- Statuts: 'en_attente', 'payee', 'en_retard', 'annulee'

  date_paiement DATE,
  moyen_paiement TEXT,

  -- Documents
  pdf_url TEXT,
  pdf_generated BOOLEAN DEFAULT FALSE,

  -- Notes
  notes TEXT,
  commentaire_interne TEXT,

  -- Audit
  created_by UUID REFERENCES auth.users(id),
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now(),

  CONSTRAINT valid_periode_mois CHECK (periode_mois BETWEEN 1 AND 12),
  CONSTRAINT valid_statut_paiement CHECK (
    statut_paiement IN ('en_attente', 'payee', 'en_retard', 'annulee')
  ),
  CONSTRAINT unique_client_periode UNIQUE (client_id, periode_mois, periode_annee)
);

-- =====================================================
-- 3. Table FACTURATION_LIGNE
-- =====================================================

CREATE TABLE IF NOT EXISTS public.facturation_ligne (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  facture_id UUID NOT NULL REFERENCES public.facturation_mensuelle(id) ON DELETE CASCADE,

  -- Type prestation
  type_prestation TEXT NOT NULL,
  description TEXT NOT NULL,

  -- Référence externe (optionnel)
  reference_externe_type TEXT,
  -- Types: 'commande', 'mouvement_stock', 'service_personnalise', 'manuel'
  reference_externe_id UUID,

  -- Période de la prestation
  periode_debut DATE,
  periode_fin DATE,

  -- Quantité et tarif
  quantite DECIMAL(10,2) NOT NULL,
  unite TEXT NOT NULL,
  prix_unitaire DECIMAL(10,2) NOT NULL,
  total DECIMAL(10,2) GENERATED ALWAYS AS (
    ROUND(quantite * prix_unitaire, 2)
  ) STORED,

  -- Détails optionnels (JSON)
  details JSONB,

  -- Ordre affichage
  ordre INTEGER DEFAULT 0,

  created_at TIMESTAMPTZ DEFAULT now()
);

-- =====================================================
-- 4. Indexes de Performance
-- =====================================================

-- Tarification
CREATE INDEX IF NOT EXISTS idx_tarification_client
  ON public.tarification_client(client_id, type_prestation)
  WHERE actif = TRUE;

CREATE INDEX IF NOT EXISTS idx_tarification_periode
  ON public.tarification_client(date_debut, date_fin)
  WHERE actif = TRUE;

-- Facturation
CREATE INDEX IF NOT EXISTS idx_facturation_client
  ON public.facturation_mensuelle(client_id, periode_annee DESC, periode_mois DESC);

CREATE INDEX IF NOT EXISTS idx_facturation_periode
  ON public.facturation_mensuelle(periode_annee DESC, periode_mois DESC);

CREATE INDEX IF NOT EXISTS idx_facturation_statut
  ON public.facturation_mensuelle(statut_paiement, date_echeance);

CREATE INDEX IF NOT EXISTS idx_facturation_numero
  ON public.facturation_mensuelle(numero_facture);

-- Lignes facturation
CREATE INDEX IF NOT EXISTS idx_facturation_ligne_facture
  ON public.facturation_ligne(facture_id, ordre);

CREATE INDEX IF NOT EXISTS idx_facturation_ligne_reference
  ON public.facturation_ligne(reference_externe_type, reference_externe_id)
  WHERE reference_externe_id IS NOT NULL;

-- =====================================================
-- 5. Triggers auto-update updated_at
-- =====================================================

CREATE OR REPLACE FUNCTION update_facturation_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER trigger_tarification_updated_at
  BEFORE UPDATE ON public.tarification_client
  FOR EACH ROW
  EXECUTE FUNCTION update_facturation_updated_at();

CREATE TRIGGER trigger_facturation_updated_at
  BEFORE UPDATE ON public.facturation_mensuelle
  FOR EACH ROW
  EXECUTE FUNCTION update_facturation_updated_at();

-- =====================================================
-- 6. RLS Policies
-- =====================================================

-- Enable RLS
ALTER TABLE public.tarification_client ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.facturation_mensuelle ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.facturation_ligne ENABLE ROW LEVEL SECURITY;

-- Service role full access
CREATE POLICY "service_role_full_tarification" ON public.tarification_client
  FOR ALL TO service_role USING (true) WITH CHECK (true);

CREATE POLICY "service_role_full_facturation" ON public.facturation_mensuelle
  FOR ALL TO service_role USING (true) WITH CHECK (true);

CREATE POLICY "service_role_full_facturation_ligne" ON public.facturation_ligne
  FOR ALL TO service_role USING (true) WITH CHECK (true);

-- Gestionnaire: Full access
CREATE POLICY "gestionnaire_full_tarification" ON public.tarification_client
  FOR ALL TO authenticated
  USING (has_role(auth.uid(), 'gestionnaire'::app_role))
  WITH CHECK (has_role(auth.uid(), 'gestionnaire'::app_role));

CREATE POLICY "gestionnaire_full_facturation" ON public.facturation_mensuelle
  FOR ALL TO authenticated
  USING (has_role(auth.uid(), 'gestionnaire'::app_role))
  WITH CHECK (has_role(auth.uid(), 'gestionnaire'::app_role));

CREATE POLICY "gestionnaire_full_facturation_ligne" ON public.facturation_ligne
  FOR ALL TO authenticated
  USING (has_role(auth.uid(), 'gestionnaire'::app_role))
  WITH CHECK (has_role(auth.uid(), 'gestionnaire'::app_role));

-- Client: Read ses propres factures
CREATE POLICY "client_own_facturation" ON public.facturation_mensuelle
  FOR SELECT TO authenticated
  USING (
    has_role(auth.uid(), 'client'::app_role) AND
    client_id IN (SELECT client_id FROM public.profiles WHERE id = auth.uid())
  );

CREATE POLICY "client_own_facturation_ligne" ON public.facturation_ligne
  FOR SELECT TO authenticated
  USING (
    has_role(auth.uid(), 'client'::app_role) AND
    EXISTS (
      SELECT 1 FROM public.facturation_mensuelle fm
      WHERE fm.id = facture_id
      AND fm.client_id IN (SELECT client_id FROM public.profiles WHERE id = auth.uid())
    )
  );

-- =====================================================
-- 7. Vue - Dashboard Facturation
-- =====================================================

CREATE OR REPLACE VIEW public.v_dashboard_facturation AS
SELECT
  fm.periode_annee,
  fm.periode_mois,
  COUNT(DISTINCT fm.id) AS nb_factures,
  COUNT(DISTINCT fm.client_id) AS nb_clients_factures,
  SUM(fm.montant_ht) AS ca_ht,
  SUM(fm.montant_ttc) AS ca_ttc,
  SUM(CASE WHEN fm.statut_paiement = 'payee' THEN fm.montant_ttc ELSE 0 END) AS encaisse,
  SUM(CASE WHEN fm.statut_paiement = 'en_attente' THEN fm.montant_ttc ELSE 0 END) AS en_attente,
  SUM(CASE WHEN fm.statut_paiement = 'en_retard' THEN fm.montant_ttc ELSE 0 END) AS en_retard,
  ROUND(
    100.0 * SUM(CASE WHEN fm.statut_paiement = 'payee' THEN 1 ELSE 0 END) / NULLIF(COUNT(*), 0),
    2
  ) AS taux_paiement_pct
FROM public.facturation_mensuelle fm
GROUP BY fm.periode_annee, fm.periode_mois
ORDER BY fm.periode_annee DESC, fm.periode_mois DESC;

-- =====================================================
-- 8. Fonction génération numéro facture
-- =====================================================

CREATE OR REPLACE FUNCTION generer_numero_facture(
  p_annee INTEGER,
  p_mois INTEGER
)
RETURNS TEXT AS $$
DECLARE
  v_numero TEXT;
  v_sequence INTEGER;
BEGIN
  -- Obtenir le prochain numéro de séquence pour ce mois
  SELECT COALESCE(MAX(
    CAST(SUBSTRING(numero_facture FROM '\d+$') AS INTEGER)
  ), 0) + 1
  INTO v_sequence
  FROM public.facturation_mensuelle
  WHERE periode_annee = p_annee
  AND periode_mois = p_mois;

  -- Format: FACT-YYYYMM-XXXXX
  v_numero := format(
    'FACT-%s%s-%s',
    p_annee,
    LPAD(p_mois::TEXT, 2, '0'),
    LPAD(v_sequence::TEXT, 5, '0')
  );

  RETURN v_numero;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- =====================================================
-- 9. Summary
-- =====================================================

DO $$
BEGIN
  RAISE NOTICE '';
  RAISE NOTICE '========================================';
  RAISE NOTICE '  SYSTÈME FACTURATION MENSUELLE';
  RAISE NOTICE '========================================';
  RAISE NOTICE 'Impact: CRITIQUE pour business';
  RAISE NOTICE '';
  RAISE NOTICE 'Tables créées:';
  RAISE NOTICE '  ✅ tarification_client';
  RAISE NOTICE '  ✅ facturation_mensuelle';
  RAISE NOTICE '  ✅ facturation_ligne';
  RAISE NOTICE '';
  RAISE NOTICE 'Fonctionnalités:';
  RAISE NOTICE '  ✅ Tarifs personnalisés par client';
  RAISE NOTICE '  ✅ Numéros facture auto (FACT-YYYYMM-XXXXX)';
  RAISE NOTICE '  ✅ Calcul TTC automatique';
  RAISE NOTICE '  ✅ Suivi paiements';
  RAISE NOTICE '  ✅ Historique complet';
  RAISE NOTICE '';
  RAISE NOTICE 'Vues créées:';
  RAISE NOTICE '  ✅ v_dashboard_facturation';
  RAISE NOTICE '';
  RAISE NOTICE 'RLS Policies:';
  RAISE NOTICE '  ✅ Gestionnaire: full access';
  RAISE NOTICE '  ✅ Client: ses factures only';
  RAISE NOTICE '';
  RAISE NOTICE 'Prochaines étapes:';
  RAISE NOTICE '  1. Créer RPC functions calcul prestations';
  RAISE NOTICE '  2. Créer CRON job génération mensuelle';
  RAISE NOTICE '  3. Créer UI consultation factures';
  RAISE NOTICE '  4. Implémenter export PDF';
  RAISE NOTICE '========================================';
  RAISE NOTICE '';
END $$;
