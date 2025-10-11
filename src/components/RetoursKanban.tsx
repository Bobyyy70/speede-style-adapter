import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { PackageX, Clock, CheckCircle, XCircle } from "lucide-react";
import { DeleteButton } from "./DeleteButton";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";

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
  { id: "recu", label: "Reçu", icon: PackageX, color: "text-blue-600" },
  { id: "en_traitement", label: "En traitement", icon: Clock, color: "text-yellow-600" },
  { id: "traite", label: "Traité", icon: CheckCircle, color: "text-green-600" },
  { id: "non_conforme", label: "Non conforme", icon: XCircle, color: "text-red-600" },
];

export function RetoursKanban({ retours, onRetourClick, loading }: RetoursKanbanProps) {
  const { toast } = useToast();

  const handleDelete = async (retourId: string) => {
    const { error } = await supabase
      .from("retour_produit")
      .update({ statut_retour: "annule" })
      .eq("id", retourId);

    if (error) {
      toast({
        title: "Erreur",
        description: "Impossible d'annuler le retour",
        variant: "destructive",
      });
      throw error;
    }

    toast({
      title: "Retour annulé",
      description: "Le retour a été marqué comme annulé",
    });
  };

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
            {columnRetours.length > 0 ? (
              columnRetours.map((retour) => (
                <div
                  key={retour.id}
                  className="bg-card border rounded-lg p-3 hover:shadow-md transition-shadow space-y-2 group relative"
                >
                  {/* Bouton suppression */}
                  <div className="absolute top-2 right-2 z-10 opacity-0 group-hover:opacity-100 transition-opacity">
                    <DeleteButton
                      onDelete={() => handleDelete(retour.id)}
                      entityName={`le retour ${retour.numero_retour}`}
                    />
                  </div>

                  {/* Contenu cliquable */}
                  <div onClick={() => onRetourClick?.(retour.id)} className="cursor-pointer">
                    <div className="flex items-start justify-between gap-2">
                      <div className="flex-1 min-w-0">
                        <div className="font-medium text-sm truncate">{retour.numero_retour}</div>
                        {retour.client && (
                          <div className="text-xs text-muted-foreground truncate">{retour.client.nom_entreprise}</div>
                        )}
                      </div>
                    </div>
                    <div className="flex items-center justify-between text-xs mt-2 pt-2 border-t">
                      <span className="text-muted-foreground">
                        {new Date(retour.date_retour).toLocaleDateString()}
                      </span>
                      {retour.valeur_totale && (
                        <span className="font-medium">€{retour.valeur_totale.toFixed(2)}</span>
                      )}
                    </div>
                    {retour.raison_retour && (
                      <div className="text-xs text-muted-foreground mt-1 line-clamp-1">{retour.raison_retour}</div>
                    )}
                  </div>
                </div>
              ))
            ) : (
              <div className="text-center py-8 text-muted-foreground text-sm">
                Aucun retour
              </div>
            )}
            </CardContent>
          </Card>
        );
      })}
    </div>
  );
}
