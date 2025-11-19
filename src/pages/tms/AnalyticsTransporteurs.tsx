import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import DashboardLayout from '@/components/DashboardLayout';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Progress } from '@/components/ui/progress';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import { useAuth } from '@/hooks/useAuth';
import {
  Trophy,
  TrendingUp,
  TrendingDown,
  DollarSign,
  Clock,
  Package,
  Leaf,
  AlertCircle,
} from 'lucide-react';
import {
  formatMontant,
  formatCO2,
  formatPourcentage,
  getScoreColor,
  getPonctualiteColor,
} from '@/lib/tmsHelpers';
import type { StatsTransporteurRealtime } from '@/types/tms';

export default function AnalyticsTransporteurs() {
  const { profile } = useAuth();

  // Query: Stats transporteurs en temps réel
  const { data: stats, isLoading } = useQuery({
    queryKey: ['stats-transporteurs-realtime'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('v_stats_transporteur_realtime')
        .select('*')
        .order('score_global_actuel', { ascending: false, nullsFirst: false });

      if (error) throw error;
      return data as StatsTransporteurRealtime[];
    },
  });

  // Calculer le meilleur transporteur
  const bestTransporteur = stats?.[0];

  // Statistiques globales
  const statsGlobales = stats?.reduce(
    (acc, t) => ({
      plansTotal: acc.plansTotal + t.plans_en_cours + t.plans_livres_total,
      plansEnCours: acc.plansEnCours + t.plans_en_cours,
      co2Total: acc.co2Total + (t.co2_total_30j_kg || 0),
    }),
    { plansTotal: 0, plansEnCours: 0, co2Total: 0 }
  );

  return (
    <DashboardLayout>
      <div className="space-y-6">
        {/* Header */}
        <div>
          <h1 className="text-3xl font-bold">Analytics Transporteurs</h1>
          <p className="text-gray-600">Performance et comparaison des transporteurs</p>
        </div>

        {/* KPIs globaux */}
        <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
          <Card>
            <CardHeader className="pb-3">
              <div className="flex items-center justify-between">
                <CardTitle className="text-sm font-medium">Transporteurs Actifs</CardTitle>
                <Package className="h-4 w-4 text-gray-500" />
              </div>
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">{stats?.length || 0}</div>
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="pb-3">
              <div className="flex items-center justify-between">
                <CardTitle className="text-sm font-medium">Plans Total</CardTitle>
                <Package className="h-4 w-4 text-gray-500" />
              </div>
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">{statsGlobales?.plansTotal || 0}</div>
              <p className="text-xs text-gray-600 mt-1">
                {statsGlobales?.plansEnCours || 0} en cours
              </p>
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="pb-3">
              <div className="flex items-center justify-between">
                <CardTitle className="text-sm font-medium">CO₂ Total (30j)</CardTitle>
                <Leaf className="h-4 w-4 text-green-600" />
              </div>
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">
                {formatCO2(statsGlobales?.co2Total || 0)}
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="pb-3">
              <div className="flex items-center justify-between">
                <CardTitle className="text-sm font-medium">Meilleur Transporteur</CardTitle>
                <Trophy className="h-4 w-4 text-yellow-500" />
              </div>
            </CardHeader>
            <CardContent>
              <div className="text-lg font-bold truncate">
                {bestTransporteur?.nom_transporteur || 'N/A'}
              </div>
              {bestTransporteur?.score_global_actuel && (
                <p className="text-xs text-gray-600 mt-1">
                  Score: {Math.round(bestTransporteur.score_global_actuel)}/100
                </p>
              )}
            </CardContent>
          </Card>
        </div>

        {/* Podium (Top 3) */}
        {stats && stats.length >= 3 && (
          <Card>
            <CardHeader>
              <CardTitle>Podium - Top 3 Transporteurs</CardTitle>
              <CardDescription>Classement selon le score global</CardDescription>
            </CardHeader>
            <CardContent>
              <div className="grid grid-cols-3 gap-4">
                {[1, 0, 2].map((index) => {
                  const transporteur = stats[index];
                  if (!transporteur) return null;

                  const position = index === 0 ? 1 : index === 1 ? 2 : 3;
                  const medal = ['🥇', '🥈', '🥉'][position - 1];
                  const heightClass = ['h-32', 'h-24', 'h-20'][position - 1];

                  return (
                    <div
                      key={transporteur.transporteur_id}
                      className={`text-center ${position !== 1 ? 'mt-8' : ''}`}
                    >
                      <div
                        className={`${heightClass} bg-gradient-to-t from-blue-100 to-blue-50 rounded-t-lg flex flex-col items-center justify-center border border-blue-200`}
                      >
                        <span className="text-4xl mb-2">{medal}</span>
                        <span className="text-2xl font-bold">
                          {Math.round(transporteur.score_global_actuel || 0)}
                        </span>
                        <span className="text-xs text-gray-600">/ 100</span>
                      </div>
                      <div className="mt-3">
                        <p className="font-semibold truncate">
                          {transporteur.nom_transporteur}
                        </p>
                        <p className="text-sm text-gray-600">
                          {formatPourcentage(transporteur.taux_ponctualite_30j_pct)} ponctualité
                        </p>
                      </div>
                    </div>
                  );
                })}
              </div>
            </CardContent>
          </Card>
        )}

        {/* Tableau comparatif */}
        <Card>
          <CardHeader>
            <CardTitle>Tableau Comparatif</CardTitle>
            <CardDescription>Performance détaillée sur 30 jours</CardDescription>
          </CardHeader>
          <CardContent>
            {isLoading ? (
              <div className="text-center py-8 text-gray-500">Chargement...</div>
            ) : stats && stats.length > 0 ? (
              <div className="overflow-x-auto">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead className="w-[50px]">#</TableHead>
                      <TableHead>Transporteur</TableHead>
                      <TableHead className="text-center">Score Global</TableHead>
                      <TableHead className="text-center">Ponctualité</TableHead>
                      <TableHead className="text-center">En cours</TableHead>
                      <TableHead className="text-center">Livrés</TableHead>
                      <TableHead className="text-right">Coût Moyen</TableHead>
                      <TableHead className="text-right">CO₂ Moyen</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {stats.map((transporteur, index) => (
                      <TableRow key={transporteur.transporteur_id}>
                        <TableCell className="font-medium">{index + 1}</TableCell>
                        <TableCell>
                          <div className="flex items-center gap-2">
                            {transporteur.logo_url && (
                              <img
                                src={transporteur.logo_url}
                                alt={transporteur.nom_transporteur}
                                className="h-6 w-6 rounded object-contain"
                              />
                            )}
                            <span className="font-medium">
                              {transporteur.nom_transporteur}
                            </span>
                          </div>
                        </TableCell>
                        <TableCell>
                          <div className="text-center">
                            <div
                              className={`text-lg font-bold ${getScoreColor(
                                transporteur.score_global_actuel || 0
                              )}`}
                            >
                              {Math.round(transporteur.score_global_actuel || 0)}
                            </div>
                            <Progress
                              value={transporteur.score_global_actuel || 0}
                              className="h-2 mt-1"
                            />
                          </div>
                        </TableCell>
                        <TableCell>
                          <div className="text-center">
                            <div
                              className={`font-semibold ${getPonctualiteColor(
                                transporteur.taux_ponctualite_30j_pct
                              )}`}
                            >
                              {formatPourcentage(transporteur.taux_ponctualite_30j_pct)}
                            </div>
                            <p className="text-xs text-gray-500">
                              {transporteur.livraisons_a_temps_30j}/{transporteur.total_livraisons_30j}
                            </p>
                          </div>
                        </TableCell>
                        <TableCell className="text-center">
                          <Badge variant="secondary">{transporteur.plans_en_cours}</Badge>
                        </TableCell>
                        <TableCell className="text-center">
                          <span className="text-gray-600">
                            {transporteur.plans_livres_total}
                          </span>
                        </TableCell>
                        <TableCell className="text-right">
                          {transporteur.cout_moyen ? (
                            <span className="font-medium">
                              {formatMontant(transporteur.cout_moyen)}
                            </span>
                          ) : (
                            <span className="text-gray-400">N/A</span>
                          )}
                        </TableCell>
                        <TableCell className="text-right">
                          {transporteur.co2_moyen_30j_kg ? (
                            <span className="text-sm">
                              {formatCO2(transporteur.co2_moyen_30j_kg)}
                            </span>
                          ) : (
                            <span className="text-gray-400">N/A</span>
                          )}
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </div>
            ) : (
              <div className="text-center py-8">
                <AlertCircle className="h-12 w-12 text-gray-300 mx-auto mb-3" />
                <p className="text-gray-500">Aucun transporteur à afficher</p>
              </div>
            )}
          </CardContent>
        </Card>

        {/* Insights */}
        {stats && stats.length > 0 && (
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <Card>
              <CardHeader className="pb-3">
                <div className="flex items-center gap-2">
                  <TrendingUp className="h-4 w-4 text-green-600" />
                  <CardTitle className="text-sm">Meilleure Ponctualité</CardTitle>
                </div>
              </CardHeader>
              <CardContent>
                {(() => {
                  const best = [...stats].sort(
                    (a, b) => b.taux_ponctualite_30j_pct - a.taux_ponctualite_30j_pct
                  )[0];
                  return (
                    <>
                      <p className="font-semibold">{best.nom_transporteur}</p>
                      <p className="text-2xl font-bold text-green-600">
                        {formatPourcentage(best.taux_ponctualite_30j_pct)}
                      </p>
                    </>
                  );
                })()}
              </CardContent>
            </Card>

            <Card>
              <CardHeader className="pb-3">
                <div className="flex items-center gap-2">
                  <DollarSign className="h-4 w-4 text-blue-600" />
                  <CardTitle className="text-sm">Meilleur Coût</CardTitle>
                </div>
              </CardHeader>
              <CardContent>
                {(() => {
                  const cheapest = [...stats]
                    .filter((t) => t.cout_moyen)
                    .sort((a, b) => (a.cout_moyen || 0) - (b.cout_moyen || 0))[0];
                  return cheapest ? (
                    <>
                      <p className="font-semibold">{cheapest.nom_transporteur}</p>
                      <p className="text-2xl font-bold text-blue-600">
                        {formatMontant(cheapest.cout_moyen || 0)}
                      </p>
                    </>
                  ) : (
                    <p className="text-gray-500">N/A</p>
                  );
                })()}
              </CardContent>
            </Card>

            <Card>
              <CardHeader className="pb-3">
                <div className="flex items-center gap-2">
                  <Leaf className="h-4 w-4 text-green-600" />
                  <CardTitle className="text-sm">Plus Écologique</CardTitle>
                </div>
              </CardHeader>
              <CardContent>
                {(() => {
                  const greenest = [...stats]
                    .filter((t) => t.co2_moyen_30j_kg)
                    .sort((a, b) => (a.co2_moyen_30j_kg || 0) - (b.co2_moyen_30j_kg || 0))[0];
                  return greenest ? (
                    <>
                      <p className="font-semibold">{greenest.nom_transporteur}</p>
                      <p className="text-2xl font-bold text-green-600">
                        {formatCO2(greenest.co2_moyen_30j_kg || 0)}
                      </p>
                    </>
                  ) : (
                    <p className="text-gray-500">N/A</p>
                  );
                })()}
              </CardContent>
            </Card>
          </div>
        )}
      </div>
    </DashboardLayout>
  );
}
