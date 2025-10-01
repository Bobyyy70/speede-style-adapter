import { useLocation } from "react-router-dom";

export interface Breadcrumb {
  label: string;
  href: string;
}

const routeLabels: Record<string, string> = {
  "/": "Dashboard",
  "/reception": "Réception",
  "/mouvements": "Mouvements",
  "/picking": "Picking",
  "/reappro": "Réapprovisionnement",
  "/produits": "Produits",
  "/emplacements": "Emplacements",
  "/retours": "Retours",
  "/parametres": "Paramètres",
};

export const useBreadcrumbs = (): Breadcrumb[] => {
  const location = useLocation();
  const pathSegments = location.pathname.split("/").filter(Boolean);

  const breadcrumbs: Breadcrumb[] = [
    { label: "Dashboard", href: "/" },
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
