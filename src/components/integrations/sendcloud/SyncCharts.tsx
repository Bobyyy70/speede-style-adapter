import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { TrendingUp, PieChart as PieChartIcon, BarChart3, Loader2 } from "lucide-react";
import {
  LineChart,
  Line,
  PieChart,
  Pie,
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  Legend,
  ResponsiveContainer,
  Cell,
} from "recharts";
import { format, subDays } from "date-fns";
import { fr } from "date-fns/locale";

interface SyncLog {
  id: number;
  run_id: string;
  job: string;
  status: 'running' | 'success' | 'partial' | 'error';
  started_at: string;
  finished_at: string | null;
  batch_count: number;
  item_count: number;
}

const STATUS_COLORS = {
  success: '#22c55e',
  partial: '#f59e0b',
  error: '#ef4444',
  running: '#3b82f6',
};

const jobLabels: Record<string, string> = {
  orders: 'Commandes',
  products: 'Produits',
  parcels: 'Colis',
  carriers: 'Transporteurs',
  shipping_methods: 'Méthodes',
};

export function SyncCharts() {
  const { data: logs, isLoading } = useQuery({
    queryKey: ['sendcloud_sync_logs_charts'],
    queryFn: async () => {
      const sevenDaysAgo = subDays(new Date(), 7);

      const { data, error } = await supabase
        .from('sendcloud_sync_logs')
        .select('*')
        .gte('started_at', sevenDaysAgo.toISOString())
        .order('started_at', { ascending: true });

      if (error) throw error;
      return data as SyncLog[];
    },
    refetchInterval: 30000,
  });

  if (isLoading) {
    return (
      <div className="flex items-center justify-center py-12">
        <Loader2 className="w-8 h-8 animate-spin text-muted-foreground" />
      </div>
    );
  }

  if (!logs || logs.length === 0) {
    return (
      <Card>
        <CardContent className="pt-6">
          <p className="text-center text-muted-foreground">
            Aucune donnée disponible pour les 7 derniers jours
          </p>
        </CardContent>
      </Card>
    );
  }

  // Performance Timeline
  const performanceData = logs
    .filter(log => log.finished_at)
    .map(log => ({
      date: format(new Date(log.started_at), 'dd/MM HH:mm', { locale: fr }),
      duration: new Date(log.finished_at!).getTime() - new Date(log.started_at).getTime(),
      items: log.item_count,
      status: log.status,
    }));

  // Success Rate
  const statusDistribution = [
    { 
      name: 'Succès', 
      value: logs.filter(l => l.status === 'success').length, 
      color: STATUS_COLORS.success 
    },
    { 
      name: 'Partiels', 
      value: logs.filter(l => l.status === 'partial').length, 
      color: STATUS_COLORS.partial 
    },
    { 
      name: 'Erreurs', 
      value: logs.filter(l => l.status === 'error').length, 
      color: STATUS_COLORS.error 
    },
    { 
      name: 'En cours', 
      value: logs.filter(l => l.status === 'running').length, 
      color: STATUS_COLORS.running 
    },
  ].filter(item => item.value > 0);

  // Volume by Job Type
  const jobTypes = ['orders', 'products', 'parcels', 'carriers', 'shipping_methods'];
  const volumeByJob = jobTypes
    .map(job => {
      const jobLogs = logs.filter(l => l.job === job);
      const totalItems = jobLogs.reduce((sum, l) => sum + (l.item_count || 0), 0);
      const totalBatches = jobLogs.reduce((sum, l) => sum + (l.batch_count || 0), 0);
      const completedLogs = jobLogs.filter(l => l.finished_at);
      const avgDuration = completedLogs.length > 0
        ? completedLogs.reduce((sum, l) => {
            return sum + (new Date(l.finished_at!).getTime() - new Date(l.started_at).getTime());
          }, 0) / completedLogs.length
        : 0;

      return {
        job: jobLabels[job] || job,
        items: totalItems,
        batches: totalBatches,
        avg_duration: Math.round(avgDuration / 1000), // en secondes
      };
    })
    .filter(item => item.items > 0);

  return (
    <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
      {/* Performance Timeline */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <TrendingUp className="w-5 h-5" />
            Performance Timeline (7j)
          </CardTitle>
        </CardHeader>
        <CardContent>
          <ResponsiveContainer width="100%" height={300}>
            <LineChart data={performanceData}>
              <CartesianGrid strokeDasharray="3 3" className="stroke-muted" />
              <XAxis 
                dataKey="date" 
                className="text-xs"
                tick={{ fill: 'hsl(var(--muted-foreground))' }}
              />
              <YAxis 
                yAxisId="left"
                className="text-xs"
                tick={{ fill: 'hsl(var(--muted-foreground))' }}
                label={{ value: 'Durée (ms)', angle: -90, position: 'insideLeft' }}
              />
              <YAxis 
                yAxisId="right" 
                orientation="right"
                className="text-xs"
                tick={{ fill: 'hsl(var(--muted-foreground))' }}
                label={{ value: 'Items', angle: 90, position: 'insideRight' }}
              />
              <Tooltip 
                contentStyle={{ 
                  backgroundColor: 'hsl(var(--card))',
                  border: '1px solid hsl(var(--border))',
                  borderRadius: '6px'
                }}
              />
              <Legend />
              <Line 
                yAxisId="left"
                type="monotone" 
                dataKey="duration" 
                stroke="#3b82f6" 
                name="Durée (ms)"
                strokeWidth={2}
              />
              <Line 
                yAxisId="right"
                type="monotone" 
                dataKey="items" 
                stroke="#22c55e" 
                name="Items"
                strokeWidth={2}
              />
            </LineChart>
          </ResponsiveContainer>
        </CardContent>
      </Card>

      {/* Success Rate */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <PieChartIcon className="w-5 h-5" />
            Taux de Réussite
          </CardTitle>
        </CardHeader>
        <CardContent>
          <ResponsiveContainer width="100%" height={300}>
            <PieChart>
              <Pie
                data={statusDistribution}
                cx="50%"
                cy="50%"
                labelLine={false}
                label={({ name, percent }) => `${name} ${(percent * 100).toFixed(0)}%`}
                outerRadius={80}
                fill="#8884d8"
                dataKey="value"
              >
                {statusDistribution.map((entry, index) => (
                  <Cell key={`cell-${index}`} fill={entry.color} />
                ))}
              </Pie>
              <Tooltip 
                contentStyle={{ 
                  backgroundColor: 'hsl(var(--card))',
                  border: '1px solid hsl(var(--border))',
                  borderRadius: '6px'
                }}
              />
            </PieChart>
          </ResponsiveContainer>
        </CardContent>
      </Card>

      {/* Volume by Job Type */}
      <Card className="lg:col-span-2">
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <BarChart3 className="w-5 h-5" />
            Volume par Type de Job
          </CardTitle>
        </CardHeader>
        <CardContent>
          <ResponsiveContainer width="100%" height={250}>
            <BarChart data={volumeByJob} layout="vertical">
              <CartesianGrid strokeDasharray="3 3" className="stroke-muted" />
              <XAxis 
                type="number"
                className="text-xs"
                tick={{ fill: 'hsl(var(--muted-foreground))' }}
              />
              <YAxis 
                type="category" 
                dataKey="job"
                className="text-xs"
                tick={{ fill: 'hsl(var(--muted-foreground))' }}
                width={120}
              />
              <Tooltip 
                contentStyle={{ 
                  backgroundColor: 'hsl(var(--card))',
                  border: '1px solid hsl(var(--border))',
                  borderRadius: '6px'
                }}
                content={({ active, payload }) => {
                  if (active && payload && payload.length) {
                    const data = payload[0].payload;
                    return (
                      <div className="bg-card p-3 rounded-md border shadow-lg">
                        <p className="font-medium">{data.job}</p>
                        <p className="text-sm text-muted-foreground">Items: {data.items}</p>
                        <p className="text-sm text-muted-foreground">Batches: {data.batches}</p>
                        <p className="text-sm text-muted-foreground">
                          Durée moy: {data.avg_duration}s
                        </p>
                      </div>
                    );
                  }
                  return null;
                }}
              />
              <Bar dataKey="items" fill="#3b82f6" name="Items traités" />
            </BarChart>
          </ResponsiveContainer>
        </CardContent>
      </Card>
    </div>
  );
}
