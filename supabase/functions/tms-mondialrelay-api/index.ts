import { serve } from 'https://deno.land/std@0.168.0/http/server.ts'
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

interface MondialRelaySearchRequest {
  countryCode: string // FR, BE, etc.
  postalCode: string
  city?: string
  numResults?: number // Max 100
  deliveryMode?: 'LCC' | '24R' | '24L' | 'ESP' // LCC=Standard, 24R=24h, etc.
  weight?: number // en grammes
}

interface MondialRelayShipRequest {
  planTransportId: string
  relayPointCode: string
  deliveryMode: 'LCC' | '24R' | '24L' | 'ESP'
  insurance?: number // Montant de l'assurance
  deliveryInstructions?: string
}

interface MondialRelayTrackRequest {
  trackingNumber: string
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

    const { action, ...params } = await req.json()

    // Récupérer les credentials Mondial Relay depuis les secrets
    const mrMerchantId = Deno.env.get('MONDIAL_RELAY_MERCHANT_ID')
    const mrApiKey = Deno.env.get('MONDIAL_RELAY_API_KEY')

    if (!mrMerchantId || !mrApiKey) {
      throw new Error('Mondial Relay API credentials not configured')
    }

    let result

    switch (action) {
      case 'searchRelayPoints':
        result = await searchRelayPoints(mrMerchantId, mrApiKey, params as MondialRelaySearchRequest)
        break
      case 'ship':
        result = await createShipment(mrMerchantId, mrApiKey, params as MondialRelayShipRequest, supabase)
        break
      case 'track':
        result = await trackShipment(mrMerchantId, mrApiKey, params as MondialRelayTrackRequest)
        break
      default:
        throw new Error(`Unknown action: ${action}`)
    }

    return new Response(JSON.stringify(result), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    })
  } catch (error) {
    console.error('Mondial Relay API Error:', error)
    return new Response(
      JSON.stringify({ error: error.message }),
      {
        status: 400,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      }
    )
  }
})

/**
 * Générer la signature MD5 pour Mondial Relay
 */
async function generateSignature(params: string, apiKey: string): Promise<string> {
  const data = params + apiKey
  const encoder = new TextEncoder()
  const hashBuffer = await crypto.subtle.digest('MD5', encoder.encode(data))
  const hashArray = Array.from(new Uint8Array(hashBuffer))
  const hashHex = hashArray.map(b => b.toString(16).padStart(2, '0')).join('')
  return hashHex.toUpperCase()
}

/**
 * Rechercher des points relais Mondial Relay
 */
async function searchRelayPoints(
  merchantId: string,
  apiKey: string,
  request: MondialRelaySearchRequest
): Promise<any> {
  const apiUrl = 'https://api.mondialrelay.com/Web_Services.asmx'

  // Construire les paramètres pour la recherche
  const params = {
    Enseigne: merchantId,
    Pays: request.countryCode,
    CP: request.postalCode,
    Ville: request.city || '',
    NbResultats: (request.numResults || 20).toString(),
    Action: request.deliveryMode || 'LCC',
    Poids: request.weight ? (request.weight / 1000).toString() : '', // Convertir en kg
  }

  // Générer la signature
  const signatureString = [
    params.Enseigne,
    params.Pays,
    params.CP,
    params.Ville,
    params.NbResultats,
    params.Action,
    params.Poids,
  ].join('')
  const signature = await generateSignature(signatureString, apiKey)

  // Construire le SOAP request
  const soapRequest = `<?xml version="1.0" encoding="utf-8"?>
<soap:Envelope xmlns:soap="http://schemas.xmlsoap.org/soap/envelope/" xmlns:tns="http://www.mondialrelay.fr/webservice/">
  <soap:Body>
    <tns:WSI3_PointRelais_Recherche>
      <tns:Enseigne>${params.Enseigne}</tns:Enseigne>
      <tns:Pays>${params.Pays}</tns:Pays>
      <tns:CP>${params.CP}</tns:CP>
      <tns:Ville>${params.Ville}</tns:Ville>
      <tns:NbResultats>${params.NbResultats}</tns:NbResultats>
      <tns:Action>${params.Action}</tns:Action>
      <tns:Poids>${params.Poids}</tns:Poids>
      <tns:Security>${signature}</tns:Security>
    </tns:WSI3_PointRelais_Recherche>
  </soap:Body>
</soap:Envelope>`

  const response = await fetch(apiUrl, {
    method: 'POST',
    headers: {
      'Content-Type': 'text/xml; charset=utf-8',
      'SOAPAction': 'http://www.mondialrelay.fr/webservice/WSI3_PointRelais_Recherche',
    },
    body: soapRequest,
  })

  if (!response.ok) {
    throw new Error(`Mondial Relay search failed: ${response.statusText}`)
  }

  const xmlText = await response.text()

  // Parser la réponse XML (simplifié - en production utiliser un parser XML)
  const relayPoints = parseRelayPointsXML(xmlText)

  return {
    relayPoints,
    count: relayPoints.length,
    raw: xmlText,
  }
}

/**
 * Parser simple de la réponse XML des points relais
 * En production, utiliser un vrai parser XML
 */
function parseRelayPointsXML(xml: string): any[] {
  const relayPoints: any[] = []

  // Regex pour extraire les points relais (simplifié)
  const relayRegex = /<PointRelais_Detail>(.*?)<\/PointRelais_Detail>/gs
  const matches = xml.matchAll(relayRegex)

  for (const match of matches) {
    const relayXml = match[1]

    const getXmlValue = (tag: string): string => {
      const regex = new RegExp(`<${tag}>(.*?)<\/${tag}>`, 's')
      const match = relayXml.match(regex)
      return match ? match[1].trim() : ''
    }

    relayPoints.push({
      code: getXmlValue('Num'),
      name: getXmlValue('LgAdr1'),
      address: {
        street: getXmlValue('LgAdr3'),
        city: getXmlValue('Ville'),
        postalCode: getXmlValue('CP'),
        country: getXmlValue('Pays'),
      },
      coordinates: {
        latitude: parseFloat(getXmlValue('Latitude')) / 100000, // Mondial Relay retourne en micro-degrés
        longitude: parseFloat(getXmlValue('Longitude')) / 100000,
      },
      openingHours: {
        monday: getXmlValue('Horaires_Lundi'),
        tuesday: getXmlValue('Horaires_Mardi'),
        wednesday: getXmlValue('Horaires_Mercredi'),
        thursday: getXmlValue('Horaires_Jeudi'),
        friday: getXmlValue('Horaires_Vendredi'),
        saturday: getXmlValue('Horaires_Samedi'),
        sunday: getXmlValue('Horaires_Dimanche'),
      },
      distance: parseInt(getXmlValue('Distance')) || 0, // en mètres
      typePoint: getXmlValue('TypeActivite'),
      available: getXmlValue('Disponibilite') !== '0',
    })
  }

  return relayPoints
}

/**
 * Créer une expédition Mondial Relay
 */
async function createShipment(
  merchantId: string,
  apiKey: string,
  request: MondialRelayShipRequest,
  supabase: any
): Promise<any> {
  // Récupérer les infos du plan transport
  const { data: plan, error: planError } = await supabase
    .from('plan_transport')
    .select('*, client(*)')
    .eq('id', request.planTransportId)
    .single()

  if (planError || !plan) {
    throw new Error('Plan transport not found')
  }

  const apiUrl = 'https://api.mondialrelay.com/Web_Services.asmx'

  // Préparer les données d'expédition
  const poidsGrammes = Math.round((plan.poids_total_kg || 1) * 1000)
  const montantCOD = '0' // Contre-remboursement (à adapter)
  const montantAssurance = request.insurance ? (request.insurance * 100).toString() : '0' // En centimes

  // Numéro d'expédition unique
  const expeditionNumber = `MR${Date.now()}`

  const params = {
    Enseigne: merchantId,
    ModeCol: 'CCC', // Point de collecte
    ModeLiv: request.deliveryMode,
    NDossier: expeditionNumber,
    NClient: plan.client_id?.substring(0, 9) || '',
    Expe_Langage: 'FR',
    Expe_Ad1: plan.origine_adresse?.nom?.substring(0, 32) || '',
    Expe_Ad3: plan.origine_adresse?.adresse_ligne_1?.substring(0, 32) || '',
    Expe_Ville: plan.origine_adresse?.ville?.substring(0, 26) || '',
    Expe_CP: plan.origine_adresse?.code_postal || '',
    Expe_Pays: plan.origine_adresse?.pays || 'FR',
    Expe_Tel1: plan.origine_adresse?.telephone?.replace(/[^0-9]/g, '').substring(0, 10) || '',
    Expe_Mail: plan.origine_adresse?.email?.substring(0, 70) || '',
    Dest_Langage: 'FR',
    Dest_Ad1: plan.destination_adresse?.nom?.substring(0, 32) || '',
    Dest_Ad3: plan.destination_adresse?.adresse_ligne_1?.substring(0, 32) || '',
    Dest_Ville: plan.destination_adresse?.ville?.substring(0, 26) || '',
    Dest_CP: plan.destination_adresse?.code_postal || '',
    Dest_Pays: plan.destination_adresse?.pays || 'FR',
    Dest_Tel1: plan.destination_adresse?.telephone?.replace(/[^0-9]/g, '').substring(0, 10) || '',
    Dest_Mail: plan.destination_adresse?.email?.substring(0, 70) || '',
    Poids: poidsGrammes.toString(),
    LIV_Rel: request.relayPointCode,
    Montant_COD: montantCOD,
    Assurance: montantAssurance,
    Instructions: request.deliveryInstructions?.substring(0, 30) || '',
  }

  // Générer la signature
  const signatureString = [
    params.Enseigne,
    params.ModeCol,
    params.ModeLiv,
    params.NDossier,
    params.NClient,
    params.Expe_Langage,
    params.Expe_Ad1,
    params.Expe_Ad3,
    params.Expe_Ville,
    params.Expe_CP,
    params.Expe_Pays,
    params.Expe_Tel1,
    params.Expe_Mail,
    params.Dest_Langage,
    params.Dest_Ad1,
    params.Dest_Ad3,
    params.Dest_Ville,
    params.Dest_CP,
    params.Dest_Pays,
    params.Dest_Tel1,
    params.Dest_Mail,
    params.Poids,
    params.LIV_Rel,
    params.Montant_COD,
    params.Assurance,
    params.Instructions,
  ].join('')
  const signature = await generateSignature(signatureString, apiKey)

  // Construire le SOAP request
  const soapRequest = `<?xml version="1.0" encoding="utf-8"?>
<soap:Envelope xmlns:soap="http://schemas.xmlsoap.org/soap/envelope/" xmlns:tns="http://www.mondialrelay.fr/webservice/">
  <soap:Body>
    <tns:WSI2_CreationExpedition>
      <tns:Enseigne>${params.Enseigne}</tns:Enseigne>
      <tns:ModeCol>${params.ModeCol}</tns:ModeCol>
      <tns:ModeLiv>${params.ModeLiv}</tns:ModeLiv>
      <tns:NDossier>${params.NDossier}</tns:NDossier>
      <tns:NClient>${params.NClient}</tns:NClient>
      <tns:Expe_Langage>${params.Expe_Langage}</tns:Expe_Langage>
      <tns:Expe_Ad1>${params.Expe_Ad1}</tns:Expe_Ad1>
      <tns:Expe_Ad3>${params.Expe_Ad3}</tns:Expe_Ad3>
      <tns:Expe_Ville>${params.Expe_Ville}</tns:Expe_Ville>
      <tns:Expe_CP>${params.Expe_CP}</tns:Expe_CP>
      <tns:Expe_Pays>${params.Expe_Pays}</tns:Expe_Pays>
      <tns:Expe_Tel1>${params.Expe_Tel1}</tns:Expe_Tel1>
      <tns:Expe_Mail>${params.Expe_Mail}</tns:Expe_Mail>
      <tns:Dest_Langage>${params.Dest_Langage}</tns:Dest_Langage>
      <tns:Dest_Ad1>${params.Dest_Ad1}</tns:Dest_Ad1>
      <tns:Dest_Ad3>${params.Dest_Ad3}</tns:Dest_Ad3>
      <tns:Dest_Ville>${params.Dest_Ville}</tns:Dest_Ville>
      <tns:Dest_CP>${params.Dest_CP}</tns:Dest_CP>
      <tns:Dest_Pays>${params.Dest_Pays}</tns:Dest_Pays>
      <tns:Dest_Tel1>${params.Dest_Tel1}</tns:Dest_Tel1>
      <tns:Dest_Mail>${params.Dest_Mail}</tns:Dest_Mail>
      <tns:Poids>${params.Poids}</tns:Poids>
      <tns:LIV_Rel>${params.LIV_Rel}</tns:LIV_Rel>
      <tns:Montant_COD>${params.Montant_COD}</tns:Montant_COD>
      <tns:Assurance>${params.Assurance}</tns:Assurance>
      <tns:Instructions>${params.Instructions}</tns:Instructions>
      <tns:Security>${signature}</tns:Security>
    </tns:WSI2_CreationExpedition>
  </soap:Body>
</soap:Envelope>`

  const response = await fetch(apiUrl, {
    method: 'POST',
    headers: {
      'Content-Type': 'text/xml; charset=utf-8',
      'SOAPAction': 'http://www.mondialrelay.fr/webservice/WSI2_CreationExpedition',
    },
    body: soapRequest,
  })

  if (!response.ok) {
    throw new Error(`Mondial Relay shipment creation failed: ${response.statusText}`)
  }

  const xmlText = await response.text()

  // Parser la réponse
  const trackingNumber = extractXmlValue(xmlText, 'ExpeditionNum')
  const labelUrl = `https://www.mondialrelay.fr/tracking/?exp=${trackingNumber}`

  if (!trackingNumber) {
    throw new Error('Failed to create Mondial Relay shipment')
  }

  // Mettre à jour le plan transport
  await supabase
    .from('plan_transport')
    .update({
      tracking_number: trackingNumber,
      label_url: labelUrl,
      statut: 'confirme',
      metadata: {
        ...plan.metadata,
        mondial_relay: {
          expeditionNumber,
          relayPointCode: request.relayPointCode,
          deliveryMode: request.deliveryMode,
        },
      },
    })
    .eq('id', request.planTransportId)

  // Créer un événement de tracking
  await supabase.from('tracking_event').insert({
    plan_transport_id: request.planTransportId,
    type_evenement: 'confirmed',
    description: `Expédition Mondial Relay créée - Tracking: ${trackingNumber}`,
    source: 'api_carrier',
    transporteur_reference: trackingNumber,
  })

  return {
    success: true,
    trackingNumber,
    expeditionNumber,
    labelUrl,
    raw: xmlText,
  }
}

/**
 * Suivre une expédition Mondial Relay
 */
async function trackShipment(
  merchantId: string,
  apiKey: string,
  request: MondialRelayTrackRequest
): Promise<any> {
  const apiUrl = 'https://api.mondialrelay.com/Web_Services.asmx'

  const params = {
    Enseigne: merchantId,
    Expedition: request.trackingNumber,
    Langue: 'FR',
  }

  // Générer la signature
  const signatureString = [params.Enseigne, params.Expedition, params.Langue].join('')
  const signature = await generateSignature(signatureString, apiKey)

  const soapRequest = `<?xml version="1.0" encoding="utf-8"?>
<soap:Envelope xmlns:soap="http://schemas.xmlsoap.org/soap/envelope/" xmlns:tns="http://www.mondialrelay.fr/webservice/">
  <soap:Body>
    <tns:WSI2_TracingColisDetaille>
      <tns:Enseigne>${params.Enseigne}</tns:Enseigne>
      <tns:Expedition>${params.Expedition}</tns:Expedition>
      <tns:Langue>${params.Langue}</tns:Langue>
      <tns:Security>${signature}</tns:Security>
    </tns:WSI2_TracingColisDetaille>
  </soap:Body>
</soap:Envelope>`

  const response = await fetch(apiUrl, {
    method: 'POST',
    headers: {
      'Content-Type': 'text/xml; charset=utf-8',
      'SOAPAction': 'http://www.mondialrelay.fr/webservice/WSI2_TracingColisDetaille',
    },
    body: soapRequest,
  })

  if (!response.ok) {
    throw new Error(`Mondial Relay tracking failed: ${response.statusText}`)
  }

  const xmlText = await response.text()

  // Parser les événements de tracking
  const events = parseTrackingEventsXML(xmlText)
  const currentStatus = events.length > 0 ? events[0].status : 'unknown'

  return {
    trackingNumber: request.trackingNumber,
    status: currentStatus,
    events,
    raw: xmlText,
  }
}

/**
 * Extraire une valeur d'un XML simple
 */
function extractXmlValue(xml: string, tag: string): string {
  const regex = new RegExp(`<${tag}>(.*?)<\/${tag}>`, 's')
  const match = xml.match(regex)
  return match ? match[1].trim() : ''
}

/**
 * Parser les événements de tracking
 */
function parseTrackingEventsXML(xml: string): any[] {
  const events: any[] = []

  const eventRegex = /<ret_WSI2_TracingColisDetaille>(.*?)<\/ret_WSI2_TracingColisDetaille>/gs
  const matches = xml.matchAll(eventRegex)

  for (const match of matches) {
    const eventXml = match[1]

    events.push({
      timestamp: extractXmlValue(eventXml, 'Date'),
      status: extractXmlValue(eventXml, 'Libelle'),
      location: extractXmlValue(eventXml, 'Lieu'),
      relayPoint: extractXmlValue(eventXml, 'Relais'),
    })
  }

  return events
}
