-- Table pour l'historique des colis SendCloud
CREATE TABLE IF NOT EXISTS public.sendcloud_parcels (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  commande_id UUID REFERENCES public.commande(id) ON DELETE CASCADE,
  parcel_id TEXT NOT NULL,
  shipment_id TEXT,
  tracking_number TEXT,
  tracking_url TEXT,
  carrier_code TEXT,
  carrier_name TEXT,
  service_name TEXT,
  status_id INTEGER,
  status_message TEXT,
  weight DECIMAL(10,2),
  country TEXT,
  postal_code TEXT,
  city TEXT,
  label_url TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(parcel_id)
);

-- Table pour les événements de tracking
CREATE TABLE IF NOT EXISTS public.sendcloud_tracking_events (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  parcel_id TEXT NOT NULL REFERENCES public.sendcloud_parcels(parcel_id) ON DELETE CASCADE,
  event_timestamp TIMESTAMPTZ NOT NULL,
  status_id INTEGER NOT NULL,
  status_message TEXT NOT NULL,
  location TEXT,
  carrier_message TEXT,
  metadata JSONB,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Index pour les requêtes fréquentes
CREATE INDEX IF NOT EXISTS idx_sendcloud_parcels_commande ON public.sendcloud_parcels(commande_id);
CREATE INDEX IF NOT EXISTS idx_sendcloud_parcels_tracking ON public.sendcloud_parcels(tracking_number);
CREATE INDEX IF NOT EXISTS idx_sendcloud_tracking_events_parcel ON public.sendcloud_tracking_events(parcel_id);
CREATE INDEX IF NOT EXISTS idx_sendcloud_tracking_events_timestamp ON public.sendcloud_tracking_events(event_timestamp DESC);

-- RLS Policies
ALTER TABLE public.sendcloud_parcels ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.sendcloud_tracking_events ENABLE ROW LEVEL SECURITY;

-- Admins peuvent tout voir
CREATE POLICY "Admins can view all parcels"
  ON public.sendcloud_parcels FOR SELECT
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM public.user_roles
      WHERE user_id = auth.uid() AND role = 'admin'
    )
  );

CREATE POLICY "Admins can view all tracking events"
  ON public.sendcloud_tracking_events FOR SELECT
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM public.user_roles
      WHERE user_id = auth.uid() AND role = 'admin'
    )
  );

-- Clients peuvent voir leurs propres colis
CREATE POLICY "Clients can view their parcels"
  ON public.sendcloud_parcels FOR SELECT
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM public.commande c
      JOIN public.profiles p ON p.client_id = c.client_id
      WHERE c.id = commande_id AND p.id = auth.uid()
    )
  );

CREATE POLICY "Clients can view their tracking events"
  ON public.sendcloud_tracking_events FOR SELECT
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM public.sendcloud_parcels sp
      JOIN public.commande c ON c.id = sp.commande_id
      JOIN public.profiles p ON p.client_id = c.client_id
      WHERE sp.parcel_id = sendcloud_tracking_events.parcel_id
      AND p.id = auth.uid()
    )
  );

-- Trigger pour mettre à jour updated_at
CREATE OR REPLACE FUNCTION update_sendcloud_parcel_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER update_sendcloud_parcels_updated_at
  BEFORE UPDATE ON public.sendcloud_parcels
  FOR EACH ROW
  EXECUTE FUNCTION update_sendcloud_parcel_updated_at();