import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const { commandeId } = await req.json();
    
    const supabaseClient = createClient(
      Deno.env.get("SUPABASE_URL") ?? "",
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? ""
    );

    const { data: commande, error: commandeError } = await supabaseClient
      .from("commande")
      .select(`
        *,
        lignes:ligne_commande(*)
      `)
      .eq("id", commandeId)
      .single();

    if (commandeError) throw commandeError;

    const htmlContent = `
      <!DOCTYPE html>
      <html>
      <head>
        <meta charset="UTF-8">
        <style>
          @media print {
            body { margin: 0; }
            .no-print { display: none; }
          }
          body { font-family: Arial, sans-serif; padding: 15px; }
          .header { 
            background-color: #000; 
            color: #fff; 
            padding: 15px; 
            text-align: center; 
            margin-bottom: 20px; 
          }
          .info-box { 
            border: 2px solid #000; 
            padding: 10px; 
            margin: 15px 0; 
            background-color: #f9f9f9; 
          }
          table { width: 100%; border-collapse: collapse; margin: 20px 0; }
          th, td { border: 1px solid #333; padding: 12px; text-align: left; }
          th { background-color: #333; color: #fff; }
          .checkbox { 
            width: 30px; 
            height: 30px; 
            border: 2px solid #000; 
            display: inline-block; 
            vertical-align: middle; 
          }
          .location { font-weight: bold; font-size: 1.2em; color: #d63031; }
          .qty { font-weight: bold; font-size: 1.1em; }
        </style>
      </head>
      <body>
        <div class="header">
          <h1>🎯 BORDEREAU DE PRÉPARATION</h1>
          <h2>Commande ${commande.numero_commande}</h2>
        </div>
        
        <div class="info-box">
          <table style="border: none;">
            <tr>
              <td style="border: none;"><strong>Client:</strong> ${commande.nom_client}</td>
              <td style="border: none;"><strong>Date:</strong> ${new Date().toLocaleDateString("fr-FR")}</td>
            </tr>
            <tr>
              <td style="border: none;"><strong>Destination:</strong> ${commande.ville}, ${commande.pays_code}</td>
              <td style="border: none;"><strong>Priorité:</strong> ${commande.methode_expedition || "Standard"}</td>
            </tr>
          </table>
        </div>
        
        <h3>📦 Produits à préparer (${commande.lignes.length} ligne(s))</h3>
        <table>
          <thead>
            <tr>
              <th style="width: 50px;">✓</th>
              <th>Emplacement</th>
              <th>Référence</th>
              <th>Produit</th>
              <th style="width: 80px; text-align: center;">Quantité</th>
              <th>Lot / Série</th>
            </tr>
          </thead>
          <tbody>
            ${commande.lignes.map((ligne: any) => `
              <tr>
                <td style="text-align: center;"><span class="checkbox"></span></td>
                <td><span class="location">${ligne.emplacement_picking_id || "A définir"}</span></td>
                <td style="font-family: monospace;">${ligne.produit_reference}</td>
                <td>${ligne.produit_nom}</td>
                <td style="text-align: center;"><span class="qty">${ligne.quantite_commandee}</span></td>
                <td>${ligne.numero_lot || "-"}</td>
              </tr>
            `).join("")}
          </tbody>
        </table>
        
        <div class="info-box">
          <h4>Instructions</h4>
          <ul>
            <li>Vérifier chaque produit scanné avant mise en colis</li>
            <li>Cocher la case ✓ après chaque picking</li>
            <li>Vérifier les dates de péremption si applicable</li>
            <li>Signaler toute anomalie immédiatement</li>
          </ul>
          <p><strong>Préparé par:</strong> _________________ &nbsp;&nbsp;&nbsp; <strong>Date:</strong> ___/___/___</p>
          <p><strong>Vérifié par:</strong> _________________ &nbsp;&nbsp;&nbsp; <strong>Heure:</strong> ___:___</p>
        </div>
      </body>
      </html>
    `;

    const fileName = `picking_slip_${commande.numero_commande}_${Date.now()}.html`;
    const blob = new Blob([htmlContent], { type: "text/html" });
    
    const { data: uploadData, error: uploadError } = await supabaseClient.storage
      .from("documents-commande")
      .upload(fileName, blob, {
        contentType: "text/html",
        upsert: false,
      });

    if (uploadError) throw uploadError;

    const { data: { publicUrl } } = supabaseClient.storage
      .from("documents-commande")
      .getPublicUrl(fileName);

    const { error: docError } = await supabaseClient
      .from("document_commande")
      .insert({
        commande_id: commandeId,
        type_document: "picking_slip",
        categorie: "interne",
        nom_fichier: fileName,
        url_fichier: publicUrl,
        genere_par: null,
        taille_fichier: blob.size,
        format: "HTML",
      });

    if (docError) throw docError;

    return new Response(
      JSON.stringify({ success: true, url: publicUrl }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  } catch (error: any) {
    console.error("Erreur génération Bordereau:", error);
    return new Response(
      JSON.stringify({ error: error.message }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});
