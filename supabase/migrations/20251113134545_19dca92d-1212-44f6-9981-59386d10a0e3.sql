-- Table pour les templates d'emails personnalisables
CREATE TABLE IF NOT EXISTS public.customs_email_templates (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  nom TEXT NOT NULL UNIQUE,
  sujet TEXT NOT NULL,
  corps_html TEXT NOT NULL,
  description TEXT,
  variables_disponibles TEXT[] DEFAULT ARRAY['{{numero_commande}}', '{{client_nom}}', '{{date}}', '{{transporteur}}'],
  actif BOOLEAN DEFAULT true,
  date_creation TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  date_modification TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Insérer des templates par défaut
INSERT INTO public.customs_email_templates (nom, sujet, corps_html, description) VALUES
(
  'cn23_client',
  'Documents douaniers pour votre commande {{numero_commande}}',
  '<html>
<head>
  <style>
    body { font-family: Arial, sans-serif; line-height: 1.6; color: #333; }
    .header { background: #f4f4f4; padding: 20px; text-align: center; }
    .content { padding: 20px; }
    .footer { background: #f4f4f4; padding: 10px; text-align: center; font-size: 12px; color: #666; }
  </style>
</head>
<body>
  <div class="header">
    <h2>Documents douaniers</h2>
  </div>
  <div class="content">
    <p>Bonjour {{client_nom}},</p>
    <p>Veuillez trouver ci-joint les documents douaniers pour votre commande <strong>{{numero_commande}}</strong>.</p>
    <p>Ces documents sont nécessaires pour l''expédition internationale de votre colis via <strong>{{transporteur}}</strong>.</p>
    <ul>
      <li>CN23 (Déclaration en douane)</li>
      <li>Packing List (Liste de colisage)</li>
    </ul>
    <p>Votre colis sera expédié sous peu.</p>
    <p>Cordialement,<br>L''équipe logistique</p>
  </div>
  <div class="footer">
    <p>Email automatique - Ne pas répondre</p>
  </div>
</body>
</html>',
  'Template pour envoyer les documents au client'
),
(
  'cn23_transporteur',
  '[WMS] Documents douaniers - Commande {{numero_commande}}',
  '<html>
<head>
  <style>
    body { font-family: Arial, sans-serif; line-height: 1.6; color: #333; }
    .header { background: #2563eb; color: white; padding: 20px; }
    .content { padding: 20px; }
    .info-box { background: #eff6ff; border-left: 4px solid #2563eb; padding: 10px; margin: 10px 0; }
  </style>
</head>
<body>
  <div class="header">
    <h2>Documents douaniers - Expédition internationale</h2>
  </div>
  <div class="content">
    <p>Documents douaniers pour la commande <strong>{{numero_commande}}</strong></p>
    <div class="info-box">
      <p><strong>Client:</strong> {{client_nom}}<br>
      <strong>Date:</strong> {{date}}<br>
      <strong>Transporteur:</strong> {{transporteur}}</p>
    </div>
    <p>Documents joints:</p>
    <ul>
      <li>CN23 (Déclaration en douane)</li>
      <li>Packing List (Liste de colisage)</li>
    </ul>
    <p>Merci de prendre en charge cette expédition.</p>
  </div>
</body>
</html>',
  'Template pour envoyer les documents au transporteur'
);

-- RLS pour les templates
ALTER TABLE public.customs_email_templates ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Tout le monde peut lire les templates actifs"
  ON public.customs_email_templates
  FOR SELECT
  USING (actif = true);

CREATE POLICY "Les admins peuvent tout gérer"
  ON public.customs_email_templates
  FOR ALL
  USING (
    EXISTS (
      SELECT 1 FROM public.user_roles
      WHERE user_id = auth.uid() AND role = 'admin'
    )
  );

-- Trigger pour date_modification
CREATE OR REPLACE FUNCTION update_customs_email_template_date_modification()
RETURNS TRIGGER AS $$
BEGIN
  NEW.date_modification = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER update_customs_email_template_date_modification_trigger
  BEFORE UPDATE ON public.customs_email_templates
  FOR EACH ROW
  EXECUTE FUNCTION update_customs_email_template_date_modification();

-- Table pour logger les emails envoyés
CREATE TABLE IF NOT EXISTS public.customs_email_log (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  commande_id UUID REFERENCES public.commande(id) ON DELETE CASCADE,
  destinataire_email TEXT NOT NULL,
  destinataire_type TEXT NOT NULL CHECK (destinataire_type IN ('client', 'transporteur')),
  template_utilise TEXT,
  sujet TEXT,
  statut TEXT NOT NULL DEFAULT 'en_attente' CHECK (statut IN ('en_attente', 'envoye', 'erreur')),
  erreur_message TEXT,
  resend_id TEXT,
  documents_joints TEXT[],
  date_envoi TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- RLS pour le log
ALTER TABLE public.customs_email_log ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Les admins et gestionnaires peuvent voir les logs"
  ON public.customs_email_log
  FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM public.user_roles
      WHERE user_id = auth.uid() AND role IN ('admin', 'gestionnaire')
    )
  );

CREATE POLICY "Le système peut insérer des logs"
  ON public.customs_email_log
  FOR INSERT
  WITH CHECK (true);

-- Index pour les recherches
CREATE INDEX idx_customs_email_log_commande ON public.customs_email_log(commande_id);
CREATE INDEX idx_customs_email_log_statut ON public.customs_email_log(statut);
CREATE INDEX idx_customs_email_log_date ON public.customs_email_log(date_envoi DESC);