import { createClient } from 'npm:@supabase/supabase-js@2';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
    const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
    const sendcloudPublicKey = Deno.env.get('SENDCLOUD_API_PUBLIC_KEY')!;
    const sendcloudSecretKey = Deno.env.get('SENDCLOUD_API_SECRET_KEY')!;

    const supabase = createClient(supabaseUrl, supabaseServiceKey);

    console.log('[Backfill] Recherche des commandes SendCloud sans produits...');

    // Trouver les commandes SendCloud qui n'ont pas de lignes
    const { data: commandesSansLignes, error: searchError } = await supabase
      .from('commande')
      .select('id, numero_commande, sendcloud_id, client_id')
      .eq('source', 'sendcloud')
      .not('sendcloud_id', 'is', null)
      .limit(100);

    if (searchError) throw searchError;

    if (!commandesSansLignes || commandesSansLignes.length === 0) {
      return new Response(
        JSON.stringify({ success: true, message: 'Aucune commande à réparer', processed: 0 }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    console.log(`[Backfill] ${commandesSansLignes.length} commandes trouvées`);

    // Filtrer celles qui n'ont vraiment pas de lignes
    const commandesAReparer = [];
    for (const cmd of commandesSansLignes) {
      const { count } = await supabase
        .from('ligne_commande')
        .select('*', { count: 'exact', head: true })
        .eq('commande_id', cmd.id);
      
      if (count === 0) {
        commandesAReparer.push(cmd);
      }
    }

    console.log(`[Backfill] ${commandesAReparer.length} commandes sans produits à réparer`);

    let successCount = 0;
    let errorCount = 0;
    const errors: string[] = [];

    const basicAuth = btoa(`${sendcloudPublicKey}:${sendcloudSecretKey}`);

    for (const commande of commandesAReparer) {
      try {
        console.log(`[Backfill] Traitement commande ${commande.numero_commande}...`);

        // Récupérer la commande depuis SendCloud API v3
        const orderResponse = await fetch(
          `https://panel.sendcloud.sc/api/v3/orders?order_number=${encodeURIComponent(commande.numero_commande)}`,
          {
            headers: {
              'Authorization': `Basic ${basicAuth}`,
              'Content-Type': 'application/json',
            },
          }
        );

        if (!orderResponse.ok) {
          console.error(`[Backfill] Erreur API SendCloud pour ${commande.numero_commande}`);
          errorCount++;
          continue;
        }

        const orderData = await orderResponse.json();
        const order = orderData.orders?.[0];

        if (!order || !order.order_products || order.order_products.length === 0) {
          console.log(`[Backfill] Pas de produits dans la commande ${commande.numero_commande}`);
          continue;
        }

        console.log(`[Backfill] ${order.order_products.length} produits trouvés`);

        // Créer les lignes de produits
        let produitsCreesCount = 0;

        for (const product of order.order_products) {
          // Chercher le produit par SKU
          let { data: produit } = await supabase
            .from('produit')
            .select('id, nom, reference, poids_unitaire, prix_unitaire')
            .eq('reference', product.sku)
            .maybeSingle();

          // Si pas trouvé, essayer par EAN
          if (!produit && product.ean) {
            ({ data: produit } = await supabase
              .from('produit')
              .select('id, nom, reference, poids_unitaire, prix_unitaire')
              .eq('code_barre_ean', product.ean)
              .maybeSingle());
          }

          // Si toujours pas trouvé, essayer de récupérer depuis SendCloud Products API
          if (!produit) {
            console.log(`[Backfill] Produit ${product.sku} non trouvé, tentative import...`);
            
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
                // Créer le produit
                const { data: newProduit } = await supabase
                  .from('produit')
                  .insert({
                    reference: product.sku,
                    nom: scProduct.description || product.name || product.sku,
                    code_barre_ean: scProduct.ean || product.ean || null,
                    poids_unitaire: scProduct.weight?.value || 0.1,
                    prix_unitaire: product.unit_price?.value || 0,
                    client_id: commande.client_id,
                    stock_actuel: 0,
                    stock_minimum: 0,
                    statut_actif: true,
                    pays_origine: scProduct.origin_country || 'FR',
                    code_sh: scProduct.hs_code || null,
                    marque: 'SendCloud Import',
                  })
                  .select('id, nom, reference, poids_unitaire, prix_unitaire')
                  .single();

                if (newProduit) {
                  console.log(`[Backfill] Produit ${product.sku} créé`);
                  produit = newProduit;
                }
              }
            }
          }

          if (!produit) {
            console.error(`[Backfill] Impossible de trouver/créer produit ${product.sku}`);
            continue;
          }

          // Créer la ligne de commande
          const { error: ligneError } = await supabase
            .from('ligne_commande')
            .insert({
              commande_id: commande.id,
              produit_id: produit.id,
              produit_reference: product.sku,
              produit_nom: product.name || produit.nom,
              quantite_commandee: product.quantity,
              prix_unitaire: product.unit_price?.value || produit.prix_unitaire || 0,
              valeur_totale: product.total_price?.value || (product.quantity * (produit.prix_unitaire || 0)),
              poids_unitaire: produit.poids_unitaire || 0.1,
              statut_ligne: 'en_attente'
            });

          if (ligneError) {
            console.error(`[Backfill] Erreur création ligne pour ${product.sku}:`, ligneError);
          } else {
            produitsCreesCount++;
          }
        }

        console.log(`[Backfill] ✅ ${produitsCreesCount} produits ajoutés à ${commande.numero_commande}`);
        successCount++;

      } catch (error) {
        console.error(`[Backfill] Erreur pour ${commande.numero_commande}:`, error);
        errorCount++;
        errors.push(`${commande.numero_commande}: ${error instanceof Error ? error.message : String(error)}`);
      }
    }

    console.log(`[Backfill] Terminé: ${successCount} succès, ${errorCount} erreurs`);

    return new Response(
      JSON.stringify({
        success: true,
        processed: commandesAReparer.length,
        success_count: successCount,
        error_count: errorCount,
        errors: errors.length > 0 ? errors : undefined,
      }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );

  } catch (error) {
    console.error('[Backfill] Erreur fatale:', error);
    return new Response(
      JSON.stringify({ success: false, error: error instanceof Error ? error.message : String(error) }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' }, status: 500 }
    );
  }
});
