/**
 * Edge Function pour appliquer les migrations Supabase automatiquement
 *
 * Usage: POST https://[project].supabase.co/functions/v1/apply-migrations
 * Body: { "migration": "20251117000006" }
 * Headers: Authorization: Bearer [anon_key]
 */

import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.58.0';

// Définition des migrations disponibles
const MIGRATIONS: Record<string, string> = {
  '20251117000006': `
-- =====================================================
-- HOTFIX: Fix RLS policies pour client_id NULL
-- =====================================================

-- Drop anciennes policies
DROP POLICY IF EXISTS "Admin full access on commande" ON public.commande;
DROP POLICY IF EXISTS "Gestionnaire full access on commande" ON public.commande;
DROP POLICY IF EXISTS "Operateur read own commande" ON public.commande;
DROP POLICY IF EXISTS "Client read own commande" ON public.commande;

-- POLICY ADMIN: Accès complet
CREATE POLICY "Admin full access on commande"
  ON public.commande FOR ALL TO authenticated
  USING (
    has_role(auth.uid(), 'admin'::app_role)
  )
  WITH CHECK (
    has_role(auth.uid(), 'admin'::app_role)
  );

-- POLICY GESTIONNAIRE: Accès complet
CREATE POLICY "Gestionnaire full access on commande"
  ON public.commande FOR ALL TO authenticated
  USING (
    has_role(auth.uid(), 'gestionnaire'::app_role)
  )
  WITH CHECK (
    has_role(auth.uid(), 'gestionnaire'::app_role)
  );

-- POLICY OPERATEUR: Lecture seule
CREATE POLICY "Operateur read own commande"
  ON public.commande FOR SELECT TO authenticated
  USING (
    has_role(auth.uid(), 'operateur'::app_role)
  );

-- POLICY CLIENT: Lecture des commandes avec gestion NULL-safe
CREATE POLICY "Client read own commande"
  ON public.commande FOR SELECT TO authenticated
  USING (
    has_role(auth.uid(), 'client'::app_role)
    AND (
      -- Cas 1: Commande avec client_id correspondant
      (client_id IS NOT NULL AND client_id IN (
        SELECT client_id FROM public.profiles WHERE id = auth.uid()
      ))
      -- Cas 2: User sans client_id peut voir commandes sans client_id
      OR (
        client_id IS NULL
        AND NOT EXISTS (SELECT 1 FROM public.profiles WHERE id = auth.uid() AND client_id IS NOT NULL)
      )
    )
  );

-- POLICY SERVICE ROLE: Accès complet pour Edge Functions
CREATE POLICY "Service role full access on commande"
  ON public.commande FOR ALL TO service_role
  USING (true)
  WITH CHECK (true);

-- =====================================================
-- MÊME LOGIQUE POUR ligne_commande
-- =====================================================

DROP POLICY IF EXISTS "Admin full access on ligne_commande" ON public.ligne_commande;
DROP POLICY IF EXISTS "Gestionnaire full access on ligne_commande" ON public.ligne_commande;
DROP POLICY IF EXISTS "Operateur read ligne_commande" ON public.ligne_commande;
DROP POLICY IF EXISTS "Client read own ligne_commande" ON public.ligne_commande;

CREATE POLICY "Admin full access on ligne_commande"
  ON public.ligne_commande FOR ALL TO authenticated
  USING (
    has_role(auth.uid(), 'admin'::app_role)
  )
  WITH CHECK (
    has_role(auth.uid(), 'admin'::app_role)
  );

CREATE POLICY "Gestionnaire full access on ligne_commande"
  ON public.ligne_commande FOR ALL TO authenticated
  USING (
    has_role(auth.uid(), 'gestionnaire'::app_role)
  )
  WITH CHECK (
    has_role(auth.uid(), 'gestionnaire'::app_role)
  );

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

-- =====================================================
-- Indexes pour performance des sous-requêtes RLS
-- =====================================================

CREATE INDEX IF NOT EXISTS idx_profiles_client_id_lookup ON public.profiles(id, client_id);
CREATE INDEX IF NOT EXISTS idx_commande_client_id_lookup ON public.commande(client_id, id);
CREATE INDEX IF NOT EXISTS idx_ligne_commande_commande_id_lookup ON public.ligne_commande(commande_id);

-- Notification
DO $$
BEGIN
  RAISE NOTICE '======================================';
  RAISE NOTICE '   HOTFIX RLS POLICIES APPLIQUÉ';
  RAISE NOTICE '======================================';
  RAISE NOTICE 'Policies créées sur commande: 5';
  RAISE NOTICE 'Policies créées sur ligne_commande: 5';
  RAISE NOTICE 'Indexes créés: 3';
  RAISE NOTICE '======================================';
END $$;
`,

  '20251117000005': `
-- =====================================================
-- HOTFIX: Ajout statuts manquants dans CHECK constraint
-- =====================================================

ALTER TABLE public.commande DROP CONSTRAINT IF EXISTS commande_statut_wms_check;

ALTER TABLE public.commande ADD CONSTRAINT commande_statut_wms_check
  CHECK (statut_wms IN (
    -- Anciens statuts (legacy)
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
    -- NOUVEAUX statuts (automation)
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

-- Notification
DO $$
BEGIN
  RAISE NOTICE '======================================';
  RAISE NOTICE '   HOTFIX STATUTS APPLIQUÉ';
  RAISE NOTICE '======================================';
  RAISE NOTICE 'Statuts ajoutés: 9';
  RAISE NOTICE '======================================';
END $$;
`
};

Deno.serve(async (req) => {
  try {
    // Parse request
    const { migration } = await req.json();

    if (!migration) {
      return new Response(
        JSON.stringify({
          error: 'Migration number required',
          available: Object.keys(MIGRATIONS)
        }),
        { status: 400, headers: { 'Content-Type': 'application/json' } }
      );
    }

    // Vérifier que la migration existe
    const sql = MIGRATIONS[migration];
    if (!sql) {
      return new Response(
        JSON.stringify({
          error: `Migration ${migration} not found`,
          available: Object.keys(MIGRATIONS)
        }),
        { status: 404, headers: { 'Content-Type': 'application/json' } }
      );
    }

    // Créer client Supabase avec service_role
    const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
    const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;

    const supabase = createClient(supabaseUrl, supabaseServiceKey, {
      auth: {
        autoRefreshToken: false,
        persistSession: false
      }
    });

    console.log(`🔄 Applying migration ${migration}...`);

    // Diviser le SQL en statements individuels
    const statements = sql
      .split(';')
      .map(s => s.trim())
      .filter(s => s.length > 0 && !s.startsWith('--') && !s.match(/^DO \$\$/));

    const results = [];
    let successCount = 0;
    let errorCount = 0;

    for (const statement of statements) {
      if (statement.length === 0) continue;

      try {
        // Exécuter via raw SQL
        const { data, error } = await supabase.rpc('exec', {
          sql: statement + ';'
        });

        if (error) {
          console.error(`❌ Error: ${error.message}`);
          errorCount++;
          results.push({
            statement: statement.substring(0, 100) + '...',
            error: error.message
          });
        } else {
          successCount++;
          results.push({
            statement: statement.substring(0, 100) + '...',
            success: true
          });
        }
      } catch (err) {
        console.error(`❌ Exception: ${err.message}`);
        errorCount++;
        results.push({
          statement: statement.substring(0, 100) + '...',
          error: err.message
        });
      }
    }

    const responseData = {
      migration,
      success: errorCount === 0,
      statements_executed: successCount,
      statements_failed: errorCount,
      results: results.slice(0, 10), // Limite à 10 pour éviter trop de données
      message: errorCount === 0
        ? `✅ Migration ${migration} applied successfully!`
        : `⚠️ Migration ${migration} partially applied: ${successCount} success, ${errorCount} errors`
    };

    console.log(responseData.message);

    return new Response(
      JSON.stringify(responseData),
      {
        status: errorCount === 0 ? 200 : 207,
        headers: { 'Content-Type': 'application/json' }
      }
    );

  } catch (error) {
    console.error('❌ Fatal error:', error);

    return new Response(
      JSON.stringify({
        error: error.message,
        stack: error.stack
      }),
      { status: 500, headers: { 'Content-Type': 'application/json' } }
    );
  }
});
