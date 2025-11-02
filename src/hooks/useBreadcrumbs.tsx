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
  "/commandes/reappro": "Stock > Réappro",
  "/stock/produits": "Stock > Produits",
  "/stock/emplacements": "Stock > Emplacements",
  "/commandes": "Commandes",
  "/commandes/preparation": "Commandes > Préparation",
  "/commandes/retours": "Commandes > Retours",
  "/expedition": "Commandes > Expédition",
  "/integrations": "Intégrations",
  "/integrations/transporteurs": "Transporteurs",
  "/integrations/connecteurs": "Connecteurs",
  "/gestion-donnees": "Gestion Données",
  "/gestion-donnees/import-export": "Import/Export",
  "/administratif": "Administratif",
  "/administratif/facturation": "Facturation",
  "/parametres": "Paramètres",
  "/parametres/utilisateurs": "Utilisateurs",
  "/parametres/notifications": "Notifications",
  "/client/dashboard": "Tableau de Bord",
  "/client/commandes": "Commandes > Mes Commandes",
  "/client/commandes/creer": "Commandes > Créer",
  "/client/produits": "Mes Produits",
  "/client/retours": "Commandes > Mes Retours",
  "/client/facturation": "Ma Facturation",
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
