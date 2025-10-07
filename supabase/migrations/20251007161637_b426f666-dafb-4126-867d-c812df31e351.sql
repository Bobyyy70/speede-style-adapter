-- Ajouter colonne sous_client sur commande pour gérer Thomas/Elite Water sous Link-OS
ALTER TABLE commande ADD COLUMN IF NOT EXISTS sous_client VARCHAR;

-- Créer les 3 clients B2B
INSERT INTO client (nom_entreprise, actif, email_contact)
VALUES 
  ('HEATZY', true, 'contact@heatzy.com'),
  ('HEFAGROUP OÜ', true, 'contact@hefagroup.com'),
  ('Link-OS', true, 'contact@linkos.com')
ON CONFLICT DO NOTHING;

-- Mise à jour des commandes SendCloud existantes pour associer client_id basé sur la marque des produits
UPDATE commande c
SET client_id = (
  SELECT CASE 
    WHEN p.marque = 'Heatzy' THEN (SELECT id FROM client WHERE nom_entreprise = 'HEATZY' LIMIT 1)
    WHEN p.marque = 'Thomas' THEN (SELECT id FROM client WHERE nom_entreprise = 'Link-OS' LIMIT 1)
    WHEN p.marque = 'Elete Electrolyte' THEN (SELECT id FROM client WHERE nom_entreprise = 'Link-OS' LIMIT 1)
    ELSE (SELECT id FROM client WHERE nom_entreprise = 'HEFAGROUP OÜ' LIMIT 1)
  END
  FROM ligne_commande lc
  JOIN produit p ON p.id = lc.produit_id
  WHERE lc.commande_id = c.id
  LIMIT 1
)
WHERE c.client_id IS NULL AND c.source = 'SendCloud';

-- Mise à jour des sous_client pour les commandes avec produits Thomas/Elite Water
UPDATE commande c
SET sous_client = (
  SELECT CASE 
    WHEN p.marque = 'Thomas' THEN 'Thomas'
    WHEN p.marque = 'Elete Electrolyte' THEN 'Elite Water'
  END
  FROM ligne_commande lc
  JOIN produit p ON p.id = lc.produit_id
  WHERE lc.commande_id = c.id
  AND p.marque IN ('Thomas', 'Elete Electrolyte')
  LIMIT 1
)
WHERE c.sous_client IS NULL;