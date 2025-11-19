-- Migration pour l'intégration des imprimantes thermiques
-- Création de la table de configuration des imprimantes et des logs d'impression

-- Table de configuration des imprimantes thermiques
CREATE TABLE IF NOT EXISTS public.imprimante_thermique (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    client_id UUID NOT NULL REFERENCES public.client(id) ON DELETE CASCADE,
    nom_imprimante TEXT NOT NULL,
    type_imprimante TEXT NOT NULL CHECK (type_imprimante IN ('thermal_80mm', 'thermal_58mm', 'label_100x150mm', 'label_4x6inch', 'zebra_zpl', 'epson_escpos')),
    type_connexion TEXT NOT NULL CHECK (type_connexion IN ('usb', 'network', 'bluetooth', 'wifi')),

    -- Configuration réseau (pour network/wifi)
    adresse_ip TEXT,
    port INTEGER,

    -- Configuration USB/Bluetooth
    device_id TEXT,

    -- Préférences d'impression
    largeur_papier_mm INTEGER NOT NULL DEFAULT 80,
    hauteur_papier_mm INTEGER,
    resolution_dpi INTEGER DEFAULT 203,
    vitesse_impression TEXT CHECK (vitesse_impression IN ('slow', 'medium', 'fast')) DEFAULT 'medium',

    -- Configuration par défaut
    par_defaut_picking BOOLEAN DEFAULT false,
    par_defaut_expedition BOOLEAN DEFAULT false,
    par_defaut_etiquettes BOOLEAN DEFAULT false,

    -- Statut
    is_active BOOLEAN DEFAULT true,
    derniere_connexion TIMESTAMPTZ,
    statut_connexion TEXT CHECK (statut_connexion IN ('online', 'offline', 'error', 'unknown')) DEFAULT 'unknown',
    message_erreur TEXT,

    -- Métadonnées
    created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    created_by UUID REFERENCES auth.users(id),

    -- Contraintes
    CONSTRAINT unique_printer_name_per_client UNIQUE (client_id, nom_imprimante)
);

-- Table de log des impressions
CREATE TABLE IF NOT EXISTS public.log_impression_thermique (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    imprimante_id UUID REFERENCES public.imprimante_thermique(id) ON DELETE SET NULL,
    commande_id UUID REFERENCES public.commande(id) ON DELETE CASCADE,
    document_id UUID REFERENCES public.document_commande(id) ON DELETE SET NULL,

    type_document TEXT NOT NULL CHECK (type_document IN ('picking_slip', 'packing_list', 'shipping_label', 'product_label', 'cn23', 'barcode')),
    format_impression TEXT NOT NULL CHECK (format_impression IN ('escpos', 'zpl', 'html_thermal', 'pdf')),

    -- Statut de l'impression
    statut TEXT NOT NULL CHECK (statut IN ('pending', 'printing', 'success', 'error', 'cancelled')) DEFAULT 'pending',
    message_erreur TEXT,

    -- Données de l'impression
    nombre_copies INTEGER DEFAULT 1,
    taille_donnees_bytes INTEGER,
    duree_impression_ms INTEGER,

    -- Métadonnées
    printed_at TIMESTAMPTZ,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    printed_by UUID REFERENCES auth.users(id),

    -- Index pour les requêtes fréquentes
    CONSTRAINT fk_imprimante FOREIGN KEY (imprimante_id) REFERENCES public.imprimante_thermique(id),
    CONSTRAINT fk_commande FOREIGN KEY (commande_id) REFERENCES public.commande(id)
);

-- Index pour optimiser les requêtes
CREATE INDEX IF NOT EXISTS idx_imprimante_thermique_client_id ON public.imprimante_thermique(client_id);
CREATE INDEX IF NOT EXISTS idx_imprimante_thermique_active ON public.imprimante_thermique(client_id, is_active) WHERE is_active = true;
CREATE INDEX IF NOT EXISTS idx_log_impression_commande_id ON public.log_impression_thermique(commande_id);
CREATE INDEX IF NOT EXISTS idx_log_impression_status ON public.log_impression_thermique(statut, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_log_impression_printed_at ON public.log_impression_thermique(printed_at DESC);

-- Trigger pour mettre à jour updated_at automatiquement
CREATE OR REPLACE FUNCTION update_imprimante_thermique_updated_at()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = now();
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER trigger_update_imprimante_thermique_timestamp
    BEFORE UPDATE ON public.imprimante_thermique
    FOR EACH ROW
    EXECUTE FUNCTION update_imprimante_thermique_updated_at();

-- Politique RLS (Row Level Security) pour imprimante_thermique
ALTER TABLE public.imprimante_thermique ENABLE ROW LEVEL SECURITY;

-- Politique: Les utilisateurs peuvent voir les imprimantes de leur client
CREATE POLICY "Users can view printers of their client"
    ON public.imprimante_thermique
    FOR SELECT
    USING (
        client_id IN (
            SELECT client_id FROM public.profiles WHERE id = auth.uid()
        )
        OR
        EXISTS (
            SELECT 1 FROM public.profiles
            WHERE id = auth.uid() AND role = 'admin'
        )
    );

-- Politique: Seuls les gestionnaires et admins peuvent créer des imprimantes
CREATE POLICY "Managers and admins can create printers"
    ON public.imprimante_thermique
    FOR INSERT
    WITH CHECK (
        EXISTS (
            SELECT 1 FROM public.profiles
            WHERE id = auth.uid()
            AND role IN ('admin', 'gestionnaire')
            AND (role = 'admin' OR client_id = imprimante_thermique.client_id)
        )
    );

-- Politique: Seuls les gestionnaires et admins peuvent modifier les imprimantes
CREATE POLICY "Managers and admins can update printers"
    ON public.imprimante_thermique
    FOR UPDATE
    USING (
        EXISTS (
            SELECT 1 FROM public.profiles
            WHERE id = auth.uid()
            AND role IN ('admin', 'gestionnaire')
            AND (role = 'admin' OR client_id = imprimante_thermique.client_id)
        )
    );

-- Politique: Seuls les admins peuvent supprimer des imprimantes
CREATE POLICY "Admins can delete printers"
    ON public.imprimante_thermique
    FOR DELETE
    USING (
        EXISTS (
            SELECT 1 FROM public.profiles
            WHERE id = auth.uid() AND role = 'admin'
        )
    );

-- Politique RLS pour log_impression_thermique
ALTER TABLE public.log_impression_thermique ENABLE ROW LEVEL SECURITY;

-- Politique: Les utilisateurs peuvent voir les logs de leur client
CREATE POLICY "Users can view print logs of their client"
    ON public.log_impression_thermique
    FOR SELECT
    USING (
        EXISTS (
            SELECT 1 FROM public.commande c
            JOIN public.profiles p ON p.client_id = c.client_id
            WHERE c.id = log_impression_thermique.commande_id
            AND p.id = auth.uid()
        )
        OR
        EXISTS (
            SELECT 1 FROM public.profiles
            WHERE id = auth.uid() AND role = 'admin'
        )
    );

-- Politique: Tous les utilisateurs authentifiés peuvent créer des logs d'impression
CREATE POLICY "Authenticated users can create print logs"
    ON public.log_impression_thermique
    FOR INSERT
    WITH CHECK (auth.uid() IS NOT NULL);

-- Commentaires sur les tables
COMMENT ON TABLE public.imprimante_thermique IS 'Configuration des imprimantes thermiques par client pour l''impression de bordereaux et étiquettes';
COMMENT ON TABLE public.log_impression_thermique IS 'Historique des impressions thermiques effectuées';

COMMENT ON COLUMN public.imprimante_thermique.type_imprimante IS 'Type d''imprimante: thermal_80mm, thermal_58mm, label_100x150mm, zebra_zpl, epson_escpos';
COMMENT ON COLUMN public.imprimante_thermique.type_connexion IS 'Mode de connexion: usb, network, bluetooth, wifi';
COMMENT ON COLUMN public.imprimante_thermique.par_defaut_picking IS 'Imprimante par défaut pour les bordereaux de picking';
COMMENT ON COLUMN public.imprimante_thermique.par_defaut_expedition IS 'Imprimante par défaut pour les étiquettes d''expédition';
COMMENT ON COLUMN public.log_impression_thermique.format_impression IS 'Format utilisé: escpos (ESC/POS), zpl (Zebra), html_thermal, pdf';
