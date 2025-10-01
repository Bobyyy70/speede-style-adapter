import { useLocation } from "react-router-dom";

export interface Breadcrumb {
  label: string;
  href: string;
}

const routeLabels: Record<string, string> = {
  "/": "Tableau de Bord",
  "/reception": "Réception",
  "/stock": "Stock",
  "/stock/mouvements": "Mouvements",
  "/stock/reappro": "Réapprovisionnement",
  "/stock/produits": "Produits",
  "/stock/emplacements": "Emplacements",
  "/commandes": "Commandes",
  "/transporteurs": "Transporteurs",
  "/facturation": "Facturation",
  "/retours": "Retours",
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
