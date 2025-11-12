-- Créer un client par défaut pour les commandes importées
INSERT INTO public.client (id, nom_entreprise, actif, adresse, email_contact, telephone)
VALUES (
  '00000000-0000-0000-0000-000000000001'::uuid,
  'Import SendCloud',
  true,
  'Non renseignée',
  'import@sendcloud.local',
  'N/A'
)
ON CONFLICT (id) DO NOTHING;

-- Assigner ce client par défaut aux commandes sans client_id
UPDATE public.commande
SET client_id = '00000000-0000-0000-0000-000000000001'::uuid
WHERE client_id IS NULL;

-- Créer une configuration expéditeur par défaut si elle n'existe pas
INSERT INTO public.configuration_expediteur (
  nom,
  entreprise,
  email,
  telephone,
  adresse_ligne_1,
  code_postal,
  ville,
  pays_code,
  client_id,
  est_defaut,
  actif
)
VALUES (
  'Speed E-Log',
  'Speed E-Log',
  'contact@speedelog.net',
  '+33 1 XX XX XX XX',
  'Adresse entrepôt',
  '75001',
  'Paris',
  'FR',
  NULL,
  true,
  true
)
ON CONFLICT DO NOTHING;