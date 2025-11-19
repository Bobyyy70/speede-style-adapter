/**
 * Helpers et utilitaires pour le TMS
 */

import type {
  PlanTransportStatut,
  ModeTransportCode,
  SeveriteAlerte,
  TypeAlerte,
} from '@/types/tms';

// =====================================================
// Helpers de formatage
// =====================================================

/**
 * Formater le statut du plan transport
 */
export function formatPlanStatut(statut: PlanTransportStatut): {
  label: string;
  color: string;
  variant: 'default' | 'secondary' | 'destructive' | 'outline';
} {
  const config: Record<
    PlanTransportStatut,
    { label: string; color: string; variant: 'default' | 'secondary' | 'destructive' | 'outline' }
  > = {
    draft: { label: 'Brouillon', color: 'text-gray-600', variant: 'outline' },
    planifie: { label: 'Planifié', color: 'text-blue-600', variant: 'secondary' },
    confirme: { label: 'Confirmé', color: 'text-cyan-600', variant: 'default' },
    en_attente_pickup: { label: 'En attente enlèvement', color: 'text-yellow-600', variant: 'outline' },
    pickup_effectue: { label: 'Enlèvement effectué', color: 'text-orange-600', variant: 'secondary' },
    en_transit: { label: 'En transit', color: 'text-purple-600', variant: 'default' },
    en_livraison: { label: 'En livraison', color: 'text-indigo-600', variant: 'default' },
    livre: { label: 'Livré', color: 'text-green-600', variant: 'default' },
    incident: { label: 'Incident', color: 'text-red-600', variant: 'destructive' },
    annule: { label: 'Annulé', color: 'text-gray-500', variant: 'outline' },
  };

  return config[statut] || config.draft;
}

/**
 * Formater le mode de transport
 */
export function formatModeTransport(code: ModeTransportCode): {
  label: string;
  icon: string;
  color: string;
} {
  const config: Record<ModeTransportCode, { label: string; icon: string; color: string }> = {
    ROAD: { label: 'Routier', icon: '🚚', color: '#3B82F6' },
    SEA: { label: 'Maritime', icon: '🚢', color: '#0EA5E9' },
    AIR: { label: 'Aérien', icon: '✈️', color: '#8B5CF6' },
    RAIL: { label: 'Ferroviaire', icon: '🚂', color: '#10B981' },
  };

  return config[code];
}

/**
 * Formater la sévérité d'alerte
 */
export function formatSeveriteAlerte(severite: SeveriteAlerte): {
  label: string;
  color: string;
  bgColor: string;
  icon: string;
} {
  const config: Record<
    SeveriteAlerte,
    { label: string; color: string; bgColor: string; icon: string }
  > = {
    info: {
      label: 'Information',
      color: 'text-blue-700',
      bgColor: 'bg-blue-100',
      icon: 'ℹ️',
    },
    warning: {
      label: 'Avertissement',
      color: 'text-yellow-700',
      bgColor: 'bg-yellow-100',
      icon: '⚠️',
    },
    critical: {
      label: 'Critique',
      color: 'text-red-700',
      bgColor: 'bg-red-100',
      icon: '🚨',
    },
  };

  return config[severite];
}

/**
 * Formater le type d'alerte
 */
export function formatTypeAlerte(type: TypeAlerte): string {
  const labels: Record<TypeAlerte, string> = {
    delay: 'Retard',
    incident: 'Incident',
    weather: 'Météo',
    traffic: 'Trafic',
    customs: 'Douane',
    damage: 'Dommage',
    missed_delivery: 'Livraison manquée',
    route_change: 'Changement itinéraire',
    cost_overrun: 'Dépassement coût',
    eco_threshold: 'Seuil CO2',
  };

  return labels[type] || type;
}

// =====================================================
// Helpers de calcul
// =====================================================

/**
 * Calculer l'émission CO2 estimée
 */
export function calculateCO2Emission(
  distanceKm: number,
  poidsKg: number,
  facteurEmission: number
): number {
  const poidsTonnes = poidsKg / 1000;
  return Math.round(distanceKm * poidsTonnes * facteurEmission * 100) / 100;
}

/**
 * Calculer le délai en jours entre deux dates
 */
export function calculateDelaiJours(dateDebut: Date, dateFin: Date): number {
  const diff = dateFin.getTime() - dateDebut.getTime();
  return Math.ceil(diff / (1000 * 60 * 60 * 24));
}

/**
 * Calculer le taux de ponctualité
 */
export function calculateTauxPonctualite(
  nombreATemps: number,
  nombreTotal: number
): number {
  if (nombreTotal === 0) return 0;
  return Math.round((nombreATemps / nombreTotal) * 10000) / 100;
}

/**
 * Calculer le coût au kilomètre
 */
export function calculateCoutParKm(coutTotal: number, distanceKm: number): number {
  if (distanceKm === 0) return 0;
  return Math.round((coutTotal / distanceKm) * 100) / 100;
}

/**
 * Calculer le coût à la tonne
 */
export function calculateCoutParTonne(coutTotal: number, poidsKg: number): number {
  if (poidsKg === 0) return 0;
  const poidsTonnes = poidsKg / 1000;
  return Math.round((coutTotal / poidsTonnes) * 100) / 100;
}

/**
 * Calculer l'économie en pourcentage
 */
export function calculateEconomiePct(
  coutInitial: number,
  coutOptimise: number
): number {
  if (coutInitial === 0) return 0;
  return Math.round(((coutInitial - coutOptimise) / coutInitial) * 10000) / 100;
}

// =====================================================
// Helpers de distance
// =====================================================

/**
 * Calculer la distance entre deux points GPS (formule Haversine)
 */
export function calculateDistance(
  lat1: number,
  lon1: number,
  lat2: number,
  lon2: number
): number {
  const R = 6371; // Rayon de la Terre en km
  const dLat = toRad(lat2 - lat1);
  const dLon = toRad(lon2 - lon1);

  const a =
    Math.sin(dLat / 2) * Math.sin(dLat / 2) +
    Math.cos(toRad(lat1)) *
      Math.cos(toRad(lat2)) *
      Math.sin(dLon / 2) *
      Math.sin(dLon / 2);

  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
  const distance = R * c;

  return Math.round(distance * 100) / 100;
}

function toRad(degrees: number): number {
  return (degrees * Math.PI) / 180;
}

// =====================================================
// Helpers de score
// =====================================================

/**
 * Calculer le score global pondéré
 */
export function calculateScoreGlobal(scores: {
  cout: number;
  delai: number;
  fiabilite: number;
  eco: number;
  poids: {
    cout: number;
    delai: number;
    fiabilite: number;
    eco: number;
  };
}): number {
  const scoreGlobal =
    (scores.cout * scores.poids.cout +
      scores.delai * scores.poids.delai +
      scores.fiabilite * scores.poids.fiabilite +
      scores.eco * scores.poids.eco) /
    100;

  return Math.round(scoreGlobal * 100) / 100;
}

/**
 * Normaliser un score entre 0 et 100
 */
export function normalizeScore(
  value: number,
  min: number,
  max: number,
  inverse: boolean = false
): number {
  if (max === min) return 50;

  let score = ((value - min) / (max - min)) * 100;

  if (inverse) {
    score = 100 - score;
  }

  return Math.max(0, Math.min(100, Math.round(score * 100) / 100));
}

// =====================================================
// Helpers de formatage de données
// =====================================================

/**
 * Formater un poids
 */
export function formatPoids(kg: number): string {
  if (kg >= 1000) {
    return `${Math.round(kg / 100) / 10}t`;
  }
  return `${Math.round(kg * 10) / 10}kg`;
}

/**
 * Formater un volume
 */
export function formatVolume(m3: number): string {
  if (m3 < 1) {
    return `${Math.round(m3 * 1000)}L`;
  }
  return `${Math.round(m3 * 100) / 100}m³`;
}

/**
 * Formater une distance
 */
export function formatDistance(km: number): string {
  if (km >= 1000) {
    return `${Math.round(km / 100) / 10}k km`;
  }
  return `${Math.round(km * 10) / 10}km`;
}

/**
 * Formater une émission CO2
 */
export function formatCO2(kg: number): string {
  if (kg >= 1000) {
    return `${Math.round(kg / 100) / 10}t CO₂`;
  }
  return `${Math.round(kg * 10) / 10}kg CO₂`;
}

/**
 * Formater un montant
 */
export function formatMontant(montant: number, devise: string = 'EUR'): string {
  return new Intl.NumberFormat('fr-FR', {
    style: 'currency',
    currency: devise,
  }).format(montant);
}

/**
 * Formater une durée en heures
 */
export function formatDuree(heures: number): string {
  if (heures < 24) {
    return `${Math.round(heures * 10) / 10}h`;
  }

  const jours = Math.floor(heures / 24);
  const heuresRestantes = Math.round(heures % 24);

  if (heuresRestantes === 0) {
    return `${jours}j`;
  }

  return `${jours}j ${heuresRestantes}h`;
}

/**
 * Formater un délai en jours
 */
export function formatDelai(jours: number): string {
  if (jours === 0) return "Aujourd'hui";
  if (jours === 1) return 'Demain';
  if (jours < 7) return `${jours} jours`;
  if (jours < 30) {
    const semaines = Math.floor(jours / 7);
    return `${semaines} semaine${semaines > 1 ? 's' : ''}`;
  }

  const mois = Math.floor(jours / 30);
  return `${mois} mois`;
}

/**
 * Formater un pourcentage
 */
export function formatPourcentage(valeur: number): string {
  return `${Math.round(valeur * 10) / 10}%`;
}

// =====================================================
// Helpers de validation
// =====================================================

/**
 * Vérifier si un plan est éditable
 */
export function isPlanEditable(statut: PlanTransportStatut): boolean {
  return ['draft', 'planifie'].includes(statut);
}

/**
 * Vérifier si un plan peut être annulé
 */
export function isPlanAnnulable(statut: PlanTransportStatut): boolean {
  return !['livre', 'annule'].includes(statut);
}

/**
 * Vérifier si un plan est en cours
 */
export function isPlanEnCours(statut: PlanTransportStatut): boolean {
  return [
    'en_attente_pickup',
    'pickup_effectue',
    'en_transit',
    'en_livraison',
  ].includes(statut);
}

/**
 * Vérifier si un plan est terminé
 */
export function isPlanTermine(statut: PlanTransportStatut): boolean {
  return ['livre', 'annule'].includes(statut);
}

// =====================================================
// Helpers d'équivalents environnementaux
// =====================================================

/**
 * Calculer équivalent en arbres à planter
 * 1 arbre absorbe environ 25kg de CO2 par an
 */
export function calculateEquivalentArbres(co2Kg: number): number {
  return Math.ceil(co2Kg / 25);
}

/**
 * Calculer équivalent en km de voiture
 * 1 km en voiture = environ 0.2kg de CO2
 */
export function calculateEquivalentVoitureKm(co2Kg: number): number {
  return Math.round((co2Kg / 0.2) * 10) / 10;
}

// =====================================================
// Helpers de tri et filtrage
// =====================================================

/**
 * Trier les transporteurs par score
 */
export function sortTransporteursByScore<T extends { score_final?: number }>(
  transporteurs: T[]
): T[] {
  return [...transporteurs].sort((a, b) => {
    const scoreA = a.score_final || 0;
    const scoreB = b.score_final || 0;
    return scoreB - scoreA;
  });
}

/**
 * Filtrer les alertes par sévérité
 */
export function filterAlertesBySeverite<T extends { severite: SeveriteAlerte }>(
  alertes: T[],
  severites: SeveriteAlerte[]
): T[] {
  return alertes.filter((alerte) => severites.includes(alerte.severite));
}

/**
 * Grouper les plans par statut
 */
export function groupPlansByStatut<T extends { statut: PlanTransportStatut }>(
  plans: T[]
): Record<PlanTransportStatut, T[]> {
  const grouped: Partial<Record<PlanTransportStatut, T[]>> = {};

  plans.forEach((plan) => {
    if (!grouped[plan.statut]) {
      grouped[plan.statut] = [];
    }
    grouped[plan.statut]!.push(plan);
  });

  return grouped as Record<PlanTransportStatut, T[]>;
}

// =====================================================
// Helpers de couleurs
// =====================================================

/**
 * Obtenir la couleur selon le score
 */
export function getScoreColor(score: number): string {
  if (score >= 80) return 'text-green-600';
  if (score >= 60) return 'text-blue-600';
  if (score >= 40) return 'text-yellow-600';
  if (score >= 20) return 'text-orange-600';
  return 'text-red-600';
}

/**
 * Obtenir la couleur selon le taux de ponctualité
 */
export function getPonctualiteColor(taux: number): string {
  if (taux >= 95) return 'text-green-600';
  if (taux >= 90) return 'text-blue-600';
  if (taux >= 80) return 'text-yellow-600';
  if (taux >= 70) return 'text-orange-600';
  return 'text-red-600';
}

/**
 * Obtenir la couleur selon l'économie
 */
export function getEconomieColor(economiePct: number): string {
  if (economiePct >= 20) return 'text-green-600';
  if (economiePct >= 15) return 'text-blue-600';
  if (economiePct >= 10) return 'text-cyan-600';
  if (economiePct >= 5) return 'text-yellow-600';
  return 'text-gray-600';
}
