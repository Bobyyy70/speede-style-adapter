import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { AlertTriangle, CheckCircle2, X } from "lucide-react";
import { toast } from "sonner";
import { useNavigate } from "react-router-dom";

interface AlertesDegradationProps {
  limit?: number;
  showAll?: boolean;
}

export function AlertesDegradationTransporteur({ limit = 3, showAll = false }: AlertesDegradationProps) {
  const queryClient = useQueryClient();
  const navigate = useNavigate();

  // Fetch active alerts
  const { data: alertes, isLoading } = useQuery({
    queryKey: ["alertes-degradation-transporteur", limit],
    queryFn: async () => {
      let query = supabase
        .from("alerte_performance_transporteur" as any)
        .select("*")
        .eq("traitee", false)
        .order("date_creation", { ascending: false });

      if (!showAll) {
        query = query.limit(limit);
      }

      const { data, error } = await query;
      if (error) throw error;
      return data as any[];
    },
    refetchInterval: 60000, // Refresh every minute
  });

  // Mark as treated mutation
  const traitAlertMutation = useMutation({
    mutationFn: async (alerteId: string) => {
      const { error } = await supabase
        .from("alerte_performance_transporteur" as any)
        .update({ 
          traitee: true, 
          date_traitement: new Date().toISOString()
        })
        .eq("id", alerteId);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["alertes-degradation-transporteur"] });
      toast.success("Alerte marquée comme traitée");
    },
  });

  if (isLoading) {
    return (
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2 text-sm">
            <AlertTriangle className="h-4 w-4" />
            Alertes de Dégradation
          </CardTitle>
        </CardHeader>
        <CardContent>
          <p className="text-sm text-muted-foreground">Chargement...</p>
        </CardContent>
      </Card>
    );
  }

  if (!alertes || alertes.length === 0) {
    return (
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2 text-sm">
            <CheckCircle2 className="h-4 w-4 text-green-600" />
            Alertes de Dégradation
          </CardTitle>
        </CardHeader>
        <CardContent>
          <p className="text-sm text-muted-foreground">Aucune alerte active</p>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card>
      <CardHeader>
        <div className="flex items-center justify-between">
          <CardTitle className="flex items-center gap-2 text-sm">
            <AlertTriangle className="h-4 w-4 text-orange-600" />
            Alertes de Dégradation
            <Badge variant="destructive">{alertes.length}</Badge>
          </CardTitle>
          {!showAll && (
            <Button
              size="sm"
              variant="ghost"
              onClick={() => navigate("/analytics/scoring-predictif")}
            >
              Voir tout
            </Button>
          )}
        </div>
      </CardHeader>
      <CardContent className="space-y-3">
        {alertes.map((alerte: any) => (
          <Alert
            key={alerte.id}
            variant={alerte.niveau_severite === 'critical' ? 'destructive' : 'default'}
            className="relative"
          >
            <AlertTriangle className="h-4 w-4" />
            <AlertTitle className="flex items-center justify-between pr-6">
              <span className="text-sm">{alerte.type_alerte}</span>
              <Badge variant={alerte.niveau_severite === 'critical' ? 'destructive' : 'secondary'}>
                {alerte.niveau_severite}
              </Badge>
            </AlertTitle>
            <AlertDescription>
              <p className="text-sm">{alerte.message}</p>
              {alerte.recommandation && (
                <p className="text-xs mt-2 text-muted-foreground">
                  💡 {alerte.recommandation}
                </p>
              )}
              <div className="flex justify-end mt-2">
                <Button
                  size="sm"
                  variant="ghost"
                  onClick={() => traitAlertMutation.mutate(alerte.id)}
                  disabled={traitAlertMutation.isPending}
                >
                  <CheckCircle2 className="h-3 w-3 mr-1" />
                  Traiter
                </Button>
              </div>
            </AlertDescription>
            <Button
              size="sm"
              variant="ghost"
              className="absolute top-2 right-2 h-6 w-6 p-0"
              onClick={() => traitAlertMutation.mutate(alerte.id)}
            >
              <X className="h-3 w-3" />
            </Button>
          </Alert>
        ))}
      </CardContent>
    </Card>
  );
}
