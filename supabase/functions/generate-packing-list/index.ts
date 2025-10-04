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
          body { font-family: Arial, sans-serif; padding: 20px; }
          .header { text-align: center; border-bottom: 2px solid #000; padding-bottom: 10px; margin-bottom: 20px; }
          .info { margin: 15px 0; }
          table { width: 100%; border-collapse: collapse; margin: 20px 0; }
          th, td { border: 1px solid #000; padding: 10px; text-align: left; }
          th { background-color: #e0e0e0; font-weight: bold; }
          .total { text-align: right; font-weight: bold; margin-top: 10px; }
        </style>
      </head>
      <body>
        <div class="header">
          <h1>PACKING LIST / BORDEREAU DE COLISAGE</h1>
          <p>Commande: ${commande.numero_commande}</p>
          <p>Date: ${new Date().toLocaleDateString("fr-FR")}</p>
        </div>
        
        <div class="info">
          <h3>Destinataire</h3>
          <p><strong>${commande.adresse_nom}</strong></p>
          <p>${commande.adresse_ligne_1}</p>
          ${commande.adresse_ligne_2 ? `<p>${commande.adresse_ligne_2}</p>` : ""}
          <p>${commande.code_postal} ${commande.ville}, ${commande.pays_code}</p>
          ${commande.email_client ? `<p>Email: ${commande.email_client}</p>` : ""}
          ${commande.telephone_client ? `<p>Téléphone: ${commande.telephone_client}</p>` : ""}
        </div>
        
        <table>
          <thead>
            <tr>
              <th>Référence</th>
              <th>Description</th>
              <th>Quantité</th>
              <th>Poids unitaire</th>
              <th>Poids total</th>
            </tr>
          </thead>
          <tbody>
            ${commande.lignes.map((ligne: any) => {
              const poidsTotal = ligne.poids_unitaire ? (ligne.poids_unitaire * ligne.quantite_commandee).toFixed(2) : "-";
              return `
                <tr>
                  <td>${ligne.produit_reference}</td>
                  <td>${ligne.produit_nom}</td>
                  <td>${ligne.quantite_commandee}</td>
                  <td>${ligne.poids_unitaire ? ligne.poids_unitaire + " kg" : "-"}</td>
                  <td>${poidsTotal !== "-" ? poidsTotal + " kg" : "-"}</td>
                </tr>
              `;
            }).join("")}
          </tbody>
        </table>
        
        <div class="total">
          <p>Nombre total de pièces: ${commande.lignes.reduce((sum: number, l: any) => sum + l.quantite_commandee, 0)}</p>
          <p>Poids total: ${commande.poids_total || "Non calculé"} kg</p>
          <p>Valeur totale: ${commande.valeur_totale.toFixed(2)} ${commande.devise || "EUR"}</p>
        </div>
      </body>
      </html>
    `;

    const fileName = `packing_list_${commande.numero_commande}_${Date.now()}.html`;
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
        type_document: "packing_list",
        categorie: "transport",
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
    console.error("Erreur génération Packing List:", error);
    return new Response(
      JSON.stringify({ error: error.message }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});
