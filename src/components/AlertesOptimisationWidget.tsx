import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { AlertTriangle, TrendingDown, ArrowRight } from "lucide-react";
import { Link } from "react-router-dom";

export function AlertesOptimisationWidget() {
  const { data: alertes, isLoading } = useQuery({
    queryKey: ["alertes-poids-widget"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("alerte_poids_volumetrique")
        .select("id, numero_commande, ecart_pourcentage, statut")
        .eq("statut", "nouveau")
        .order("ecart_pourcentage", { ascending: false })
        .limit(5);

      if (error) throw error;
      return data;
    },
    refetchInterval: 60000, // Refresh every minute
  });

  if (isLoading) {
    return (
      <Card>
        <CardContent className="py-6 text-center text-muted-foreground text-sm">
          Chargement...
        </CardContent>
      </Card>
    );
  }

  if (!alertes || alertes.length === 0) {
    return (
      <Card>
        <CardHeader>
          <CardTitle className="text-base flex items-center gap-2">
            <TrendingDown className="h-4 w-4" />
            Optimisation Transport
          </CardTitle>
        </CardHeader>
        <CardContent>
          <p className="text-sm text-muted-foreground">
            Aucune alerte active. Emballages optimisés !
          </p>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card>
      <CardHeader>
        <div className="flex items-center justify-between">
          <div>
            <CardTitle className="text-base flex items-center gap-2">
              <AlertTriangle className="h-4 w-4 text-destructive" />
              Opportunités d'Optimisation
            </CardTitle>
            <CardDescription className="text-xs mt-1">
              {alertes.length} alerte{alertes.length > 1 ? "s" : ""} active{alertes.length > 1 ? "s" : ""}
            </CardDescription>
          </div>
          <Badge variant="destructive">{alertes.length}</Badge>
        </div>
      </CardHeader>
      <CardContent className="space-y-3">
        {alertes.map((alerte) => (
          <div
            key={alerte.id}
            className="flex items-center justify-between p-3 bg-muted/50 rounded-lg hover:bg-muted transition-colors"
          >
            <div className="flex-1">
              <p className="font-medium text-sm">{alerte.numero_commande}</p>
              <p className="text-xs text-muted-foreground">
                Écart: +{alerte.ecart_pourcentage.toFixed(1)}% volumétrique
              </p>
            </div>
            <Badge variant="outline" className="font-mono">
              {alerte.ecart_pourcentage.toFixed(0)}%
            </Badge>
          </div>
        ))}

        <Link to="/optimisation-transport">
          <Button variant="outline" size="sm" className="w-full">
            Voir toutes les alertes
            <ArrowRight className="h-4 w-4 ml-2" />
          </Button>
        </Link>
      </CardContent>
    </Card>
  );
}
