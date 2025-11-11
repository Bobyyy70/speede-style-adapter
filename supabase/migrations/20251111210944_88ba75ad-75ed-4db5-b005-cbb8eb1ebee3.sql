-- Phase 2: Tables pour gestion des événements temps réel SendCloud

-- 1. Table pour logger tous les événements webhook entrants
CREATE TABLE IF NOT EXISTS sendcloud_webhook_events (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  event_type VARCHAR(100) NOT NULL,
  event_data JSONB NOT NULL,
  sendcloud_id TEXT,
  commande_id UUID REFERENCES commande(id) ON DELETE SET NULL,
  processed BOOLEAN DEFAULT FALSE,
  processing_error TEXT,
  retry_count INTEGER DEFAULT 0,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  processed_at TIMESTAMPTZ
);

CREATE INDEX idx_webhook_events_type ON sendcloud_webhook_events(event_type);
CREATE INDEX idx_webhook_events_processed ON sendcloud_webhook_events(processed);
CREATE INDEX idx_webhook_events_commande ON sendcloud_webhook_events(commande_id);
CREATE INDEX idx_webhook_events_created ON sendcloud_webhook_events(created_at DESC);

-- 2. Table pour les webhooks sortants (WMS → SendCloud)
CREATE TABLE IF NOT EXISTS sendcloud_outgoing_webhooks (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  event_type VARCHAR(100) NOT NULL,
  entity_type VARCHAR(50) NOT NULL, -- 'order', 'product', 'stock'
  entity_id UUID NOT NULL,
  payload JSONB NOT NULL,
  status VARCHAR(20) DEFAULT 'pending', -- pending | sent | failed
  sendcloud_response JSONB,
  retry_count INTEGER DEFAULT 0,
  max_retries INTEGER DEFAULT 5,
  next_retry_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  sent_at TIMESTAMPTZ,
  error_message TEXT
);

CREATE INDEX idx_outgoing_status ON sendcloud_outgoing_webhooks(status);
CREATE INDEX idx_outgoing_next_retry ON sendcloud_outgoing_webhooks(next_retry_at);
CREATE INDEX idx_outgoing_entity ON sendcloud_outgoing_webhooks(entity_type, entity_id);

-- 3. Table pour historique des événements avec analyse
CREATE TABLE IF NOT EXISTS sendcloud_event_history (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  event_type VARCHAR(100) NOT NULL,
  direction VARCHAR(20) NOT NULL, -- 'incoming' | 'outgoing'
  entity_type VARCHAR(50),
  entity_id UUID,
  success BOOLEAN NOT NULL,
  processing_time_ms INTEGER,
  error_details TEXT,
  metadata JSONB,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX idx_event_history_type ON sendcloud_event_history(event_type);
CREATE INDEX idx_event_history_direction ON sendcloud_event_history(direction);
CREATE INDEX idx_event_history_success ON sendcloud_event_history(success);
CREATE INDEX idx_event_history_created ON sendcloud_event_history(created_at DESC);

-- 4. Table pour tracking des statuts en temps réel
CREATE TABLE IF NOT EXISTS sendcloud_status_tracking (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  commande_id UUID REFERENCES commande(id) ON DELETE CASCADE,
  sendcloud_parcel_id TEXT NOT NULL,
  carrier VARCHAR(100),
  tracking_number VARCHAR(255),
  current_status VARCHAR(100),
  status_message TEXT,
  shipment_uuid UUID,
  external_tracking_url TEXT,
  last_status_change TIMESTAMPTZ DEFAULT NOW(),
  estimated_delivery_date TIMESTAMPTZ,
  tracking_events JSONB DEFAULT '[]'::jsonb,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(commande_id, sendcloud_parcel_id)
);

CREATE INDEX idx_status_tracking_commande ON sendcloud_status_tracking(commande_id);
CREATE INDEX idx_status_tracking_parcel ON sendcloud_status_tracking(sendcloud_parcel_id);
CREATE INDEX idx_status_tracking_status ON sendcloud_status_tracking(current_status);

-- 5. Vue pour statistiques événements
CREATE OR REPLACE VIEW sendcloud_event_stats AS
SELECT 
  event_type,
  direction,
  COUNT(*) as total_events,
  SUM(CASE WHEN success THEN 1 ELSE 0 END) as successful_events,
  SUM(CASE WHEN NOT success THEN 1 ELSE 0 END) as failed_events,
  ROUND(AVG(processing_time_ms)::numeric, 2) as avg_processing_time_ms,
  MAX(created_at) as last_event_at
FROM sendcloud_event_history
WHERE created_at > NOW() - INTERVAL '30 days'
GROUP BY event_type, direction
ORDER BY total_events DESC;

-- 6. Vue pour webhooks en échec nécessitant retry
CREATE OR REPLACE VIEW sendcloud_failed_webhooks AS
SELECT 
  id,
  event_type,
  entity_type,
  entity_id,
  retry_count,
  max_retries,
  next_retry_at,
  error_message,
  created_at
FROM sendcloud_outgoing_webhooks
WHERE status = 'failed' 
  AND retry_count < max_retries
  AND (next_retry_at IS NULL OR next_retry_at <= NOW())
ORDER BY next_retry_at ASC NULLS FIRST
LIMIT 100;

-- 7. Fonction pour calculer le prochain retry avec backoff exponentiel
CREATE OR REPLACE FUNCTION calculate_next_retry(
  retry_count INTEGER,
  base_delay_minutes INTEGER DEFAULT 2
) RETURNS TIMESTAMPTZ AS $$
BEGIN
  RETURN NOW() + (base_delay_minutes * POWER(2, retry_count)) * INTERVAL '1 minute';
END;
$$ LANGUAGE plpgsql IMMUTABLE;

-- 8. Trigger pour mettre à jour updated_at sur sendcloud_status_tracking
CREATE OR REPLACE FUNCTION update_status_tracking_timestamp()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER trigger_update_status_tracking_timestamp
BEFORE UPDATE ON sendcloud_status_tracking
FOR EACH ROW
EXECUTE FUNCTION update_status_tracking_timestamp();

-- 9. RLS Policies
ALTER TABLE sendcloud_webhook_events ENABLE ROW LEVEL SECURITY;
ALTER TABLE sendcloud_outgoing_webhooks ENABLE ROW LEVEL SECURITY;
ALTER TABLE sendcloud_event_history ENABLE ROW LEVEL SECURITY;
ALTER TABLE sendcloud_status_tracking ENABLE ROW LEVEL SECURITY;

-- Admins peuvent tout voir
CREATE POLICY "Admins can view webhook events" ON sendcloud_webhook_events FOR SELECT TO authenticated USING (
  EXISTS (SELECT 1 FROM user_roles WHERE user_id = auth.uid() AND role = 'admin')
);

CREATE POLICY "Admins can view outgoing webhooks" ON sendcloud_outgoing_webhooks FOR SELECT TO authenticated USING (
  EXISTS (SELECT 1 FROM user_roles WHERE user_id = auth.uid() AND role = 'admin')
);

CREATE POLICY "Admins can view event history" ON sendcloud_event_history FOR SELECT TO authenticated USING (
  EXISTS (SELECT 1 FROM user_roles WHERE user_id = auth.uid() AND role = 'admin')
);

CREATE POLICY "Admins can view status tracking" ON sendcloud_status_tracking FOR SELECT TO authenticated USING (
  EXISTS (SELECT 1 FROM user_roles WHERE user_id = auth.uid() AND role = 'admin')
);

-- Service role peut tout faire (pour les edge functions)
CREATE POLICY "Service role full access webhook events" ON sendcloud_webhook_events FOR ALL TO service_role USING (true);
CREATE POLICY "Service role full access outgoing webhooks" ON sendcloud_outgoing_webhooks FOR ALL TO service_role USING (true);
CREATE POLICY "Service role full access event history" ON sendcloud_event_history FOR ALL TO service_role USING (true);
CREATE POLICY "Service role full access status tracking" ON sendcloud_status_tracking FOR ALL TO service_role USING (true);