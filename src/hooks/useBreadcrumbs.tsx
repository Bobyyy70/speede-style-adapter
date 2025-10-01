import { useLocation } from "react-router-dom";

export interface Breadcrumb {
  label: string;
  href: string;
}

const routeLabels: Record<string, string> = {
  "/": "Tableau de Bord",
  "/stock": "Stock",
  "/stock/reception": "Réception",
  "/stock/mouvements": "Mouvements",
  "/commandes/reappro": "Réapprovisionnement",
  "/stock/produits": "Produits",
  "/stock/emplacements": "Emplacements",
  "/commandes": "Commandes",
  "/commandes/preparation": "Préparation",
  "/commandes/retours": "Retours",
  "/integrations": "Intégrations",
  "/integrations/transporteurs": "Transporteurs",
  "/integrations/connecteurs": "Connecteurs",
  "/administratif": "Administratif",
  "/administratif/facturation": "Facturation",
  "/parametres": "Paramètres",
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
