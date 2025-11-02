-- Ajouter une table pour suivre les limites d'utilisateurs par client
CREATE TABLE IF NOT EXISTS public.client_user_limits (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  client_id UUID NOT NULL REFERENCES public.client(id) ON DELETE CASCADE,
  max_users INTEGER NOT NULL DEFAULT 5,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  UNIQUE(client_id)
);

-- Enable RLS
ALTER TABLE public.client_user_limits ENABLE ROW LEVEL SECURITY;

-- Admins peuvent tout faire
CREATE POLICY "Admin full access on client_user_limits"
  ON public.client_user_limits
  FOR ALL
  USING (has_role(auth.uid(), 'admin'::app_role))
  WITH CHECK (has_role(auth.uid(), 'admin'::app_role));

-- Clients peuvent voir leur propre limite
CREATE POLICY "Client read own user limits"
  ON public.client_user_limits
  FOR SELECT
  USING (
    has_role(auth.uid(), 'client'::app_role) 
    AND client_id IN (
      SELECT client_id 
      FROM public.profiles 
      WHERE id = auth.uid()
    )
  );

-- Fonction pour vérifier si un client peut créer plus d'utilisateurs
CREATE OR REPLACE FUNCTION public.can_client_create_user(_client_id UUID)
RETURNS BOOLEAN
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_max_users INTEGER;
  v_current_users INTEGER;
BEGIN
  -- Obtenir la limite maximale (5 par défaut si pas configuré)
  SELECT COALESCE(max_users, 5) INTO v_max_users
  FROM public.client_user_limits
  WHERE client_id = _client_id;
  
  IF v_max_users IS NULL THEN
    v_max_users := 5;
  END IF;
  
  -- Compter les utilisateurs actuels pour ce client
  SELECT COUNT(*) INTO v_current_users
  FROM public.profiles
  WHERE client_id = _client_id;
  
  -- Retourner vrai si on peut encore créer des utilisateurs
  RETURN v_current_users < v_max_users;
END;
$$;

-- Vue pour obtenir le nombre d'utilisateurs par client avec leur limite
CREATE OR REPLACE VIEW public.client_user_stats AS
SELECT 
  c.id as client_id,
  c.nom_entreprise,
  COALESCE(cul.max_users, 5) as max_users,
  COUNT(p.id) as current_users,
  COALESCE(cul.max_users, 5) - COUNT(p.id) as remaining_slots
FROM public.client c
LEFT JOIN public.client_user_limits cul ON c.id = cul.client_id
LEFT JOIN public.profiles p ON c.id = p.client_id
GROUP BY c.id, c.nom_entreprise, cul.max_users;

-- RLS pour la vue
ALTER VIEW public.client_user_stats SET (security_invoker = on);

-- Initialiser les limites pour les clients existants
INSERT INTO public.client_user_limits (client_id, max_users)
SELECT id, 5 FROM public.client
ON CONFLICT (client_id) DO NOTHING;