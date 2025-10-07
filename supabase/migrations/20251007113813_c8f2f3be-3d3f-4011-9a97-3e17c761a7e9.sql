-- Étape 1 : Associer le profile alexandre@heatzy.com au client HEATZY
UPDATE profiles 
SET client_id = '3447887c-b7a5-40b7-b215-780e65d652a1'
WHERE email = 'alexandre@heatzy.com';

-- Étape 2 : Supprimer la contrainte incorrecte sur commande
ALTER TABLE commande DROP CONSTRAINT IF EXISTS commande_client_id_fkey;

-- Étape 3 : Créer la bonne contrainte vers la table client
ALTER TABLE commande 
ADD CONSTRAINT commande_client_id_fkey 
FOREIGN KEY (client_id) REFERENCES client(id) ON DELETE SET NULL;

-- Étape 4 : Faire la même chose pour les autres tables
ALTER TABLE produit DROP CONSTRAINT IF EXISTS produit_client_id_fkey;
ALTER TABLE produit 
ADD CONSTRAINT produit_client_id_fkey 
FOREIGN KEY (client_id) REFERENCES client(id) ON DELETE SET NULL;

ALTER TABLE attendu_reception DROP CONSTRAINT IF EXISTS attendu_reception_client_id_fkey;
ALTER TABLE attendu_reception 
ADD CONSTRAINT attendu_reception_client_id_fkey 
FOREIGN KEY (client_id) REFERENCES client(id) ON DELETE SET NULL;

ALTER TABLE retour_produit DROP CONSTRAINT IF EXISTS retour_produit_client_id_fkey;
ALTER TABLE retour_produit 
ADD CONSTRAINT retour_produit_client_id_fkey 
FOREIGN KEY (client_id) REFERENCES client(id) ON DELETE SET NULL;

-- Étape 5 : Maintenant associer toutes les données orphelines à HEATZY
UPDATE commande 
SET client_id = '3447887c-b7a5-40b7-b215-780e65d652a1'
WHERE client_id IS NULL;

UPDATE produit 
SET client_id = '3447887c-b7a5-40b7-b215-780e65d652a1'
WHERE client_id IS NULL;

UPDATE attendu_reception 
SET client_id = '3447887c-b7a5-40b7-b215-780e65d652a1'
WHERE client_id IS NULL;

-- Étape 6 : Policy pour admins/gestionnaires voir toutes les commandes
DROP POLICY IF EXISTS "Admin view all orders bypass client_id" ON commande;

CREATE POLICY "Admin view all orders bypass client_id"
ON commande FOR SELECT
TO authenticated
USING (
  has_role(auth.uid(), 'admin'::app_role) OR
  has_role(auth.uid(), 'gestionnaire'::app_role)
);

-- Étape 7 : Trigger pour inférer automatiquement le client_id sur les commandes
CREATE OR REPLACE FUNCTION infer_commande_client_id()
RETURNS TRIGGER AS $$
BEGIN
  IF NEW.client_id IS NULL THEN
    NEW.client_id := (
      SELECT DISTINCT p.client_id
      FROM ligne_commande lc
      JOIN produit p ON p.id = lc.produit_id
      WHERE lc.commande_id = NEW.id
      LIMIT 1
    );
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public;

DROP TRIGGER IF EXISTS trigger_infer_commande_client ON commande;

CREATE TRIGGER trigger_infer_commande_client
BEFORE INSERT OR UPDATE ON commande
FOR EACH ROW EXECUTE FUNCTION infer_commande_client_id();