import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

interface SendCloudProduct {
  sku: string;
  name: string;
  quantity: number;
  ean?: string;
  unit_price?: { value: number; currency: string };
  total_price?: { value: number; currency: string };
  measurement?: { weight?: { value: number; unit: string } };
}

interface SendCloudOrder {
  id: string | number;
  order_number?: string;
  order_id?: string;
  name?: string;
  email?: string;
  telephone?: string;
  address?: string;
  address_2?: string;
  city?: string;
  postal_code?: string;
  country?: any;
  shipping_address?: {
    name?: string;
    address?: string;
    address_2?: string;
    city?: string;
    postal_code?: string;
    country?: any;
  };
  order_products: SendCloudProduct[];
  total_order_value?: number;
  currency?: string;
}

function normalizeCountry(country: any): string {
  if (!country) return 'FR';
  
  if (typeof country === 'string') {
    const trimmed = country.trim().toUpperCase();
    if (trimmed.length === 2) return trimmed;
    
    const countryMap: Record<string, string> = {
      'FRANCE': 'FR', 'BELGIUM': 'BE', 'BELGIQUE': 'BE',
      'GERMANY': 'DE', 'ALLEMAGNE': 'DE', 'SPAIN': 'ES', 
      'ESPAGNE': 'ES', 'ITALY': 'IT', 'ITALIE': 'IT',
      'NETHERLANDS': 'NL', 'PAYS-BAS': 'NL', 'UK': 'GB',
      'UNITED KINGDOM': 'GB', 'ROYAUME-UNI': 'GB'
    };
    
    return countryMap[trimmed] || 'FR';
  }
  
  if (typeof country === 'object' && country !== null && 'iso_2' in country) {
    const code = (country as any).iso_2;
    if (typeof code === 'string') {
      return code.trim().toUpperCase();
    }
  }
  
  return 'FR';
}

function buildCommandeData(
  sendcloudData: SendCloudOrder, 
  expediteurDefault: any,
  orderNumber: string,
  sendcloudId: string,
  status: string
): any {
  const shippingAddr = sendcloudData.shipping_address;
  const clientName = shippingAddr?.name || sendcloudData.name || 'Client inconnu';
  const paysCode = normalizeCountry(shippingAddr?.country || sendcloudData.country);
  const priorite = (sendcloudData as any).shipment?.method === 'express' ? 'express' : 'standard';
  const incoterm = paysCode === 'FR' ? 'DDP' : 'DAP';

  let statutInitial = 'en_attente_validation';
  if (status === 'cancelled') {
    statutInitial = 'annule';
  }

  return {
    sendcloud_id: sendcloudId,
    numero_commande: orderNumber,
    nom_client: clientName,
    email_client: sendcloudData.email || null,
    telephone_client: sendcloudData.telephone || null,
    adresse_nom: clientName,
    adresse_ligne_1: shippingAddr?.address || sendcloudData.address || '',
    adresse_ligne_2: shippingAddr?.address_2 || sendcloudData.address_2 || null,
    ville: shippingAddr?.city || sendcloudData.city || '',
    code_postal: shippingAddr?.postal_code || sendcloudData.postal_code || '',
    pays_code: paysCode,
    transporteur: (sendcloudData as any).carrier?.name || null,
    methode_expedition: (sendcloudData as any).shipping_method?.name || null,
    tracking_number: (sendcloudData as any).tracking_number || null,
    tracking_url: (sendcloudData as any).tracking_url || null,
    label_url: (sendcloudData as any).label_url || null,
    sendcloud_shipment_id: sendcloudId,
    poids_reel_kg: (sendcloudData as any).weight ? parseFloat(String((sendcloudData as any).weight)) : null,
    expediteur_nom: (sendcloudData as any).sender_address?.name || expediteurDefault?.nom || null,
    expediteur_entreprise: (sendcloudData as any).sender_address?.company_name || expediteurDefault?.entreprise || null,
    expediteur_email: (sendcloudData as any).sender_address?.email || expediteurDefault?.email || null,
    expediteur_telephone: (sendcloudData as any).sender_address?.telephone || expediteurDefault?.telephone || null,
    expediteur_adresse_ligne_1: (sendcloudData as any).sender_address?.address || expediteurDefault?.adresse_ligne_1 || null,
    expediteur_adresse_ligne_2: (sendcloudData as any).sender_address?.address_2 || expediteurDefault?.adresse_ligne_2 || null,
    expediteur_code_postal: (sendcloudData as any).sender_address?.postal_code || expediteurDefault?.code_postal || null,
    expediteur_ville: (sendcloudData as any).sender_address?.city || expediteurDefault?.ville || null,
    expediteur_pays_code: (sendcloudData as any).sender_address?.country || expediteurDefault?.pays_code || 'FR',
    valeur_totale: sendcloudData.total_order_value || 0,
    devise: sendcloudData.currency || 'EUR',
    statut_wms: statutInitial,
    source: 'sendcloud',
    incoterm: incoterm,
    priorite_expedition: priorite,
    date_expedition_demandee: new Date(Date.now() + 24*60*60*1000).toISOString().split('T')[0],
    pays_origine_marchandise: (sendcloudData as any).sender_address?.country || expediteurDefault?.pays_code || 'FR',
    remarques: status === 'cancelled' ? 'Commande annulée sur SendCloud' : null
  };
}

async function archiveCommandeLines(supabase: any, commandeId: string): Promise<void> {
  const { data: lines } = await supabase
    .from('ligne_commande')
    .select('*')
    .eq('commande_id', commandeId);
  
  if (lines && lines.length > 0) {
    const archiveData = lines.map((line: any) => ({
      commande_id: line.commande_id,
      produit_reference: line.produit_reference,
      quantite: line.quantite,
      prix_unitaire: line.prix_unitaire,
      archived_at: new Date().toISOString(),
      original_line_data: line
    }));
    
    await supabase
      .from('ligne_commande_historique')
      .insert(archiveData)
      .catch((err: any) => console.warn('⚠️ Archivage historique échoué:', err));
  }
}

async function upsertCommande(
  supabase: any,
  commandeData: any,
  orderNumber: string
): Promise<{ data: any; error: any; wasUpdate: boolean }> {
  
  const { data: existing } = await supabase
    .from('commande')
    .select('id, numero_commande, statut_wms, date_creation, client_id, sous_client')
    .or(`sendcloud_id.eq.${commandeData.sendcloud_id},sendcloud_shipment_id.eq.${commandeData.sendcloud_shipment_id || 'null'}`)
    .eq('source', 'sendcloud')
    .maybeSingle();

  if (existing) {
    console.log(`📝 Commande existante trouvée: ${existing.numero_commande} (ID: ${existing.id})`);
    
    const updateData = { ...commandeData };
    updateData.date_creation = existing.date_creation;
    if (existing.client_id) updateData.client_id = existing.client_id;
    if (existing.sous_client) updateData.sous_client = existing.sous_client;
    
    const statutsAvances = ['en_preparation', 'pret_expedition', 'etiquette_generee', 'expedie', 'livre'];
    if (statutsAvances.includes(existing.statut_wms)) {
      console.log(`⚠️ Statut avancé préservé: ${existing.statut_wms}`);
      updateData.statut_wms = existing.statut_wms;
    }
    
    const result = await supabase
      .from('commande')
      .update(updateData)
      .eq('id', existing.id)
      .select()
      .single();
    
    return { ...result, wasUpdate: true };
  }

  console.log(`➕ Nouvelle commande, UPSERT par numero_commande`);
  
  const result = await supabase
    .from('commande')
    .upsert(commandeData, {
      onConflict: 'numero_commande',
      ignoreDuplicates: false
    })
    .select()
    .single();
  
  return { ...result, wasUpdate: false };
}

interface BatchResult {
  order_number: string;
  success: boolean;
  was_updated?: boolean;
  already_exists?: boolean;
  commande_id?: string;
  error?: string;
  details?: string;
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

    const { orders } = await req.json() as { orders: SendCloudOrder[] };

    if (!Array.isArray(orders) || orders.length === 0) {
      return new Response(
        JSON.stringify({ success: false, error: 'Invalid request: orders array required' }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' }, status: 400 }
      );
    }

    console.log(`📦 Traitement batch de ${orders.length} commandes`);

    const results: BatchResult[] = [];
    let successCount = 0;
    let existingCount = 0;
    let errorCount = 0;

    const { data: expediteurDefault } = await supabase
      .from('configuration_expediteur')
      .select('*')
      .eq('est_defaut', true)
      .eq('actif', true)
      .maybeSingle();

    for (const sendcloudData of orders) {
      const orderNumber = sendcloudData.order_number || sendcloudData.order_id || String(sendcloudData.id);
      const sendcloudId = String(sendcloudData.id);
      const status = (sendcloudData as any).status || 'pending';
      
      try {
        console.log(`\n🔄 Traitement: ${orderNumber} (SendCloud ID: ${sendcloudId}, status: ${status})`);

        const commandeData = buildCommandeData(
          sendcloudData,
          expediteurDefault,
          orderNumber,
          sendcloudId,
          status
        );

        const { data: commande, error: commandeError, wasUpdate } = await upsertCommande(
          supabase,
          commandeData,
          orderNumber
        );

        if (commandeError) {
          console.error(`❌ Erreur UPSERT commande ${orderNumber}:`, commandeError.message);
          results.push({
            order_number: orderNumber,
            success: false,
            error: commandeError.message,
            details: commandeError.details
          });
          errorCount++;
          continue;
        }

        console.log(`✅ Commande ${wasUpdate ? 'mise à jour' : 'créée'}: ${commande.id} | ${commande.numero_commande}`);

        if (wasUpdate) {
          await archiveCommandeLines(supabase, commande.id);
          
          await supabase
            .from('ligne_commande')
            .delete()
            .eq('commande_id', commande.id);
          
          console.log(`🗑️ Anciennes lignes supprimées pour re-création`);
        }

        let stockOk = true;
        let clientIdInfere: string | null = null;
        let sousClientInfere: string | null = null;

        for (const product of sendcloudData.order_products) {
          const sku = product.sku;
          const quantity = product.quantity;

          console.log(`  📦 Produit: ${sku} x${quantity}`);

          const { data: produitData } = await supabase
            .from('produit')
            .select('id, reference, nom, client_id, marque')
            .or(`reference.eq.${sku},ean.eq.${product.ean || 'none'}`)
            .maybeSingle();

          let produitId = produitData?.id;

          if (!produitData) {
            console.log(`    ⚠️ Produit non trouvé: ${sku}, tentative création depuis SendCloud`);

            const apiKey = Deno.env.get('SENDCLOUD_PUBLIC_KEY');
            const apiSecret = Deno.env.get('SENDCLOUD_SECRET_KEY');

            if (apiKey && apiSecret) {
              try {
                const auth = btoa(`${apiKey}:${apiSecret}`);
                const scResponse = await fetch(
                  `https://panel.sendcloud.sc/api/v2/products?sku=${encodeURIComponent(sku)}`,
                  { headers: { 'Authorization': `Basic ${auth}` } }
                );

                if (scResponse.ok) {
                  const scData = await scResponse.json();
                  if (scData.results && scData.results.length > 0) {
                    const scProduct = scData.results[0];

                    const { data: newProduit } = await supabase
                      .from('produit')
                      .insert({
                        reference: sku,
                        nom: scProduct.name || product.name,
                        ean: scProduct.ean || product.ean,
                        poids_kg: scProduct.weight ? parseFloat(scProduct.weight) / 1000 : null,
                        description: scProduct.description,
                        hs_code: scProduct.hs_code,
                        pays_origine: scProduct.origin_country,
                        statut_actif: true
                      })
                      .select('id')
                      .single();

                    if (newProduit) {
                      produitId = newProduit.id;
                      console.log(`    ✅ Produit créé depuis SendCloud: ${produitId}`);
                    }
                  }
                }
              } catch (err) {
                console.warn(`    ⚠️ Erreur création produit:`, err);
              }
            }

            if (!produitId) {
              stockOk = false;
              console.log(`    ❌ Produit introuvable et création échouée`);
              continue;
            }
          }

          if (produitData?.client_id && !clientIdInfere) {
            clientIdInfere = produitData.client_id;
          }
          if (produitData?.marque && !sousClientInfere) {
            sousClientInfere = produitData.marque;
          }

          const { data: stockData } = await supabase
            .from('stock_disponible')
            .select('stock_disponible')
            .eq('produit_id', produitId)
            .maybeSingle();

          const stockDisponible = stockData?.stock_disponible || 0;

          if (stockDisponible < quantity) {
            stockOk = false;
            console.log(`    ⚠️ Stock insuffisant: ${stockDisponible} < ${quantity}`);
          }

          const unitPrice = product.unit_price?.value || product.total_price?.value || 0;

          await supabase
            .from('ligne_commande')
            .insert({
              commande_id: commande.id,
              produit_id: produitId,
              produit_reference: sku,
              quantite: quantity,
              prix_unitaire: unitPrice
            });

          if (stockDisponible >= quantity) {
            await supabase.rpc('reserver_stock', {
              p_produit_id: produitId,
              p_quantite: quantity,
              p_commande_id: commande.id
            });
            console.log(`    ✅ Stock réservé: ${quantity}`);
          }
        }

        const updatePayload: any = {};
        
        if (clientIdInfere && !commande.client_id) {
          updatePayload.client_id = clientIdInfere;
        }
        if (sousClientInfere && !commande.sous_client) {
          updatePayload.sous_client = sousClientInfere;
        }
        
        if (!stockOk) {
          updatePayload.statut_wms = 'en_attente_reappro';
          updatePayload.message_validation = 'Stock insuffisant pour un ou plusieurs produits';
        }

        if (Object.keys(updatePayload).length > 0) {
          await supabase
            .from('commande')
            .update(updatePayload)
            .eq('id', commande.id);
        }

        try {
          supabase.functions.invoke('apply-automatic-rules', {
            body: { commandeId: commande.id }
          }).then(() => console.log(`  🤖 Règles auto appliquées`))
            .catch((err: any) => console.warn(`  ⚠️ Erreur règles auto:`, err));
          
          supabase.functions.invoke('check-validation-rules', {
            body: { commandeId: commande.id }
          }).then(() => console.log(`  ✅ Validation vérifiée`))
            .catch((err: any) => console.warn(`  ⚠️ Erreur validation:`, err));
        } catch (error) {
          console.warn('⚠️ Erreur lancement règles:', error);
        }

        results.push({
          order_number: orderNumber,
          success: true,
          commande_id: commande.id,
          was_updated: wasUpdate,
          already_exists: wasUpdate
        });

        if (wasUpdate) {
          existingCount++;
        } else {
          successCount++;
        }

      } catch (error: any) {
        console.error(`❌ Erreur traitement ${orderNumber}:`, error);
        results.push({
          order_number: orderNumber,
          success: false,
          error: error.message
        });
        errorCount++;
      }
    }

    console.log(`\n📊 Résumé batch: ${successCount} créées, ${existingCount} mises à jour, ${errorCount} erreurs`);

    return new Response(
      JSON.stringify({
        success: true,
        total: orders.length,
        created: successCount,
        updated: existingCount,
        errors: errorCount,
        results
      }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );

  } catch (error: any) {
    console.error('❌ Erreur batch processing:', error);
    return new Response(
      JSON.stringify({ success: false, error: error.message }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' }, status: 500 }
    );
  }
});
