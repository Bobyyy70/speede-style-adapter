/**
 * Types TypeScript pour le TMS (Transport Management System)
 * Généré à partir des migrations SQL TMS
 */

// =====================================================
// Enums et types communs
// =====================================================

export type ModeTransportCode = 'ROAD' | 'SEA' | 'AIR' | 'RAIL';

export type PlanTransportStatut =
  | 'draft'
  | 'planifie'
  | 'confirme'
  | 'en_attente_pickup'
  | 'pickup_effectue'
  | 'en_transit'
  | 'en_livraison'
  | 'livre'
  | 'incident'
  | 'annule';

export type SegmentTransportStatut = 'planifie' | 'en_cours' | 'termine' | 'annule';

export type TypeTarification =
  | 'fixed'
  | 'distance_based'
  | 'weight_based'
  | 'volume_based'
  | 'zone_based'
  | 'custom';

export type TypeEvenementTracking =
  | 'created'
  | 'confirmed'
  | 'pickup_scheduled'
  | 'pickup_completed'
  | 'in_transit'
  | 'checkpoint'
  | 'customs_clearance'
  | 'out_for_delivery'
  | 'delivered'
  | 'failed_delivery'
  | 'returned'
  | 'incident'
  | 'delayed'
  | 'cancelled';

export type SourceTracking = 'manual' | 'api_carrier' | 'gps' | 'webhook' | 'system';

export type TypeAlerte =
  | 'delay'
  | 'incident'
  | 'weather'
  | 'traffic'
  | 'customs'
  | 'damage'
  | 'missed_delivery'
  | 'route_change'
  | 'cost_overrun'
  | 'eco_threshold';

export type SeveriteAlerte = 'info' | 'warning' | 'critical';

export type TypeOptimisation = 'route' | 'carrier' | 'consolidation' | 'mode' | 'timing';

export type StatutDevis = 'draft' | 'sent' | 'accepted' | 'rejected' | 'expired';

export type TypeDocument =
  | 'CMR'
  | 'BOL'
  | 'AWB'
  | 'POD'
  | 'invoice'
  | 'packing_list'
  | 'customs_declaration'
  | 'insurance'
  | 'certificate';

export type StatutFacture = 'draft' | 'sent' | 'paid' | 'overdue' | 'cancelled';

export type StatutObjectifCO2 = 'on_track' | 'at_risk' | 'achieved' | 'missed';

export type ModeSelection = 'auto' | 'manual' | 'rule_based';

// =====================================================
// Adresse type (JSONB)
// =====================================================

export interface Adresse {
  nom?: string;
  entreprise?: string;
  adresse_ligne_1?: string;
  adresse_ligne_2?: string;
  code_postal?: string;
  ville?: string;
  pays?: string;
  telephone?: string;
  email?: string;
  latitude?: number;
  longitude?: number;
}

// =====================================================
// Tables principales
// =====================================================

export interface ModeTransport {
  id: string;
  code: ModeTransportCode;
  nom: string;
  description?: string;
  facteur_emission_co2: number;
  icone?: string;
  couleur?: string;
  actif: boolean;
  created_at: string;
  updated_at: string;
}

export interface PlanTransport {
  id: string;
  client_id: string;
  commande_id?: string;
  numero_plan: string;
  reference_externe?: string;
  date_creation: string;
  date_depart_prevue?: string;
  date_arrivee_prevue?: string;
  date_depart_reelle?: string;
  date_arrivee_reelle?: string;
  mode_transport_id?: string;
  transporteur_id?: string;
  origine_adresse?: Adresse;
  destination_adresse?: Adresse;
  poids_total_kg?: number;
  volume_total_m3?: number;
  nombre_colis?: number;
  nature_marchandise?: string;
  valeur_declaree?: number;
  statut: PlanTransportStatut;
  cout_estime?: number;
  cout_reel?: number;
  devise: string;
  distance_km?: number;
  duree_prevue_h?: number;
  duree_reelle_h?: number;
  emission_co2_kg?: number;
  optimise_par_ia: boolean;
  score_optimisation?: number;
  economie_estimee_eur?: number;
  instructions_speciales?: string;
  meta_data?: any;
  created_by?: string;
  updated_at: string;
}

export interface SegmentTransport {
  id: string;
  plan_transport_id: string;
  ordre: number;
  mode_transport_id?: string;
  transporteur_id?: string;
  origine_lieu: string;
  origine_adresse?: Adresse;
  destination_lieu: string;
  destination_adresse?: Adresse;
  date_depart_prevue?: string;
  date_arrivee_prevue?: string;
  date_depart_reelle?: string;
  date_arrivee_reelle?: string;
  distance_km?: number;
  duree_prevue_h?: number;
  cout?: number;
  statut: SegmentTransportStatut;
  tracking_number?: string;
  meta_data?: any;
  created_at: string;
  updated_at: string;
}

// =====================================================
// Transporteurs et tarification
// =====================================================

export interface ContratTransporteur {
  id: string;
  transporteur_id: string;
  client_id: string;
  numero_contrat: string;
  nom_contrat: string;
  description?: string;
  date_debut: string;
  date_fin?: string;
  date_signature?: string;
  type_tarification: TypeTarification;
  conditions?: any;
  remise_volume_pct: number;
  franchise_carburant: boolean;
  actif: boolean;
  auto_renew: boolean;
  document_url?: string;
  meta_data?: any;
  created_at: string;
  updated_at: string;
}

export interface GrilleTarifaire {
  id: string;
  contrat_transporteur_id: string;
  mode_transport_id?: string;
  zone_origine?: string;
  zone_destination?: string;
  pays_origine?: string;
  pays_destination?: string;
  poids_min_kg: number;
  poids_max_kg?: number;
  volume_min_m3: number;
  volume_max_m3?: number;
  tarif_base: number;
  tarif_par_km: number;
  tarif_par_kg: number;
  tarif_par_m3: number;
  surcharge_carburant_pct: number;
  surcharge_peage: number;
  surcharge_urgence_pct: number;
  delai_livraison_jours?: number;
  delai_pickup_heures: number;
  date_debut_validite: string;
  date_fin_validite?: string;
  actif: boolean;
  created_at: string;
  updated_at: string;
}

export interface PerformanceTransporteur {
  id: string;
  transporteur_id: string;
  periode_debut: string;
  periode_fin: string;
  nb_expeditions_total: number;
  nb_expeditions_a_temps: number;
  nb_expeditions_retard: number;
  nb_expeditions_incident: number;
  nb_expeditions_annulees: number;
  taux_ponctualite_pct: number;
  taux_incident_pct: number;
  delai_moyen_livraison_jours?: number;
  delai_min_livraison_jours?: number;
  delai_max_livraison_jours?: number;
  cout_total: number;
  cout_moyen_expedition?: number;
  emission_co2_totale_kg: number;
  emission_co2_moyenne_kg?: number;
  score_ponctualite?: number;
  score_fiabilite?: number;
  score_cout?: number;
  score_environnemental?: number;
  score_global?: number;
  meta_data?: any;
  created_at: string;
  updated_at: string;
}

export interface DecisionTransporteurTMS {
  id: string;
  plan_transport_id: string;
  transporteurs_compares?: any;
  transporteur_selectionne_id?: string;
  mode_selection?: ModeSelection;
  critere_principal?: string;
  poids_criteres?: any;
  score_selection?: number;
  economie_vs_standard_eur?: number;
  justification?: string;
  overridden: boolean;
  override_reason?: string;
  override_by?: string;
  override_at?: string;
  created_at: string;
}

// =====================================================
// Tracking et alertes
// =====================================================

export interface TrackingEvent {
  id: string;
  plan_transport_id: string;
  segment_transport_id?: string;
  timestamp: string;
  timestamp_source?: string;
  type_evenement: TypeEvenementTracking;
  lieu?: string;
  ville?: string;
  pays?: string;
  code_postal?: string;
  latitude?: number;
  longitude?: number;
  description?: string;
  details?: any;
  source: SourceTracking;
  transporteur_reference?: string;
  eta_updated?: string;
  meta_data?: any;
  created_at: string;
}

export interface AlerteTransport {
  id: string;
  plan_transport_id: string;
  type_alerte: TypeAlerte;
  severite: SeveriteAlerte;
  titre: string;
  description?: string;
  details?: any;
  date_alerte: string;
  date_resolution?: string;
  resolue: boolean;
  acquittee: boolean;
  acquittee_par?: string;
  acquittee_at?: string;
  actions_prises?: string;
  impact_estime?: string;
  notification_envoyee: boolean;
  destinataires?: any;
  created_at: string;
  updated_at: string;
}

export interface PredictionETA {
  id: string;
  plan_transport_id: string;
  eta_predit: string;
  eta_original: string;
  difference_minutes?: number;
  niveau_confiance?: number;
  intervalle_min?: string;
  intervalle_max?: string;
  facteurs_analyse?: any;
  trafic_temps_reel: boolean;
  meteo_previsions: boolean;
  historique_transporteur: boolean;
  douane_previsions: boolean;
  justification?: string;
  eta_reel?: string;
  precision_minutes?: number;
  created_at: string;
}

export interface PositionGPS {
  id: string;
  plan_transport_id: string;
  latitude: number;
  longitude: number;
  altitude?: number;
  precision_metres?: number;
  timestamp: string;
  vitesse_kmh?: number;
  direction_degres?: number;
  adresse_approximative?: string;
  ville?: string;
  pays?: string;
  source: string;
  device_id?: string;
  meta_data?: any;
  created_at: string;
}

// =====================================================
// Analytics et Green
// =====================================================

export interface TMSKPISnapshot {
  id: string;
  client_id: string;
  periode_debut: string;
  periode_fin: string;
  type_periode?: 'daily' | 'weekly' | 'monthly' | 'quarterly' | 'yearly';
  nb_expeditions: number;
  nb_tonnes_transportees: number;
  nb_km_parcourus: number;
  nb_colis_total: number;
  cout_total: number;
  cout_moyen_expedition?: number;
  cout_au_km?: number;
  cout_a_la_tonne?: number;
  taux_ponctualite_pct?: number;
  taux_incident_pct?: number;
  delai_moyen_livraison_jours?: number;
  emission_co2_totale_kg: number;
  emission_co2_par_tonne_km?: number;
  emission_co2_par_expedition_kg?: number;
  nb_optimisations_ia: number;
  economie_ia_eur: number;
  taux_remplissage_moyen_pct?: number;
  repartition_modes?: any;
  meta_data?: any;
  created_at: string;
  updated_at: string;
}

export interface EconomiesOptimisation {
  id: string;
  plan_transport_id: string;
  client_id?: string;
  type_optimisation: TypeOptimisation;
  cout_initial: number;
  temps_initial_h?: number;
  distance_initiale_km?: number;
  co2_initial_kg?: number;
  cout_optimise: number;
  temps_optimise_h?: number;
  distance_optimisee_km?: number;
  co2_optimise_kg?: number;
  economie_eur: number;
  economie_pct: number;
  gain_temps_h?: number;
  reduction_co2_kg?: number;
  justification?: string;
  algorithme_utilise?: string;
  validee: boolean;
  validee_par?: string;
  created_at: string;
}

export interface RapportEnvironnemental {
  id: string;
  client_id: string;
  periode_debut: string;
  periode_fin: string;
  emission_co2_totale_kg: number;
  emission_co2_par_expedition_kg?: number;
  emission_co2_par_tonne_km?: number;
  emission_road_kg: number;
  emission_sea_kg: number;
  emission_air_kg: number;
  emission_rail_kg: number;
  emission_co2_economisee_kg: number;
  taux_reduction_pct?: number;
  objectif_reduction_pct?: number;
  statut_objectif?: StatutObjectifCO2;
  equivalent_arbres?: number;
  equivalent_voitures_km?: number;
  norme_calcul: string;
  certifie: boolean;
  certificat_url?: string;
  meta_data?: any;
  created_at: string;
  updated_at: string;
}

export interface DevisTransport {
  id: string;
  client_id: string;
  numero_devis: string;
  reference_client?: string;
  date_creation: string;
  date_validite?: string;
  origine: Adresse;
  destination: Adresse;
  marchandise?: any;
  mode_transport_id?: string;
  transporteur_id?: string;
  prix_ht: number;
  prix_ttc?: number;
  devise: string;
  details_tarification?: any;
  delai_pickup_heures?: number;
  delai_livraison_jours?: number;
  statut: StatutDevis;
  plan_transport_id?: string;
  remise_pct: number;
  conditions_commerciales?: string;
  notes?: string;
  document_url?: string;
  meta_data?: any;
  created_at: string;
  updated_at: string;
}

export interface DocumentTransport {
  id: string;
  plan_transport_id: string;
  type_document: TypeDocument;
  numero_document: string;
  date_emission: string;
  fichier_url?: string;
  fichier_storage_path?: string;
  signature_electronique?: string;
  signe_par?: string;
  signe_at?: string;
  meta_data?: any;
  created_at: string;
}

export interface FactureTransport {
  id: string;
  plan_transport_id?: string;
  client_id: string;
  transporteur_id?: string;
  numero_facture: string;
  reference_externe?: string;
  date_facture: string;
  date_echeance?: string;
  date_paiement?: string;
  montant_ht: number;
  montant_tva?: number;
  montant_ttc?: number;
  devise: string;
  lignes_facture?: any;
  statut: StatutFacture;
  mode_paiement?: string;
  reference_paiement?: string;
  document_url?: string;
  meta_data?: any;
  created_at: string;
  updated_at: string;
}

// =====================================================
// Vues (types générés depuis les vues SQL)
// =====================================================

export interface PlanTransportComplet extends PlanTransport {
  client_nom?: string;
  numero_commande?: string;
  mode_code?: ModeTransportCode;
  mode_nom?: string;
  mode_icone?: string;
  mode_couleur?: string;
  nom_transporteur?: string;
  transporteur_logo?: string;
  statut_label?: string;
  nb_alertes_actives?: number;
  derniere_latitude?: number;
  derniere_longitude?: number;
  derniere_position_timestamp?: string;
  eta_predit?: string;
}

export interface StatsTransporteurRealtime {
  transporteur_id: string;
  nom_transporteur: string;
  logo_url?: string;
  plans_en_cours: number;
  plans_livres_total: number;
  livraisons_a_temps_30j: number;
  total_livraisons_30j: number;
  taux_ponctualite_30j_pct: number;
  cout_moyen?: number;
  co2_total_30j_kg?: number;
  co2_moyen_30j_kg?: number;
  score_global_actuel?: number;
}

export interface AlerteCritique {
  id: string;
  plan_transport_id: string;
  numero_plan: string;
  client_id: string;
  client_nom?: string;
  type_alerte: TypeAlerte;
  severite: SeveriteAlerte;
  titre: string;
  description?: string;
  date_alerte: string;
  age_heures: number;
  acquittee: boolean;
  resolue: boolean;
  plan_statut: PlanTransportStatut;
  nom_transporteur?: string;
}

export interface CommandePreteTransport {
  commande_id: string;
  numero_commande: string;
  client_id: string;
  client_nom?: string;
  statut_wms: string;
  date_creation: string;
  nom_destinataire?: string;
  ville_livraison?: string;
  pays_livraison?: string;
  poids_total_kg?: number;
  volume_total_m3?: number;
  transporteur_id?: string;
  nom_transporteur?: string;
  plan_transport_id?: string;
  numero_plan?: string;
  plan_statut?: PlanTransportStatut;
  etat_transport: string;
}

// =====================================================
// Types pour RPC functions
// =====================================================

export interface CalculTransportPriceResult {
  transporteur_id: string;
  nom_transporteur: string;
  tarif_base: number;
  tarif_distance: number;
  tarif_poids: number;
  tarif_volume: number;
  surcharges: number;
  total_ht: number;
  delai_jours: number;
  emission_co2_kg: number;
}

export interface AutoSelectCarrierResult {
  transporteur_id: string;
  nom_transporteur: string;
  score_final: number;
  cout_ht: number;
  delai_jours: number;
  score_fiabilite: number;
  emission_co2_kg: number;
  justification: string;
}

export interface CalculTMSKPIsResult {
  nb_expeditions: number;
  cout_total: number;
  cout_moyen: number;
  taux_ponctualite_pct: number;
  emission_co2_totale_kg: number;
  economie_ia_eur: number;
}

export interface BatchCreatePlansResult {
  commande_id: string;
  plan_id?: string;
  success: boolean;
  message: string;
}

// =====================================================
// Utilitaires et constantes
// =====================================================

export const PLAN_TRANSPORT_STATUTS: Record<PlanTransportStatut, { label: string; color: string }> = {
  draft: { label: 'Brouillon', color: 'gray' },
  planifie: { label: 'Planifié', color: 'blue' },
  confirme: { label: 'Confirmé', color: 'cyan' },
  en_attente_pickup: { label: 'En attente enlèvement', color: 'yellow' },
  pickup_effectue: { label: 'Enlèvement effectué', color: 'orange' },
  en_transit: { label: 'En transit', color: 'purple' },
  en_livraison: { label: 'En livraison', color: 'indigo' },
  livre: { label: 'Livré', color: 'green' },
  incident: { label: 'Incident', color: 'red' },
  annule: { label: 'Annulé', color: 'gray' },
};

export const MODES_TRANSPORT: Record<ModeTransportCode, { label: string; icon: string; color: string }> = {
  ROAD: { label: 'Routier', icon: 'truck', color: '#3B82F6' },
  SEA: { label: 'Maritime', icon: 'ship', color: '#0EA5E9' },
  AIR: { label: 'Aérien', icon: 'plane', color: '#8B5CF6' },
  RAIL: { label: 'Ferroviaire', icon: 'train', color: '#10B981' },
};

export const SEVERITES_ALERTE: Record<SeveriteAlerte, { label: string; color: string }> = {
  info: { label: 'Information', color: 'blue' },
  warning: { label: 'Avertissement', color: 'yellow' },
  critical: { label: 'Critique', color: 'red' },
};
