import { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import DashboardLayout from '@/components/DashboardLayout';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Progress } from '@/components/ui/progress';
import { useAuth } from '@/hooks/useAuth';
import {
  Leaf,
  TrendingDown,
  TrendingUp,
  TreeDeciduous,
  Car,
  Package,
  Ship,
  Plane,
  Truck,
  Train,
} from 'lucide-react';
import {
  formatCO2,
  formatPourcentage,
  calculateEquivalentArbres,
  calculateEquivalentVoitureKm,
} from '@/lib/tmsHelpers';

export default function GreenDashboard() {
  const { profile } = useAuth();
  const [periode, setPeriode] = useState<'7d' | '30d' | '90d'>('30d');

  // Calculer les dates
  const periodeJours = periode === '7d' ? 7 : periode === '30d' ? 30 : 90;
  const dateDebut = new Date();
  dateDebut.setDate(dateDebut.getDate() - periodeJours);

  // Query: Émissions par mode de transport
  const { data: emissionsParMode } = useQuery({
    queryKey: ['emissions-par-mode', profile?.client_id, periode],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('plan_transport')
        .select('mode_transport_id, emission_co2_kg, mode_transport(code, nom)')
        .eq('client_id', profile?.client_id || '')
        .gte('date_creation', dateDebut.toISOString())
        .not('emission_co2_kg', 'is', null);

      if (error) throw error;

      // Agréger par mode
      const agregation = data.reduce((acc: any, plan: any) => {
        const mode = plan.mode_transport?.code || 'UNKNOWN';
        if (!acc[mode]) {
          acc[mode] = {
            code: mode,
            nom: plan.mode_transport?.nom || 'Inconnu',
            total_co2: 0,
            count: 0,
          };
        }
        acc[mode].total_co2 += plan.emission_co2_kg;
        acc[mode].count++;
        return acc;
      }, {});

      return Object.values(agregation);
    },
    enabled: !!profile?.client_id,
  });

  // Query: Total émissions
  const { data: totalEmissions } = useQuery({
    queryKey: ['total-emissions', profile?.client_id, periode],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('plan_transport')
        .select('emission_co2_kg')
        .eq('client_id', profile?.client_id || '')
        .gte('date_creation', dateDebut.toISOString())
        .not('emission_co2_kg', 'is', null);

      if (error) throw error;

      const total = data.reduce((sum, plan) => sum + (plan.emission_co2_kg || 0), 0);
      return total;
    },
    enabled: !!profile?.client_id,
  });

  // Query: Économies via optimisation
  const { data: economies } = useQuery({
    queryKey: ['economies-co2', profile?.client_id, periode],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('economies_optimisation')
        .select('reduction_co2_kg')
        .eq('client_id', profile?.client_id || '')
        .gte('created_at', dateDebut.toISOString())
        .not('reduction_co2_kg', 'is', null);

      if (error) throw error;

      const total = data.reduce((sum, eco) => sum + (eco.reduction_co2_kg || 0), 0);
      return total;
    },
    enabled: !!profile?.client_id,
  });

  // Calculs
  const totalCO2 = totalEmissions || 0;
  const co2Economise = economies || 0;
  const co2SansOptimisation = totalCO2 + co2Economise;
  const tauxReduction = co2SansOptimisation > 0 ? (co2Economise / co2SansOptimisation) * 100 : 0;

  // Équivalents
  const equivalentArbres = calculateEquivalentArbres(totalCO2);
  const equivalentVoitureKm = calculateEquivalentVoitureKm(totalCO2);

  // Objectif (exemple: -20% sur 1 an)
  const objectifReductionPct = 20;
  const progressionObjectif = Math.min((tauxReduction / objectifReductionPct) * 100, 100);

  const getModeIcon = (code: string) => {
    switch (code) {
      case 'ROAD':
        return <Truck className="h-5 w-5 text-blue-600" />;
      case 'SEA':
        return <Ship className="h-5 w-5 text-cyan-600" />;
      case 'AIR':
        return <Plane className="h-5 w-5 text-purple-600" />;
      case 'RAIL':
        return <Train className="h-5 w-5 text-green-600" />;
      default:
        return <Package className="h-5 w-5 text-gray-600" />;
    }
  };

  return (
    <DashboardLayout>
      <div className="space-y-6">
        {/* Header */}
        <div className="flex justify-between items-center">
          <div>
            <h1 className="text-3xl font-bold flex items-center gap-2">
              <Leaf className="h-8 w-8 text-green-600" />
              Green Logistics
            </h1>
            <p className="text-gray-600">Bilan environnemental de vos transports</p>
          </div>

          {/* Sélecteur période */}
          <div className="flex gap-2">
            <Button
              variant={periode === '7d' ? 'default' : 'outline'}
              onClick={() => setPeriode('7d')}
              size="sm"
            >
              7 jours
            </Button>
            <Button
              variant={periode === '30d' ? 'default' : 'outline'}
              onClick={() => setPeriode('30d')}
              size="sm"
            >
              30 jours
            </Button>
            <Button
              variant={periode === '90d' ? 'default' : 'outline'}
              onClick={() => setPeriode('90d')}
              size="sm"
            >
              90 jours
            </Button>
          </div>
        </div>

        {/* KPIs Environnementaux */}
        <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
          <Card className="bg-gradient-to-br from-green-50 to-green-100 border-green-200">
            <CardHeader className="pb-3">
              <CardTitle className="text-sm font-medium flex items-center gap-2">
                <Leaf className="h-4 w-4 text-green-700" />
                Émissions Totales
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold text-green-800">{formatCO2(totalCO2)}</div>
              <p className="text-xs text-green-700 mt-1">Sur {periodeJours} jours</p>
            </CardContent>
          </Card>

          <Card className="bg-gradient-to-br from-blue-50 to-blue-100 border-blue-200">
            <CardHeader className="pb-3">
              <CardTitle className="text-sm font-medium flex items-center gap-2">
                <TrendingDown className="h-4 w-4 text-blue-700" />
                CO₂ Économisé
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold text-blue-800">{formatCO2(co2Economise)}</div>
              <p className="text-xs text-blue-700 mt-1">
                Via optimisation IA
              </p>
            </CardContent>
          </Card>

          <Card className="bg-gradient-to-br from-purple-50 to-purple-100 border-purple-200">
            <CardHeader className="pb-3">
              <CardTitle className="text-sm font-medium flex items-center gap-2">
                <TreeDeciduous className="h-4 w-4 text-purple-700" />
                Équivalent Arbres
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold text-purple-800">{equivalentArbres}</div>
              <p className="text-xs text-purple-700 mt-1">Arbres à planter</p>
            </CardContent>
          </Card>

          <Card className="bg-gradient-to-br from-orange-50 to-orange-100 border-orange-200">
            <CardHeader className="pb-3">
              <CardTitle className="text-sm font-medium flex items-center gap-2">
                <Car className="h-4 w-4 text-orange-700" />
                Équivalent Voiture
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold text-orange-800">
                {Math.round(equivalentVoitureKm).toLocaleString()}km
              </div>
              <p className="text-xs text-orange-700 mt-1">Parcours voiture</p>
            </CardContent>
          </Card>
        </div>

        {/* Objectif de réduction */}
        <Card>
          <CardHeader>
            <div className="flex items-center justify-between">
              <div>
                <CardTitle>Objectif de Réduction CO₂</CardTitle>
                <CardDescription>
                  Cible: -{objectifReductionPct}% d'émissions sur 1 an
                </CardDescription>
              </div>
              <Badge
                variant={progressionObjectif >= 100 ? 'default' : 'secondary'}
                className="text-lg px-4 py-2"
              >
                {Math.round(progressionObjectif)}%
              </Badge>
            </div>
          </CardHeader>
          <CardContent>
            <div className="space-y-4">
              <Progress value={progressionObjectif} className="h-4" />

              <div className="grid grid-cols-3 gap-4 text-center">
                <div>
                  <p className="text-sm text-gray-600">Sans optimisation</p>
                  <p className="text-lg font-bold">{formatCO2(co2SansOptimisation)}</p>
                </div>
                <div>
                  <p className="text-sm text-gray-600">Réduction actuelle</p>
                  <p className="text-lg font-bold text-green-600">
                    {formatPourcentage(tauxReduction)}
                  </p>
                </div>
                <div>
                  <p className="text-sm text-gray-600">Avec optimisation</p>
                  <p className="text-lg font-bold text-blue-600">{formatCO2(totalCO2)}</p>
                </div>
              </div>

              {progressionObjectif >= 100 ? (
                <div className="bg-green-50 border border-green-200 rounded-lg p-4 flex items-center gap-3">
                  <TrendingDown className="h-6 w-6 text-green-600" />
                  <div>
                    <p className="font-semibold text-green-800">Objectif atteint !</p>
                    <p className="text-sm text-green-700">
                      Vous avez dépassé votre objectif de réduction d'émissions.
                    </p>
                  </div>
                </div>
              ) : (
                <div className="bg-blue-50 border border-blue-200 rounded-lg p-4 flex items-center gap-3">
                  <TrendingUp className="h-6 w-6 text-blue-600" />
                  <div>
                    <p className="font-semibold text-blue-800">En bonne voie</p>
                    <p className="text-sm text-blue-700">
                      Continuez vos efforts pour atteindre l'objectif de {objectifReductionPct}%
                    </p>
                  </div>
                </div>
              )}
            </div>
          </CardContent>
        </Card>

        {/* Émissions par mode de transport */}
        <Card>
          <CardHeader>
            <CardTitle>Émissions par Mode de Transport</CardTitle>
            <CardDescription>Répartition des émissions CO₂</CardDescription>
          </CardHeader>
          <CardContent>
            {emissionsParMode && emissionsParMode.length > 0 ? (
              <div className="space-y-4">
                {(emissionsParMode as any[]).map((mode: any) => {
                  const pct = totalCO2 > 0 ? (mode.total_co2 / totalCO2) * 100 : 0;
                  return (
                    <div key={mode.code} className="space-y-2">
                      <div className="flex items-center justify-between">
                        <div className="flex items-center gap-3">
                          {getModeIcon(mode.code)}
                          <div>
                            <p className="font-medium">{mode.nom}</p>
                            <p className="text-sm text-gray-600">
                              {mode.count} expédition{mode.count > 1 ? 's' : ''}
                            </p>
                          </div>
                        </div>
                        <div className="text-right">
                          <p className="font-bold">{formatCO2(mode.total_co2)}</p>
                          <p className="text-sm text-gray-600">{formatPourcentage(pct)}</p>
                        </div>
                      </div>
                      <Progress value={pct} className="h-2" />
                    </div>
                  );
                })}
              </div>
            ) : (
              <div className="text-center py-8 text-gray-500">
                Aucune donnée d'émission disponible
              </div>
            )}
          </CardContent>
        </Card>

        {/* Actions recommandées */}
        <Card>
          <CardHeader>
            <CardTitle>Actions Recommandées</CardTitle>
            <CardDescription>Pour réduire votre empreinte carbone</CardDescription>
          </CardHeader>
          <CardContent>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div className="p-4 bg-green-50 border border-green-200 rounded-lg">
                <div className="flex items-start gap-3">
                  <Ship className="h-5 w-5 text-green-600 mt-1" />
                  <div>
                    <h4 className="font-semibold text-green-900">Privilégier le maritime</h4>
                    <p className="text-sm text-green-700 mt-1">
                      8x moins de CO₂ que le routier pour le fret longue distance
                    </p>
                  </div>
                </div>
              </div>

              <div className="p-4 bg-blue-50 border border-blue-200 rounded-lg">
                <div className="flex items-start gap-3">
                  <Package className="h-5 w-5 text-blue-600 mt-1" />
                  <div>
                    <h4 className="font-semibold text-blue-900">Optimiser le remplissage</h4>
                    <p className="text-sm text-blue-700 mt-1">
                      Consolidez vos expéditions pour maximiser le taux de remplissage
                    </p>
                  </div>
                </div>
              </div>

              <div className="p-4 bg-purple-50 border border-purple-200 rounded-lg">
                <div className="flex items-start gap-3">
                  <Train className="h-5 w-5 text-purple-600 mt-1" />
                  <div>
                    <h4 className="font-semibold text-purple-900">Transport ferroviaire</h4>
                    <p className="text-sm text-purple-700 mt-1">
                      3x moins de CO₂ que le routier sur moyenne distance
                    </p>
                  </div>
                </div>
              </div>

              <div className="p-4 bg-orange-50 border border-orange-200 rounded-lg">
                <div className="flex items-start gap-3">
                  <Leaf className="h-5 w-5 text-orange-600 mt-1" />
                  <div>
                    <h4 className="font-semibold text-orange-900">Utiliser l'IA</h4>
                    <p className="text-sm text-orange-700 mt-1">
                      L'optimisation IA a déjà économisé {formatCO2(co2Economise)}
                    </p>
                  </div>
                </div>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>
    </DashboardLayout>
  );
}
