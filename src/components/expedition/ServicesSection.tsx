import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Package, ExternalLink, Clock, CheckCircle2, XCircle } from "lucide-react";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";

interface ServicesSectionProps {
  commandeId: string;
  commande?: any;
}

const getStatusBadge = (statut: string) => {
  const variants: Record<string, { label: string; icon: any; className: string }> = {
    'en_attente_rdv': { label: 'En attente RDV', icon: Clock, className: 'bg-yellow-100 text-yellow-800' },
    'rdv_planifie': { label: 'RDV planifié', icon: Clock, className: 'bg-blue-100 text-blue-800' },
    'valide': { label: 'Validé', icon: CheckCircle2, className: 'bg-green-100 text-green-800' },
    'en_cours': { label: 'En cours', icon: Package, className: 'bg-purple-100 text-purple-800' },
    'termine': { label: 'Terminé', icon: CheckCircle2, className: 'bg-green-100 text-green-800' },
    'annule': { label: 'Annulé', icon: XCircle, className: 'bg-gray-100 text-gray-800' },
  };
  return variants[statut] || variants['en_attente_rdv'];
};

export const ServicesSection = ({ commandeId, commande }: ServicesSectionProps) => {
  // Fetch custom services for the client associated with this order
  const { data: services, isLoading } = useQuery({
    queryKey: ["demande_service_personnalise_commande", commandeId, commande?.client_id],
    queryFn: async () => {
      if (!commande?.client_id) return [];

      const { data, error } = await supabase
        .from("demande_service_personnalise")
        .select(`
          *,
          service:service_id (
            nom_service,
            code_service,
            description
          )
        `)
        .eq("client_id", commande.client_id)
        .in("statut", ["en_attente_rdv", "rdv_planifie", "valide", "en_cours"])
        .order("date_creation", { ascending: false })
        .limit(5);

      if (error) throw error;
      return data || [];
    },
    enabled: !!commande?.client_id,
  });

  if (isLoading) {
    return <div className="text-sm text-muted-foreground">Chargement des services...</div>;
  }

  if (!commande?.client_id) {
    return (
      <div className="text-center py-8 text-muted-foreground">
        <Package className="h-12 w-12 mx-auto mb-2 opacity-50" />
        <p>Aucun client associé à cette commande</p>
      </div>
    );
  }

  if (!services || services.length === 0) {
    return (
      <div className="text-center py-8 text-muted-foreground">
        <Package className="h-12 w-12 mx-auto mb-2 opacity-50" />
        <p className="mb-2">Aucune demande de service personnalisé active</p>
        <p className="text-xs">Les services personnalisés sont gérés au niveau client</p>
      </div>
    );
  }

  return (
    <Card>
      <CardHeader>
        <div className="flex items-center justify-between">
          <CardTitle className="flex items-center gap-2">
            <Package className="h-5 w-5" />
            Services personnalisés du client
          </CardTitle>
          <Badge variant="outline" className="text-xs">
            {services.length} actif(s)
          </Badge>
        </div>
      </CardHeader>
      <CardContent>
        <div className="space-y-3">
          {services.map((service) => {
            const statusInfo = getStatusBadge(service.statut);
            const StatusIcon = statusInfo.icon;

            return (
              <div
                key={service.id}
                className="flex items-start justify-between p-3 border rounded-lg hover:bg-muted/30 transition-colors"
              >
                <div className="flex-1">
                  <div className="flex items-center gap-2 mb-1">
                    <span className="font-medium">
                      {service.service?.nom_service || "Service personnalisé"}
                    </span>
                    <Badge variant="secondary" className={`text-xs gap-1 ${statusInfo.className}`}>
                      <StatusIcon className="h-3 w-3" />
                      {statusInfo.label}
                    </Badge>
                  </div>

                  {service.service?.code_service && (
                    <span className="text-xs text-muted-foreground block mb-1">
                      Code: {service.service.code_service}
                    </span>
                  )}

                  {service.date_rdv && (
                    <p className="text-sm text-muted-foreground">
                      RDV: {new Date(service.date_rdv).toLocaleDateString('fr-FR', {
                        day: '2-digit',
                        month: 'short',
                        year: 'numeric',
                        hour: '2-digit',
                        minute: '2-digit'
                      })}
                    </p>
                  )}
                </div>

                <div className="text-right ml-4">
                  {service.prix_estime && (
                    <div className="text-sm text-muted-foreground">
                      Estimé: {service.prix_estime.toFixed(2)} €
                    </div>
                  )}
                  {service.prix_final && (
                    <div className="font-semibold text-green-700">
                      Final: {service.prix_final.toFixed(2)} €
                    </div>
                  )}
                </div>
              </div>
            );
          })}
        </div>

        <div className="mt-4 pt-4 border-t">
          <Button
            variant="outline"
            size="sm"
            className="w-full gap-2"
            onClick={() => window.open('/services-personnalises', '_blank')}
          >
            <ExternalLink className="h-4 w-4" />
            Gérer les services personnalisés
          </Button>
        </div>
      </CardContent>
    </Card>
  );
};
