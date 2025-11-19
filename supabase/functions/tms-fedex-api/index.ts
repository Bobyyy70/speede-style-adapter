import { serve } from 'https://deno.land/std@0.168.0/http/server.ts'
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

interface FedExRateRequest {
  origin: {
    postalCode: string
    countryCode: string
  }
  destination: {
    postalCode: string
    countryCode: string
  }
  packages: Array<{
    weight: number // en kg
    length?: number // en cm
    width?: number
    height?: number
  }>
  service?: string // FEDEX_GROUND, INTERNATIONAL_PRIORITY, etc.
}

interface FedExShipRequest {
  planTransportId: string
  service: string
  labelFormat?: 'PDF' | 'PNG'
}

interface FedExTrackRequest {
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

    // Récupérer les credentials FedEx depuis les secrets
    const fedexApiKey = Deno.env.get('FEDEX_API_KEY')
    const fedexSecretKey = Deno.env.get('FEDEX_SECRET_KEY')
    const fedexAccountNumber = Deno.env.get('FEDEX_ACCOUNT_NUMBER')

    if (!fedexApiKey || !fedexSecretKey) {
      throw new Error('FedEx API credentials not configured')
    }

    // Obtenir le token OAuth
    const token = await getFedExToken(fedexApiKey, fedexSecretKey)

    let result

    switch (action) {
      case 'rate':
        result = await getRates(token, params as FedExRateRequest, fedexAccountNumber!)
        break
      case 'ship':
        result = await createShipment(token, params as FedExShipRequest, fedexAccountNumber!, supabase)
        break
      case 'track':
        result = await trackShipment(token, params as FedExTrackRequest)
        break
      default:
        throw new Error(`Unknown action: ${action}`)
    }

    return new Response(JSON.stringify(result), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    })
  } catch (error: any) {
    console.error('FedEx API Error:', error)
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
 * Obtenir un token OAuth FedEx
 */
async function getFedExToken(apiKey: string, secretKey: string): Promise<string> {
  const tokenUrl = 'https://apis.fedex.com/oauth/token'

  const response = await fetch(tokenUrl, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/x-www-form-urlencoded',
    },
    body: new URLSearchParams({
      grant_type: 'client_credentials',
      client_id: apiKey,
      client_secret: secretKey,
    }),
  })

  if (!response.ok) {
    throw new Error(`Failed to get FedEx token: ${response.statusText}`)
  }

  const data = await response.json()
  return data.access_token
}

/**
 * Obtenir les tarifs FedEx
 */
async function getRates(
  token: string,
  request: FedExRateRequest,
  accountNumber: string
): Promise<any> {
  const rateUrl = 'https://apis.fedex.com/rate/v1/rates/quotes'

  const payload = {
    accountNumber: {
      value: accountNumber,
    },
    requestedShipment: {
      shipper: {
        address: {
          postalCode: request.origin.postalCode,
          countryCode: request.origin.countryCode,
        },
      },
      recipient: {
        address: {
          postalCode: request.destination.postalCode,
          countryCode: request.destination.countryCode,
        },
      },
      pickupType: 'DROPOFF_AT_FEDEX_LOCATION',
      rateRequestType: ['LIST', 'ACCOUNT'],
      requestedPackageLineItems: request.packages.map((pkg, index) => ({
        sequenceNumber: index + 1,
        weight: {
          units: 'KG',
          value: pkg.weight,
        },
        dimensions: pkg.length && pkg.width && pkg.height ? {
          length: pkg.length,
          width: pkg.width,
          height: pkg.height,
          units: 'CM',
        } : undefined,
      })),
    },
  }

  const response = await fetch(rateUrl, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${token}`,
      'X-locale': 'fr_FR',
    },
    body: JSON.stringify(payload),
  })

  if (!response.ok) {
    const errorText = await response.text()
    throw new Error(`FedEx rate request failed: ${errorText}`)
  }

  const data = await response.json()

  // Formater les résultats
  const rates = data.output?.rateReplyDetails?.map((rate: any) => ({
    service: rate.serviceName,
    serviceType: rate.serviceType,
    totalCharge: {
      amount: rate.ratedShipmentDetails?.[0]?.totalNetCharge,
      currency: rate.ratedShipmentDetails?.[0]?.currency,
    },
    transitTime: rate.commit?.dateDetail?.dayFormat,
    deliveryDate: rate.commit?.dateDetail?.dayCxsFormat,
  })) || []

  return { rates, raw: data }
}

/**
 * Créer une expédition FedEx
 */
async function createShipment(
  token: string,
  request: FedExShipRequest,
  accountNumber: string,
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

  const shipUrl = 'https://apis.fedex.com/ship/v1/shipments'

  const payload = {
    labelResponseOptions: 'URL_ONLY',
    requestedShipment: {
      shipper: {
        contact: {
          personName: plan.origine_adresse?.nom || 'Shipper',
          phoneNumber: plan.origine_adresse?.telephone || '',
        },
        address: {
          streetLines: [plan.origine_adresse?.adresse_ligne_1 || ''],
          city: plan.origine_adresse?.ville || '',
          postalCode: plan.origine_adresse?.code_postal || '',
          countryCode: plan.origine_adresse?.pays || 'FR',
        },
      },
      recipients: [
        {
          contact: {
            personName: plan.destination_adresse?.nom || 'Recipient',
            phoneNumber: plan.destination_adresse?.telephone || '',
            emailAddress: plan.destination_adresse?.email || '',
          },
          address: {
            streetLines: [plan.destination_adresse?.adresse_ligne_1 || ''],
            city: plan.destination_adresse?.ville || '',
            postalCode: plan.destination_adresse?.code_postal || '',
            countryCode: plan.destination_adresse?.pays || 'FR',
          },
        },
      ],
      shipDatestamp: new Date().toISOString().split('T')[0],
      serviceType: request.service,
      packagingType: 'YOUR_PACKAGING',
      pickupType: 'DROPOFF_AT_FEDEX_LOCATION',
      blockInsightVisibility: false,
      shippingChargesPayment: {
        paymentType: 'SENDER',
      },
      labelSpecification: {
        imageType: request.labelFormat || 'PDF',
        labelStockType: 'PAPER_85X11_TOP_HALF_LABEL',
      },
      requestedPackageLineItems: [
        {
          weight: {
            units: 'KG',
            value: plan.poids_total_kg || 1,
          },
        },
      ],
      accountNumber: {
        value: accountNumber,
      },
    },
  }

  const response = await fetch(shipUrl, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${token}`,
      'X-locale': 'fr_FR',
    },
    body: JSON.stringify(payload),
  })

  if (!response.ok) {
    const errorText = await response.text()
    throw new Error(`FedEx shipment creation failed: ${errorText}`)
  }

  const data = await response.json()

  // Extraire les infos importantes
  const trackingNumber = data.output?.transactionShipments?.[0]?.masterTrackingNumber
  const labelUrl = data.output?.transactionShipments?.[0]?.pieceResponses?.[0]?.packageDocuments?.[0]?.url

  // Mettre à jour le plan transport
  await supabase
    .from('plan_transport')
    .update({
      tracking_number: trackingNumber,
      label_url: labelUrl,
      statut: 'confirme',
    })
    .eq('id', request.planTransportId)

  // Créer un événement de tracking
  await supabase.from('tracking_event').insert({
    plan_transport_id: request.planTransportId,
    type_evenement: 'confirmed',
    description: `Expédition FedEx créée - Tracking: ${trackingNumber}`,
    source: 'api_carrier',
    transporteur_reference: trackingNumber,
  })

  return {
    success: true,
    trackingNumber,
    labelUrl,
    raw: data,
  }
}

/**
 * Suivre une expédition FedEx
 */
async function trackShipment(token: string, request: FedExTrackRequest): Promise<any> {
  const trackUrl = 'https://apis.fedex.com/track/v1/trackingnumbers'

  const payload = {
    includeDetailedScans: true,
    trackingInfo: [
      {
        trackingNumberInfo: {
          trackingNumber: request.trackingNumber,
        },
      },
    ],
  }

  const response = await fetch(trackUrl, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${token}`,
      'X-locale': 'fr_FR',
    },
    body: JSON.stringify(payload),
  })

  if (!response.ok) {
    const errorText = await response.text()
    throw new Error(`FedEx tracking failed: ${errorText}`)
  }

  const data = await response.json()

  // Formater les résultats
  const trackingInfo = data.output?.completeTrackResults?.[0]?.trackResults?.[0]

  return {
    trackingNumber: request.trackingNumber,
    status: trackingInfo?.latestStatusDetail?.description,
    statusCode: trackingInfo?.latestStatusDetail?.code,
    estimatedDelivery: trackingInfo?.dateAndTimes?.find((d: any) => d.type === 'ESTIMATED_DELIVERY')?.dateTime,
    actualDelivery: trackingInfo?.dateAndTimes?.find((d: any) => d.type === 'ACTUAL_DELIVERY')?.dateTime,
    events: trackingInfo?.scanEvents?.map((event: any) => ({
      timestamp: event.date,
      location: event.scanLocation?.city,
      status: event.eventDescription,
      eventType: event.eventType,
    })) || [],
    raw: data,
  }
}
