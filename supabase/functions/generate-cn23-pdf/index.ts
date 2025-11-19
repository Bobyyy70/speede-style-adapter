import { serve } from 'https://deno.land/std@0.168.0/http/server.ts'
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

interface CN23GenerateRequest {
  cn23_declaration_id: string
}

serve(async (req) => {
  // CORS preflight
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders })
  }

  try {
    const supabase = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? ''
    )

    const { cn23_declaration_id } = await req.json() as CN23GenerateRequest

    // Récupérer la déclaration CN23
    const { data: cn23, error: cn23Error } = await supabase
      .from('cn23_declaration')
      .select('*')
      .eq('id', cn23_declaration_id)
      .single()

    if (cn23Error || !cn23) {
      throw new Error('Déclaration CN23 non trouvée')
    }

    // Générer le HTML du CN23
    const html = generateCN23HTML(cn23)

    // Convertir HTML en PDF (utiliser un service externe ou bibliothèque)
    // Pour cet exemple, on retourne le HTML et on le convertit côté client
    // En production, utiliser Puppeteer, wkhtmltopdf, ou un service comme PDFShift

    const pdfBlob = await convertHTMLToPDF(html)

    // Upload vers Supabase Storage
    const fileName = `cn23/${cn23.numero_cn23}.pdf`
    const { data: uploadData, error: uploadError } = await supabase.storage
      .from('documents')
      .upload(fileName, pdfBlob, {
        contentType: 'application/pdf',
        upsert: true,
      })

    if (uploadError) {
      throw new Error(`Erreur upload: ${uploadError.message}`)
    }

    // Obtenir l'URL publique
    const { data: { publicUrl } } = supabase.storage
      .from('documents')
      .getPublicUrl(fileName)

    // Mettre à jour la déclaration CN23
    await supabase
      .from('cn23_declaration')
      .update({
        pdf_url: publicUrl,
        pdf_generated_at: new Date().toISOString(),
        statut: 'generated',
      })
      .eq('id', cn23_declaration_id)

    return new Response(
      JSON.stringify({
        success: true,
        pdf_url: publicUrl,
        numero_cn23: cn23.numero_cn23,
      }),
      {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      }
    )
  } catch (error: any) {
    console.error('CN23 PDF Generation Error:', error)
    return new Response(
      JSON.stringify({ error: error?.message || 'Unknown error' }),
      {
        status: 400,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      }
    )
  }
})

/**
 * Générer le HTML du formulaire CN23
 */
function generateCN23HTML(cn23: any): string {
  const articles = cn23.articles as any[]
  const expediteur = cn23.expediteur
  const destinataire = cn23.destinataire

  return `<!DOCTYPE html>
<html>
<head>
  <meta charset="UTF-8">
  <title>CN23 - ${cn23.numero_cn23}</title>
  <style>
    @page {
      size: A4;
      margin: 10mm;
    }
    body {
      font-family: Arial, sans-serif;
      font-size: 10pt;
      line-height: 1.3;
      margin: 0;
      padding: 0;
    }
    .cn23-container {
      border: 2px solid #000;
      padding: 10px;
      max-width: 190mm;
      margin: 0 auto;
    }
    .header {
      text-align: center;
      border-bottom: 2px solid #000;
      padding-bottom: 10px;
      margin-bottom: 10px;
    }
    .header h1 {
      margin: 0;
      font-size: 18pt;
      font-weight: bold;
    }
    .header p {
      margin: 5px 0 0 0;
      font-size: 9pt;
    }
    .section {
      border: 1px solid #000;
      padding: 8px;
      margin-bottom: 10px;
    }
    .section-title {
      font-weight: bold;
      background: #f0f0f0;
      padding: 3px 5px;
      margin: -8px -8px 8px -8px;
      border-bottom: 1px solid #000;
    }
    .two-columns {
      display: flex;
      gap: 10px;
    }
    .two-columns > div {
      flex: 1;
    }
    table {
      width: 100%;
      border-collapse: collapse;
      margin-top: 5px;
    }
    table th,
    table td {
      border: 1px solid #000;
      padding: 4px;
      text-align: left;
      font-size: 9pt;
    }
    table th {
      background: #f0f0f0;
      font-weight: bold;
    }
    .totals {
      margin-top: 10px;
      text-align: right;
      font-weight: bold;
    }
    .field {
      margin-bottom: 5px;
    }
    .field-label {
      font-weight: bold;
      display: inline-block;
      width: 120px;
    }
    .checkbox-group {
      display: flex;
      gap: 15px;
      margin-top: 5px;
    }
    .checkbox {
      display: inline-flex;
      align-items: center;
      gap: 5px;
    }
    .checkbox input {
      width: 15px;
      height: 15px;
    }
    .signature-area {
      margin-top: 20px;
      display: flex;
      justify-content: space-between;
    }
    .signature-box {
      width: 45%;
      border: 1px solid #000;
      padding: 10px;
      min-height: 60px;
    }
  </style>
</head>
<body>
  <div class="cn23-container">
    <!-- En-tête -->
    <div class="header">
      <h1>CN 23</h1>
      <p>DÉCLARATION EN DOUANE / CUSTOMS DECLARATION</p>
      <p style="font-size: 8pt; margin-top: 5px;">
        Peut être ouvert d'office / May be opened officially
      </p>
      <p style="margin-top: 10px; font-weight: bold;">N° ${cn23.numero_cn23}</p>
    </div>

    <!-- Type d'envoi -->
    <div class="section">
      <div class="section-title">1. Type d'envoi / Type of shipment</div>
      <div class="checkbox-group">
        <div class="checkbox">
          <input type="checkbox" ${cn23.type_envoi === 'GIFT' ? 'checked' : ''} />
          <label>Cadeau / Gift</label>
        </div>
        <div class="checkbox">
          <input type="checkbox" ${cn23.type_envoi === 'SALE' ? 'checked' : ''} />
          <label>Vente de marchandises / Sale of goods</label>
        </div>
        <div class="checkbox">
          <input type="checkbox" ${cn23.type_envoi === 'SAMPLE' ? 'checked' : ''} />
          <label>Échantillon / Sample</label>
        </div>
        <div class="checkbox">
          <input type="checkbox" ${cn23.type_envoi === 'RETURN' ? 'checked' : ''} />
          <label>Retour / Return</label>
        </div>
        <div class="checkbox">
          <input type="checkbox" ${cn23.type_envoi === 'DOCUMENT' ? 'checked' : ''} />
          <label>Documents</label>
        </div>
        <div class="checkbox">
          <input type="checkbox" ${cn23.type_envoi === 'OTHER' ? 'checked' : ''} />
          <label>Autre / Other</label>
        </div>
      </div>
    </div>

    <!-- Expéditeur et Destinataire -->
    <div class="section">
      <div class="section-title">2. Expéditeur et Destinataire / Sender and Recipient</div>
      <div class="two-columns">
        <div>
          <strong>Expéditeur / Sender:</strong>
          <div class="field">
            <div>${expediteur.nom || ''}</div>
            <div>${expediteur.adresse_ligne_1 || ''}</div>
            ${expediteur.adresse_ligne_2 ? `<div>${expediteur.adresse_ligne_2}</div>` : ''}
            <div>${expediteur.code_postal || ''} ${expediteur.ville || ''}</div>
            <div>${expediteur.pays || ''}</div>
            ${expediteur.telephone ? `<div>Tél: ${expediteur.telephone}</div>` : ''}
          </div>
        </div>
        <div>
          <strong>Destinataire / Recipient:</strong>
          <div class="field">
            <div>${destinataire.nom || ''}</div>
            <div>${destinataire.adresse_ligne_1 || ''}</div>
            ${destinataire.adresse_ligne_2 ? `<div>${destinataire.adresse_ligne_2}</div>` : ''}
            <div>${destinataire.code_postal || ''} ${destinataire.ville || ''}</div>
            <div>${destinataire.pays || ''}</div>
            ${destinataire.telephone ? `<div>Tél: ${destinataire.telephone}</div>` : ''}
          </div>
        </div>
      </div>
    </div>

    <!-- Détail des marchandises -->
    <div class="section">
      <div class="section-title">3. Détail des marchandises / Detailed description of contents</div>
      <table>
        <thead>
          <tr>
            <th style="width: 35%;">Description</th>
            <th style="width: 10%;">Quantité<br/>Quantity</th>
            <th style="width: 10%;">Poids (kg)<br/>Weight</th>
            <th style="width: 15%;">Valeur (€)<br/>Value</th>
            <th style="width: 15%;">Code HS<br/>HS Code</th>
            <th style="width: 15%;">Origine<br/>Origin</th>
          </tr>
        </thead>
        <tbody>
          ${articles
            .map(
              (article) => `
            <tr>
              <td>${article.description || ''}</td>
              <td style="text-align: center;">${article.quantity || ''}</td>
              <td style="text-align: right;">${(article.weight_kg || 0).toFixed(2)}</td>
              <td style="text-align: right;">${(article.value_eur || 0).toFixed(2)} €</td>
              <td style="text-align: center;">${article.hs_code || ''}</td>
              <td style="text-align: center;">${article.origin_country || 'FR'}</td>
            </tr>
          `
            )
            .join('')}
        </tbody>
      </table>

      <div class="totals">
        <div>Poids total / Total weight: <strong>${cn23.poids_total_kg.toFixed(2)} kg</strong></div>
        <div>Valeur totale / Total value: <strong>${cn23.valeur_totale_eur.toFixed(2)} € (${cn23.devise || 'EUR'})</strong></div>
      </div>
    </div>

    <!-- Frais -->
    <div class="section">
      <div class="section-title">4. Frais / Fees</div>
      <div class="field">
        <span class="field-label">Frais de transport:</span>
        <span>${(cn23.frais_transport_eur || 0).toFixed(2)} €</span>
      </div>
      <div class="field">
        <span class="field-label">Assurance:</span>
        <span>${(cn23.frais_assurance_eur || 0).toFixed(2)} €</span>
      </div>
      <div class="field">
        <span class="field-label">Autres frais:</span>
        <span>${(cn23.autres_frais_eur || 0).toFixed(2)} €</span>
      </div>
    </div>

    <!-- Commentaires -->
    ${
      cn23.description_generale
        ? `
    <div class="section">
      <div class="section-title">5. Commentaires / Comments</div>
      <div>${cn23.description_generale}</div>
    </div>
    `
        : ''
    }

    <!-- Signature -->
    <div class="signature-area">
      <div class="signature-box">
        <div style="margin-bottom: 5px; font-weight: bold;">Date et signature de l'expéditeur</div>
        <div style="font-size: 8pt; color: #666;">Date and sender's signature</div>
      </div>
      <div class="signature-box">
        <div style="margin-bottom: 5px; font-weight: bold;">Cachet douanier</div>
        <div style="font-size: 8pt; color: #666;">Customs stamp</div>
      </div>
    </div>

    <!-- Mentions légales -->
    <div style="margin-top: 15px; font-size: 7pt; text-align: center; color: #666;">
      <p>Je certifie que les renseignements donnés dans cette déclaration sont exacts et que cet envoi ne contient aucun article dangereux ou interdit.</p>
      <p style="font-style: italic;">I certify that the particulars given in this declaration are correct and that this item does not contain any dangerous article or articles prohibited by legislation or by postal or customs regulations.</p>
    </div>
  </div>
</body>
</html>`
}

/**
 * Convertir HTML en PDF
 * Note: Pour production, utiliser un service externe ou Puppeteer
 */
async function convertHTMLToPDF(html: string): Promise<Blob> {
  // Option 1: Utiliser un service externe comme PDFShift, HTML2PDF.app, etc.
  // Option 2: Utiliser Puppeteer dans un container Docker
  // Option 3: Retourner le HTML et convertir côté client avec html2pdf.js

  // Pour cet exemple, on utilise un service externe simple
  // En production, configurer un service dédié

  // Simulation: retourner le HTML comme blob PDF
  // IMPORTANT: Remplacer par une vraie conversion en production
  const encoder = new TextEncoder()
  const data = encoder.encode(html)

  // Pour l'instant, on retourne le HTML
  // TODO: Implémenter la vraie conversion PDF
  return new Blob([data], { type: 'text/html' })

  // Exemple avec un service externe (à configurer):
  /*
  const pdfShiftApiKey = Deno.env.get('PDFSHIFT_API_KEY')
  const response = await fetch('https://api.pdfshift.io/v3/convert/pdf', {
    method: 'POST',
    headers: {
      'Authorization': `Basic ${btoa(`api:${pdfShiftApiKey}`)}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      source: html,
      landscape: false,
      use_print: true,
    }),
  })

  if (!response.ok) {
    throw new Error('PDF conversion failed')
  }

  return await response.blob()
  */
}
