// Types basés sur le schéma Supabase réel

// Types pour DecisionsTransporteurs
export interface DecisionTransporteur {
  id: string;
  commande_id: string;
  transporteur_choisi_code: string;
  transporteur_choisi_nom: string;
  score_transporteur: number;
  poids_colis: number;
  pays_destination: string;
  delai_souhaite: string;
  cout_estime: number;
  regles_appliquees: any[];
  nombre_regles_matchees: number;
  analyse_ia: string | null;
  recommandation_ia: string | null;
  confiance_decision: number;
  mode_decision: 'ia_suggere' | 'automatique' | 'regle_stricte' | 'manuel';
  transporteurs_alternatives: string | null; // JSON string
  duree_calcul_ms: number;
  facteurs_decision: Record<string, any>;
  force_manuellement: boolean;
  raison_forcage: string | null;
  date_decision: string;
  commande?: {
    numero_commande: string;
    statut_wms: string;
    client_id: string;
  };
  client_nom?: string; // Enriched field
}

export interface TransporteurService {
  id: string;
  code_service: string;
  nom_affichage: string;
  actif: boolean;
}

// Types pour AutomationTransporteurs (colonnes réelles de Supabase)
export interface ConfigAutoSelection {
  id: string;
  client_id: string | null;
  actif: boolean | null;
  mode_selection: string | null;
  utiliser_ia: boolean | null;
  seuil_confiance_minimum: number | null;
  fallback_manuel: boolean | null;
  regles_prioritaires: any | null; // JSONB
  metadata: any | null; // JSONB
  date_activation: string | null;
  date_modification: string | null;
  client_nom?: string; // Enriched field
}

export interface LogAutoSelection {
  id: string;
  commande_id: string;
  client_id: string | null;
  decision_id: string | null;
  methode_selection: string | null;
  transporteur_selectionne: string | null;
  succes: boolean | null;
  erreur: string | null;
  duree_ms: number | null;
  metadata: any | null; // JSONB
  date_log: string | null;
  commande?: {
    numero_commande: string;
    client_id: string;
  };
  client_nom?: string; // Enriched field
}

export interface Client {
  id: string;
  nom_entreprise: string; // Vrai nom dans Supabase
  actif: boolean | null; // Vrai nom dans Supabase
  adresse: string | null;
  email_contact: string | null;
  telephone: string | null;
}

export interface AutomationStats {
  total: number;
  success: number;
  error: number;
  rate: number;
}

// Types pour ApprentissageContinu
export interface SuggestionAjustement {
  id: string;
  type_suggestion: 'modifier_poids' | 'ajouter_condition' | 'desactiver_regle' | 'creer_regle' | 'ajuster_seuil';
  titre: string;
  description: string;
  justification: string;
  transporteur_id: string | null;
  regle_cible_id: string | null;
  modifications_proposees: Record<string, any>;
  impact_estime_cout: number;
  impact_estime_delai: number;
  confiance_score: number;
  base_sur_commandes: number;
  statut: 'en_attente' | 'approuvée' | 'rejetée' | 'appliquée';
  created_at: string;
  approved_at: string | null;
  approved_by: string | null;
  rejected_at: string | null;
  raison_rejet: string | null;
}

export interface MetriqueApprentissage {
  id: string;
  periode: string;
  nb_commandes_total: number;
  nb_changements_manuels: number;
  taux_changement: number;
  nb_problemes_livraison: number;
  taux_problemes: number;
  economie_realisee: number;
  nb_suggestions_generees: number;
  nb_suggestions_appliquees: number;
}

export interface PatternChangement {
  transporteur_initial: string;
  transporteur_final: string;
  nb_changements: number;
  impact_cout_moyen: number;
  impact_delai_moyen: number;
  pays_concernes: string[];
}

// Types pour OptimisationCouts (colonnes réelles Supabase)
export interface AnalyseOptimisation {
  id: string;
  periode_debut: string;
  periode_fin: string;
  nombre_commandes_analysees: number | null;
  cout_total_actuel: number | null; // Vrai nom dans Supabase
  cout_total_optimal: number | null;
  economies_potentielles: number | null;
  pourcentage_economie: number | null;
  nombre_suggestions: number | null;
  metadata: any | null;
  generee_par: string | null;
  date_analyse: string | null;
}

export interface SuggestionOptimisation {
  id: string;
  analyse_id: string;
  type_suggestion: string;
  titre: string;
  description: string;
  justification_detaillee: string | null; // Vrai nom dans Supabase
  impact_financier_estime: number | null; // Vrai nom dans Supabase
  confiance_score: number | null; // Vrai nom dans Supabase
  statut: string | null;
  appliquee_le: string | null;
  appliquee_par: string | null;
  raison_rejet: string | null;
  metadata: any | null;
  date_creation: string | null;
}

export interface ComparaisonCoutsTransporteur {
  transporteur_choisi_code: string;
  transporteur_choisi_nom: string;
  nombre_utilisations: number;
  cout_total_reel: number;
  cout_optimal_estime: number;
  economies_potentielles: number;
  score_moyen: number;
}

export interface EvolutionCoutTemporelle {
  jour: string;
  nombre_commandes: number;
  cout_total_jour: number;
  score_moyen_jour: number;
}

// Chart data types
export interface EconomiesChartData {
  name: string;
  reel: number;
  optimal: number;
  economies: number;
}

export interface EvolutionChartData {
  date: string;
  cout: number;
  commandes: number;
  score: number;
}
