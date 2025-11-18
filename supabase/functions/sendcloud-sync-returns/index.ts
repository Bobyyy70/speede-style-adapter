// ============================================================
// SendCloud Sync Returns - Synchronisation bidirectionnelle des retours
// ============================================================
// Cette fonction synchronise les retours entre SendCloud et le WMS:
// - SendCloud → WMS: Import des retours créés dans SendCloud
// - Met à jour les statuts des retours existants
// - Crée automatiquement les mouvements de stock pour réintégration
// ============================================================

import { createClient } from 'npm:@supabase/supabase-js@2';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

interface SendCloudReturn {
  id: number;
  parcel: {
    id: number;
    order_number?: string;
    tracking_number?: string;
  };
  tracking_number?: string;
  tracking_url?: string;
  status?: {
    id: number;
    message: string;
  };
  return_address?: {
    name?: string;
    company_name?: string;
    address?: string;
    city?: string;
    postal_code?: string;
    country?: string;
  };
  created_at?: string;
  updated_at?: string;
  reason?: string;
  comment?: string;
}

// Mapping SendCloud return status → WMS
function mapSendcloudReturnStatusToWMS(statusId: number): string {
  const statusMap: Record<number, string> = {
    1: 'cree',              // Return created
    2: 'en_transit',        // Return in transit
    3: 'recu',              // Return received
    4: 'traite',            // Return processed
    5: 'rembourse',         // Refunded
    6: 'refuse',            // Return refused
    99: 'annule',           // Cancelled
  };
  return statusMap[statusId] || 'cree';
}

Deno.serve(async (req) => {
  console.log('[SendCloud Sync Returns] Function started');

  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  const startTime = Date.now();

  try {
    const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
    const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
    const publicKey = Deno.env.get('SENDCLOUD_API_PUBLIC_KEY');
    const secretKey = Deno.env.get('SENDCLOUD_API_SECRET_KEY');

    if (!publicKey || !secretKey) {
      throw new Error('SENDCLOUD_API_PUBLIC_KEY ou SENDCLOUD_API_SECRET_KEY manquant');
    }

    const supabase = createClient(supabaseUrl, supabaseServiceKey);
    const authHeader = 'Basic ' + btoa(`${publicKey}:${secretKey}`);

    // Paramètres de synchronisation
    const body = req.method === 'POST' ? await req.json().catch(() => ({})) : {};
    const mode = body.mode || 'incremental';
    const customStartDate = body.startDate;

    // Calculer la fenêtre temporelle
    let dateMin: string;
    if (mode === 'full') {
      const d = new Date(Date.now() - 90 * 24 * 60 * 60 * 1000); // 90 jours
      dateMin = d.toISOString();
      console.log(`[Full] 90 days: ${dateMin}`);
    } else if (customStartDate) {
      dateMin = new Date(customStartDate).toISOString();
      console.log(`[Custom] from: ${dateMin}`);
    } else {
      const d = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000); // 7 jours par défaut
      dateMin = d.toISOString();
      console.log(`[Incremental] 7 days: ${dateMin}`);
    }

    // ============================================================
    // ÉTAPE 1: Récupérer les retours depuis SendCloud
    // ============================================================
    console.log('=== Fetching returns from SendCloud ===');

    const allReturns: SendCloudReturn[] = [];
    let page = 1;
    const perPage = 100;
    const maxPages = 10; // Limiter pour éviter timeout

    while (page <= maxPages) {
      const url = `https://panel.sendcloud.sc/api/v2/returns?updated_at_min=${dateMin}&page=${page}&per_page=${perPage}`;
      console.log(`[Returns] Page ${page}...`);

      const response = await fetch(url, {
        method: 'GET',
        headers: {
          'Authorization': authHeader,
          'Accept': 'application/json'
        }
      });

      if (!response.ok) {
        const errorText = await response.text();
        console.error(`[Returns] API error ${response.status}:`, errorText);
        break;
      }

      const data = await response.json();
      const returns = data.returns || [];
      console.log(`[Returns] Page ${page}: ${returns.length} returns`);

      if (returns.length === 0) break;

      allReturns.push(...returns);

      if (returns.length < perPage) break;
      page++;
    }

    console.log(`✓ ${allReturns.length} returns found`);

    if (allReturns.length === 0) {
      return new Response(
        JSON.stringify({
          success: true,
          message: 'Aucun retour trouvé pour la période spécifiée',
          found: 0,
          created: 0,
          updated: 0,
          mode
        }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // ============================================================
    // ÉTAPE 2: Traiter chaque retour
    // ============================================================
    let created = 0;
    let updated = 0;
    let errors = 0;

    for (const scReturn of allReturns) {
      try {
        console.log(`[Return ${scReturn.id}] Processing...`);

        // Trouver la commande associée
        const orderNumber = scReturn.parcel.order_number;
        const trackingNumber = scReturn.parcel.tracking_number;

        if (!orderNumber && !trackingNumber) {
          console.warn(`[Return ${scReturn.id}] No order reference, skipping`);
          errors++;
          continue;
        }

        // Chercher la commande dans le WMS
        let query = supabase
          .from('commande')
          .select('id, numero_commande, client_id, statut_wms');

        if (orderNumber) {
          query = query.eq('numero_commande', orderNumber);
        } else if (trackingNumber) {
          query = query.eq('tracking_number', trackingNumber);
        }

        const { data: commande } = await query.maybeSingle();

        if (!commande) {
          console.warn(`[Return ${scReturn.id}] Order not found (${orderNumber || trackingNumber})`);
          errors++;
          continue;
        }

        console.log(`[Return ${scReturn.id}] Found order: ${commande.numero_commande}`);

        // Vérifier si le retour existe déjà
        const { data: existingReturn } = await supabase
          .from('retour_produit')
          .select('id')
          .eq('sendcloud_return_id', scReturn.id.toString())
          .maybeSingle();

        const wmsStatus = mapSendcloudReturnStatusToWMS(scReturn.status?.id || 1);

        if (existingReturn) {
          // Mettre à jour le retour existant
          const { error: updateError } = await supabase
            .from('retour_produit')
            .update({
              statut: wmsStatus,
              tracking_number: scReturn.tracking_number,
              tracking_url: scReturn.tracking_url,
              raison_retour: scReturn.reason || 'Retour client',
              commentaire: scReturn.comment,
              date_modification: new Date().toISOString()
            })
            .eq('id', existingReturn.id);

          if (updateError) {
            console.error(`[Return ${scReturn.id}] Update error:`, updateError);
            errors++;
            continue;
          }

          console.log(`[Return ${scReturn.id}] ✓ Updated`);
          updated++;

          // Si le retour est reçu, créer un mouvement de stock
          if (wmsStatus === 'recu' || wmsStatus === 'traite') {
            await createStockMovementForReturn(supabase, existingReturn.id, commande.id);
          }
        } else {
          // Créer un nouveau retour
          const { data: newReturn, error: insertError } = await supabase
            .from('retour_produit')
            .insert({
              commande_id: commande.id,
              client_id: commande.client_id,
              numero_retour: `RET-${scReturn.id}`,
              sendcloud_return_id: scReturn.id.toString(),
              sendcloud_parcel_id: scReturn.parcel.id.toString(),
              tracking_number: scReturn.tracking_number,
              tracking_url: scReturn.tracking_url,
              statut: wmsStatus,
              raison_retour: scReturn.reason || 'Retour client',
              commentaire: scReturn.comment,
              date_creation: scReturn.created_at || new Date().toISOString(),
              source: 'sendcloud'
            })
            .select('id')
            .single();

          if (insertError) {
            console.error(`[Return ${scReturn.id}] Insert error:`, insertError);
            errors++;
            continue;
          }

          console.log(`[Return ${scReturn.id}] ✓ Created: ${newReturn.id}`);
          created++;

          // Créer les lignes de retour depuis les lignes de commande
          const { data: lignesCommande } = await supabase
            .from('ligne_commande')
            .select('*')
            .eq('commande_id', commande.id);

          if (lignesCommande) {
            for (const ligne of lignesCommande) {
              await supabase.from('ligne_retour').insert({
                retour_id: newReturn.id,
                produit_id: ligne.produit_id,
                produit_reference: ligne.produit_reference,
                produit_nom: ligne.produit_nom,
                quantite_retournee: ligne.quantite_commandee, // Par défaut, tout est retourné
                raison: scReturn.reason || 'Retour client'
              });
            }
          }

          // Si le retour est reçu, créer un mouvement de stock
          if (wmsStatus === 'recu' || wmsStatus === 'traite') {
            await createStockMovementForReturn(supabase, newReturn.id, commande.id);
          }
        }

        // Mettre à jour le statut de la commande si nécessaire
        if (commande.statut_wms !== 'retour') {
          await supabase
            .from('commande')
            .update({ statut_wms: 'retour' })
            .eq('id', commande.id);
        }

      } catch (error: any) {
        console.error(`[Return ${scReturn.id}] Processing error:`, error.message);
        errors++;
      }
    }

    const duration = Date.now() - startTime;
    console.log(`✓ Sync completed in ${duration}ms: ${created} created, ${updated} updated, ${errors} errors`);

    // Log de synchronisation
    await supabase.from('sendcloud_sync_log').insert({
      statut: errors > 0 ? 'partial' : 'success',
      mode_sync: mode,
      nb_commandes_trouvees: allReturns.length,
      nb_commandes_creees: created,
      nb_commandes_existantes: updated,
      nb_erreurs: errors,
      date_sync: new Date().toISOString(),
      duree_ms: duration,
      details: {
        type: 'returns',
        date_min: dateMin,
        pages_fetched: page - 1
      }
    });

    return new Response(
      JSON.stringify({
        success: true,
        message: `Sync returns completed: ${created} created, ${updated} updated, ${errors} errors`,
        found: allReturns.length,
        created,
        updated,
        errors,
        mode,
        duration_ms: duration
      }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );

  } catch (error) {
    const duration = Date.now() - startTime;
    const errorMessage = error instanceof Error ? error.message : String(error);
    console.error('[SendCloud Sync Returns] Fatal error:', errorMessage);

    return new Response(
      JSON.stringify({ success: false, error: errorMessage }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});

// ============================================================
// FONCTION AUXILIAIRE: Créer mouvement de stock pour retour
// ============================================================
async function createStockMovementForReturn(
  supabase: any,
  retourId: string,
  commandeId: string
): Promise<void> {
  console.log(`[Stock] Creating stock movements for return ${retourId}`);

  // Récupérer les lignes de retour
  const { data: lignesRetour } = await supabase
    .from('ligne_retour')
    .select('*, produit:produit_id(nom)')
    .eq('retour_id', retourId);

  if (!lignesRetour || lignesRetour.length === 0) {
    console.warn(`[Stock] No return lines found for return ${retourId}`);
    return;
  }

  // Créer un mouvement d'entrée pour chaque ligne
  for (const ligne of lignesRetour) {
    // Vérifier si le mouvement existe déjà
    const { data: existingMouvement } = await supabase
      .from('mouvement_stock')
      .select('id')
      .eq('retour_id', retourId)
      .eq('produit_id', ligne.produit_id)
      .maybeSingle();

    if (existingMouvement) {
      console.log(`[Stock] Movement already exists for product ${ligne.produit_reference}`);
      continue;
    }

    // Créer le mouvement d'entrée
    const { error } = await supabase.from('mouvement_stock').insert({
      produit_id: ligne.produit_id,
      type_mouvement: 'entree',
      quantite: ligne.quantite_retournee, // Positif pour entrée
      statut_mouvement: 'stock_physique', // Retour physique
      retour_id: retourId,
      commande_id: commandeId,
      reference_externe: `RETOUR-${retourId}`,
      raison: `Réintégration retour produit: ${ligne.produit_nom || ligne.produit_reference}`,
      utilisateur_id: null // Automatique depuis SendCloud
    });

    if (error) {
      console.error(`[Stock] Error creating movement for ${ligne.produit_reference}:`, error);
    } else {
      console.log(`[Stock] ✓ Movement created: +${ligne.quantite_retournee} ${ligne.produit_reference}`);
    }
  }
}
