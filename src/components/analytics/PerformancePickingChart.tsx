import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { LineChart, Line, XAxis, YAxis, ResponsiveContainer, Tooltip, BarChart, Bar, Cell } from "recharts";
import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Loader2, Clock, Zap, Users, CheckCircle } from "lucide-react";
import { KPICard } from "./KPICard";
import { format } from "date-fns";

interface PerformancePickingChartProps {
  period: number;
}

interface Metrics {
  tempsParCommande: number;
  articlesParHeure: number;
  sessionsActives: number;
  tauxExactitude: number;
}

export function PerformancePickingChart({ period }: PerformancePickingChartProps) {
  const [loading, setLoading] = useState(true);
  const [metrics, setMetrics] = useState<Metrics>({
    tempsParCommande: 0,
    articlesParHeure: 0,
    sessionsActives: 0,
    tauxExactitude: 100
  });
  const [productiviteJour, setProductiviteJour] = useState<any[]>([]);
  const [topOperateurs, setTopOperateurs] = useState<any[]>([]);

  useEffect(() => {
    fetchData();
  }, [period]);

  const fetchData = async () => {
    setLoading(true);
    try {
      const startDate = new Date();
      startDate.setDate(startDate.getDate() - period);

      // Fetch sessions avec scans
      const { data: sessions, error } = await supabase
        .from('session_preparation')
        .select(`
          id,
          nom_session,
          date_creation,
          date_modification,
          statut,
          scan_picking (
            quantite_scannee,
            date_scan,
            operateur_id,
            statut_scan
          )
        `)
        .gte('date_creation', startDate.toISOString())
        .order('date_creation', { ascending: false });

      if (error) throw error;

      let totalDureeMinutes = 0;
      let totalArticles = 0;
      let totalScans = 0;
      let scansValides = 0;
      let sessionsActives = 0;
      const parJour: Record<string, { articles: number; duree: number }> = {};
      const parOperateur: Record<string, { articles: number; duree: number }> = {};

      sessions?.forEach((session) => {
        if (session.statut === 'active') sessionsActives++;

        const debut = new Date(session.date_creation);
        const fin = session.date_modification ? new Date(session.date_modification) : new Date();
        const dureeMin = (fin.getTime() - debut.getTime()) / (1000 * 60);

        totalDureeMinutes += dureeMin;

        session.scan_picking?.forEach((scan: any) => {
          totalArticles += scan.quantite_scannee || 0;
          totalScans++;
          if (scan.statut_scan === 'valide') scansValides++;

          // Par jour
          const jour = format(new Date(scan.date_scan), 'dd/MM');
          if (!parJour[jour]) {
            parJour[jour] = { articles: 0, duree: 0 };
          }
          parJour[jour].articles += scan.quantite_scannee || 0;
          parJour[jour].duree += dureeMin / (session.scan_picking?.length || 1);

          // Par opérateur
          const opId = scan.operateur_id || 'Inconnu';
          if (!parOperateur[opId]) {
            parOperateur[opId] = { articles: 0, duree: 0 };
          }
          parOperateur[opId].articles += scan.quantite_scannee || 0;
          parOperateur[opId].duree += dureeMin / (session.scan_picking?.length || 1);
        });
      });

      // Calculer métriques
      const articlesParHeure = totalDureeMinutes > 0 ? (totalArticles / (totalDureeMinutes / 60)) : 0;
      const tempsParCommande = sessions && sessions.length > 0 ? totalDureeMinutes / sessions.length : 0;
      const tauxExactitude = totalScans > 0 ? (scansValides / totalScans) * 100 : 100;

      setMetrics({
        tempsParCommande: Math.round(tempsParCommande),
        articlesParHeure: Math.round(articlesParHeure),
        sessionsActives,
        tauxExactitude: Math.round(tauxExactitude)
      });

      // Productivité par jour
      const productiviteData = Object.entries(parJour)
        .map(([date, data]) => ({
          date,
          articlesParHeure: data.duree > 0 ? Math.round((data.articles / (data.duree / 60))) : 0
        }))
        .sort((a, b) => {
          const [dayA, monthA] = a.date.split('/').map(Number);
          const [dayB, monthB] = b.date.split('/').map(Number);
          return monthA !== monthB ? monthA - monthB : dayA - dayB;
        });

      setProductiviteJour(productiviteData.slice(-14)); // 14 derniers jours

      // Top opérateurs
      const operateursData = Object.entries(parOperateur)
        .map(([op, data]) => ({
          operateur: op.substring(0, 8), // Raccourci
          articlesParHeure: data.duree > 0 ? Math.round((data.articles / (data.duree / 60))) : 0
        }))
        .sort((a, b) => b.articlesParHeure - a.articlesParHeure)
        .slice(0, 10);

      setTopOperateurs(operateursData);
    } catch (error) {
      console.error('Erreur fetch performance picking:', error);
    } finally {
      setLoading(false);
    }
  };

  if (loading) {
    return (
      <Card>
        <CardHeader>
          <CardTitle>Performance Picking</CardTitle>
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
        <CardTitle>Performance Picking</CardTitle>
      </CardHeader>
      <CardContent>
        {/* KPIs */}
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-4 mb-6">
          <KPICard
            title="Temps Moyen"
            value={`${metrics.tempsParCommande} min`}
            icon={Clock}
            description="Par commande"
          />
          <KPICard
            title="Productivité"
            value={`${metrics.articlesParHeure}/h`}
            icon={Zap}
            description="Articles par heure"
            color="success"
          />
          <KPICard
            title="Sessions"
            value={metrics.sessionsActives}
            icon={Users}
            description="Actives"
          />
          <KPICard
            title="Exactitude"
            value={`${metrics.tauxExactitude}%`}
            icon={CheckCircle}
            description="Scans valides"
            color={metrics.tauxExactitude >= 95 ? "success" : "warning"}
          />
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          {/* Productivité journalière */}
          <div>
            <h4 className="text-sm font-semibold mb-3">Productivité (14 derniers jours)</h4>
            <ResponsiveContainer width="100%" height={250}>
              <LineChart data={productiviteJour}>
                <XAxis dataKey="date" tick={{ fontSize: 10 }} />
                <YAxis tick={{ fontSize: 10 }} />
                <Tooltip 
                  content={({ active, payload }) => {
                    if (active && payload && payload.length) {
                      return (
                        <div className="bg-background border rounded-lg shadow-lg p-2">
                          <p className="text-xs font-semibold">{payload[0].payload.date}</p>
                          <p className="text-xs text-muted-foreground">
                            {payload[0].value} articles/h
                          </p>
                        </div>
                      );
                    }
                    return null;
                  }}
                />
                <Line type="monotone" dataKey="articlesParHeure" stroke="#22c55e" strokeWidth={2} />
              </LineChart>
            </ResponsiveContainer>
          </div>

          {/* Top opérateurs */}
          <div>
            <h4 className="text-sm font-semibold mb-3">Top Opérateurs</h4>
            <ResponsiveContainer width="100%" height={250}>
              <BarChart data={topOperateurs} layout="vertical">
                <XAxis type="number" />
                <YAxis type="category" dataKey="operateur" width={80} tick={{ fontSize: 10 }} />
                <Tooltip />
                <Bar dataKey="articlesParHeure" radius={[0, 4, 4, 0]}>
                  {topOperateurs.map((entry, index) => (
                    <Cell 
                      key={`cell-${index}`} 
                      fill={entry.articlesParHeure > 50 ? '#22c55e' : entry.articlesParHeure > 30 ? '#f59e0b' : '#ef4444'} 
                    />
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
