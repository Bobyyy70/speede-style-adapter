-- Table pour stocker toutes les conversations du chatbot IA
CREATE TABLE ia_conversation (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  session_id UUID NOT NULL,
  role VARCHAR(20) NOT NULL CHECK (role IN ('user', 'assistant', 'system')),
  message TEXT NOT NULL,
  contexte_wms JSONB,
  workflow_genere_id UUID REFERENCES n8n_workflows(id),
  tokens_utilises INTEGER DEFAULT 0,
  cout_estimation NUMERIC(10,4) DEFAULT 0,
  date_creation TIMESTAMP DEFAULT NOW()
);

CREATE INDEX idx_ia_conversation_session ON ia_conversation(session_id);
CREATE INDEX idx_ia_conversation_user ON ia_conversation(user_id, date_creation DESC);

-- Table pour bloquer les utilisateurs qui abusent du chatbot
CREATE TABLE ia_user_blocked (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE UNIQUE,
  raison TEXT NOT NULL,
  bloque_par UUID REFERENCES auth.users(id),
  date_blocage TIMESTAMP DEFAULT NOW(),
  actif BOOLEAN DEFAULT TRUE
);

CREATE INDEX idx_ia_user_blocked_user ON ia_user_blocked(user_id) WHERE actif = TRUE;

-- Table pour gérer les quotas d'utilisation par utilisateur
CREATE TABLE ia_usage_quotas (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE UNIQUE,
  messages_gratuits_restants INTEGER DEFAULT 50,
  messages_payes_restants INTEGER DEFAULT 0,
  reset_date DATE DEFAULT (CURRENT_DATE + INTERVAL '1 month'),
  derniere_utilisation TIMESTAMP
);

-- RLS Policies pour ia_conversation
CREATE POLICY "Users see own conversations"
  ON ia_conversation FOR SELECT
  TO authenticated
  USING (auth.uid() = user_id);

CREATE POLICY "Admins see all conversations"
  ON ia_conversation FOR SELECT
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM user_roles 
      WHERE user_id = auth.uid() 
      AND role = 'admin'
    )
  );

CREATE POLICY "Users insert own messages"
  ON ia_conversation FOR INSERT
  TO authenticated
  WITH CHECK (auth.uid() = user_id);

-- RLS Policies pour ia_user_blocked
CREATE POLICY "Admins manage blocked users"
  ON ia_user_blocked FOR ALL
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM user_roles 
      WHERE user_id = auth.uid() 
      AND role IN ('admin', 'gestionnaire')
    )
  )
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM user_roles 
      WHERE user_id = auth.uid() 
      AND role IN ('admin', 'gestionnaire')
    )
  );

-- RLS Policies pour ia_usage_quotas
CREATE POLICY "Users see own quotas"
  ON ia_usage_quotas FOR SELECT
  TO authenticated
  USING (auth.uid() = user_id);

CREATE POLICY "System updates quotas"
  ON ia_usage_quotas FOR UPDATE
  TO authenticated
  USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);