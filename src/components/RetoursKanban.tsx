import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { PackageOpen, Settings, CheckCircle, XCircle } from "lucide-react";

interface Retour {
  id: string;
  numero_retour: string;
  date_retour: string;
  statut_retour: string;
  raison_retour: string | null;
  client_id: string | null;
  valeur_totale: number | null;
  client?: {
    nom_entreprise: string;
  };
}

interface RetoursKanbanProps {
  retours: Retour[];
  onRetourClick?: (retourId: string) => void;
  loading?: boolean;
}

const COLUMNS = [
  { id: "recu", label: "Reçu", icon: PackageOpen, color: "text-blue-600" },
  { id: "en_traitement", label: "En traitement", icon: Settings, color: "text-yellow-600" },
  { id: "traite", label: "Traité", icon: CheckCircle, color: "text-green-600" },
  { id: "non_conforme", label: "Non conforme", icon: XCircle, color: "text-red-600" },
];

export function RetoursKanban({ retours, onRetourClick, loading }: RetoursKanbanProps) {
  const getRetoursByStatus = (status: string) => {
    return retours.filter((r) => r.statut_retour === status);
  };

  return (
    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
      {COLUMNS.map((column) => {
        const columnRetours = getRetoursByStatus(column.id);
        const Icon = column.icon;

        return (
          <Card key={column.id} className="flex flex-col">
            <CardHeader className="pb-3">
              <CardTitle className="flex items-center gap-2 text-base">
                <Icon className={`h-5 w-5 ${column.color}`} />
                <span>{column.label}</span>
                <Badge variant="secondary" className="ml-auto">
                  {columnRetours.length}
                </Badge>
              </CardTitle>
            </CardHeader>
            <CardContent className="flex-1 space-y-2 overflow-y-auto max-h-[600px]">
              {columnRetours.length === 0 ? (
                <p className="text-sm text-muted-foreground text-center py-4">
                  Aucun retour
                </p>
              ) : (
                columnRetours.map((retour) => (
                  <Card
                    key={retour.id}
                    className="p-3 cursor-pointer hover:shadow-md transition-all hover:scale-[1.02]"
                    onClick={() => onRetourClick?.(retour.id)}
                  >
                    <div className="space-y-2">
                      <div className="font-semibold text-sm">
                        {retour.numero_retour}
                      </div>
                      {retour.client && (
                        <div className="text-xs text-muted-foreground">
                          {retour.client.nom_entreprise}
                        </div>
                      )}
                      <div className="flex items-center justify-between text-xs">
                        <span className="text-muted-foreground">
                          {new Date(retour.date_retour).toLocaleDateString("fr-FR")}
                        </span>
                        {retour.valeur_totale && (
                          <span className="font-semibold">
                            {retour.valeur_totale.toFixed(2)} €
                          </span>
                        )}
                      </div>
                      {retour.raison_retour && (
                        <Badge variant="outline" className="text-xs">
                          {retour.raison_retour}
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
