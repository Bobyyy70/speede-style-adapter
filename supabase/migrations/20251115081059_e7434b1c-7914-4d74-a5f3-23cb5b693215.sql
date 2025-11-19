-- Phase 5.1 Correction A : Ajouter la colonne service_transport
-- Ajouter la colonne manquante pour stocker le nom du service de transport SendCloud
ALTER TABLE public.commande 
ADD COLUMN IF NOT EXISTS service_transport TEXT;

-- Créer un index pour optimiser les recherches par service de transport
CREATE INDEX IF NOT EXISTS idx_commande_service_transport 
ON public.commande(service_transport);

-- Ajouter un commentaire pour la documentation
COMMENT ON COLUMN public.commande.service_transport IS 
'Nom du service de transport SendCloud (ex: "DPD Classic", "UPS Express", "Colissimo")';