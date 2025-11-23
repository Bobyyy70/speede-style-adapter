import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Progress } from "@/components/ui/progress";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";

export function PerformanceMetricsWidget() {
  const { getViewingClientId } = useAuth();

  const { data: metrics, isLoading } = useQuery({
    queryKey: ["performance-metrics", getViewingClientId()],
    queryFn: async () => await fetchPerformanceMetrics(getViewingClientId()),
  });

  if (isLoading) {
    return <Card><CardContent className="p-6">Chargement...</CardContent></Card>;
  }

  return (
    <div className="grid gap-4 md:grid-cols-3">
      <Card>
        <CardHeader>
          <CardTitle className="text-sm">Taux de fulfillment</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="text-3xl font-bold">{metrics?.fulfillmentRate || 0}%</div>
          <Progress value={metrics?.fulfillmentRate || 0} className="mt-3" />
          <div className="text-sm text-muted-foreground mt-2">
            Objectif: &gt;98%
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="text-sm">Temps moyen de traitement</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="text-3xl font-bold">{metrics?.avgProcessingTime || 0} min</div>
          <div className="text-sm text-muted-foreground mt-2">
            Objectif: &lt;120 min
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="text-sm">Précision inventaire</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="text-3xl font-bold">{metrics?.inventoryAccuracy || 0}%</div>
          <Progress value={metrics?.inventoryAccuracy || 0} className="mt-3" />
          <div className="text-sm text-muted-foreground mt-2">
            Objectif: &gt;99%
          </div>
        </CardContent>
      </Card>
    </div>
  );
}

async function fetchPerformanceMetrics(clientId: string | null) {
  return {
    fulfillmentRate: 97.8,
    avgProcessingTime: 95,
    inventoryAccuracy: 99.2,
  };
}
