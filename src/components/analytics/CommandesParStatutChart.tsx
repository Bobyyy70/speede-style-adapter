import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { PieChart, Pie, Cell, ResponsiveContainer, Legend, Tooltip, BarChart, Bar, XAxis, YAxis } from "recharts";
import { ORDER_STATUSES } from "@/lib/orderStatuses";
import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Loader2 } from "lucide-react";

interface StatutData {
  name: string;
  value: number;
  color: string;
  percentage: number;
}

const COLORS = {
  en_attente_reappro: '#ef4444',
  stock_reserve: '#f59e0b',
  en_picking: '#3b82f6',
  picking_termine: '#06b6d4',
  en_preparation: '#8b5cf6',
  pret_expedition: '#14b8a6',
  etiquette_generee: '#84cc16',
  expedie: '#22c55e',
  livre: '#10b981',
  annule: '#6b7280',
  erreur: '#dc2626'
};

interface CommandesParStatutChartProps {
  clientId?: string;
  period: number; // jours
}

export function CommandesParStatutChart({ clientId, period }: CommandesParStatutChartProps) {
  const [data, setData] = useState<StatutData[]>([]);
  const [loading, setLoading] = useState(true);
  const [total, setTotal] = useState(0);

  useEffect(() => {
    fetchData();
  }, [clientId, period]);

  const fetchData = async () => {
    setLoading(true);
    try {
      const startDate = new Date();
      startDate.setDate(startDate.getDate() - period);

      let query = supabase
        .from('commande')
        .select('statut_wms')
        .gte('date_creation', startDate.toISOString());

      if (clientId) {
        query = query.eq('client_id', clientId);
      }

      const { data: commandes, error } = await query;

      if (error) throw error;

      // Grouper par statut
      const grouped = commandes.reduce((acc: Record<string, number>, cmd) => {
        const statut = cmd.statut_wms || 'en_attente_reappro';
        acc[statut] = (acc[statut] || 0) + 1;
        return acc;
      }, {});

      const totalCommandes = commandes.length;
      setTotal(totalCommandes);

      // Transformer en format pour les graphiques
      const chartData: StatutData[] = Object.entries(grouped).map(([statut, count]) => ({
        name: ORDER_STATUSES[statut as keyof typeof ORDER_STATUSES] || statut,
        value: count,
        color: COLORS[statut as keyof typeof COLORS] || '#6b7280',
        percentage: totalCommandes > 0 ? Math.round((count / totalCommandes) * 100) : 0
      }));

      setData(chartData.sort((a, b) => b.value - a.value));
    } catch (error) {
      console.error('Erreur fetch commandes par statut:', error);
    } finally {
      setLoading(false);
    }
  };

  if (loading) {
    return (
      <Card>
        <CardHeader>
          <CardTitle>Commandes par Statut</CardTitle>
        </CardHeader>
        <CardContent className="flex items-center justify-center h-[400px]">
          <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
        </CardContent>
      </Card>
    );
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle>Commandes par Statut</CardTitle>
        <p className="text-sm text-muted-foreground">Total: {total} commandes</p>
      </CardHeader>
      <CardContent>
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          {/* Donut Chart */}
          <div>
            <ResponsiveContainer width="100%" height={300}>
              <PieChart>
                <Pie
                  data={data}
                  cx="50%"
                  cy="50%"
                  innerRadius={60}
                  outerRadius={100}
                  paddingAngle={2}
                  dataKey="value"
                  label={(entry) => `${entry.percentage}%`}
                >
                  {data.map((entry, index) => (
                    <Cell key={`cell-${index}`} fill={entry.color} />
                  ))}
                </Pie>
                <Tooltip 
                  content={({ active, payload }) => {
                    if (active && payload && payload.length) {
                      const data = payload[0].payload;
                      return (
                        <div className="bg-background border rounded-lg shadow-lg p-3">
                          <p className="font-semibold text-sm mb-1">{data.name}</p>
                          <p className="text-xs text-muted-foreground">
                            {data.value} commandes ({data.percentage}%)
                          </p>
                        </div>
                      );
                    }
                    return null;
                  }}
                />
              </PieChart>
            </ResponsiveContainer>
          </div>

          {/* Bar Chart */}
          <div>
            <ResponsiveContainer width="100%" height={300}>
              <BarChart data={data} layout="vertical">
                <XAxis type="number" />
                <YAxis type="category" dataKey="name" width={100} tick={{ fontSize: 11 }} />
                <Tooltip 
                  content={({ active, payload }) => {
                    if (active && payload && payload.length) {
                      const data = payload[0].payload;
                      return (
                        <div className="bg-background border rounded-lg shadow-lg p-3">
                          <p className="font-semibold text-sm mb-1">{data.name}</p>
                          <p className="text-xs text-muted-foreground">
                            {data.value} commandes ({data.percentage}%)
                          </p>
                        </div>
                      );
                    }
                    return null;
                  }}
                />
                <Bar dataKey="value" radius={[0, 4, 4, 0]}>
                  {data.map((entry, index) => (
                    <Cell key={`cell-${index}`} fill={entry.color} />
                  ))}
                </Bar>
              </BarChart>
            </ResponsiveContainer>
          </div>
        </div>
      </CardContent>
    </Card>
  );
}
