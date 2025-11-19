import { createClient } from 'npm:@supabase/supabase-js@2';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  const startTime = Date.now();

  try {
    const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
    const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
    const sendcloudPublicKey = Deno.env.get('SENDCLOUD_API_PUBLIC_KEY')!;
    const sendcloudSecretKey = Deno.env.get('SENDCLOUD_API_SECRET_KEY')!;

    const supabase = createClient(supabaseUrl, supabaseServiceKey);

    const body = await req.json().catch(() => ({}));
    const limit = body.limit || 150;

    console.log(`[Backfill Products] Starting backfill for up to ${limit} orders...`);

    // Trouver les commandes sans produits (sous-requête pour exclure celles qui ont des lignes)
    const { data: commandesSansProduits, error: fetchError } = await supabase
      .from('commande')
      .select('id, sendcloud_id, numero_commande')
      .not('sendcloud_id', 'is', null)
      .order('date_creation', { ascending: false })
      .limit(limit);

    if (fetchError) throw fetchError;

    // Filtrer celles sans ligne_commande
    const commandesIds = commandesSansProduits?.map(c => c.id) || [];
    const { data: lignesExistantes } = await supabase
      .from('ligne_commande')
      .select('commande_id')
      .in('commande_id', commandesIds);

    const idsAvecLignes = new Set(lignesExistantes?.map(l => l.commande_id) || []);
    const commandesATraiter = commandesSansProduits?.filter(c => !idsAvecLignes.has(c.id)) || [];

    console.log(`[Backfill Products] Found ${commandesATraiter.length} orders without products`);

    if (commandesATraiter.length === 0) {
      return new Response(
        JSON.stringify({ success: true, processed: 0, message: 'No orders to backfill' }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    const authHeader = 'Basic ' + btoa(`${sendcloudPublicKey}:${sendcloudSecretKey}`);
    let processedCount = 0;
    let linesCreated = 0;

    for (const commande of commandesATraiter) {
      try {
        // Récupérer l'order depuis SendCloud API v3
        const orderResponse = await fetch(
          `https://panel.sendcloud.sc/api/v3/orders/${commande.sendcloud_id}`,
          {
            headers: {
              'Authorization': authHeader,
              'Content-Type': 'application/json',
            },
          }
        );

        if (!orderResponse.ok) {
          console.error(`[Backfill] Order ${commande.numero_commande} not found in SendCloud`);
          continue;
        }

        const orderData = await orderResponse.json();
        const orderProducts = orderData.order_products || [];

        if (orderProducts.length === 0) {
          console.log(`[Backfill] Order ${commande.numero_commande} has no products in SendCloud`);
          continue;
        }

        // Créer les lignes de commande
        for (const product of orderProducts) {
          // Chercher le produit par SKU
          const { data: produit } = await supabase
            .from('produit')
            .select('id, nom, reference, poids_unitaire, prix_unitaire')
            .eq('reference', product.sku)
            .maybeSingle();

          if (!produit) {
            console.log(`[Backfill] Product ${product.sku} not found for order ${commande.numero_commande}`);
            continue;
          }

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

          linesCreated++;
        }

        processedCount++;
        console.log(`[Backfill] ${commande.numero_commande}: ${orderProducts.length} products added`);

      } catch (error) {
        console.error(`[Backfill] Error for ${commande.numero_commande}:`, error);
      }
    }

    const duration = Date.now() - startTime;
    console.log(`[Backfill Products] Completed in ${duration}ms - ${processedCount} orders, ${linesCreated} lines`);

    return new Response(
      JSON.stringify({
        success: true,
        processed: processedCount,
        lines_created: linesCreated,
        duration_ms: duration,
      }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );

  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : String(error);
    console.error('[Backfill Products] Fatal error:', errorMessage);

    return new Response(
      JSON.stringify({ success: false, error: errorMessage }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' }, status: 500 }
    );
  }
});
