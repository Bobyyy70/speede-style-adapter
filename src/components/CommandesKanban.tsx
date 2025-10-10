import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Package, AlertCircle, Truck, CheckCircle } from "lucide-react";

interface Commande {
  id: string;
  numero_commande: string;
  nom_client: string;
  date_creation: string;
  statut_wms: string;
  source: string;
  valeur_totale: number;
  ville?: string;
  pays_code?: string;
}

interface CommandesKanbanProps {
  commandes: Commande[];
  onCommandeClick: (commandeId: string) => void;
  loading?: boolean;
}

const COLUMNS = [
  { id: "En attente de réappro", label: "En attente", icon: AlertCircle, color: "text-orange-600" },
  { id: "Prêt à préparer", label: "Prêt à préparer", icon: Package, color: "text-blue-600" },
  { id: "En préparation", label: "En préparation", icon: Truck, color: "text-yellow-600" },
  { id: "Expédié", label: "Expédiée", icon: CheckCircle, color: "text-green-600" },
];

export function CommandesKanban({ commandes, onCommandeClick, loading }: CommandesKanbanProps) {
  const getCommandesByStatus = (status: string) => {
    if (status === "Expédié") {
      return commandes.filter((c) =>
        ["Expédié", "En attente d'expédition", "En cours de livraison", "Livré"].includes(c.statut_wms)
      );
    }
    return commandes.filter((c) => c.statut_wms === status);
  };

  return (
    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
      {COLUMNS.map((column) => {
        const columnCommandes = getCommandesByStatus(column.id);
        const Icon = column.icon;

        return (
          <Card key={column.id} className="flex flex-col">
            <CardHeader className="pb-3">
              <CardTitle className="flex items-center gap-2 text-base">
                <Icon className={`h-5 w-5 ${column.color}`} />
                <span>{column.label}</span>
                <Badge variant="secondary" className="ml-auto">
                  {columnCommandes.length}
                </Badge>
              </CardTitle>
            </CardHeader>
            <CardContent className="flex-1 space-y-2 overflow-y-auto max-h-[600px]">
              {columnCommandes.length === 0 ? (
                <p className="text-sm text-muted-foreground text-center py-4">
                  Aucune commande
                </p>
              ) : (
                columnCommandes.map((commande) => (
                  <Card
                    key={commande.id}
                    className="p-3 cursor-pointer hover:shadow-md transition-all hover:scale-[1.02]"
                    onClick={() => onCommandeClick(commande.id)}
                  >
                    <div className="space-y-2">
                      <div className="font-semibold text-sm">
                        {commande.numero_commande}
                      </div>
                      <div className="text-xs text-muted-foreground">
                        {commande.nom_client}
                      </div>
                      <div className="flex items-center justify-between text-xs">
                        <span className="text-muted-foreground">
                          {new Date(commande.date_creation).toLocaleDateString("fr-FR")}
                        </span>
                        <span className="font-semibold">
                          {commande.valeur_totale.toFixed(2)} €
                        </span>
                      </div>
                      {commande.source && (
                        <Badge variant="outline" className="text-xs">
                          {commande.source}
                        </Badge>
                      )}
                    </div>
                  </Card>
                ))
              )}
            </CardContent>
          </Card>
        );
      })}
    </div>
  );
}
