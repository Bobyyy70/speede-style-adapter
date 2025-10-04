import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Package, Sparkles } from "lucide-react";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";

interface ServicesSectionProps {
  commandeId: string;
}

export const ServicesSection = ({ commandeId }: ServicesSectionProps) => {
  const { data: services, isLoading } = useQuery({
    queryKey: ["ligne_service_commande", commandeId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("ligne_service_commande")
        .select(`
          *,
          service:service_logistique(nom_service, code_service)
        `)
        .eq("commande_id", commandeId)
        .order("date_creation", { ascending: true });

      if (error) throw error;
      return data || [];
    },
  });

  if (isLoading) {
    return <div className="text-sm text-muted-foreground">Chargement des services...</div>;
  }

  if (!services || services.length === 0) {
    return (
      <div className="text-center py-8 text-muted-foreground">
        <Package className="h-12 w-12 mx-auto mb-2 opacity-50" />
        <p>Aucun service logistique facturé pour cette commande</p>
      </div>
    );
  }

  const totalServices = services.reduce((sum, s) => sum + (s.prix_total || 0), 0);

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <Package className="h-5 w-5" />
          Services logistiques facturés
        </CardTitle>
      </CardHeader>
      <CardContent>
        <div className="space-y-3">
          {services.map((service) => (
            <div
              key={service.id}
              className="flex items-center justify-between p-3 border rounded-lg hover:bg-muted/30 transition-colors"
            >
              <div className="flex-1">
                <div className="flex items-center gap-2">
                  <span className="font-medium">
                    {service.service?.nom_service || "Service"}
                  </span>
                  {service.genere_automatiquement && (
                    <Badge variant="secondary" className="text-xs gap-1">
                      <Sparkles className="h-3 w-3" />
                      Auto
                    </Badge>
                  )}
                </div>
                {service.service?.code_service && (
                  <span className="text-xs text-muted-foreground">
                    {service.service.code_service}
                  </span>
                )}
                {service.remarques && (
                  <p className="text-sm text-muted-foreground mt-1">
                    {service.remarques}
                  </p>
                )}
              </div>
              <div className="text-right">
                <div className="flex items-center gap-3">
                  <span className="text-sm text-muted-foreground">
                    {service.quantite} × {service.prix_unitaire?.toFixed(2)} €
                  </span>
                  <span className="font-semibold">
                    {service.prix_total?.toFixed(2)} €
                  </span>
                </div>
              </div>
            </div>
          ))}
        </div>

        <div className="mt-4 pt-4 border-t flex justify-between items-center">
          <span className="font-semibold">Total services</span>
          <span className="text-lg font-bold">{totalServices.toFixed(2)} €</span>
        </div>
      </CardContent>
    </Card>
  );
};
