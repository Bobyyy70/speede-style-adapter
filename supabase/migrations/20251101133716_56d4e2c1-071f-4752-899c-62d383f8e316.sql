-- Migration: Correction auto-fill expéditeur et données rétroactives (v2)
-- Date: 2025-11-01
-- Description: Corrige le trigger pour remplir l'expéditeur et met à jour les données existantes

-- 1. Corriger le trigger pour qu'il fonctionne aussi sur INSERT (pas seulement UPDATE)
DROP TRIGGER IF EXISTS trigger_auto_complete_commande ON public.commande;

CREATE TRIGGER trigger_auto_complete_commande
  BEFORE INSERT OR UPDATE ON public.commande
  FOR EACH ROW
  EXECUTE FUNCTION public.auto_complete_commande_fields();

-- 2. Remplir rétroactivement les expéditeurs manquants depuis configuration_expediteur
UPDATE public.commande c
SET 
  expediteur_nom = ce.nom,
  expediteur_entreprise = ce.entreprise,
  expediteur_email = ce.email,
  expediteur_telephone = ce.telephone,
  expediteur_adresse_ligne_1 = ce.adresse_ligne_1,
  expediteur_adresse_ligne_2 = ce.adresse_ligne_2,
  expediteur_code_postal = ce.code_postal,
  expediteur_ville = ce.ville,
  expediteur_pays_code = ce.pays_code
FROM configuration_expediteur ce
WHERE c.client_id = ce.client_id
  AND ce.est_defaut = true
  AND ce.actif = true
  AND c.expediteur_entreprise IS NULL;

-- 3. Pour les commandes sans config expéditeur, essayer de remplir depuis la table client
UPDATE public.commande c
SET
  expediteur_entreprise = cl.nom_entreprise,
  expediteur_email = cl.email_contact,
  expediteur_telephone = cl.telephone,
  expediteur_adresse_ligne_1 = cl.adresse,
  expediteur_pays_code = 'FR'
FROM client cl
WHERE c.client_id = cl.id
  AND c.expediteur_entreprise IS NULL;

COMMENT ON TRIGGER trigger_auto_complete_commande ON public.commande IS 'Remplit automatiquement les champs expéditeur et autres valeurs par défaut lors de la création ou modification d''une commande';