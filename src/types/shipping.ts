/**
 * Types pour les expéditions, CN23, étiquettes et configuration transporteurs
 */

import type { CarrierType } from './carriers'
import type { Adresse } from './tms'

// ============================================================================
// Carrier Configuration
// ============================================================================

export interface CarrierConfig {
  id: string
  client_id: string
  carrier_type: CarrierType
  carrier_name: string

  // Credentials
  api_key?: string
  secret_key?: string
  account_number?: string
  merchant_id?: string
  additional_params?: Record<string, any>

  // Configuration
  is_active: boolean
  is_default: boolean
  supported_services?: string[]

  // Default sender address
  default_sender_address?: Adresse

  // Metadata
  created_at: string
  updated_at: string
}

export interface CarrierConfigCreate {
  carrier_type: CarrierType
  carrier_name: string
  api_key?: string
  secret_key?: string
  account_number?: string
  merchant_id?: string
  additional_params?: Record<string, any>
  is_active?: boolean
  is_default?: boolean
  supported_services?: string[]
  default_sender_address?: Adresse
}

// ============================================================================
// CN23 Declaration
// ============================================================================

export type TypeEnvoiCN23 = 'GIFT' | 'SALE' | 'SAMPLE' | 'RETURN' | 'DOCUMENT' | 'OTHER'

export interface CN23Article {
  description: string
  quantity: number
  weight_kg: number
  value_eur: number
  hs_code?: string
  origin_country?: string
}

export interface CN23Declaration {
  id: string
  client_id: string
  plan_transport_id: string
  commande_id?: string

  // General info
  numero_cn23: string
  type_envoi: TypeEnvoiCN23
  description_generale?: string

  // Sender & recipient
  expediteur: Adresse
  destinataire: Adresse

  // Articles
  articles: CN23Article[]

  // Totals
  poids_total_kg: number
  valeur_totale_eur: number
  devise: string

  // Fees
  frais_transport_eur: number
  frais_assurance_eur: number
  autres_frais_eur: number

  // Documents
  pdf_url?: string
  pdf_generated_at?: string

  // Status
  statut: 'draft' | 'generated' | 'sent'

  // Metadata
  created_at: string
  updated_at: string
  created_by?: string
}

export interface CN23DeclarationCreate {
  plan_transport_id: string
  type_envoi: TypeEnvoiCN23
  description_generale?: string
  articles: CN23Article[]
  poids_total_kg: number
  valeur_totale_eur: number
  frais_transport_eur?: number
  frais_assurance_eur?: number
  autres_frais_eur?: number
}

// ============================================================================
// Shipping Label
// ============================================================================

export type LabelFormat = 'PDF' | 'PNG' | 'ZPL'

export interface ShippingLabel {
  id: string
  client_id: string
  plan_transport_id: string

  // Carrier
  carrier_type: CarrierType
  carrier_service?: string

  // Numbers
  tracking_number: string
  shipment_id?: string

  // Documents
  label_url: string
  label_format: LabelFormat
  cn23_url?: string

  // Cost
  shipping_cost?: number
  currency: string

  // Dates
  created_at: string
  printed_at?: string

  // Metadata
  metadata?: Record<string, any>
}

export interface ShippingLabelCreate {
  plan_transport_id: string
  carrier_type: CarrierType
  carrier_service?: string
  tracking_number: string
  shipment_id?: string
  label_url: string
  label_format?: LabelFormat
  cn23_url?: string
  shipping_cost?: number
  currency?: string
  metadata?: Record<string, any>
}

// ============================================================================
// Commande Prête pour Expédition (Vue)
// ============================================================================

export interface CommandePretExpedition {
  commande_id: string
  numero_commande: string
  client_id: string
  client_nom: string
  statut_wms: string
  montant_total: number
  poids_total_kg: number
  adresse_livraison: Adresse

  // Plan transport
  plan_transport_id?: string
  numero_plan?: string
  transporteur_id?: string
  transporteur_nom?: string
  tracking_number?: string
  label_url?: string

  // CN23
  cn23_id?: string
  numero_cn23?: string
  cn23_pdf_url?: string

  // Label
  label_id?: string
  label_generated_url?: string
  label_tracking?: string

  // Checks
  cn23_required: boolean

  created_at: string
  updated_at: string
}

// ============================================================================
// Workflow Expédition
// ============================================================================

export interface ShipmentWorkflowState {
  // Step 1: Commande selection
  commande?: CommandePretExpedition

  // Step 2: Carrier selection
  selectedCarrier?: CarrierType
  selectedService?: string
  availableRates?: any[]

  // Step 3: CN23 (if required)
  cn23Declaration?: CN23Declaration
  cn23Articles?: CN23Article[]

  // Step 4: Relay point (if Mondial Relay)
  relayPointCode?: string
  relayPointName?: string

  // Step 5: Confirmation
  label?: ShippingLabel
  confirmationData?: {
    tracking_number: string
    label_url: string
    cn23_url?: string
    total_cost: number
  }
}

export type ShipmentWorkflowStep =
  | 'select_order'
  | 'select_carrier'
  | 'fill_cn23'
  | 'select_relay_point'
  | 'confirm'
  | 'print'

// ============================================================================
// Helper Functions Types
// ============================================================================

export interface CreateShipmentRequest {
  plan_transport_id: string
  carrier_type: CarrierType
  carrier_service: string
  relay_point_code?: string
  insurance_amount?: number
  delivery_instructions?: string
  include_cn23?: boolean
  cn23_declaration_id?: string
}

export interface CreateShipmentResponse {
  success: boolean
  tracking_number: string
  label_url: string
  cn23_url?: string
  shipment_id?: string
  carrier_reference?: string
  estimated_delivery?: string
  total_cost?: number
  errors?: string[]
}

export interface PrintDocumentsRequest {
  label_url: string
  cn23_url?: string
  plan_transport_id: string
}

// ============================================================================
// Constants
// ============================================================================

export const TYPE_ENVOI_CN23_LABELS: Record<TypeEnvoiCN23, string> = {
  GIFT: 'Cadeau',
  SALE: 'Vente',
  SAMPLE: 'Échantillon',
  RETURN: 'Retour',
  DOCUMENT: 'Documents',
  OTHER: 'Autre',
}

export const STATUT_CN23_LABELS: Record<CN23Declaration['statut'], string> = {
  draft: 'Brouillon',
  generated: 'Généré',
  sent: 'Envoyé',
}

export const PAYS_UE = [
  'FR', 'BE', 'DE', 'IT', 'ES', 'NL', 'PT', 'AT', 'DK', 'FI',
  'GR', 'IE', 'LU', 'SE', 'CZ', 'EE', 'HU', 'LV', 'LT', 'PL',
  'SK', 'SI', 'BG', 'RO', 'HR', 'CY', 'MT'
]

// ============================================================================
// Validation Helpers
// ============================================================================

export function requiresCN23(countryCode: string): boolean {
  return !PAYS_UE.includes(countryCode.toUpperCase())
}

export function validateCN23Article(article: CN23Article): { valid: boolean; errors: string[] } {
  const errors: string[] = []

  if (!article.description || article.description.trim().length === 0) {
    errors.push('Description requise')
  }
  if (!article.quantity || article.quantity <= 0) {
    errors.push('Quantité invalide')
  }
  if (!article.weight_kg || article.weight_kg <= 0) {
    errors.push('Poids invalide')
  }
  if (!article.value_eur || article.value_eur <= 0) {
    errors.push('Valeur invalide')
  }

  return {
    valid: errors.length === 0,
    errors,
  }
}

export function validateCN23Declaration(declaration: Partial<CN23Declaration>): {
  valid: boolean
  errors: string[]
} {
  const errors: string[] = []

  if (!declaration.expediteur) {
    errors.push('Adresse expéditeur requise')
  }
  if (!declaration.destinataire) {
    errors.push('Adresse destinataire requise')
  }
  if (!declaration.articles || declaration.articles.length === 0) {
    errors.push('Au moins un article requis')
  } else {
    declaration.articles.forEach((article, index) => {
      const validation = validateCN23Article(article)
      if (!validation.valid) {
        errors.push(`Article ${index + 1}: ${validation.errors.join(', ')}`)
      }
    })
  }

  if (!declaration.poids_total_kg || declaration.poids_total_kg <= 0) {
    errors.push('Poids total invalide')
  }
  if (!declaration.valeur_totale_eur || declaration.valeur_totale_eur <= 0) {
    errors.push('Valeur totale invalide')
  }

  return {
    valid: errors.length === 0,
    errors,
  }
}

export function calculateCN23Totals(articles: CN23Article[]): {
  poids_total_kg: number
  valeur_totale_eur: number
} {
  return articles.reduce(
    (acc, article) => ({
      poids_total_kg: acc.poids_total_kg + article.weight_kg * article.quantity,
      valeur_totale_eur: acc.valeur_totale_eur + article.value_eur,
    }),
    { poids_total_kg: 0, valeur_totale_eur: 0 }
  )
}

// ============================================================================
// Formatting Helpers
// ============================================================================

export function formatTypeEnvoi(type: TypeEnvoiCN23): string {
  return TYPE_ENVOI_CN23_LABELS[type] || type
}

export function formatStatutCN23(statut: CN23Declaration['statut']): string {
  return STATUT_CN23_LABELS[statut] || statut
}

export function formatCurrency(amount: number, currency: string = 'EUR'): string {
  return new Intl.NumberFormat('fr-FR', {
    style: 'currency',
    currency,
  }).format(amount)
}

export function formatWeight(kg: number): string {
  if (kg < 1) {
    return `${Math.round(kg * 1000)}g`
  }
  return `${kg.toFixed(2)}kg`
}
