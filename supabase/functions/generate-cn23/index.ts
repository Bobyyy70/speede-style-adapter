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

    // Fetch commande complète avec lignes
    const { data: commande, error: commandeError } = await supabaseClient
      .from("commande")
      .select(`
        *,
        lignes:ligne_commande(*)
      `)
      .eq("id", commandeId)
      .single();

    if (commandeError) throw commandeError;

    // Validation des informations requises pour CN23
    const errors: string[] = [];
    
    if (!commande.adresse_nom) errors.push("Nom du destinataire manquant");
    if (!commande.adresse_ligne_1) errors.push("Adresse du destinataire manquante");
    if (!commande.code_postal) errors.push("Code postal manquant");
    if (!commande.ville) errors.push("Ville manquante");
    if (!commande.pays_code) errors.push("Code pays manquant");
    if (!commande.valeur_totale || commande.valeur_totale <= 0) errors.push("Valeur totale manquante ou invalide");
    if (!commande.poids_total || commande.poids_total <= 0) errors.push("Poids total manquant ou invalide");
    
    // Vérifier que toutes les lignes ont un poids et une valeur
    const lignesInvalides = commande.lignes.filter((l: any) => 
      !l.poids_unitaire || l.poids_unitaire <= 0 || !l.prix_unitaire || l.prix_unitaire <= 0
    );
    
    if (lignesInvalides.length > 0) {
      errors.push(`${lignesInvalides.length} ligne(s) sans poids ou prix unitaire`);
    }

    if (errors.length > 0) {
      return new Response(
        JSON.stringify({ 
          error: "Informations manquantes pour générer le CN23",
          details: errors,
          status: "validation_failed"
        }),
        { 
          status: 400, 
          headers: { ...corsHeaders, "Content-Type": "application/json" } 
        }
      );
    }

    // Générer le PDF (HTML simple pour l'instant)
    const htmlContent = `
      <!DOCTYPE html>
      <html>
      <head>
        <meta charset="UTF-8">
        <style>
          body { font-family: Arial, sans-serif; padding: 20px; }
          .header { text-align: center; border-bottom: 2px solid #000; padding-bottom: 10px; }
          .section { margin: 20px 0; }
          table { width: 100%; border-collapse: collapse; }
          th, td { border: 1px solid #000; padding: 8px; text-align: left; }
          th { background-color: #f0f0f0; }
        </style>
      </head>
      <body>
        <div class="header">
          <h1>CN23 - DÉCLARATION EN DOUANE</h1>
          <p>Commande: ${commande.numero_commande}</p>
        </div>
        
        <div class="section">
          <h3>Expéditeur</h3>
          <p><strong>Votre entreprise</strong></p>
          <p>Adresse de votre entrepôt</p>
        </div>
        
        <div class="section">
          <h3>Destinataire</h3>
          <p><strong>${commande.adresse_nom}</strong></p>
          <p>${commande.adresse_ligne_1}</p>
          ${commande.adresse_ligne_2 ? `<p>${commande.adresse_ligne_2}</p>` : ""}
          <p>${commande.code_postal} ${commande.ville}</p>
          <p>${commande.pays_code}</p>
        </div>
        
        <div class="section">
          <h3>Contenu de l'envoi</h3>
          <table>
            <thead>
              <tr>
                <th>Description</th>
                <th>Quantité</th>
                <th>Poids unitaire (kg)</th>
                <th>Valeur (EUR)</th>
              </tr>
            </thead>
            <tbody>
              ${commande.lignes.map((ligne: any) => `
                <tr>
                  <td>${ligne.produit_nom}</td>
                  <td>${ligne.quantite_commandee}</td>
                  <td>${ligne.poids_unitaire || "-"}</td>
                  <td>${ligne.prix_unitaire?.toFixed(2) || "-"}</td>
                </tr>
              `).join("")}
            </tbody>
          </table>
          <p><strong>Valeur totale déclarée:</strong> ${commande.valeur_totale.toFixed(2)} EUR</p>
          <p><strong>Poids total:</strong> ${commande.poids_total || "Non calculé"} kg</p>
        </div>
        
        <div class="section">
          <p><strong>Catégorie:</strong> Marchandises commerciales</p>
          <p><strong>Date:</strong> ${new Date().toLocaleDateString("fr-FR")}</p>
        </div>
      </body>
      </html>
    `;

    // Convertir HTML en PDF (utilisation d'un service externe ou bibliothèque)
    // Pour simplifier, on enregistre le HTML comme "PDF"
    const fileName = `cn23_${commande.numero_commande}_${Date.now()}.html`;
    const blob = new Blob([htmlContent], { type: "text/html" });
    
    // Upload vers Supabase Storage
    const { data: uploadData, error: uploadError } = await supabaseClient.storage
      .from("documents-commande")
      .upload(fileName, blob, {
        contentType: "text/html",
        upsert: false,
      });

    if (uploadError) throw uploadError;

    // Créer l'entrée dans document_commande
    const { data: { publicUrl } } = supabaseClient.storage
      .from("documents-commande")
      .getPublicUrl(fileName);

    const { error: docError } = await supabaseClient
      .from("document_commande")
      .insert({
        commande_id: commandeId,
        type_document: "cn23",
        categorie: "douane",
        nom_fichier: fileName,
        url_fichier: publicUrl,
        genere_par: null, // TODO: récupérer auth.uid()
        taille_fichier: blob.size,
        format: "HTML",
      });

    if (docError) throw docError;

    return new Response(
      JSON.stringify({ success: true, url: publicUrl }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  } catch (error: any) {
    console.error("Erreur génération CN23:", error);
    return new Response(
      JSON.stringify({ error: error.message }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});
