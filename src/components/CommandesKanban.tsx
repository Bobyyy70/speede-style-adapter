import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Package, Truck, CheckCircle2, AlertCircle, PackageSearch, PackageOpen, PackageCheck } from "lucide-react";
import { DeleteButton } from "./DeleteButton";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";
import { ORDER_STATUSES, ORDER_STATUS_LABELS, ORDER_STATUS_COLORS, KANBAN_COLUMNS } from "@/lib/orderStatuses";

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

const ICON_MAP: Record<string, any> = {
  'AlertCircle': AlertCircle,
  'Package': Package,
  'PackageSearch': PackageSearch,
  'PackageOpen': PackageOpen,
  'PackageCheck': PackageCheck,
  'Truck': Truck,
  'CheckCircle2': CheckCircle2
};

const COLUMNS = KANBAN_COLUMNS.map(col => ({
  ...col,
  icon: ICON_MAP[col.icon] || Package
}));

export function CommandesKanban({ commandes, onCommandeClick, loading }: CommandesKanbanProps) {
  const { toast } = useToast();

  const handleDelete = async (commandeId: string) => {
    const { error } = await supabase
      .from("commande")
      .update({ statut_wms: ORDER_STATUSES.ANNULE })
      .eq("id", commandeId);

    if (error) {
      toast({
        title: "Erreur",
        description: "Impossible d'annuler la commande",
        variant: "destructive",
      });
      throw error;
    }

    toast({
      title: "Commande annulée",
      description: "La commande a été marquée comme annulée",
    });
  };

  const getCommandesByStatus = (status: string) => {
    if (status === ORDER_STATUSES.EXPEDIE) {
      return commandes.filter((c) =>
        [ORDER_STATUSES.EXPEDIE, ORDER_STATUSES.LIVRE].includes(c.statut_wms as any)
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
            {columnCommandes.length > 0 ? (
              columnCommandes.map((commande) => (
                <div
                  key={commande.id}
                  className="bg-card border rounded-lg p-3 hover:shadow-md transition-shadow space-y-2 group relative"
                >
                  {/* Bouton suppression */}
                  <div className="absolute top-2 right-2 z-10 opacity-0 group-hover:opacity-100 transition-opacity">
                    <DeleteButton
                      onDelete={() => handleDelete(commande.id)}
                      entityName={`la commande ${commande.numero_commande}`}
                    />
                  </div>

                  {/* Contenu cliquable */}
                  <div onClick={() => onCommandeClick(commande.id)} className="cursor-pointer">
                    <div className="flex items-start justify-between gap-2">
                      <div className="flex-1 min-w-0">
                        <div className="font-medium text-sm truncate">{commande.numero_commande}</div>
                        {commande.nom_client && (
                          <div className="text-xs text-muted-foreground truncate">{commande.nom_client}</div>
                        )}
                      </div>
                    </div>
                    <div className="flex items-center justify-between text-xs mt-2 pt-2 border-t">
                      <span className="text-muted-foreground">
                        {new Date(commande.date_creation).toLocaleDateString()}
                      </span>
                      {commande.valeur_totale > 0 && (
                        <span className="font-medium">€{commande.valeur_totale.toFixed(2)}</span>
                      )}
                    </div>
                  </div>
                </div>
              ))
            ) : (
              <div className="text-center py-8 text-muted-foreground text-sm">
                Aucune commande
              </div>
            )}
            </CardContent>
          </Card>
        );
      })}
    </div>
  );
}
