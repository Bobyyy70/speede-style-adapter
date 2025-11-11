// Statuts de commande (ENUM statut_commande_enum)
export const ORDER_STATUSES = {
  // État de validation (AVANT les états de stock)
  EN_ATTENTE_VALIDATION: 'en_attente_validation',
  
  // États de stock
  EN_ATTENTE_REAPPRO: 'en_attente_reappro',
  STOCK_RESERVE: 'stock_reserve',
  
  // États de préparation
  EN_PICKING: 'en_picking',
  PICKING_TERMINE: 'picking_termine',
  EN_PREPARATION: 'en_preparation',
  PRET_EXPEDITION: 'pret_expedition',
  
  // États d'expédition
  ETIQUETTE_GENEREE: 'etiquette_generee',
  EXPEDIE: 'expedie',
  EN_TRANSIT: 'en_transit',
  EN_LIVRAISON: 'en_livraison',
  
  // États finaux
  LIVRE: 'livre',
  ANNULE: 'annule',
  ERREUR: 'erreur',
  
  // États incidents
  INCIDENT_LIVRAISON: 'incident_livraison',
  RETOUR_EXPEDITEUR: 'retour_expediteur'
} as const;

export type OrderStatus = typeof ORDER_STATUSES[keyof typeof ORDER_STATUSES];

// Labels d'affichage en français
export const ORDER_STATUS_LABELS: Record<OrderStatus, string> = {
  [ORDER_STATUSES.EN_ATTENTE_VALIDATION]: '⚠️ En attente de validation',
  [ORDER_STATUSES.EN_ATTENTE_REAPPRO]: 'En attente de réappro',
  [ORDER_STATUSES.STOCK_RESERVE]: 'Stock réservé',
  [ORDER_STATUSES.EN_PICKING]: 'En picking',
  [ORDER_STATUSES.PICKING_TERMINE]: 'Picking terminé',
  [ORDER_STATUSES.EN_PREPARATION]: 'En préparation',
  [ORDER_STATUSES.PRET_EXPEDITION]: 'Prêt à expédier',
  [ORDER_STATUSES.ETIQUETTE_GENEREE]: 'Étiquette générée',
  [ORDER_STATUSES.EXPEDIE]: 'Expédié',
  [ORDER_STATUSES.EN_TRANSIT]: 'En transit',
  [ORDER_STATUSES.EN_LIVRAISON]: 'En livraison',
  [ORDER_STATUSES.LIVRE]: 'Livré',
  [ORDER_STATUSES.ANNULE]: 'Annulé',
  [ORDER_STATUSES.ERREUR]: 'Erreur',
  [ORDER_STATUSES.INCIDENT_LIVRAISON]: 'Incident livraison',
  [ORDER_STATUSES.RETOUR_EXPEDITEUR]: 'Retour expéditeur'
};

// Couleurs pour l'affichage
export const ORDER_STATUS_COLORS: Record<OrderStatus, string> = {
  [ORDER_STATUSES.EN_ATTENTE_VALIDATION]: 'text-amber-600',
  [ORDER_STATUSES.EN_ATTENTE_REAPPRO]: 'text-orange-600',
  [ORDER_STATUSES.STOCK_RESERVE]: 'text-blue-600',
  [ORDER_STATUSES.EN_PICKING]: 'text-purple-600',
  [ORDER_STATUSES.PICKING_TERMINE]: 'text-indigo-600',
  [ORDER_STATUSES.EN_PREPARATION]: 'text-yellow-600',
  [ORDER_STATUSES.PRET_EXPEDITION]: 'text-cyan-600',
  [ORDER_STATUSES.ETIQUETTE_GENEREE]: 'text-teal-600',
  [ORDER_STATUSES.EXPEDIE]: 'text-green-600',
  [ORDER_STATUSES.EN_TRANSIT]: 'text-lime-600',
  [ORDER_STATUSES.EN_LIVRAISON]: 'text-emerald-500',
  [ORDER_STATUSES.LIVRE]: 'text-emerald-600',
  [ORDER_STATUSES.ANNULE]: 'text-red-600',
  [ORDER_STATUSES.ERREUR]: 'text-destructive',
  [ORDER_STATUSES.INCIDENT_LIVRAISON]: 'text-rose-600',
  [ORDER_STATUSES.RETOUR_EXPEDITEUR]: 'text-amber-600'
};

// Colonnes Kanban
export const KANBAN_COLUMNS = [
  {
    id: ORDER_STATUSES.EN_ATTENTE_REAPPRO,
    label: ORDER_STATUS_LABELS[ORDER_STATUSES.EN_ATTENTE_REAPPRO],
    icon: 'AlertCircle',
    color: ORDER_STATUS_COLORS[ORDER_STATUSES.EN_ATTENTE_REAPPRO]
  },
  {
    id: ORDER_STATUSES.STOCK_RESERVE,
    label: ORDER_STATUS_LABELS[ORDER_STATUSES.STOCK_RESERVE],
    icon: 'Package',
    color: ORDER_STATUS_COLORS[ORDER_STATUSES.STOCK_RESERVE]
  },
  {
    id: ORDER_STATUSES.EN_PICKING,
    label: ORDER_STATUS_LABELS[ORDER_STATUSES.EN_PICKING],
    icon: 'PackageSearch',
    color: ORDER_STATUS_COLORS[ORDER_STATUSES.EN_PICKING]
  },
  {
    id: ORDER_STATUSES.EN_PREPARATION,
    label: ORDER_STATUS_LABELS[ORDER_STATUSES.EN_PREPARATION],
    icon: 'PackageOpen',
    color: ORDER_STATUS_COLORS[ORDER_STATUSES.EN_PREPARATION]
  },
  {
    id: ORDER_STATUSES.PRET_EXPEDITION,
    label: ORDER_STATUS_LABELS[ORDER_STATUSES.PRET_EXPEDITION],
    icon: 'PackageCheck',
    color: ORDER_STATUS_COLORS[ORDER_STATUSES.PRET_EXPEDITION]
  },
  {
    id: ORDER_STATUSES.EXPEDIE,
    label: ORDER_STATUS_LABELS[ORDER_STATUSES.EXPEDIE],
    icon: 'Truck',
    color: ORDER_STATUS_COLORS[ORDER_STATUSES.EXPEDIE]
  }
] as const;

// Statuts pour les filtres
export const FILTER_STATUSES = [
  { value: 'all', label: 'Tous les statuts' },
  ...Object.entries(ORDER_STATUS_LABELS).map(([key, label]) => ({
    value: ORDER_STATUSES[key as keyof typeof ORDER_STATUSES],
    label
  }))
];

// Fonction helper pour obtenir la variante de Badge selon le statut
export const getStatutBadgeVariant = (statut: OrderStatus): "default" | "secondary" | "destructive" | "outline" => {
  switch (statut) {
    case ORDER_STATUSES.EN_ATTENTE_VALIDATION:
      return "outline";
    case ORDER_STATUSES.EN_ATTENTE_REAPPRO:
      return "outline";
    case ORDER_STATUSES.STOCK_RESERVE:
      return "secondary";
    case ORDER_STATUSES.EN_PICKING:
    case ORDER_STATUSES.PICKING_TERMINE:
    case ORDER_STATUSES.EN_PREPARATION:
      return "default";
    case ORDER_STATUSES.PRET_EXPEDITION:
    case ORDER_STATUSES.ETIQUETTE_GENEREE:
    case ORDER_STATUSES.EXPEDIE:
    case ORDER_STATUSES.EN_TRANSIT:
    case ORDER_STATUSES.EN_LIVRAISON:
    case ORDER_STATUSES.LIVRE:
      return "default";
    case ORDER_STATUSES.INCIDENT_LIVRAISON:
    case ORDER_STATUSES.RETOUR_EXPEDITEUR:
      return "outline";
    case ORDER_STATUSES.ANNULE:
    case ORDER_STATUSES.ERREUR:
      return "destructive";
    default:
      return "secondary";
  }
};
