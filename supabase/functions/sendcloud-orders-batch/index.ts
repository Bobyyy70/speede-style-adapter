import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

interface SendCloudProduct {
  sku: string;
  name: string;
  quantity: number;
  unit_price?: { value: number; currency: string };
  total_price?: { value: number; currency: string };
  measurement?: { weight?: { value: number; unit: string } };
}

interface SendCloudOrder {
  id: string | number;
  order_number?: string;
  order_id?: string;
  name: string;
  email?: string;
  telephone?: string;
  address: string;
  address_2?: string;
  city: string;
  postal_code: string;
  country: string;
  order_products: SendCloudProduct[];
  total_order_value?: number;
  currency?: string;
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
      
      try {
        console.log(`\n🔄 Traitement: ${orderNumber}`);

        // Vérifier si la commande existe déjà
        const { data: existingCommande } = await supabase
          .from('commande')
          .select('id, numero_commande')
          .or(`sendcloud_id.eq.${sendcloudData.id},numero_commande.eq.${orderNumber}`)
          .maybeSingle();

        if (existingCommande) {
          console.log(`⚠️ Déjà existante: ${existingCommande.numero_commande}`);
          results.push({
            order_number: orderNumber,
            success: true,
            already_exists: true,
            commande_id: existingCommande.id
          });
          existingCount++;
          continue;
        }

        // Insérer la commande
        const { data: commande, error: commandeError } = await supabase
          .from('commande')
          .insert({
            sendcloud_id: String(sendcloudData.id),
            numero_commande: orderNumber,
            nom_client: sendcloudData.name,
            email_client: sendcloudData.email || null,
            telephone_client: sendcloudData.telephone || null,
            adresse_nom: sendcloudData.name,
            adresse_ligne_1: sendcloudData.address,
            adresse_ligne_2: sendcloudData.address_2 || null,
            ville: sendcloudData.city,
            code_postal: sendcloudData.postal_code,
            pays_code: sendcloudData.country,
            valeur_totale: sendcloudData.total_order_value || 0,
            devise: sendcloudData.currency || 'EUR',
            statut_wms: 'En attente de réappro',
            source: 'SendCloud'
          })
          .select()
          .single();

        if (commandeError) {
          console.error(`❌ Erreur insertion ${orderNumber}:`, commandeError);
          results.push({
            order_number: orderNumber,
            success: false,
            error: commandeError.message,
            details: commandeError.details
          });
          errorCount++;
          continue;
        }

        console.log(`✅ Commande créée: ${commande.id}`);

        // Traiter les produits
        let tousProduitsStockOk = true;
        let tousProduitsTrouves = true;

        for (const product of sendcloudData.order_products) {
          // Chercher le produit par SKU
          const { data: produit } = await supabase
            .from('produit')
            .select('id, nom, reference, stock_actuel, poids_unitaire, prix_unitaire')
            .eq('reference', product.sku)
            .maybeSingle();

          if (!produit) {
            console.log(`⚠️ Produit non trouvé: ${product.sku}`);
            tousProduitsTrouves = false;
            continue;
          }

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

        // Mettre à jour le statut de la commande
        const nouveauStatut = !tousProduitsTrouves 
          ? 'Produits introuvables' 
          : tousProduitsStockOk 
          ? 'Prêt à préparer' 
          : 'En attente de réappro';

        await supabase
          .from('commande')
          .update({ statut_wms: nouveauStatut })
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
