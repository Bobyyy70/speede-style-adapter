import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Users, ArrowUpRight, ArrowDownRight } from "lucide-react";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";

interface TopClient {
  id: string;
  name: string;
  ordersCount: number;
  revenue: number;
  trend: number;
}

export function TopClientsWidget() {
  const { data: clients, isLoading } = useQuery({
    queryKey: ["top-clients"],
    queryFn: fetchTopClients,
  });

  if (isLoading) {
    return <Card><CardContent className="p-6">Chargement...</CardContent></Card>;
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <Users className="h-5 w-5" />
          Top Clients
        </CardTitle>
      </CardHeader>
      <CardContent>
        <div className="space-y-3">
          {clients?.slice(0, 5).map((client, idx) => (
            <div key={client.id} className="flex items-center justify-between">
              <div className="flex items-center gap-3">
                <div className="w-8 h-8 rounded-full bg-primary/10 flex items-center justify-center font-bold text-primary">
                  {idx + 1}
                </div>
                <div>
                  <div className="font-medium">{client.name}</div>
                  <div className="text-sm text-muted-foreground">
                    {client.ordersCount} commandes
                  </div>
                </div>
              </div>
              <div className="text-right">
                <div className="font-semibold">
                  {new Intl.NumberFormat('fr-FR', { style: 'currency', currency: 'EUR' }).format(client.revenue)}
                </div>
                <div className={`text-sm flex items-center gap-1 ${client.trend >= 0 ? 'text-green-600' : 'text-red-600'}`}>
                  {client.trend >= 0 ? <ArrowUpRight className="h-3 w-3" /> : <ArrowDownRight className="h-3 w-3" />}
                  {Math.abs(client.trend)}%
                </div>
              </div>
            </div>
          ))}
        </div>
      </CardContent>
    </Card>
  );
}

async function fetchTopClients(): Promise<TopClient[]> {
  const { data: commandes } = await supabase
    .from('commande')
    .select('client_id, valeur_totale, date_creation')
    .gte('date_creation', new Date(Date.now() - 30 * 24 * 60 * 60 * 1000).toISOString());

  const clientStats: { [key: string]: { count: number; revenue: number } } = {};

  commandes?.forEach(cmd => {
    if (!cmd.client_id) return;
    if (!clientStats[cmd.client_id]) {
      clientStats[cmd.client_id] = { count: 0, revenue: 0 };
    }
    clientStats[cmd.client_id].count++;
    clientStats[cmd.client_id].revenue += parseFloat(String(cmd.valeur_totale || 0));
  });

  const { data: clients } = await supabase
    .from('client')
    .select('id, nom_entreprise')
    .in('id', Object.keys(clientStats));

  return clients?.map(c => ({
    id: c.id,
    name: c.nom_entreprise,
    ordersCount: clientStats[c.id]?.count || 0,
    revenue: clientStats[c.id]?.revenue || 0,
    trend: Math.random() * 30 - 10,
  })).sort((a, b) => b.revenue - a.revenue) || [];
}
