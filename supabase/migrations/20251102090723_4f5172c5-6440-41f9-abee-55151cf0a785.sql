-- ============================================
-- PHASE 2 : SYSTÈME DE GESTION D'ÉTATS AUTOMATIQUE
-- ============================================

-- 1. Tables de log des transitions pour retours
CREATE TABLE IF NOT EXISTS public.retour_transition_log (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  retour_id UUID REFERENCES public.retour_produit(id) ON DELETE CASCADE NOT NULL,
  statut_precedent TEXT NOT NULL,
  statut_nouveau TEXT NOT NULL,
  utilisateur_id UUID REFERENCES auth.users(id),
  raison TEXT,
  metadata JSONB DEFAULT '{}'::jsonb,
  date_transition TIMESTAMPTZ DEFAULT NOW() NOT NULL
);

-- Index pour performances
CREATE INDEX IF NOT EXISTS idx_retour_transition_log_retour_id ON public.retour_transition_log(retour_id);
CREATE INDEX IF NOT EXISTS idx_retour_transition_log_date ON public.retour_transition_log(date_transition DESC);

-- RLS pour retour_transition_log
ALTER TABLE public.retour_transition_log ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Admin full access on retour_transition_log"
  ON public.retour_transition_log
  FOR ALL
  TO authenticated
  USING (has_role(auth.uid(), 'admin'::app_role))
  WITH CHECK (has_role(auth.uid(), 'admin'::app_role));

CREATE POLICY "Gestionnaire read retour_transition_log"
  ON public.retour_transition_log
  FOR SELECT
  TO authenticated
  USING (has_role(auth.uid(), 'gestionnaire'::app_role));

CREATE POLICY "Client read own retour_transition_log"
  ON public.retour_transition_log
  FOR SELECT
  TO authenticated
  USING (
    has_role(auth.uid(), 'client'::app_role) 
    AND retour_id IN (
      SELECT rp.id FROM public.retour_produit rp
      JOIN public.profiles p ON p.client_id = rp.client_id
      WHERE p.id = auth.uid()
    )
  );

-- 2. Tables de log des transitions pour attendus
CREATE TABLE IF NOT EXISTS public.attendu_transition_log (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  attendu_id UUID REFERENCES public.attendu_reception(id) ON DELETE CASCADE NOT NULL,
  statut_precedent TEXT NOT NULL,
  statut_nouveau TEXT NOT NULL,
  utilisateur_id UUID REFERENCES auth.users(id),
  raison TEXT,
  metadata JSONB DEFAULT '{}'::jsonb,
  date_transition TIMESTAMPTZ DEFAULT NOW() NOT NULL
);

-- Index pour performances
CREATE INDEX IF NOT EXISTS idx_attendu_transition_log_attendu_id ON public.attendu_transition_log(attendu_id);
CREATE INDEX IF NOT EXISTS idx_attendu_transition_log_date ON public.attendu_transition_log(date_transition DESC);

-- RLS pour attendu_transition_log
ALTER TABLE public.attendu_transition_log ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Admin full access on attendu_transition_log"
  ON public.attendu_transition_log
  FOR ALL
  TO authenticated
  USING (has_role(auth.uid(), 'admin'::app_role))
  WITH CHECK (has_role(auth.uid(), 'admin'::app_role));

CREATE POLICY "Gestionnaire read attendu_transition_log"
  ON public.attendu_transition_log
  FOR SELECT
  TO authenticated
  USING (has_role(auth.uid(), 'gestionnaire'::app_role));

CREATE POLICY "Operateur read attendu_transition_log"
  ON public.attendu_transition_log
  FOR SELECT
  TO authenticated
  USING (has_role(auth.uid(), 'operateur'::app_role));

CREATE POLICY "Client read own attendu_transition_log"
  ON public.attendu_transition_log
  FOR SELECT
  TO authenticated
  USING (
    has_role(auth.uid(), 'client'::app_role) 
    AND attendu_id IN (
      SELECT ar.id FROM public.attendu_reception ar
      JOIN public.profiles p ON p.client_id = ar.client_id
      WHERE p.id = auth.uid()
    )
  );

-- 3. Fonction de transition pour retours
CREATE OR REPLACE FUNCTION public.transition_statut_retour(
  p_retour_id UUID,
  p_nouveau_statut TEXT,
  p_utilisateur_id UUID DEFAULT NULL,
  p_raison TEXT DEFAULT NULL,
  p_metadata JSONB DEFAULT '{}'::jsonb
) RETURNS JSON
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_statut_actuel TEXT;
  v_transition_valide BOOLEAN := false;
  v_message TEXT;
  v_numero_retour TEXT;
BEGIN
  -- Récupérer le statut actuel
  SELECT statut_retour, numero_retour
  INTO v_statut_actuel, v_numero_retour
  FROM retour_produit
  WHERE id = p_retour_id
  FOR UPDATE;

  IF NOT FOUND THEN
    RETURN json_build_object(
      'success', false,
      'error', 'Retour non trouvé',
      'retour_id', p_retour_id
    );
  END IF;

  -- Si déjà au bon statut
  IF v_statut_actuel = p_nouveau_statut THEN
    RETURN json_build_object(
      'success', true,
      'message', 'Statut déjà à jour',
      'statut_actuel', v_statut_actuel,
      'no_change', true
    );
  END IF;

  -- Valider la transition
  v_transition_valide := CASE
    WHEN v_statut_actuel = 'recu' AND p_nouveau_statut IN ('en_inspection', 'annule') THEN true
    WHEN v_statut_actuel = 'en_inspection' AND p_nouveau_statut IN ('traite', 'non_conforme', 'recu') THEN true
    WHEN v_statut_actuel = 'traite' AND p_nouveau_statut = 'archive' THEN true
    WHEN v_statut_actuel = 'non_conforme' AND p_nouveau_statut IN ('traite', 'archive') THEN true
    WHEN p_nouveau_statut = 'annule' AND v_statut_actuel NOT IN ('annule', 'archive') THEN true
    ELSE false
  END;

  IF NOT v_transition_valide THEN
    RETURN json_build_object(
      'success', false,
      'error', format('Transition invalide: %s → %s', v_statut_actuel, p_nouveau_statut),
      'statut_actuel', v_statut_actuel,
      'statut_demande', p_nouveau_statut,
      'numero_retour', v_numero_retour
    );
  END IF;

  -- Mettre à jour le statut
  UPDATE retour_produit
  SET statut_retour = p_nouveau_statut,
      date_modification = NOW()
  WHERE id = p_retour_id;

  -- Logger la transition
  INSERT INTO retour_transition_log (
    retour_id,
    statut_precedent,
    statut_nouveau,
    utilisateur_id,
    raison,
    metadata
  ) VALUES (
    p_retour_id,
    v_statut_actuel,
    p_nouveau_statut,
    p_utilisateur_id,
    p_raison,
    p_metadata
  );

  v_message := format('Retour %s: %s → %s', v_numero_retour, v_statut_actuel, p_nouveau_statut);

  RETURN json_build_object(
    'success', true,
    'statut_precedent', v_statut_actuel,
    'statut_nouveau', p_nouveau_statut,
    'numero_retour', v_numero_retour,
    'message', v_message
  );
END;
$$;

-- 4. Fonction de transition pour attendus de réception
CREATE OR REPLACE FUNCTION public.transition_statut_attendu(
  p_attendu_id UUID,
  p_nouveau_statut statut_attendu_reception,
  p_utilisateur_id UUID DEFAULT NULL,
  p_raison TEXT DEFAULT NULL,
  p_metadata JSONB DEFAULT '{}'::jsonb
) RETURNS JSON
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_statut_actuel statut_attendu_reception;
  v_transition_valide BOOLEAN := false;
  v_message TEXT;
  v_numero_attendu TEXT;
BEGIN
  -- Récupérer le statut actuel
  SELECT statut, numero_attendu
  INTO v_statut_actuel, v_numero_attendu
  FROM attendu_reception
  WHERE id = p_attendu_id
  FOR UPDATE;

  IF NOT FOUND THEN
    RETURN json_build_object(
      'success', false,
      'error', 'Attendu non trouvé',
      'attendu_id', p_attendu_id
    );
  END IF;

  -- Si déjà au bon statut
  IF v_statut_actuel = p_nouveau_statut THEN
    RETURN json_build_object(
      'success', true,
      'message', 'Statut déjà à jour',
      'statut_actuel', v_statut_actuel::text,
      'no_change', true
    );
  END IF;

  -- Valider la transition
  v_transition_valide := CASE
    WHEN v_statut_actuel = 'prévu' AND p_nouveau_statut IN ('en_transit', 'annulé') THEN true
    WHEN v_statut_actuel = 'en_transit' AND p_nouveau_statut IN ('arrivé', 'annulé', 'prévu') THEN true
    WHEN v_statut_actuel = 'arrivé' AND p_nouveau_statut IN ('en_cours_réception', 'en_transit') THEN true
    WHEN v_statut_actuel = 'en_cours_réception' AND p_nouveau_statut IN ('réceptionné_partiellement', 'réceptionné_totalement', 'anomalie', 'arrivé') THEN true
    WHEN v_statut_actuel = 'réceptionné_partiellement' AND p_nouveau_statut IN ('réceptionné_totalement', 'anomalie', 'en_cours_réception') THEN true
    WHEN v_statut_actuel = 'anomalie' AND p_nouveau_statut IN ('en_cours_réception', 'réceptionné_partiellement', 'réceptionné_totalement') THEN true
    WHEN v_statut_actuel = 'réceptionné_totalement' AND p_nouveau_statut = 'clôturé' THEN true
    WHEN p_nouveau_statut = 'annulé' AND v_statut_actuel NOT IN ('annulé', 'clôturé') THEN true
    ELSE false
  END;

  IF NOT v_transition_valide THEN
    RETURN json_build_object(
      'success', false,
      'error', format('Transition invalide: %s → %s', v_statut_actuel::text, p_nouveau_statut::text),
      'statut_actuel', v_statut_actuel::text,
      'statut_demande', p_nouveau_statut::text,
      'numero_attendu', v_numero_attendu
    );
  END IF;

  -- Mettre à jour le statut
  UPDATE attendu_reception
  SET statut = p_nouveau_statut,
      date_modification = NOW()
  WHERE id = p_attendu_id;

  -- Logger la transition
  INSERT INTO attendu_transition_log (
    attendu_id,
    statut_precedent,
    statut_nouveau,
    utilisateur_id,
    raison,
    metadata
  ) VALUES (
    p_attendu_id,
    v_statut_actuel::text,
    p_nouveau_statut::text,
    p_utilisateur_id,
    p_raison,
    p_metadata
  );

  v_message := format('Attendu %s: %s → %s', v_numero_attendu, v_statut_actuel::text, p_nouveau_statut::text);

  RETURN json_build_object(
    'success', true,
    'statut_precedent', v_statut_actuel::text,
    'statut_nouveau', p_nouveau_statut::text,
    'numero_attendu', v_numero_attendu,
    'message', v_message
  );
END;
$$;

-- 5. Activer Realtime sur les tables critiques
ALTER TABLE public.commande REPLICA IDENTITY FULL;
ALTER TABLE public.retour_produit REPLICA IDENTITY FULL;
ALTER TABLE public.attendu_reception REPLICA IDENTITY FULL;

-- Ajouter à la publication realtime
ALTER PUBLICATION supabase_realtime ADD TABLE public.commande;
ALTER PUBLICATION supabase_realtime ADD TABLE public.retour_produit;
ALTER PUBLICATION supabase_realtime ADD TABLE public.attendu_reception;