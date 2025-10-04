import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Clock, Package, Truck, CheckCircle2, AlertCircle } from "lucide-react";
import { format } from "date-fns";
import { fr } from "date-fns/locale";

interface HistoireTimelineProps {
  commande: any;
}

const statusConfig: Record<string, { icon: any; color: string; label: string }> = {
  "En attente de réappro": {
    icon: AlertCircle,
    color: "text-amber-500",
    label: "En attente",
  },
  "Prêt à préparer": {
    icon: Package,
    color: "text-blue-500",
    label: "Prêt",
  },
  "En préparation": {
    icon: Package,
    color: "text-purple-500",
    label: "En cours",
  },
  prete: {
    icon: CheckCircle2,
    color: "text-green-500",
    label: "Préparée",
  },
  expediee: {
    icon: Truck,
    color: "text-green-600",
    label: "Expédiée",
  },
};

export const HistoireTimeline = ({ commande }: HistoireTimelineProps) => {
  const events = [];

  // Événement de création
  if (commande.date_creation) {
    events.push({
      date: commande.date_creation,
      type: "creation",
      label: "Commande créée",
      description: `Source: ${commande.source}`,
      icon: Package,
      color: "text-blue-500",
    });
  }

  // Événement de modification (si différent de création)
  if (
    commande.date_modification &&
    commande.date_modification !== commande.date_creation
  ) {
    events.push({
      date: commande.date_modification,
      type: "modification",
      label: "Dernière modification",
      description: `Statut actuel: ${commande.statut_wms}`,
      icon: Clock,
      color: "text-muted-foreground",
    });
  }

  // Événement d'expédition si applicable
  if (commande.tracking_number) {
    events.push({
      date: commande.date_modification, // Utiliser date_modification comme approximation
      type: "expedition",
      label: "Commande expédiée",
      description: `Transporteur: ${commande.transporteur || "N/A"}`,
      icon: Truck,
      color: "text-green-600",
    });
  }

  // Trier par date décroissante (plus récent en haut)
  events.sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime());

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <Clock className="h-5 w-5" />
          Historique & Traçabilité
        </CardTitle>
      </CardHeader>
      <CardContent>
        <div className="relative space-y-4">
          {/* Ligne verticale */}
          <div className="absolute left-4 top-0 bottom-0 w-0.5 bg-border" />

          {events.map((event, index) => {
            const Icon = event.icon;
            return (
              <div key={index} className="relative flex gap-4 pl-0">
                {/* Icône */}
                <div
                  className={`relative z-10 flex h-8 w-8 items-center justify-center rounded-full border-2 border-background bg-card ${event.color}`}
                >
                  <Icon className="h-4 w-4" />
                </div>

                {/* Contenu */}
                <div className="flex-1 pb-4">
                  <div className="flex items-start justify-between gap-2">
                    <div className="flex-1">
                      <p className="font-medium">{event.label}</p>
                      {event.description && (
                        <p className="text-sm text-muted-foreground mt-1">
                          {event.description}
                        </p>
                      )}
                    </div>
                    <Badge variant="outline" className="text-xs whitespace-nowrap">
                      {format(new Date(event.date), "dd MMM yyyy HH:mm", {
                        locale: fr,
                      })}
                    </Badge>
                  </div>
                </div>
              </div>
            );
          })}
        </div>

        {events.length === 0 && (
          <div className="text-center py-8 text-muted-foreground">
            <Clock className="h-12 w-12 mx-auto mb-2 opacity-50" />
            <p>Aucun historique disponible</p>
          </div>
        )}
      </CardContent>
    </Card>
  );
};
