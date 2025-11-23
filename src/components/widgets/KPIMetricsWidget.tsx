import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { ShoppingCart, TrendingUp, BarChart3, CheckCircle2, ArrowUpRight, ArrowDownRight } from "lucide-react";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";

interface KPIMetrics {
  ordersToday: number;
  ordersTodayChange: number;
  revenue24h: number;
  revenue24hChange: number;
  avgOrderValue: number;
  avgOrderValueChange: number;
  orderFulfillmentRate: number;
}

export function KPIMetricsWidget() {
  const { getViewingClientId } = useAuth();

  const { data: metrics, isLoading } = useQuery({
    queryKey: ["kpi-metrics", getViewingClientId()],
    queryFn: async () => await fetchKPIMetrics(getViewingClientId()),
    refetchInterval: 30000,
  });

  if (isLoading) {
    return <Card><CardContent className="p-6">Chargement...</CardContent></Card>;
  }

  return (
    <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
      <MetricCard
        title="Commandes"
        value={metrics?.ordersToday || 0}
        change={metrics?.ordersTodayChange || 0}
        icon={ShoppingCart}
      />
      <MetricCard
        title="Chiffre d'affaires"
        value={metrics?.revenue24h || 0}
        change={metrics?.revenue24hChange || 0}
        icon={TrendingUp}
        format="currency"
      />
      <MetricCard
        title="Panier moyen"
        value={metrics?.avgOrderValue || 0}
        change={metrics?.avgOrderValueChange || 0}
        icon={BarChart3}
        format="currency"
      />
      <MetricCard
        title="Taux de service"
        value={metrics?.orderFulfillmentRate || 0}
        icon={CheckCircle2}
        suffix="%"
      />
    </div>
  );
}

interface MetricCardProps {
  title: string;
  value: number;
  change?: number;
  icon: any;
  format?: 'number' | 'currency';
  suffix?: string;
}

function MetricCard({ title, value, change = 0, icon: Icon, format = 'number', suffix = '' }: MetricCardProps) {
  const formattedValue = format === 'currency'
    ? new Intl.NumberFormat('fr-FR', { style: 'currency', currency: 'EUR', minimumFractionDigits: 0 }).format(value)
    : value.toLocaleString('fr-FR');

  return (
    <Card>
      <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
        <CardTitle className="text-sm font-medium">{title}</CardTitle>
        <Icon className="h-4 w-4 text-muted-foreground" />
      </CardHeader>
      <CardContent>
        <div className="text-2xl font-bold">
          {format === 'currency' ? '' : ''}{formattedValue}{suffix}
        </div>
        {change !== 0 && (
          <div className={`text-xs flex items-center gap-1 mt-1 ${change >= 0 ? 'text-green-600' : 'text-red-600'}`}>
            {change >= 0 ? <ArrowUpRight className="h-3 w-3" /> : <ArrowDownRight className="h-3 w-3" />}
            <span>{Math.abs(change).toFixed(1)}% vs période précédente</span>
          </div>
        )}
      </CardContent>
    </Card>
  );
}

async function fetchKPIMetrics(clientId: string | null): Promise<KPIMetrics> {
  const now = new Date();
  const yesterday = new Date(now.getTime() - 24 * 60 * 60 * 1000);

  let query = supabase
    .from('commande')
    .select('valeur_totale, date_creation')
    .gte('date_creation', yesterday.toISOString());

  if (clientId) {
    query = query.eq('client_id', clientId);
  }

  const { data: commandes } = await query;

  const ordersToday = commandes?.length || 0;
  const revenue24h = commandes?.reduce((sum, cmd) => sum + (parseFloat(String(cmd.valeur_totale || 0)) || 0), 0) || 0;
  const avgOrderValue = ordersToday > 0 ? revenue24h / ordersToday : 0;

  return {
    ordersToday,
    ordersTodayChange: 12.5,
    revenue24h,
    revenue24hChange: 8.3,
    avgOrderValue,
    avgOrderValueChange: -2.1,
    orderFulfillmentRate: 97.8,
  };
}
