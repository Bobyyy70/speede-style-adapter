-- Extension de la table produit avec tous les champs manquants pour un WMS complet

-- Dimensions et volumétrie
ALTER TABLE public.produit ADD COLUMN IF NOT EXISTS longueur_cm NUMERIC(10,2);
ALTER TABLE public.produit ADD COLUMN IF NOT EXISTS largeur_cm NUMERIC(10,2);
ALTER TABLE public.produit ADD COLUMN IF NOT EXISTS hauteur_cm NUMERIC(10,2);
ALTER TABLE public.produit ADD COLUMN IF NOT EXISTS volume_m3 NUMERIC(10,6) GENERATED ALWAYS AS (
  CASE 
    WHEN longueur_cm IS NOT NULL AND largeur_cm IS NOT NULL AND hauteur_cm IS NOT NULL 
    THEN (longueur_cm * largeur_cm * hauteur_cm) / 1000000.0
    ELSE NULL
  END
) STORED;

-- International et douanes
ALTER TABLE public.produit ADD COLUMN IF NOT EXISTS code_sh TEXT;
ALTER TABLE public.produit ADD COLUMN IF NOT EXISTS pays_origine TEXT;
ALTER TABLE public.produit ADD COLUMN IF NOT EXISTS valeur_douaniere NUMERIC(12,2);

-- Logistique et transport
ALTER TABLE public.produit ADD COLUMN IF NOT EXISTS temperature_stockage TEXT CHECK (temperature_stockage IN ('ambiante', 'controlee', 'refrigeree', 'congelee'));
ALTER TABLE public.produit ADD COLUMN IF NOT EXISTS matieres_dangereuses BOOLEAN DEFAULT false;
ALTER TABLE public.produit ADD COLUMN IF NOT EXISTS classe_danger TEXT;
ALTER TABLE public.produit ADD COLUMN IF NOT EXISTS numero_onu TEXT;
ALTER TABLE public.produit ADD COLUMN IF NOT EXISTS conditions_speciales TEXT[];

-- Traçabilité
ALTER TABLE public.produit ADD COLUMN IF NOT EXISTS gestion_lots BOOLEAN DEFAULT false;
ALTER TABLE public.produit ADD COLUMN IF NOT EXISTS gestion_serie BOOLEAN DEFAULT false;
ALTER TABLE public.produit ADD COLUMN IF NOT EXISTS duree_vie_jours INTEGER;
ALTER TABLE public.produit ADD COLUMN IF NOT EXISTS delai_peremption_alerte_jours INTEGER;

-- Informations commerciales étendues
ALTER TABLE public.produit ADD COLUMN IF NOT EXISTS marque TEXT;
ALTER TABLE public.produit ADD COLUMN IF NOT EXISTS fournisseur TEXT;
ALTER TABLE public.produit ADD COLUMN IF NOT EXISTS taux_tva NUMERIC(5,2) DEFAULT 20.00;

-- Image produit
ALTER TABLE public.produit ADD COLUMN IF NOT EXISTS image_url TEXT;

-- Commentaires et instructions
ALTER TABLE public.produit ADD COLUMN IF NOT EXISTS instructions_picking TEXT;
ALTER TABLE public.produit ADD COLUMN IF NOT EXISTS instructions_stockage TEXT;

-- Index pour performances
CREATE INDEX IF NOT EXISTS idx_produit_code_sh ON public.produit(code_sh);
CREATE INDEX IF NOT EXISTS idx_produit_marque ON public.produit(marque);
CREATE INDEX IF NOT EXISTS idx_produit_fournisseur ON public.produit(fournisseur);
CREATE INDEX IF NOT EXISTS idx_produit_matieres_dangereuses ON public.produit(matieres_dangereuses) WHERE matieres_dangereuses = true;
CREATE INDEX IF NOT EXISTS idx_produit_gestion_lots ON public.produit(gestion_lots) WHERE gestion_lots = true;

COMMENT ON COLUMN public.produit.longueur_cm IS 'Longueur du produit en centimètres';
COMMENT ON COLUMN public.produit.largeur_cm IS 'Largeur du produit en centimètres';
COMMENT ON COLUMN public.produit.hauteur_cm IS 'Hauteur du produit en centimètres';
COMMENT ON COLUMN public.produit.volume_m3 IS 'Volume calculé automatiquement en m³';
COMMENT ON COLUMN public.produit.code_sh IS 'Code SH (Système Harmonisé) pour les douanes internationales';
COMMENT ON COLUMN public.produit.pays_origine IS 'Pays d''origine du produit (code ISO)';
COMMENT ON COLUMN public.produit.valeur_douaniere IS 'Valeur déclarée pour les douanes';
COMMENT ON COLUMN public.produit.matieres_dangereuses IS 'Indique si le produit contient des matières dangereuses (ADR/IATA)';
COMMENT ON COLUMN public.produit.classe_danger IS 'Classe de danger selon ADR/IATA (ex: 3, 4.1, 6.1, 8, 9)';
COMMENT ON COLUMN public.produit.numero_onu IS 'Numéro ONU pour matières dangereuses (ex: UN1170)';
COMMENT ON COLUMN public.produit.gestion_lots IS 'Active la gestion par numéros de lot';
COMMENT ON COLUMN public.produit.gestion_serie IS 'Active la gestion par numéros de série';
COMMENT ON COLUMN public.produit.duree_vie_jours IS 'Durée de vie du produit en jours';
COMMENT ON COLUMN public.produit.delai_peremption_alerte_jours IS 'Nombre de jours avant péremption pour déclencher une alerte';