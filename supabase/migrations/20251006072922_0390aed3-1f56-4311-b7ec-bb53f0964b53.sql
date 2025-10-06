-- Créer la table de journalisation des erreurs frontend
CREATE TABLE IF NOT EXISTS public.error_logs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  route TEXT NOT NULL,
  message TEXT NOT NULL,
  stack TEXT,
  user_agent TEXT,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT now()
);

-- Index pour recherches rapides
CREATE INDEX idx_error_logs_created_at ON public.error_logs(created_at DESC);
CREATE INDEX idx_error_logs_user_id ON public.error_logs(user_id);

-- RLS policies
ALTER TABLE public.error_logs ENABLE ROW LEVEL SECURITY;

-- Admins peuvent tout voir
CREATE POLICY "Admin read error_logs" ON public.error_logs
  FOR SELECT
  TO authenticated
  USING (has_role(auth.uid(), 'admin'));

-- Tous les utilisateurs authentifiés peuvent insérer leurs propres erreurs
CREATE POLICY "Users insert own error_logs" ON public.error_logs
  FOR INSERT
  TO authenticated
  WITH CHECK (auth.uid() = user_id OR user_id IS NULL);