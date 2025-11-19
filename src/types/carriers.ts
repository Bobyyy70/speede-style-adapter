/**
 * Types pour les intégrations transporteurs
 * FedEx, Mondial Relay, etc.
 */

// ============================================================================
// FedEx Types
// ============================================================================

export interface FedExRateRequest {
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

export interface FedExShipRequest {
  planTransportId: string
  service: string
  labelFormat?: 'PDF' | 'PNG'
}

export interface FedExTrackRequest {
  trackingNumber: string
}

export interface FedExRate {
  service: string
  serviceType: string
  totalCharge: {
    amount: number
    currency: string
  }
  transitTime?: string
  deliveryDate?: string
}

export interface FedExRateResponse {
  rates: FedExRate[]
  raw?: any
}

export interface FedExShipResponse {
  success: boolean
  trackingNumber: string
  labelUrl: string
  raw?: any
}

export interface FedExTrackEvent {
  timestamp: string
  location?: string
  status: string
  eventType: string
}

export interface FedExTrackResponse {
  trackingNumber: string
  status: string
  statusCode: string
  estimatedDelivery?: string
  actualDelivery?: string
  events: FedExTrackEvent[]
  raw?: any
}

// ============================================================================
// Mondial Relay Types
// ============================================================================

export type MondialRelayDeliveryMode = 'LCC' | '24R' | '24L' | 'ESP'

export interface MondialRelaySearchRequest {
  countryCode: string // FR, BE, ES, etc.
  postalCode: string
  city?: string
  numResults?: number // Max 100
  deliveryMode?: MondialRelayDeliveryMode
  weight?: number // en grammes
}

export interface MondialRelayShipRequest {
  planTransportId: string
  relayPointCode: string
  deliveryMode: MondialRelayDeliveryMode
  insurance?: number // Montant de l'assurance en EUR
  deliveryInstructions?: string
}

export interface MondialRelayTrackRequest {
  trackingNumber: string
}

export interface MondialRelayRelayPoint {
  code: string
  name: string
  address: {
    street: string
    city: string
    postalCode: string
    country: string
  }
  coordinates: {
    latitude: number
    longitude: number
  }
  openingHours: {
    monday: string
    tuesday: string
    wednesday: string
    thursday: string
    friday: string
    saturday: string
    sunday: string
  }
  distance: number // en mètres
  typePoint: string
  available: boolean
}

export interface MondialRelaySearchResponse {
  relayPoints: MondialRelayRelayPoint[]
  count: number
  raw?: any
}

export interface MondialRelayShipResponse {
  success: boolean
  trackingNumber: string
  expeditionNumber: string
  labelUrl: string
  raw?: any
}

export interface MondialRelayTrackEvent {
  timestamp: string
  status: string
  location?: string
  relayPoint?: string
}

export interface MondialRelayTrackResponse {
  trackingNumber: string
  status: string
  events: MondialRelayTrackEvent[]
  raw?: any
}

// ============================================================================
// Generic Carrier Types
// ============================================================================

export type CarrierType = 'FEDEX' | 'MONDIAL_RELAY' | 'DHL' | 'UPS' | 'CHRONOPOST' | 'COLISSIMO'

export interface CarrierCredentials {
  carrierType: CarrierType
  apiKey?: string
  secretKey?: string
  accountNumber?: string
  merchantId?: string
  additionalParams?: Record<string, string>
}

export interface GenericRateRequest {
  carrierType: CarrierType
  origin: {
    postalCode: string
    countryCode: string
    city?: string
  }
  destination: {
    postalCode: string
    countryCode: string
    city?: string
  }
  packages: Array<{
    weight: number // en kg
    length?: number // en cm
    width?: number
    height?: number
  }>
  serviceLevel?: string
}

export interface GenericRate {
  carrierType: CarrierType
  service: string
  serviceType: string
  totalCharge: {
    amount: number
    currency: string
  }
  transitTime?: string
  deliveryDate?: string
  co2Emission?: number // kg CO2
}

export interface GenericShipRequest {
  carrierType: CarrierType
  planTransportId: string
  service: string
  labelFormat?: 'PDF' | 'PNG'
  relayPointCode?: string // Pour Mondial Relay
  insurance?: number
}

export interface GenericShipResponse {
  success: boolean
  carrierType: CarrierType
  trackingNumber: string
  labelUrl: string
  expeditionNumber?: string
  errors?: string[]
}

export interface GenericTrackEvent {
  timestamp: string
  status: string
  location?: string
  description?: string
}

export interface GenericTrackResponse {
  carrierType: CarrierType
  trackingNumber: string
  currentStatus: string
  estimatedDelivery?: string
  actualDelivery?: string
  events: GenericTrackEvent[]
}

// ============================================================================
// Carrier API Actions
// ============================================================================

export type CarrierAPIAction = 'rate' | 'ship' | 'track' | 'searchRelayPoints'

export interface CarrierAPIRequest {
  action: CarrierAPIAction
  [key: string]: any
}

// ============================================================================
// Delivery Mode Helpers
// ============================================================================

export const MONDIAL_RELAY_DELIVERY_MODES = {
  LCC: {
    code: 'LCC',
    name: 'Livraison en Point Relais',
    description: 'Livraison standard en point relais (3-5 jours)',
  },
  '24R': {
    code: '24R',
    name: 'Livraison 24h en Point Relais',
    description: 'Livraison express 24h en point relais',
  },
  '24L': {
    code: '24L',
    name: 'Livraison 24h à domicile',
    description: 'Livraison express 24h à domicile',
  },
  ESP: {
    code: 'ESP',
    name: 'Livraison Europe',
    description: 'Livraison en point relais Europe (5-7 jours)',
  },
} as const

export const FEDEX_SERVICE_TYPES = {
  FEDEX_GROUND: {
    code: 'FEDEX_GROUND',
    name: 'FedEx Ground',
    description: 'Service terrestre économique',
  },
  FEDEX_EXPRESS_SAVER: {
    code: 'FEDEX_EXPRESS_SAVER',
    name: 'FedEx Express Saver',
    description: 'Livraison express économique',
  },
  FEDEX_2_DAY: {
    code: 'FEDEX_2_DAY',
    name: 'FedEx 2 Day',
    description: 'Livraison en 2 jours',
  },
  STANDARD_OVERNIGHT: {
    code: 'STANDARD_OVERNIGHT',
    name: 'Standard Overnight',
    description: 'Livraison le lendemain',
  },
  PRIORITY_OVERNIGHT: {
    code: 'PRIORITY_OVERNIGHT',
    name: 'Priority Overnight',
    description: 'Livraison prioritaire le lendemain',
  },
  INTERNATIONAL_ECONOMY: {
    code: 'INTERNATIONAL_ECONOMY',
    name: 'International Economy',
    description: 'Économique international (4-5 jours)',
  },
  INTERNATIONAL_PRIORITY: {
    code: 'INTERNATIONAL_PRIORITY',
    name: 'International Priority',
    description: 'Prioritaire international (1-3 jours)',
  },
} as const

// ============================================================================
// Carrier Configuration
// ============================================================================

export interface CarrierConfig {
  type: CarrierType
  name: string
  apiEndpoint: string
  supportsRelayPoints: boolean
  supportedCountries: string[]
  maxWeight: number // en kg
  maxDimensions: {
    length: number // en cm
    width: number
    height: number
  }
  trackingUrlTemplate: string // ex: "https://www.fedex.com/track?trknbr={trackingNumber}"
}

export const CARRIER_CONFIGS: Record<CarrierType, CarrierConfig> = {
  FEDEX: {
    type: 'FEDEX',
    name: 'FedEx',
    apiEndpoint: 'https://apis.fedex.com',
    supportsRelayPoints: false,
    supportedCountries: ['FR', 'US', 'GB', 'DE', 'ES', 'IT', 'NL', 'BE'],
    maxWeight: 68,
    maxDimensions: { length: 274, width: 330, height: 160 },
    trackingUrlTemplate: 'https://www.fedex.com/fedextrack/?trknbr={trackingNumber}',
  },
  MONDIAL_RELAY: {
    type: 'MONDIAL_RELAY',
    name: 'Mondial Relay',
    apiEndpoint: 'https://api.mondialrelay.com',
    supportsRelayPoints: true,
    supportedCountries: ['FR', 'BE', 'ES', 'LU', 'PT', 'NL'],
    maxWeight: 30,
    maxDimensions: { length: 150, width: 80, height: 80 },
    trackingUrlTemplate: 'https://www.mondialrelay.fr/tracking/?exp={trackingNumber}',
  },
  DHL: {
    type: 'DHL',
    name: 'DHL Express',
    apiEndpoint: 'https://api.dhl.com',
    supportsRelayPoints: false,
    supportedCountries: [], // Mondial
    maxWeight: 70,
    maxDimensions: { length: 270, width: 120, height: 120 },
    trackingUrlTemplate: 'https://www.dhl.com/fr-fr/home/tracking.html?tracking-id={trackingNumber}',
  },
  UPS: {
    type: 'UPS',
    name: 'UPS',
    apiEndpoint: 'https://onlinetools.ups.com',
    supportsRelayPoints: true,
    supportedCountries: [], // Mondial
    maxWeight: 70,
    maxDimensions: { length: 270, width: 165, height: 165 },
    trackingUrlTemplate: 'https://www.ups.com/track?tracknum={trackingNumber}',
  },
  CHRONOPOST: {
    type: 'CHRONOPOST',
    name: 'Chronopost',
    apiEndpoint: 'https://ws.chronopost.fr',
    supportsRelayPoints: true,
    supportedCountries: ['FR', 'BE', 'ES', 'PT', 'IT', 'DE'],
    maxWeight: 30,
    maxDimensions: { length: 150, width: 80, height: 80 },
    trackingUrlTemplate: 'https://www.chronopost.fr/tracking-no-cms/suivi-page?listeNumerosLT={trackingNumber}',
  },
  COLISSIMO: {
    type: 'COLISSIMO',
    name: 'Colissimo',
    apiEndpoint: 'https://ws.colissimo.fr',
    supportsRelayPoints: true,
    supportedCountries: ['FR'],
    maxWeight: 30,
    maxDimensions: { length: 150, width: 80, height: 80 },
    trackingUrlTemplate: 'https://www.laposte.fr/outils/suivre-vos-envois?code={trackingNumber}',
  },
}

// ============================================================================
// Helper Functions
// ============================================================================

export function getCarrierConfig(carrierType: CarrierType): CarrierConfig {
  return CARRIER_CONFIGS[carrierType]
}

export function getTrackingUrl(carrierType: CarrierType, trackingNumber: string): string {
  const config = getCarrierConfig(carrierType)
  return config.trackingUrlTemplate.replace('{trackingNumber}', trackingNumber)
}

export function isRelayPointSupported(carrierType: CarrierType): boolean {
  return getCarrierConfig(carrierType).supportsRelayPoints
}

export function validatePackageDimensions(
  carrierType: CarrierType,
  weight: number,
  dimensions?: { length: number; width: number; height: number }
): { valid: boolean; errors: string[] } {
  const config = getCarrierConfig(carrierType)
  const errors: string[] = []

  if (weight > config.maxWeight) {
    errors.push(`Poids maximum dépassé: ${weight}kg (max: ${config.maxWeight}kg)`)
  }

  if (dimensions) {
    if (dimensions.length > config.maxDimensions.length) {
      errors.push(`Longueur maximum dépassée: ${dimensions.length}cm (max: ${config.maxDimensions.length}cm)`)
    }
    if (dimensions.width > config.maxDimensions.width) {
      errors.push(`Largeur maximum dépassée: ${dimensions.width}cm (max: ${config.maxDimensions.width}cm)`)
    }
    if (dimensions.height > config.maxDimensions.height) {
      errors.push(`Hauteur maximum dépassée: ${dimensions.height}cm (max: ${config.maxDimensions.height}cm)`)
    }
  }

  return {
    valid: errors.length === 0,
    errors,
  }
}

export function formatDeliveryMode(mode: MondialRelayDeliveryMode): string {
  return MONDIAL_RELAY_DELIVERY_MODES[mode]?.name || mode
}

export function formatFedExService(service: string): string {
  const serviceKey = service as keyof typeof FEDEX_SERVICE_TYPES
  return FEDEX_SERVICE_TYPES[serviceKey]?.name || service
}
