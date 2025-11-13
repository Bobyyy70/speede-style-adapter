-- Table pour stocker les adresses expéditeur SendCloud
CREATE TABLE IF NOT EXISTS public.sendcloud_sender_address (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  sendcloud_id INTEGER UNIQUE NOT NULL,
  company_name TEXT,
  contact_name TEXT NOT NULL,
  email TEXT NOT NULL,
  telephone TEXT,
  street TEXT NOT NULL,
  house_number TEXT NOT NULL,
  postal_code TEXT NOT NULL,
  city TEXT NOT NULL,
  country TEXT NOT NULL,
  vat_number TEXT,
  eori_number TEXT,
  is_default BOOLEAN DEFAULT false,
  bank_account_number TEXT,
  raw_data JSONB,
  date_creation TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  date_modification TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Index pour recherches rapides
CREATE INDEX IF NOT EXISTS idx_sendcloud_sender_address_sendcloud_id ON public.sendcloud_sender_address(sendcloud_id);
CREATE INDEX IF NOT EXISTS idx_sendcloud_sender_address_is_default ON public.sendcloud_sender_address(is_default);
CREATE INDEX IF NOT EXISTS idx_sendcloud_sender_address_country ON public.sendcloud_sender_address(country);

-- RLS policies (accessible par tous les utilisateurs authentifiés en lecture)
ALTER TABLE public.sendcloud_sender_address ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Sender addresses are viewable by authenticated users"
  ON public.sendcloud_sender_address
  FOR SELECT
  TO authenticated
  USING (true);

CREATE POLICY "Sender addresses are manageable by admins"
  ON public.sendcloud_sender_address
  FOR ALL
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM public.user_roles
      WHERE user_id = auth.uid()
      AND role = 'admin'
    )
  );

-- Trigger pour date_modification
CREATE OR REPLACE FUNCTION update_sendcloud_sender_address_date_modification()
RETURNS TRIGGER AS $$
BEGIN
  NEW.date_modification = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER update_sendcloud_sender_address_date_modification
  BEFORE UPDATE ON public.sendcloud_sender_address
  FOR EACH ROW
  EXECUTE FUNCTION update_sendcloud_sender_address_date_modification();