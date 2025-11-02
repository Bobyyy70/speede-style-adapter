import { useLocation } from "react-router-dom";

export interface Breadcrumb {
  label: string;
  href: string;
}

const routeLabels: Record<string, string> = {
  "/": "Tableau de Bord",
  "/stock": "Stock",
  "/stock/reception": "Stock > Réception",
  "/stock/mouvements": "Stock > Mouvements",
  "/commandes/reappro": "Préparation > Réappro",
  "/stock/produits": "Stock > Produits",
  "/stock/emplacements": "Stock > Emplacements",
  "/commandes": "Commandes > Gestion des commandes",
  "/commandes/preparation": "Préparation > Sessions de préparation",
  "/commandes/retours": "Retours > Gestion des retours",
  "/expedition": "Expédition",
  "/expedition/create-label": "Expédition > Créer une étiquette",
  "/expedition/tracking": "Expédition > Suivi",
  "/service-client": "Service Client",
  "/integrations": "Intégrations",
  "/integrations/transporteurs": "Transporteurs",
  "/integrations/connecteurs": "Connecteurs",
  "/integrations/sendcloud-sync": "SendCloud Sync",
  "/gestion-donnees": "Gestion Données",
  "/gestion-donnees/import-export": "Import/Export",
  "/administratif": "Administratif",
  "/administratif/facturation": "Facturation",
  "/administratif/services": "Services Logistiques",
  "/parametres": "Paramètres",
  "/parametres/utilisateurs": "Utilisateurs",
  "/parametres/clients": "Clients",
  "/parametres/notifications": "Notifications",
  "/parametres/expediteur": "Configuration Expéditeur",
  "/client/dashboard": "Tableau de Bord",
  "/client/commandes": "Mes Commandes",
  "/client/commandes/creer": "Mes Commandes > Créer",
  "/client/produits": "Mes Produits",
  "/client/retours": "Mes Retours",
  "/client/retours/creer": "Retours > Créer",
  "/client/facturation": "Ma Facturation",
  "/client/reception": "Attendu de Réception",
  "/client/mouvements": "Mes Mouvements",
};

export const useBreadcrumbs = (): Breadcrumb[] => {
  const location = useLocation();
  const pathSegments = location.pathname.split("/").filter(Boolean);

  const breadcrumbs: Breadcrumb[] = [
    { label: "Tableau de Bord", href: "/" },
  ];

  if (pathSegments.length === 0) {
    return breadcrumbs;
  }

  let currentPath = "";
  pathSegments.forEach((segment) => {
    currentPath += `/${segment}`;
    const label = routeLabels[currentPath] || segment;
    breadcrumbs.push({ label, href: currentPath });
  });

  return breadcrumbs;
};
