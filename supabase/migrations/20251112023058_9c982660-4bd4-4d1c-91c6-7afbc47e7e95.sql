-- Table de mapping SendCloud → Client pour import automatique
CREATE TABLE IF NOT EXISTS public.sendcloud_client_mapping (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  integration_id INTEGER UNIQUE,
  shop_name TEXT,
  email_domain TEXT,
  client_id UUID NOT NULL REFERENCES public.client(id) ON DELETE CASCADE,
  config_expediteur_defaut_id UUID REFERENCES public.configuration_expediteur(id) ON DELETE SET NULL,
  actif BOOLEAN DEFAULT true,
  date_creation TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  date_modification TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  CONSTRAINT unique_email_domain UNIQUE (email_domain)
);

-- Index pour performance
CREATE INDEX IF NOT EXISTS idx_sendcloud_mapping_client ON public.sendcloud_client_mapping(client_id);
CREATE INDEX IF NOT EXISTS idx_sendcloud_mapping_active ON public.sendcloud_client_mapping(actif) WHERE actif = true;

-- RLS policies pour sendcloud_client_mapping
ALTER TABLE public.sendcloud_client_mapping ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Admin full access sendcloud_client_mapping"
  ON public.sendcloud_client_mapping
  FOR ALL
  USING (
    EXISTS (
      SELECT 1 FROM public.user_roles
      WHERE user_id = auth.uid()
      AND role = 'admin'
    )
  )
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM public.user_roles
      WHERE user_id = auth.uid()
      AND role = 'admin'
    )
  );

-- Index uniques pour améliorer le matching des événements de tracking
CREATE UNIQUE INDEX IF NOT EXISTS idx_commande_sendcloud_id_unique 
  ON public.commande(sendcloud_id) 
  WHERE sendcloud_id IS NOT NULL;

CREATE UNIQUE INDEX IF NOT EXISTS idx_commande_sendcloud_shipment_id_unique 
  ON public.commande(sendcloud_shipment_id) 
  WHERE sendcloud_shipment_id IS NOT NULL;

-- Index pour améliorer les recherches par sendcloud_reference
CREATE INDEX IF NOT EXISTS idx_commande_sendcloud_reference 
  ON public.commande(sendcloud_reference) 
  WHERE sendcloud_reference IS NOT NULL;

COMMENT ON TABLE public.sendcloud_client_mapping IS 'Mapping automatique SendCloud → Client pour identification lors de l''import webhook';
COMMENT ON COLUMN public.sendcloud_client_mapping.integration_id IS 'ID de l''intégration SendCloud (si disponible dans le webhook)';
COMMENT ON COLUMN public.sendcloud_client_mapping.email_domain IS 'Domaine email pour matching automatique (ex: @exemple.com)';
COMMENT ON COLUMN public.sendcloud_client_mapping.config_expediteur_defaut_id IS 'Configuration expéditeur par défaut à appliquer pour ce client';