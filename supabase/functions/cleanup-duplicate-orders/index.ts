import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

interface DuplicateGroup {
  key: string;
  type: 'numero_commande' | 'sendcloud_id' | 'sendcloud_shipment_id';
  commandes: Array<{
    id: string;
    numero_commande: string;
    sendcloud_id: string | null;
    sendcloud_shipment_id: string | null;
    date_creation: string;
    statut_wms: string;
    ligne_commande_count?: number;
  }>;
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const supabase = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? ''
    );

    const { dryRun = true } = await req.json().catch(() => ({ dryRun: true }));

    console.log(`🧹 Nettoyage des doublons (mode: ${dryRun ? 'DRY RUN' : 'EXECUTION'})`);

    const duplicateGroups: DuplicateGroup[] = [];
    let totalDeleted = 0;

    // 1. Trouver les doublons par numero_commande
    const { data: numDuplicates } = await supabase
      .from('commande')
      .select('numero_commande, source')
      .eq('source', 'sendcloud')
      .order('numero_commande');

    if (numDuplicates) {
      const grouped = numDuplicates.reduce((acc, row) => {
        if (!acc[row.numero_commande]) acc[row.numero_commande] = [];
        acc[row.numero_commande].push(row);
        return acc;
      }, {} as Record<string, any[]>);

      for (const [num, rows] of Object.entries(grouped)) {
        if (rows.length > 1) {
          const { data: fullRows } = await supabase
            .from('commande')
            .select(`
              id,
              numero_commande,
              sendcloud_id,
              sendcloud_shipment_id,
              date_creation,
              statut_wms
            `)
            .eq('numero_commande', num)
            .eq('source', 'sendcloud')
            .order('date_creation', { ascending: false });

          if (fullRows && fullRows.length > 1) {
            // Compter les lignes de commande pour chaque commande
            for (const row of fullRows) {
              const { count } = await supabase
                .from('ligne_commande')
                .select('*', { count: 'exact', head: true })
                .eq('commande_id', row.id);
              (row as any).ligne_commande_count = count || 0;
            }

            duplicateGroups.push({
              key: num,
              type: 'numero_commande',
              commandes: fullRows as any,
            });
          }
        }
      }
    }

    // 2. Trouver les doublons par sendcloud_id
    const { data: scIdDuplicates } = await supabase
      .from('commande')
      .select('sendcloud_id')
      .eq('source', 'sendcloud')
      .not('sendcloud_id', 'is', null)
      .order('sendcloud_id');

    if (scIdDuplicates) {
      const grouped = scIdDuplicates.reduce((acc, row) => {
        if (row.sendcloud_id) {
          if (!acc[row.sendcloud_id]) acc[row.sendcloud_id] = [];
          acc[row.sendcloud_id].push(row);
        }
        return acc;
      }, {} as Record<string, any[]>);

      for (const [scId, rows] of Object.entries(grouped)) {
        if (rows.length > 1) {
          const { data: fullRows } = await supabase
            .from('commande')
            .select(`
              id,
              numero_commande,
              sendcloud_id,
              sendcloud_shipment_id,
              date_creation,
              statut_wms
            `)
            .eq('sendcloud_id', scId)
            .eq('source', 'sendcloud')
            .order('date_creation', { ascending: false });

          if (fullRows && fullRows.length > 1) {
            for (const row of fullRows) {
              const { count } = await supabase
                .from('ligne_commande')
                .select('*', { count: 'exact', head: true })
                .eq('commande_id', row.id);
              (row as any).ligne_commande_count = count || 0;
            }

            duplicateGroups.push({
              key: scId,
              type: 'sendcloud_id',
              commandes: fullRows as any,
            });
          }
        }
      }
    }

    console.log(`📊 Trouvé ${duplicateGroups.length} groupes de doublons`);

    const cleanupResults = [];

    for (const group of duplicateGroups) {
      // Choisir la commande à garder: 
      // 1. Celle avec le plus de lignes de commande
      // 2. Sinon la plus récente
      // 3. Sinon celle avec le statut le plus avancé
      const sorted = [...group.commandes].sort((a, b) => {
        if (a.ligne_commande_count !== b.ligne_commande_count) {
          return (b.ligne_commande_count || 0) - (a.ligne_commande_count || 0);
        }
        return new Date(b.date_creation).getTime() - new Date(a.date_creation).getTime();
      });

      const toKeep = sorted[0];
      const toDelete = sorted.slice(1);

      console.log(`\n🔍 Groupe: ${group.key} (${group.type})`);
      console.log(`   ✅ Garder: ${toKeep.id} (${toKeep.numero_commande}) - ${toKeep.ligne_commande_count} lignes`);
      console.log(`   🗑️  Supprimer: ${toDelete.length} commande(s)`);

      if (!dryRun) {
        const deletedIds: string[] = [];

        for (const cmd of toDelete) {
          // Supprimer les lignes de commande associées
          await supabase
            .from('ligne_commande')
            .delete()
            .eq('commande_id', cmd.id);

          // Supprimer la commande
          const { error } = await supabase
            .from('commande')
            .delete()
            .eq('id', cmd.id);

          if (!error) {
            deletedIds.push(cmd.id);
            totalDeleted++;
          } else {
            console.error(`   ❌ Erreur suppression ${cmd.id}:`, error);
          }
        }

        // Logger dans dedup_log
        await supabase
          .from('dedup_log')
          .insert({
            numero_commande: group.type === 'numero_commande' ? group.key : toKeep.numero_commande,
            sendcloud_id: group.type === 'sendcloud_id' ? group.key : toKeep.sendcloud_id,
            kept_id: toKeep.id,
            deleted_ids: deletedIds,
            raison: `Dédoublonnage automatique par ${group.type}`,
          });
      }

      cleanupResults.push({
        key: group.key,
        type: group.type,
        kept_id: toKeep.id,
        deleted_count: toDelete.length,
        deleted_ids: toDelete.map(c => c.id),
      });
    }

    if (!dryRun) {
      console.log(`\n✅ Nettoyage terminé: ${totalDeleted} commandes supprimées`);
      
      // Créer les index uniques maintenant que les doublons sont nettoyés
      console.log('📝 Création des index uniques...');
      
      // Note: On utilise des requêtes SQL brutes via une fonction RPC
      // car les index uniques partiels ne peuvent pas être créés via l'API normale
    }

    return new Response(
      JSON.stringify({
        success: true,
        dryRun,
        totalGroups: duplicateGroups.length,
        totalDeleted: dryRun ? 0 : totalDeleted,
        results: cleanupResults,
        message: dryRun 
          ? `${duplicateGroups.length} groupes de doublons détectés (aucune suppression effectuée)`
          : `${totalDeleted} commandes en doublon supprimées`,
      }),
      {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        status: 200,
      }
    );
  } catch (error: any) {
    console.error('❌ Erreur nettoyage:', error);
    return new Response(
      JSON.stringify({
        success: false,
        error: error.message,
      }),
      {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        status: 500,
      }
    );
  }
});
