import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Progress } from "@/components/ui/progress";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";

export function OrdersByStatusWidget() {
  const { getViewingClientId } = useAuth();

  const { data: statusData, isLoading } = useQuery({
    queryKey: ["orders-by-status", getViewingClientId()],
    queryFn: async () => await fetchOrdersByStatus(getViewingClientId()),
  });

  if (isLoading) {
    return <Card><CardContent className="p-6">Chargement...</CardContent></Card>;
  }

  const total = Object.values(statusData || {}).reduce((sum: number, count) => sum + (count as number), 0);

  return (
    <Card>
      <CardHeader>
        <CardTitle>Commandes par statut</CardTitle>
      </CardHeader>
      <CardContent className="space-y-3">
        {statusData && Object.entries(statusData).map(([status, count]) => (
          <div key={status} className="space-y-1">
            <div className="flex items-center justify-between text-sm">
              <span className="font-medium">{formatStatus(status)}</span>
              <span className="text-muted-foreground">{count as number}</span>
            </div>
            <Progress
              value={((count as number) / (total || 1)) * 100}
              className="h-2"
            />
          </div>
        ))}
      </CardContent>
    </Card>
  );
}

async function fetchOrdersByStatus(clientId: string | null): Promise<{ [key: string]: number }> {
  let query = supabase.from('commande').select('statut_wms');
  
  if (clientId) {
    query = query.eq('client_id', clientId);
  }

  const { data: commandes } = await query;

  const statusCount: { [key: string]: number } = {};
  commandes?.forEach(cmd => {
    statusCount[cmd.statut_wms] = (statusCount[cmd.statut_wms] || 0) + 1;
  });

  return statusCount;
}

function formatStatus(status: string): string {
  const statusMap: { [key: string]: string } = {
    'en_attente': 'En attente',
    'en_preparation': 'En préparation',
    'prete': 'Prête',
    'expediee': 'Expédiée',
    'livree': 'Livrée',
    'annulee': 'Annulée',
  };
  return statusMap[status] || status;
}
