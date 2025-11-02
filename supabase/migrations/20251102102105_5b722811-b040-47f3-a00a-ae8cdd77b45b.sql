-- Phase 1: Table pour règles expéditeur automatiques
CREATE TABLE IF NOT EXISTS public.regle_expediteur_automatique (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  client_id UUID REFERENCES public.client(id) ON DELETE CASCADE NOT NULL,
  nom_regle VARCHAR(100) NOT NULL,
  condition_type VARCHAR(50) NOT NULL CHECK (condition_type IN ('nom_client_exact', 'nom_client_contient', 'tags_commande', 'sous_client_exact')),
  condition_value TEXT NOT NULL,
  configuration_expediteur_id UUID REFERENCES public.configuration_expediteur(id) ON DELETE CASCADE NOT NULL,
  priorite INTEGER DEFAULT 100,
  actif BOOLEAN DEFAULT true,
  date_creation TIMESTAMPTZ DEFAULT NOW(),
  date_modification TIMESTAMPTZ DEFAULT NOW()
);

-- Index pour performance
CREATE INDEX IF NOT EXISTS idx_regle_expediteur_client ON public.regle_expediteur_automatique(client_id) WHERE actif = true;
CREATE INDEX IF NOT EXISTS idx_regle_expediteur_priorite ON public.regle_expediteur_automatique(priorite DESC) WHERE actif = true;

-- RLS policies
ALTER TABLE public.regle_expediteur_automatique ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Admin full access on regle_expediteur_automatique"
  ON public.regle_expediteur_automatique
  FOR ALL
  USING (has_role(auth.uid(), 'admin'::app_role))
  WITH CHECK (has_role(auth.uid(), 'admin'::app_role));

CREATE POLICY "Client read own regle_expediteur_automatique"
  ON public.regle_expediteur_automatique
  FOR SELECT
  USING (
    has_role(auth.uid(), 'client'::app_role) AND
    client_id IN (SELECT client_id FROM public.profiles WHERE id = auth.uid())
  );

CREATE POLICY "Client manage own regle_expediteur_automatique"
  ON public.regle_expediteur_automatique
  FOR ALL
  USING (
    has_role(auth.uid(), 'client'::app_role) AND
    client_id IN (SELECT client_id FROM public.profiles WHERE id = auth.uid())
  )
  WITH CHECK (
    has_role(auth.uid(), 'client'::app_role) AND
    client_id IN (SELECT client_id FROM public.profiles WHERE id = auth.uid())
  );

-- Phase 2: Colonne pour stock après mouvement
ALTER TABLE public.mouvement_stock ADD COLUMN IF NOT EXISTS stock_apres_mouvement INTEGER;

-- Fonction pour calculer stock après mouvement
CREATE OR REPLACE FUNCTION public.calculate_stock_after_movement()
RETURNS TRIGGER AS $$
DECLARE
  v_stock_actuel INTEGER;
BEGIN
  -- Calculer le stock après ce mouvement
  SELECT COALESCE(SUM(
    CASE 
      WHEN type_mouvement = 'entrée' THEN quantite
      WHEN type_mouvement = 'sortie' THEN -quantite
      WHEN type_mouvement = 'réservation' THEN -quantite
      ELSE 0
    END
  ), 0) INTO v_stock_actuel
  FROM public.mouvement_stock
  WHERE produit_id = NEW.produit_id
    AND statut_mouvement = 'stock_physique'
    AND date_mouvement <= NEW.date_mouvement
    AND id <= NEW.id;
  
  NEW.stock_apres_mouvement := v_stock_actuel;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public;

-- Trigger pour calculer automatiquement
DROP TRIGGER IF EXISTS trg_calculate_stock_after ON public.mouvement_stock;
CREATE TRIGGER trg_calculate_stock_after
  BEFORE INSERT ON public.mouvement_stock
  FOR EACH ROW
  EXECUTE FUNCTION public.calculate_stock_after_movement();

-- Phase 4: Tables pour dashboard personnalisable
CREATE TABLE IF NOT EXISTS public.dashboard_widget_library (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  nom VARCHAR(100) NOT NULL,
  description TEXT,
  widget_type VARCHAR(50) NOT NULL CHECK (widget_type IN ('stat_card', 'chart_line', 'chart_bar', 'table', 'map', 'timeline', 'gauge')),
  default_config JSONB NOT NULL,
  preview_image TEXT,
  categorie VARCHAR(50) CHECK (categorie IN ('stock', 'commandes', 'analytics', 'custom', 'retours', 'preparation')),
  version INTEGER DEFAULT 1,
  date_ajout TIMESTAMPTZ DEFAULT NOW(),
  actif BOOLEAN DEFAULT true
);

CREATE TABLE IF NOT EXISTS public.dashboard_widget_config (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE NOT NULL,
  widget_library_id UUID REFERENCES public.dashboard_widget_library(id) ON DELETE CASCADE,
  widget_type VARCHAR(50) NOT NULL,
  widget_config JSONB NOT NULL,
  position_x INTEGER NOT NULL DEFAULT 0,
  position_y INTEGER NOT NULL DEFAULT 0,
  width INTEGER DEFAULT 1 CHECK (width >= 1 AND width <= 12),
  height INTEGER DEFAULT 1 CHECK (height >= 1 AND height <= 6),
  visible BOOLEAN DEFAULT true,
  date_creation TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(user_id, position_x, position_y)
);

-- Index pour performance
CREATE INDEX IF NOT EXISTS idx_widget_config_user ON public.dashboard_widget_config(user_id) WHERE visible = true;
CREATE INDEX IF NOT EXISTS idx_widget_library_active ON public.dashboard_widget_library(categorie) WHERE actif = true;

-- RLS policies pour widgets
ALTER TABLE public.dashboard_widget_library ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.dashboard_widget_config ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Everyone can read active widgets library"
  ON public.dashboard_widget_library
  FOR SELECT
  USING (actif = true);

CREATE POLICY "Admin manage widget library"
  ON public.dashboard_widget_library
  FOR ALL
  USING (has_role(auth.uid(), 'admin'::app_role))
  WITH CHECK (has_role(auth.uid(), 'admin'::app_role));

CREATE POLICY "Users manage own widget config"
  ON public.dashboard_widget_config
  FOR ALL
  USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);

-- Insérer widgets par défaut dans la library
INSERT INTO public.dashboard_widget_library (nom, description, widget_type, default_config, categorie, actif) VALUES
  ('Commandes en Préparation', 'Nombre de commandes actuellement en préparation', 'stat_card', '{"metric":"commandes_preparation","icon":"Package","color":"blue"}', 'commandes', true),
  ('Retours en Vue', 'Retours reçus ou en inspection', 'stat_card', '{"metric":"retours_en_vue","icon":"RotateCcw","color":"orange"}', 'retours', true),
  ('Réappros en Attente', 'Demandes de réapprovisionnement non traitées', 'stat_card', '{"metric":"reappros_attente","icon":"TrendingUp","color":"purple"}', 'stock', true),
  ('Sessions Actives', 'Sessions de préparation en cours', 'stat_card', '{"metric":"sessions_actives","icon":"Users","color":"green"}', 'preparation', true),
  ('Alertes Stock', 'Produits avec stock faible', 'stat_card', '{"metric":"alertes_stock","icon":"AlertTriangle","color":"red"}', 'stock', true)
ON CONFLICT DO NOTHING;