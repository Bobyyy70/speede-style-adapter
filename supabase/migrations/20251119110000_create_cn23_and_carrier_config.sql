-- ============================================================================
-- Migration: CN23 Déclarations Douanières + Configuration Transporteurs
-- ============================================================================

-- Table: Configuration des transporteurs par client
CREATE TABLE IF NOT EXISTS carrier_config (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  client_id UUID REFERENCES client(id) ON DELETE CASCADE,
  carrier_type TEXT NOT NULL, -- FEDEX, MONDIAL_RELAY, DHL, UPS, CHRONOPOST, COLISSIMO
  carrier_name TEXT NOT NULL,

  -- Credentials (chiffrées)
  api_key TEXT,
  secret_key TEXT,
  account_number TEXT,
  merchant_id TEXT,
  additional_params JSONB DEFAULT '{}',

  -- Configuration
  is_active BOOLEAN DEFAULT true,
  is_default BOOLEAN DEFAULT false,
  supported_services JSONB DEFAULT '[]', -- Liste des services supportés

  -- Adresse expéditeur par défaut
  default_sender_address JSONB,

  -- Métadonnées
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),

  UNIQUE(client_id, carrier_type)
);

CREATE INDEX idx_carrier_config_client ON carrier_config(client_id);
CREATE INDEX idx_carrier_config_active ON carrier_config(client_id, is_active);

-- Table: CN23 - Déclarations douanières pour exports
CREATE TABLE IF NOT EXISTS cn23_declaration (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  client_id UUID REFERENCES client(id) ON DELETE CASCADE,
  plan_transport_id UUID REFERENCES plan_transport(id) ON DELETE CASCADE,
  commande_id UUID REFERENCES commande(id),

  -- Informations générales
  numero_cn23 TEXT UNIQUE NOT NULL,
  type_envoi TEXT DEFAULT 'GIFT', -- GIFT, SALE, SAMPLE, RETURN, DOCUMENT, OTHER
  description_generale TEXT,

  -- Expéditeur
  expediteur JSONB NOT NULL, -- {nom, adresse, ville, cp, pays, tel, email}

  -- Destinataire
  destinataire JSONB NOT NULL,

  -- Détails articles
  articles JSONB NOT NULL, -- Array de {description, quantity, weight_kg, value_eur, hs_code, origin_country}

  -- Valeurs totales
  poids_total_kg NUMERIC NOT NULL,
  valeur_totale_eur NUMERIC NOT NULL,
  devise TEXT DEFAULT 'EUR',

  -- Frais
  frais_transport_eur NUMERIC DEFAULT 0,
  frais_assurance_eur NUMERIC DEFAULT 0,
  autres_frais_eur NUMERIC DEFAULT 0,

  -- Documents
  pdf_url TEXT,
  pdf_generated_at TIMESTAMPTZ,

  -- Statut
  statut TEXT DEFAULT 'draft', -- draft, generated, sent

  -- Métadonnées
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  created_by UUID REFERENCES auth.users(id)
);

CREATE INDEX idx_cn23_client ON cn23_declaration(client_id);
CREATE INDEX idx_cn23_plan ON cn23_declaration(plan_transport_id);
CREATE INDEX idx_cn23_commande ON cn23_declaration(commande_id);
CREATE INDEX idx_cn23_statut ON cn23_declaration(statut);

-- Table: Historique des étiquettes et documents générés
CREATE TABLE IF NOT EXISTS shipping_label (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  client_id UUID REFERENCES client(id) ON DELETE CASCADE,
  plan_transport_id UUID REFERENCES plan_transport(id) ON DELETE CASCADE,

  -- Transporteur
  carrier_type TEXT NOT NULL,
  carrier_service TEXT,

  -- Numéros
  tracking_number TEXT NOT NULL,
  shipment_id TEXT,

  -- Documents
  label_url TEXT NOT NULL,
  label_format TEXT DEFAULT 'PDF', -- PDF, PNG, ZPL
  cn23_url TEXT, -- Lien vers CN23 si export

  -- Coût
  shipping_cost NUMERIC,
  currency TEXT DEFAULT 'EUR',

  -- Dates
  created_at TIMESTAMPTZ DEFAULT NOW(),
  printed_at TIMESTAMPTZ,

  -- Métadonnées
  metadata JSONB DEFAULT '{}'
);

CREATE INDEX idx_shipping_label_client ON shipping_label(client_id);
CREATE INDEX idx_shipping_label_plan ON shipping_label(plan_transport_id);
CREATE INDEX idx_shipping_label_tracking ON shipping_label(tracking_number);

-- ============================================================================
-- RLS Policies
-- ============================================================================

ALTER TABLE carrier_config ENABLE ROW LEVEL SECURITY;
ALTER TABLE cn23_declaration ENABLE ROW LEVEL SECURITY;
ALTER TABLE shipping_label ENABLE ROW LEVEL SECURITY;

-- carrier_config policies
CREATE POLICY "Users can view their client's carrier configs"
  ON carrier_config FOR SELECT
  USING (
    client_id IN (
      SELECT client_id FROM user_profile WHERE user_id = auth.uid()
    )
  );

CREATE POLICY "Admins can manage carrier configs"
  ON carrier_config FOR ALL
  USING (
    EXISTS (
      SELECT 1 FROM user_profile
      WHERE user_id = auth.uid()
        AND role IN ('admin', 'super_admin')
        AND client_id = carrier_config.client_id
    )
  );

-- cn23_declaration policies
CREATE POLICY "Users can view their client's CN23"
  ON cn23_declaration FOR SELECT
  USING (
    client_id IN (
      SELECT client_id FROM user_profile WHERE user_id = auth.uid()
    )
  );

CREATE POLICY "Users can manage CN23"
  ON cn23_declaration FOR ALL
  USING (
    client_id IN (
      SELECT client_id FROM user_profile WHERE user_id = auth.uid()
    )
  );

-- shipping_label policies
CREATE POLICY "Users can view their client's labels"
  ON shipping_label FOR SELECT
  USING (
    client_id IN (
      SELECT client_id FROM user_profile WHERE user_id = auth.uid()
    )
  );

CREATE POLICY "Users can create labels"
  ON shipping_label FOR INSERT
  WITH CHECK (
    client_id IN (
      SELECT client_id FROM user_profile WHERE user_id = auth.uid()
    )
  );

-- ============================================================================
-- Functions
-- ============================================================================

-- Fonction: Générer numéro CN23 unique
CREATE OR REPLACE FUNCTION generate_cn23_number()
RETURNS TEXT AS $$
DECLARE
  v_numero TEXT;
  v_exists BOOLEAN;
BEGIN
  LOOP
    v_numero := 'CN23-' || TO_CHAR(NOW(), 'YYYYMMDD') || '-' || LPAD(FLOOR(RANDOM() * 999999)::TEXT, 6, '0');

    SELECT EXISTS(SELECT 1 FROM cn23_declaration WHERE numero_cn23 = v_numero) INTO v_exists;

    EXIT WHEN NOT v_exists;
  END LOOP;

  RETURN v_numero;
END;
$$ LANGUAGE plpgsql;

-- Fonction: Vérifier si expédition nécessite CN23
CREATE OR REPLACE FUNCTION requires_cn23(p_plan_transport_id UUID)
RETURNS BOOLEAN AS $$
DECLARE
  v_dest_pays TEXT;
  v_pays_ue TEXT[] := ARRAY['FR', 'BE', 'DE', 'IT', 'ES', 'NL', 'PT', 'AT', 'DK', 'FI', 'GR', 'IE', 'LU', 'SE'];
BEGIN
  -- Récupérer pays destination
  SELECT (destination_adresse->>'pays')::TEXT INTO v_dest_pays
  FROM plan_transport
  WHERE id = p_plan_transport_id;

  -- CN23 requis si destination hors UE
  RETURN v_dest_pays IS NOT NULL AND NOT (v_dest_pays = ANY(v_pays_ue));
END;
$$ LANGUAGE plpgsql;

-- Fonction: Créer CN23 automatique depuis plan transport
CREATE OR REPLACE FUNCTION create_cn23_from_plan(
  p_plan_transport_id UUID,
  p_type_envoi TEXT DEFAULT 'SALE',
  p_articles JSONB DEFAULT '[]'
)
RETURNS UUID AS $$
DECLARE
  v_cn23_id UUID;
  v_plan RECORD;
  v_commande RECORD;
  v_articles JSONB;
  v_poids_total NUMERIC;
  v_valeur_totale NUMERIC;
BEGIN
  -- Récupérer le plan transport
  SELECT * INTO v_plan FROM plan_transport WHERE id = p_plan_transport_id;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'Plan transport non trouvé';
  END IF;

  -- Vérifier si CN23 nécessaire
  IF NOT requires_cn23(p_plan_transport_id) THEN
    RAISE EXCEPTION 'CN23 non requis pour cette destination';
  END IF;

  -- Récupérer les articles de la commande si pas fournis
  IF jsonb_array_length(p_articles) = 0 AND v_plan.commande_id IS NOT NULL THEN
    SELECT c.*,
           COALESCE(
             (SELECT jsonb_agg(
               jsonb_build_object(
                 'description', cl.nom_article,
                 'quantity', cl.quantite,
                 'weight_kg', COALESCE(cl.poids_kg, 0.5),
                 'value_eur', cl.prix_unitaire * cl.quantite,
                 'hs_code', '',
                 'origin_country', 'FR'
               )
             )
             FROM commande_ligne cl
             WHERE cl.commande_id = c.id), '[]'::jsonb
           ) as articles_json
    INTO v_commande
    FROM commande c
    WHERE c.id = v_plan.commande_id;

    v_articles := v_commande.articles_json;
  ELSE
    v_articles := p_articles;
  END IF;

  -- Calculer totaux
  SELECT
    COALESCE(SUM((item->>'weight_kg')::NUMERIC), v_plan.poids_total_kg, 1),
    COALESCE(SUM((item->>'value_eur')::NUMERIC), v_commande.montant_total, 100)
  INTO v_poids_total, v_valeur_totale
  FROM jsonb_array_elements(v_articles) item;

  -- Créer la déclaration CN23
  INSERT INTO cn23_declaration (
    client_id,
    plan_transport_id,
    commande_id,
    numero_cn23,
    type_envoi,
    expediteur,
    destinataire,
    articles,
    poids_total_kg,
    valeur_totale_eur,
    statut
  ) VALUES (
    v_plan.client_id,
    p_plan_transport_id,
    v_plan.commande_id,
    generate_cn23_number(),
    p_type_envoi,
    v_plan.origine_adresse,
    v_plan.destination_adresse,
    v_articles,
    v_poids_total,
    v_valeur_totale,
    'draft'
  )
  RETURNING id INTO v_cn23_id;

  RETURN v_cn23_id;
END;
$$ LANGUAGE plpgsql;

-- Fonction: Obtenir configuration transporteur active pour un client
CREATE OR REPLACE FUNCTION get_active_carrier_config(
  p_client_id UUID,
  p_carrier_type TEXT
)
RETURNS TABLE (
  id UUID,
  carrier_type TEXT,
  carrier_name TEXT,
  api_key TEXT,
  secret_key TEXT,
  account_number TEXT,
  merchant_id TEXT,
  additional_params JSONB,
  supported_services JSONB,
  default_sender_address JSONB
) AS $$
BEGIN
  RETURN QUERY
  SELECT
    cc.id,
    cc.carrier_type,
    cc.carrier_name,
    cc.api_key,
    cc.secret_key,
    cc.account_number,
    cc.merchant_id,
    cc.additional_params,
    cc.supported_services,
    cc.default_sender_address
  FROM carrier_config cc
  WHERE cc.client_id = p_client_id
    AND cc.carrier_type = p_carrier_type
    AND cc.is_active = true
  LIMIT 1;
END;
$$ LANGUAGE plpgsql;

-- ============================================================================
-- Triggers
-- ============================================================================

-- Trigger: Mettre à jour updated_at
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER update_carrier_config_updated_at
  BEFORE UPDATE ON carrier_config
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_cn23_updated_at
  BEFORE UPDATE ON cn23_declaration
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

-- ============================================================================
-- Vue: Commandes prêtes pour expédition
-- ============================================================================

CREATE OR REPLACE VIEW v_commandes_pret_expedition AS
SELECT
  c.id as commande_id,
  c.numero_commande,
  c.client_id,
  cl.nom as client_nom,
  c.statut_wms,
  c.montant_total,
  c.poids_total_kg,
  c.adresse_livraison,

  -- Plan transport existant
  pt.id as plan_transport_id,
  pt.numero_plan,
  pt.transporteur_id,
  t.nom as transporteur_nom,
  pt.tracking_number,
  pt.label_url,

  -- CN23 si existe
  cn.id as cn23_id,
  cn.numero_cn23,
  cn.pdf_url as cn23_pdf_url,

  -- Étiquette si existe
  sl.id as label_id,
  sl.label_url as label_generated_url,
  sl.tracking_number as label_tracking,

  -- Vérification CN23 requis
  requires_cn23(pt.id) as cn23_required,

  c.created_at,
  c.updated_at
FROM commande c
LEFT JOIN client cl ON c.client_id = cl.id
LEFT JOIN plan_transport pt ON pt.commande_id = c.id
LEFT JOIN transporteur t ON pt.transporteur_id = t.id
LEFT JOIN cn23_declaration cn ON cn.plan_transport_id = pt.id
LEFT JOIN shipping_label sl ON sl.plan_transport_id = pt.id
WHERE c.statut_wms IN ('pret_expedition', 'etiquette_generee')
ORDER BY c.created_at DESC;

COMMENT ON VIEW v_commandes_pret_expedition IS 'Vue des commandes prêtes pour expédition avec statut CN23 et étiquettes';
