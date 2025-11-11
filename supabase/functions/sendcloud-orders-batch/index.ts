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

// Normaliser les codes pays depuis différents formats SendCloud
function normalizeCountry(country: any): string {
  if (!country) return 'FR';
  
  // Si c'est déjà un code ISO-2 valide
  if (typeof country === 'string') {
    const trimmed = country.trim().toUpperCase();
    if (trimmed.length === 2) return trimmed;
    
    // Mapping des noms communs vers ISO-2
    const countryMap: Record<string, string> = {
      'FRANCE': 'FR', 'BELGIUM': 'BE', 'BELGIQUE': 'BE',
      'GERMANY': 'DE', 'ALLEMAGNE': 'DE', 'SPAIN': 'ES', 
      'ESPAGNE': 'ES', 'ITALY': 'IT', 'ITALIE': 'IT',
      'NETHERLANDS': 'NL', 'PAYS-BAS': 'NL', 'UK': 'GB',
      'UNITED KINGDOM': 'GB', 'ROYAUME-UNI': 'GB'
    };
    
    return countryMap[trimmed] || 'FR';
  }
  
  // Si c'est un objet avec iso_2
  if (typeof country === 'object' && country !== null && 'iso_2' in country) {
    const code = (country as any).iso_2;
    if (typeof code === 'string') {
      return code.trim().toUpperCase();
    }
  }
  
  return 'FR';
}

interface BatchResult {
  order_number: string;
  success: boolean;
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

    for (const sendcloudData of orders) {
      const orderNumber = sendcloudData.order_number || sendcloudData.order_id || String(sendcloudData.id);
      const status = (sendcloudData as any).status || 'pending';
      
      try {
        console.log(`\n🔄 Traitement: ${orderNumber} (status: ${status})`);

        // Si commande annulée, l'archiver directement
        if (status === 'cancelled') {
          console.log(`🗑️ Commande annulée: ${orderNumber}`);
          
          // Vérifier si elle existe déjà
          const { data: existing } = await supabase
            .from('commande')
            .select('id')
            .or(`sendcloud_id.eq.${String(sendcloudData.id)},numero_commande.eq.${orderNumber}`)
            .maybeSingle();
          
          if (existing) {
            // Archiver l'existante
            await supabase
              .from('commande')
              .update({ statut_wms: 'Archivé', remarques: 'Commande annulée sur SendCloud' })
              .eq('id', existing.id);
            
            results.push({
              order_number: orderNumber,
              success: true,
              already_exists: true,
              commande_id: existing.id
            });
            existingCount++;
          } else {
            // Créer directement archivée
            const { data: newArchived } = await supabase
              .from('commande')
              .insert({
                sendcloud_id: String(sendcloudData.id),
                numero_commande: orderNumber,
                nom_client: sendcloudData.name || 'Client inconnu',
                statut_wms: 'Archivé',
                source: 'sendcloud',
                valeur_totale: 0,
                remarques: 'Commande annulée sur SendCloud'
              })
              .select('id')
              .single();
            
            results.push({
              order_number: orderNumber,
              success: true,
              commande_id: newArchived?.id
            });
            successCount++;
          }
          continue;
        }

        // Extraire les données d'adresse (v3 avec shipping_address ou v2 à plat)
        const shippingAddr = sendcloudData.shipping_address;
        const clientName = shippingAddr?.name || sendcloudData.name || 'Client inconnu';
        const address1 = shippingAddr?.address || sendcloudData.address || '';
        const address2 = shippingAddr?.address_2 || sendcloudData.address_2 || null;
        const city = shippingAddr?.city || sendcloudData.city || '';
        const postalCode = shippingAddr?.postal_code || sendcloudData.postal_code || '';
        const country = shippingAddr?.country || sendcloudData.country;
        
        // Normaliser le code pays
        const paysCode = normalizeCountry(country);
        
        console.log(`📍 Adresse: ${city}, ${postalCode}, Pays: ${paysCode}`);

        // ⚠️ VÉRIFIER SI DOUBLON AVANT INSERTION
        const { data: existingOrder } = await supabase
          .from('commande')
          .select('id, numero_commande, statut_wms, date_creation')
          .or(`sendcloud_id.eq.${String(sendcloudData.id)},numero_commande.eq.${orderNumber}`)
          .maybeSingle();

        if (existingOrder) {
          console.log(`⚠️ DOUBLON DÉTECTÉ: ${orderNumber} existe déjà (ID: ${existingOrder.id}, statut: ${existingOrder.statut_wms})`);
          
          results.push({
            order_number: orderNumber,
            success: false,
            already_exists: true,
            commande_id: existingOrder.id,
            error: 'Commande déjà existante',
            details: `Créée le ${existingOrder.date_creation}, statut: ${existingOrder.statut_wms}`
          });
          existingCount++;
          continue; // ❌ REJETER LE DOUBLON
        }

        // Récupérer config expéditeur par défaut (depuis HEFAGROUP par défaut)
        const { data: expediteurDefault } = await supabase
          .from('configuration_expediteur')
          .select('*')
          .eq('est_defaut', true)
          .eq('actif', true)
          .maybeSingle();

        // Déterminer priorité et incoterm
        const priorite = (sendcloudData as any).shipment?.method === 'express' ? 'express' : 'standard';
        const incoterm = paysCode === 'FR' ? 'DDP' : 'DAP'; // DDP pour France, DAP pour international

        // ✅ PAS DE DOUBLON, INSERTION NORMALE avec données expéditeur
        const { data: commande, error: commandeError } = await supabase
          .from('commande')
          .insert({
            sendcloud_id: String(sendcloudData.id),
            numero_commande: orderNumber,
            nom_client: clientName,
            email_client: sendcloudData.email || null,
            telephone_client: sendcloudData.telephone || null,
            adresse_nom: clientName,
            adresse_ligne_1: address1,
            adresse_ligne_2: address2,
            ville: city,
            code_postal: postalCode,
            pays_code: paysCode,
            valeur_totale: sendcloudData.total_order_value || 0,
            devise: sendcloudData.currency || 'EUR',
            statut_wms: 'en_attente_reappro',
            source: 'sendcloud',
            // Données expéditeur depuis config
            expediteur_nom: expediteurDefault?.nom || null,
            expediteur_entreprise: expediteurDefault?.entreprise || null,
            expediteur_email: expediteurDefault?.email || null,
            expediteur_telephone: expediteurDefault?.telephone || null,
            expediteur_adresse_ligne_1: expediteurDefault?.adresse_ligne_1 || null,
            expediteur_adresse_ligne_2: expediteurDefault?.adresse_ligne_2 || null,
            expediteur_code_postal: expediteurDefault?.code_postal || null,
            expediteur_ville: expediteurDefault?.ville || null,
            expediteur_pays_code: expediteurDefault?.pays_code || 'FR',
            // Valeurs par défaut intelligentes
            incoterm: incoterm,
            priorite_expedition: priorite,
            date_expedition_demandee: new Date(Date.now() + 24*60*60*1000).toISOString().split('T')[0],
            pays_origine_marchandise: expediteurDefault?.pays_code || 'FR'
          })
          .select()
          .single();

        if (commandeError) {
          console.error(`❌ Error inserting commande:`, commandeError.message);
          results.push({ 
            order_number: orderNumber, 
            success: false, 
            error: commandeError.message,
            details: commandeError.details 
          });
          errorCount++;
          continue;
        }

        console.log(`✅ Commande inserted: ${commande.id}`);

        // Enrichir avec tracking si un parcel existe déjà
        try {
          const publicKey = Deno.env.get('SENDCLOUD_API_PUBLIC_KEY');
          const secretKey = Deno.env.get('SENDCLOUD_API_SECRET_KEY');

          if (publicKey && secretKey) {
            const basicAuth = btoa(`${publicKey}:${secretKey}`);
            const parcelResponse = await fetch(
              `https://panel.sendcloud.sc/api/v2/parcels?external_order_id=${commande.sendcloud_id}`,
              {
                headers: {
                  'Authorization': `Basic ${basicAuth}`,
                  'Content-Type': 'application/json',
                },
              }
            );

            if (parcelResponse.ok) {
              const parcelData = await parcelResponse.json();
              if (parcelData.parcels && parcelData.parcels.length > 0) {
                const parcel = parcelData.parcels[0];
                
                let statutWms = 'en_attente_reappro';
                if (parcel.status) {
                  const statusId = parcel.status.id;
                  if (statusId >= 1000 && statusId < 2000) {
                    statutWms = 'en_preparation';
                  } else if (statusId >= 2000 && statusId < 3000) {
                    statutWms = 'en_transit';
                  } else if (statusId >= 3000) {
                    statutWms = 'livre';
                  }
                }

                await supabase
                  .from('commande')
                  .update({
                    transporteur: parcel.carrier?.name || null,
                    methode_expedition: parcel.shipping_method?.name || null,
                    tracking_number: parcel.tracking_number || null,
                    tracking_url: parcel.tracking_url || null,
                    label_url: parcel.label?.label_printer || null,
                    sendcloud_shipment_id: parcel.id?.toString() || null,
                    statut_wms: statutWms,
                  })
                  .eq('id', commande.id);

                console.log(`🔄 Enriched order ${commande.numero_commande} with tracking`);
              }
            }
          }
        } catch (enrichError: any) {
          console.error(`⚠️ Error enriching order:`, enrichError.message);
        }

        console.log(`✅ Commande créée: ${commande.id}`);

        // Traiter les produits
        let tousProduitsStockOk = true;
        let tousProduitsTrouves = true;
        const produitsCommande: any[] = [];

        const publicKey = Deno.env.get('SENDCLOUD_API_PUBLIC_KEY');
        const secretKey = Deno.env.get('SENDCLOUD_API_SECRET_KEY');

        for (const product of sendcloudData.order_products) {
          // Chercher le produit par SKU puis par EAN
          let { data: produit } = await supabase
            .from('produit')
            .select('id, nom, reference, marque, client_id, stock_actuel, poids_unitaire, prix_unitaire')
            .eq('reference', product.sku)
            .maybeSingle();

          // Si pas trouvé par SKU, essayer par EAN
          if (!produit && product.ean) {
            ({ data: produit } = await supabase
              .from('produit')
              .select('id, nom, reference, marque, client_id, stock_actuel, poids_unitaire, prix_unitaire')
              .eq('code_barre_ean', product.ean)
              .maybeSingle());
          }

          // Si toujours pas trouvé, récupérer depuis SendCloud API et créer le produit
          if (!produit && publicKey && secretKey) {
            console.log(`🔍 Produit ${product.sku} non trouvé, récupération depuis SendCloud...`);
            
            try {
              const basicAuth = btoa(`${publicKey}:${secretKey}`);
              
              // Chercher le produit dans SendCloud Products API par SKU
              const productResponse = await fetch(
                `https://panel.sendcloud.sc/api/v3/products?sku=${encodeURIComponent(product.sku)}`,
                {
                  headers: {
                    'Authorization': `Basic ${basicAuth}`,
                    'Content-Type': 'application/json',
                  },
                }
              );

              if (productResponse.ok) {
                const productData = await productResponse.json();
                const scProduct = productData.products?.[0];

                if (scProduct) {
                  console.log(`✅ Produit trouvé dans SendCloud: ${scProduct.description}`);
                  
                  // Déterminer le client_id par défaut (HEFAGROUP)
                  const { data: defaultClient } = await supabase
                    .from('client')
                    .select('id')
                    .eq('nom_entreprise', 'HEFAGROUP OÜ')
                    .maybeSingle();

                  // Créer le produit dans notre base
                  const { data: newProduit, error: createError } = await supabase
                    .from('produit')
                    .insert({
                      reference: product.sku,
                      nom: scProduct.description || product.name,
                      code_barre_ean: scProduct.ean || product.ean || null,
                      poids_unitaire: scProduct.weight?.value || 0.1,
                      prix_unitaire: product.unit_price?.value || 0,
                      client_id: defaultClient?.id,
                      stock_actuel: 0,
                      stock_minimum: 0,
                      statut_actif: true,
                      pays_origine: scProduct.origin_country || 'FR',
                      code_sh: scProduct.hs_code || null,
                      marque: 'SendCloud Import',
                    })
                    .select('id, nom, reference, marque, client_id, stock_actuel, poids_unitaire, prix_unitaire')
                    .single();

                  if (createError) {
                    console.error(`❌ Erreur création produit ${product.sku}:`, createError);
                  } else {
                    console.log(`✅ Produit ${product.sku} créé automatiquement`);
                    produit = newProduit;
                  }
                }
              }
            } catch (apiError) {
              console.error(`⚠️ Erreur API SendCloud Products pour ${product.sku}:`, apiError);
            }
          }

          if (!produit) {
            console.log(`⚠️ Produit non trouvé et non créé: SKU=${product.sku}, EAN=${product.ean || 'N/A'}`);
            tousProduitsTrouves = false;
            continue;
          }

          // Stocker le produit pour inférer le client plus tard
          produitsCommande.push(produit);

          // Vérifier le stock
          const { data: stockData } = await supabase
            .from('stock_disponible')
            .select('stock_disponible')
            .eq('produit_id', produit.id)
            .maybeSingle();

          const stockDisponible = stockData?.stock_disponible || 0;

          if (stockDisponible < product.quantity) {
            console.log(`⚠️ Stock insuffisant pour ${product.sku}: ${stockDisponible}/${product.quantity}`);
            tousProduitsStockOk = false;
          }

          // Créer la ligne de commande
          await supabase
            .from('ligne_commande')
            .insert({
              commande_id: commande.id,
              produit_id: produit.id,
              produit_reference: product.sku,
              produit_nom: product.name,
              quantite_commandee: product.quantity,
              prix_unitaire: product.unit_price?.value || produit.prix_unitaire || 0,
              valeur_totale: product.total_price?.value || (product.quantity * (produit.prix_unitaire || 0)),
              poids_unitaire: produit.poids_unitaire,
              statut_ligne: 'en_attente'
            });

          // Réserver le stock si disponible
          if (stockDisponible >= product.quantity) {
            await supabase.rpc('reserver_stock', {
              p_produit_id: produit.id,
              p_quantite: product.quantity,
              p_commande_id: commande.id,
              p_reference_origine: commande.numero_commande
            });
          }
        }

        // Inférer client_id et sous_client depuis la marque du premier produit
        let clientId = null;
        let sousClient = null;
        
        if (produitsCommande.length > 0) {
          const premierProduit = produitsCommande[0];
          const marque = premierProduit.marque?.toLowerCase() || '';
          
          if (marque.includes('heatzy')) {
            const { data: heatzyClient } = await supabase
              .from('client')
              .select('id')
              .eq('nom_entreprise', 'HEATZY')
              .maybeSingle();
            clientId = heatzyClient?.id;
          } else if (marque.includes('thomas')) {
            const { data: linkosClient } = await supabase
              .from('client')
              .select('id')
              .eq('nom_entreprise', 'Link-OS')
              .maybeSingle();
            clientId = linkosClient?.id;
            sousClient = 'Thomas';
          } else if (marque.includes('elete') || marque.includes('electrolyte')) {
            const { data: linkosClient } = await supabase
              .from('client')
              .select('id')
              .eq('nom_entreprise', 'Link-OS')
              .maybeSingle();
            clientId = linkosClient?.id;
            sousClient = 'Elite Water';
          } else {
            const { data: hefaClient } = await supabase
              .from('client')
              .select('id')
              .eq('nom_entreprise', 'HEFAGROUP OÜ')
              .maybeSingle();
            clientId = hefaClient?.id;
          }
        }

        // Mettre à jour le statut et client de la commande
        const nouveauStatut = !tousProduitsTrouves 
          ? 'Produits introuvables' 
          : tousProduitsStockOk 
          ? 'Prêt à préparer' 
          : 'En attente de réappro';

        await supabase
          .from('commande')
          .update({ 
            statut_wms: nouveauStatut,
            client_id: clientId,
            sous_client: sousClient
          })
          .eq('id', commande.id);

        console.log(`✅ ${orderNumber} - Statut: ${nouveauStatut}`);

        results.push({
          order_number: orderNumber,
          success: true,
          commande_id: commande.id
        });
        successCount++;

      } catch (error) {
        console.error(`❌ Erreur ${orderNumber}:`, error);
        results.push({
          order_number: orderNumber,
          success: false,
          error: error instanceof Error ? error.message : String(error)
        });
        errorCount++;
      }
    }

    console.log(`\n📊 Résumé: ${successCount} créées, ${existingCount} existantes, ${errorCount} erreurs`);

    return new Response(
      JSON.stringify({
        success: errorCount === 0,
        total: orders.length,
        processed: successCount,
        existing: existingCount,
        errors: errorCount,
        results
      }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' }, status: 200 }
    );

  } catch (error) {
    console.error('❌ Erreur batch:', error);
    return new Response(
      JSON.stringify({ success: false, error: error instanceof Error ? error.message : String(error) }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' }, status: 500 }
    );
  }
});
