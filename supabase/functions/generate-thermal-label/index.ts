import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

/**
 * Génère un document optimisé pour impression thermique
 * Supporte: picking slips, shipping labels, product labels
 * Formats: HTML thermique 80mm, ESC/POS, ZPL
 */
serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const { commandeId, documentType = 'picking_slip', format = 'html_thermal', printerWidth = 80 } = await req.json();

    if (!commandeId) {
      throw new Error("commandeId est requis");
    }

    const supabaseClient = createClient(
      Deno.env.get("SUPABASE_URL") ?? "",
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? ""
    );

    // Récupérer les données de la commande
    const { data: commande, error: commandeError } = await supabaseClient
      .from("commande")
      .select(`
        *,
        lignes:ligne_commande(*),
        client:client(*)
      `)
      .eq("id", commandeId)
      .single();

    if (commandeError) throw commandeError;
    if (!commande) throw new Error("Commande introuvable");

    let content: string;
    let fileName: string;
    let mimeType: string;

    switch (format) {
      case 'html_thermal':
        content = generateThermalHTML(commande, documentType, printerWidth);
        fileName = `thermal_${documentType}_${commande.numero_commande}_${Date.now()}.html`;
        mimeType = "text/html";
        break;

      case 'escpos':
        content = generateESCPOS(commande, documentType);
        fileName = `escpos_${documentType}_${commande.numero_commande}_${Date.now()}.txt`;
        mimeType = "text/plain";
        break;

      case 'zpl':
        content = generateZPL(commande, documentType);
        fileName = `zpl_${documentType}_${commande.numero_commande}_${Date.now()}.zpl`;
        mimeType = "text/plain";
        break;

      default:
        throw new Error(`Format non supporté: ${format}`);
    }

    // Upload du document
    const blob = new Blob([content], { type: mimeType });
    const { data: uploadData, error: uploadError } = await supabaseClient.storage
      .from("documents-commande")
      .upload(fileName, blob, {
        contentType: mimeType,
        upsert: false,
      });

    if (uploadError) throw uploadError;

    const { data: { publicUrl } } = supabaseClient.storage
      .from("documents-commande")
      .getPublicUrl(fileName);

    // Enregistrer dans document_commande
    const { error: docError } = await supabaseClient
      .from("document_commande")
      .insert({
        commande_id: commandeId,
        type_document: documentType,
        categorie: documentType === 'shipping_label' ? 'transport' : 'interne',
        nom_fichier: fileName,
        url_fichier: publicUrl,
        format: format.toUpperCase(),
        taille_fichier: content.length,
        date_generation: new Date().toISOString(),
      });

    if (docError) throw docError;

    return new Response(
      JSON.stringify({
        success: true,
        url: publicUrl,
        fileName,
        format,
        size: content.length
      }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );

  } catch (error) {
    console.error("Erreur:", error);
    return new Response(
      JSON.stringify({ error: error.message }),
      {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" }
      }
    );
  }
});

/**
 * Génère un HTML optimisé pour imprimante thermique
 * Largeur standard: 80mm (576px @ 180 DPI)
 */
function generateThermalHTML(commande: any, documentType: string, widthMm: number): string {
  const widthPx = Math.floor((widthMm / 25.4) * 180); // Conversion mm to px @ 180 DPI

  if (documentType === 'picking_slip') {
    return generateThermalPickingSlip(commande, widthPx);
  } else if (documentType === 'shipping_label') {
    return generateThermalShippingLabel(commande, widthPx);
  } else if (documentType === 'product_label') {
    return generateThermalProductLabel(commande, widthPx);
  }

  throw new Error(`Type de document non supporté: ${documentType}`);
}

function generateThermalPickingSlip(commande: any, widthPx: number): string {
  return `<!DOCTYPE html>
<html>
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=${widthPx}px">
  <style>
    @page {
      size: ${widthPx}px auto;
      margin: 0;
    }
    @media print {
      body { margin: 0; padding: 0; }
      .no-print { display: none !important; }
    }
    * {
      margin: 0;
      padding: 0;
      box-sizing: border-box;
    }
    body {
      font-family: 'Courier New', monospace;
      width: ${widthPx}px;
      padding: 8px;
      font-size: 10pt;
      line-height: 1.3;
    }
    .header {
      text-align: center;
      border-bottom: 2px solid #000;
      padding-bottom: 8px;
      margin-bottom: 10px;
    }
    .title {
      font-size: 14pt;
      font-weight: bold;
      margin-bottom: 4px;
    }
    .order-number {
      font-size: 16pt;
      font-weight: bold;
      margin: 4px 0;
    }
    .section {
      margin: 10px 0;
      padding: 6px 0;
      border-top: 1px dashed #000;
    }
    .label {
      font-weight: bold;
      display: inline-block;
      width: 100px;
    }
    .value {
      display: inline-block;
    }
    .item {
      margin: 8px 0;
      padding: 6px;
      border: 1px solid #000;
      background: #f5f5f5;
    }
    .item-ref {
      font-weight: bold;
      font-size: 11pt;
    }
    .item-name {
      margin: 2px 0;
    }
    .item-location {
      font-weight: bold;
      font-size: 12pt;
      background: #000;
      color: #fff;
      padding: 4px;
      margin: 4px 0;
      text-align: center;
    }
    .item-qty {
      font-size: 13pt;
      font-weight: bold;
      text-align: center;
      margin: 4px 0;
    }
    .checkbox {
      width: 20px;
      height: 20px;
      border: 2px solid #000;
      display: inline-block;
      vertical-align: middle;
      margin-right: 8px;
    }
    .footer {
      margin-top: 12px;
      padding-top: 8px;
      border-top: 2px solid #000;
      font-size: 9pt;
      text-align: center;
    }
    .barcode {
      text-align: center;
      font-family: 'Libre Barcode 128', monospace;
      font-size: 32pt;
      margin: 8px 0;
    }
  </style>
</head>
<body>
  <div class="header">
    <div class="title">BORDEREAU DE PREPARATION</div>
    <div class="order-number">#${commande.numero_commande}</div>
    <div>${new Date().toLocaleDateString('fr-FR')} ${new Date().toLocaleTimeString('fr-FR', { hour: '2-digit', minute: '2-digit' })}</div>
  </div>

  <div class="section">
    <div><span class="label">Client:</span> ${commande.nom_client || '-'}</div>
    <div><span class="label">Ville:</span> ${commande.ville}, ${commande.pays_code}</div>
    <div><span class="label">Transport:</span> ${commande.methode_expedition || 'Standard'}</div>
  </div>

  <div class="section">
    <div style="font-weight: bold; text-align: center; margin-bottom: 8px;">
      ${commande.lignes.length} ARTICLE(S) A PREPARER
    </div>

    ${commande.lignes.map((ligne: any, index: number) => `
      <div class="item">
        <div style="display: flex; align-items: center; margin-bottom: 4px;">
          <span class="checkbox"></span>
          <span style="font-size: 11pt; font-weight: bold;">Article ${index + 1}/${commande.lignes.length}</span>
        </div>

        <div class="item-location">
          ${ligne.emplacement_picking_id || 'EMPLACEMENT A DEFINIR'}
        </div>

        <div class="item-ref">${ligne.produit_reference}</div>
        <div class="item-name">${ligne.produit_nom}</div>

        <div class="item-qty">
          QUANTITE: ${ligne.quantite_commandee}
        </div>

        ${ligne.numero_lot ? `<div style="margin-top: 4px;"><strong>Lot:</strong> ${ligne.numero_lot}</div>` : ''}
      </div>
    `).join('\n')}
  </div>

  <div class="footer">
    <div style="margin: 4px 0;">Prepare par: _____________</div>
    <div style="margin: 4px 0;">Verifie par: _____________</div>
    <div style="margin-top: 8px; font-size: 8pt;">
      Document genere automatiquement - WMS Speed E-Log
    </div>
  </div>
</body>
</html>`;
}

function generateThermalShippingLabel(commande: any, widthPx: number): string {
  return `<!DOCTYPE html>
<html>
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=${widthPx}px">
  <style>
    @page { size: ${widthPx}px auto; margin: 0; }
    @media print { body { margin: 0; padding: 0; } }
    * { margin: 0; padding: 0; box-sizing: border-box; }
    body {
      font-family: Arial, sans-serif;
      width: ${widthPx}px;
      padding: 10px;
      font-size: 11pt;
    }
    .header {
      text-align: center;
      font-size: 18pt;
      font-weight: bold;
      margin-bottom: 12px;
      padding: 10px;
      background: #000;
      color: #fff;
    }
    .destination {
      font-size: 16pt;
      font-weight: bold;
      margin: 10px 0;
      text-align: center;
      padding: 8px;
      border: 3px solid #000;
    }
    .address {
      margin: 10px 0;
      padding: 8px;
      border: 2px solid #000;
      line-height: 1.5;
    }
    .tracking {
      text-align: center;
      font-size: 14pt;
      font-weight: bold;
      margin: 12px 0;
      padding: 8px;
      background: #f0f0f0;
      border: 2px solid #000;
    }
    .barcode {
      text-align: center;
      font-family: 'Libre Barcode 128', monospace;
      font-size: 36pt;
      margin: 10px 0;
    }
  </style>
</head>
<body>
  <div class="header">
    ETIQUETTE EXPEDITION
  </div>

  <div class="destination">
    ${commande.ville?.toUpperCase() || ''}, ${commande.pays_code}
  </div>

  <div class="address">
    <div style="font-weight: bold; font-size: 13pt; margin-bottom: 4px;">
      ${commande.adresse_nom || commande.nom_client}
    </div>
    <div>${commande.adresse_ligne_1}</div>
    ${commande.adresse_ligne_2 ? `<div>${commande.adresse_ligne_2}</div>` : ''}
    <div style="font-weight: bold; margin-top: 4px;">
      ${commande.code_postal} ${commande.ville}
    </div>
    <div style="font-weight: bold; font-size: 12pt;">
      ${commande.pays_code}
    </div>
    ${commande.telephone ? `<div style="margin-top: 4px;">Tel: ${commande.telephone}</div>` : ''}
  </div>

  ${commande.tracking_number ? `
    <div class="tracking">
      ${commande.tracking_number}
    </div>
    <div class="barcode">
      *${commande.tracking_number}*
    </div>
  ` : ''}

  <div style="margin-top: 12px; text-align: center; font-size: 9pt;">
    Commande: ${commande.numero_commande}
    <br>
    Service: ${commande.service_transport || 'Standard'}
  </div>
</body>
</html>`;
}

function generateThermalProductLabel(commande: any, widthPx: number): string {
  // Pour les étiquettes produit, on génère une par ligne de commande
  const ligne = commande.lignes[0]; // Premier produit

  return `<!DOCTYPE html>
<html>
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=${widthPx}px">
  <style>
    @page { size: ${widthPx}px auto; margin: 0; }
    @media print { body { margin: 0; padding: 0; } }
    * { margin: 0; padding: 0; box-sizing: border-box; }
    body {
      font-family: Arial, sans-serif;
      width: ${widthPx}px;
      padding: 8px;
      font-size: 10pt;
    }
    .product-name {
      font-weight: bold;
      font-size: 12pt;
      margin-bottom: 6px;
      text-align: center;
    }
    .reference {
      font-size: 14pt;
      font-weight: bold;
      text-align: center;
      margin: 8px 0;
      padding: 6px;
      background: #000;
      color: #fff;
    }
    .barcode {
      text-align: center;
      font-family: 'Libre Barcode 128', monospace;
      font-size: 32pt;
      margin: 8px 0;
    }
    .info {
      margin: 4px 0;
      font-size: 9pt;
    }
  </style>
</head>
<body>
  <div class="product-name">${ligne?.produit_nom || 'Produit'}</div>
  <div class="reference">${ligne?.produit_reference || ''}</div>

  ${ligne?.code_barre_ean ? `
    <div class="barcode">*${ligne.code_barre_ean}*</div>
    <div style="text-align: center; font-size: 9pt;">${ligne.code_barre_ean}</div>
  ` : ''}

  <div class="info">Quantite: ${ligne?.quantite_commandee || 1}</div>
  ${ligne?.numero_lot ? `<div class="info">Lot: ${ligne.numero_lot}</div>` : ''}
  <div class="info">Commande: ${commande.numero_commande}</div>
</body>
</html>`;
}

/**
 * Génère des commandes ESC/POS pour imprimantes thermiques Epson et compatibles
 */
function generateESCPOS(commande: any, documentType: string): string {
  const ESC = '\x1B';
  const GS = '\x1D';

  let escpos = '';

  // Initialisation
  escpos += ESC + '@'; // Reset
  escpos += ESC + 'a' + '\x01'; // Centrer
  escpos += ESC + '!' + '\x30'; // Double hauteur et largeur
  escpos += 'BORDEREAU PREPARATION\n';
  escpos += ESC + '!' + '\x20'; // Double largeur
  escpos += `#${commande.numero_commande}\n`;
  escpos += ESC + '!' + '\x00'; // Normal
  escpos += '\n';

  // Informations commande
  escpos += ESC + 'a' + '\x00'; // Aligner à gauche
  escpos += `Client: ${commande.nom_client || '-'}\n`;
  escpos += `Ville: ${commande.ville}, ${commande.pays_code}\n`;
  escpos += `Transport: ${commande.methode_expedition || 'Standard'}\n`;
  escpos += '--------------------------------\n';

  // Articles
  commande.lignes.forEach((ligne: any, index: number) => {
    escpos += ESC + '!' + '\x10'; // Double hauteur
    escpos += `Article ${index + 1}/${commande.lignes.length}\n`;
    escpos += ESC + '!' + '\x00'; // Normal
    escpos += `Ref: ${ligne.produit_reference}\n`;
    escpos += `${ligne.produit_nom}\n`;
    escpos += ESC + '!' + '\x20'; // Double largeur
    escpos += `QTE: ${ligne.quantite_commandee}\n`;
    escpos += ESC + '!' + '\x00'; // Normal
    if (ligne.emplacement_picking_id) {
      escpos += `Emplacement: ${ligne.emplacement_picking_id}\n`;
    }
    escpos += '--------------------------------\n';
  });

  // Pied de page
  escpos += '\n';
  escpos += ESC + 'a' + '\x01'; // Centrer
  escpos += `${new Date().toLocaleDateString('fr-FR')}\n`;
  escpos += 'WMS Speed E-Log\n';
  escpos += '\n\n\n';

  // Coupe papier (si supporté)
  escpos += GS + 'V' + '\x00';

  return escpos;
}

/**
 * Génère du ZPL pour imprimantes Zebra
 */
function generateZPL(commande: any, documentType: string): string {
  let zpl = '^XA\n'; // Début du label

  // Configuration
  zpl += '^CF0,40\n'; // Police par défaut, taille 40
  zpl += '^FO50,50^FDBORDEREAU PREPARATION^FS\n';
  zpl += '^CF0,60\n';
  zpl += `^FO50,100^FD#${commande.numero_commande}^FS\n`;

  // Informations
  zpl += '^CF0,30\n';
  let yPos = 180;
  zpl += `^FO50,${yPos}^FDClient: ${commande.nom_client || '-'}^FS\n`;
  yPos += 40;
  zpl += `^FO50,${yPos}^FDVille: ${commande.ville}, ${commande.pays_code}^FS\n`;
  yPos += 40;

  // Ligne de séparation
  zpl += `^FO50,${yPos}^GB700,3,3^FS\n`;
  yPos += 20;

  // Articles
  commande.lignes.forEach((ligne: any, index: number) => {
    zpl += '^CF0,35\n';
    zpl += `^FO50,${yPos}^FDArticle ${index + 1}/${commande.lignes.length}^FS\n`;
    yPos += 40;

    zpl += '^CF0,25\n';
    zpl += `^FO50,${yPos}^FDRef: ${ligne.produit_reference}^FS\n`;
    yPos += 35;

    zpl += `^FO50,${yPos}^FD${ligne.produit_nom.substring(0, 40)}^FS\n`;
    yPos += 35;

    zpl += '^CF0,40\n';
    zpl += `^FO50,${yPos}^FDQTE: ${ligne.quantite_commandee}^FS\n`;
    yPos += 50;

    if (ligne.emplacement_picking_id) {
      zpl += '^CF0,30\n';
      zpl += `^FO50,${yPos}^FDEmplacement: ${ligne.emplacement_picking_id}^FS\n`;
      yPos += 40;
    }

    yPos += 20; // Espace entre articles
  });

  zpl += '^XZ\n'; // Fin du label

  return zpl;
}
