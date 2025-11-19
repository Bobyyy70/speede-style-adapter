# PROMPT POUR LOVABLE

Copie/colle exactement ce texte dans Lovable:

---

Applique ce SQL dans la base de données Supabase:

```sql
-- HOTFIX 005: Ajout statuts manquants
ALTER TABLE public.commande DROP CONSTRAINT IF EXISTS commande_statut_wms_check;

ALTER TABLE public.commande ADD CONSTRAINT commande_statut_wms_check
  CHECK (statut_wms IN (
    'En attente de réappro',
    'Prêt à préparer',
    'Réservé',
    'En préparation',
    'En attente d''expédition',
    'Expédié',
    'Livré',
    'Annulée',
    'prete',
    'expediee',
    'stock_reserve',
    'en_picking',
    'pret_expedition',
    'etiquette_generee',
    'expedie',
    'livre',
    'retour',
    'erreur',
    'annule'
  ));

-- HOTFIX 006: Fix RLS policies NULL-safe
DROP POLICY IF EXISTS "Admin full access on commande" ON public.commande;
DROP POLICY IF EXISTS "Gestionnaire full access on commande" ON public.commande;
DROP POLICY IF EXISTS "Operateur read own commande" ON public.commande;
DROP POLICY IF EXISTS "Client read own commande" ON public.commande;
DROP POLICY IF EXISTS "Service role full access on commande" ON public.commande;

CREATE POLICY "Admin full access on commande"
  ON public.commande FOR ALL TO authenticated
  USING (has_role(auth.uid(), 'admin'::app_role))
  WITH CHECK (has_role(auth.uid(), 'admin'::app_role));

CREATE POLICY "Gestionnaire full access on commande"
  ON public.commande FOR ALL TO authenticated
  USING (has_role(auth.uid(), 'gestionnaire'::app_role))
  WITH CHECK (has_role(auth.uid(), 'gestionnaire'::app_role));

CREATE POLICY "Operateur read own commande"
  ON public.commande FOR SELECT TO authenticated
  USING (has_role(auth.uid(), 'operateur'::app_role));

CREATE POLICY "Client read own commande"
  ON public.commande FOR SELECT TO authenticated
  USING (
    has_role(auth.uid(), 'client'::app_role)
    AND (
      (client_id IS NOT NULL AND client_id IN (
        SELECT client_id FROM public.profiles WHERE id = auth.uid()
      ))
      OR (
        client_id IS NULL
        AND NOT EXISTS (SELECT 1 FROM public.profiles WHERE id = auth.uid() AND client_id IS NOT NULL)
      )
    )
  );

CREATE POLICY "Service role full access on commande"
  ON public.commande FOR ALL TO service_role
  USING (true)
  WITH CHECK (true);

DROP POLICY IF EXISTS "Admin full access on ligne_commande" ON public.ligne_commande;
DROP POLICY IF EXISTS "Gestionnaire full access on ligne_commande" ON public.ligne_commande;
DROP POLICY IF EXISTS "Operateur read ligne_commande" ON public.ligne_commande;
DROP POLICY IF EXISTS "Client read own ligne_commande" ON public.ligne_commande;
DROP POLICY IF EXISTS "Service role full access on ligne_commande" ON public.ligne_commande;

CREATE POLICY "Admin full access on ligne_commande"
  ON public.ligne_commande FOR ALL TO authenticated
  USING (has_role(auth.uid(), 'admin'::app_role))
  WITH CHECK (has_role(auth.uid(), 'admin'::app_role));

CREATE POLICY "Gestionnaire full access on ligne_commande"
  ON public.ligne_commande FOR ALL TO authenticated
  USING (has_role(auth.uid(), 'gestionnaire'::app_role))
  WITH CHECK (has_role(auth.uid(), 'gestionnaire'::app_role));

CREATE POLICY "Operateur read ligne_commande"
  ON public.ligne_commande FOR SELECT TO authenticated
  USING (
    has_role(auth.uid(), 'operateur'::app_role)
    AND commande_id IN (SELECT id FROM public.commande)
  );

CREATE POLICY "Client read own ligne_commande"
  ON public.ligne_commande FOR SELECT TO authenticated
  USING (
    has_role(auth.uid(), 'client'::app_role)
    AND commande_id IN (
      SELECT id FROM public.commande
      WHERE (
        (client_id IS NOT NULL AND client_id IN (
          SELECT client_id FROM public.profiles WHERE id = auth.uid()
        ))
        OR (
          client_id IS NULL
          AND NOT EXISTS (SELECT 1 FROM public.profiles WHERE id = auth.uid() AND client_id IS NOT NULL)
        )
      )
    )
  );

CREATE POLICY "Service role full access on ligne_commande"
  ON public.ligne_commande FOR ALL TO service_role
  USING (true)
  WITH CHECK (true);

CREATE INDEX IF NOT EXISTS idx_profiles_client_id_lookup ON public.profiles(id, client_id);
CREATE INDEX IF NOT EXISTS idx_commande_client_id_lookup ON public.commande(client_id, id);
CREATE INDEX IF NOT EXISTS idx_ligne_commande_commande_id_lookup ON public.ligne_commande(commande_id);
```

---

Ce SQL corrige:
1. Les statuts manquants qui bloquaient la création des commandes
2. Les RLS policies qui empêchaient la récupération des commandes quand client_id est NULL
3. Ajoute des indexes pour la performance
