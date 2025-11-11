import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { RadialBarChart, RadialBar, ResponsiveContainer, LineChart, Line, XAxis, YAxis, Tooltip, BarChart, Bar, Cell } from "recharts";
import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Loader2 } from "lucide-react";
import { format, subDays } from "date-fns";

interface TauxRetourChartProps {
  clientId?: string;
  period: number;
}

export function TauxRetourChart({ clientId, period }: TauxRetourChartProps) {
  const [loading, setLoading] = useState(true);
  const [tauxGlobal, setTauxGlobal] = useState(0);
  const [tendance, setTendance] = useState<any[]>([]);
  const [topRaisons, setTopRaisons] = useState<any[]>([]);

  useEffect(() => {
    fetchData();
  }, [clientId, period]);

  const fetchData = async () => {
    setLoading(true);
    try {
      const startDate = new Date();
      startDate.setDate(startDate.getDate() - period);

      // Total commandes
      let queryCommandes = supabase
        .from('commande')
        .select('id', { count: 'exact', head: true })
        .gte('date_creation', startDate.toISOString());

      if (clientId) {
        queryCommandes = queryCommandes.eq('client_id', clientId);
      }

      const { count: totalCommandes } = await queryCommandes;

      // Total retours
      let queryRetours = supabase
        .from('retour_produit')
        .select('date_retour, raison_retour', { count: 'exact' })
        .gte('date_retour', startDate.toISOString());

      if (clientId) {
        queryRetours = queryRetours.eq('client_id', clientId);
      }

      const { data: retours, count: totalRetours } = await queryRetours;

      // Calcul taux global
      const taux = totalCommandes && totalCommandes > 0 ? (totalRetours || 0) / totalCommandes * 100 : 0;
      setTauxGlobal(Math.round(taux * 10) / 10);

      // Tendance journalière (30 derniers jours)
      if (retours && retours.length > 0) {
        const retourParJour: Record<string, number> = {};
        
        for (let i = 0; i < 30; i++) {
          const date = format(subDays(new Date(), i), 'dd/MM');
          retourParJour[date] = 0;
        }

        retours.forEach((r) => {
          const jour = format(new Date(r.date_retour), 'dd/MM');
          if (retourParJour[jour] !== undefined) {
            retourParJour[jour]++;
          }
        });

        const tendanceData = Object.entries(retourParJour)
          .map(([date, count]) => ({ date, count }))
          .reverse();

        setTendance(tendanceData);

        // Top raisons
        const raisonsGroupees: Record<string, number> = {};
        retours.forEach((r) => {
          const raison = r.raison_retour || 'Non spécifiée';
          raisonsGroupees[raison] = (raisonsGroupees[raison] || 0) + 1;
        });

        const topRaisonsData = Object.entries(raisonsGroupees)
          .map(([raison, count]) => ({ raison, count }))
          .sort((a, b) => b.count - a.count)
          .slice(0, 5);

        setTopRaisons(topRaisonsData);
      }
    } catch (error) {
      console.error('Erreur fetch taux retour:', error);
    } finally {
      setLoading(false);
    }
  };

  if (loading) {
    return (
      <Card>
        <CardHeader>
          <CardTitle>Taux de Retour</CardTitle>
        </CardHeader>
        <CardContent className="flex items-center justify-center h-[400px]">
          <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
        </CardContent>
      </Card>
    );
  }

  const gaugeData = [{ name: 'Taux', value: tauxGlobal, fill: tauxGlobal < 5 ? '#22c55e' : tauxGlobal < 10 ? '#f59e0b' : '#ef4444' }];

  return (
    <Card>
      <CardHeader>
        <CardTitle>Taux de Retour</CardTitle>
      </CardHeader>
      <CardContent>
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          {/* Gauge */}
          <div className="flex flex-col items-center justify-center">
            <ResponsiveContainer width="100%" height={200}>
              <RadialBarChart
                cx="50%"
                cy="50%"
                innerRadius="60%"
                outerRadius="100%"
                data={gaugeData}
                startAngle={180}
                endAngle={0}
              >
                <RadialBar dataKey="value" cornerRadius={10} />
              </RadialBarChart>
            </ResponsiveContainer>
            <div className="text-center mt-4">
              <p className="text-4xl font-bold">{tauxGlobal}%</p>
              <p className="text-sm text-muted-foreground">Taux de retour global</p>
            </div>
          </div>

          {/* Tendance */}
          <div>
            <h4 className="text-sm font-semibold mb-3">Évolution 30 jours</h4>
            <ResponsiveContainer width="100%" height={180}>
              <LineChart data={tendance}>
                <XAxis dataKey="date" tick={{ fontSize: 10 }} />
                <YAxis tick={{ fontSize: 10 }} />
                <Tooltip 
                  content={({ active, payload }) => {
                    if (active && payload && payload.length) {
                      return (
                        <div className="bg-background border rounded-lg shadow-lg p-2">
                          <p className="text-xs font-semibold">{payload[0].payload.date}</p>
                          <p className="text-xs text-muted-foreground">{payload[0].value} retours</p>
                        </div>
                      );
                    }
                    return null;
                  }}
                />
                <Line type="monotone" dataKey="count" stroke="#ef4444" strokeWidth={2} dot={false} />
              </LineChart>
            </ResponsiveContainer>
          </div>
        </div>

        {/* Top raisons */}
        {topRaisons.length > 0 && (
          <div className="mt-6">
            <h4 className="text-sm font-semibold mb-3">Top Raisons de Retour</h4>
            <ResponsiveContainer width="100%" height={200}>
              <BarChart data={topRaisons} layout="vertical">
                <XAxis type="number" />
                <YAxis type="category" dataKey="raison" width={120} tick={{ fontSize: 11 }} />
                <Tooltip />
                <Bar dataKey="count" radius={[0, 4, 4, 0]}>
                  {topRaisons.map((_, index) => (
                    <Cell key={`cell-${index}`} fill={`hsl(${index * 45}, 70%, 50%)`} />
                  ))}
                </Bar>
              </BarChart>
            </ResponsiveContainer>
          </div>
        )}
      </CardContent>
    </Card>
  );
}
