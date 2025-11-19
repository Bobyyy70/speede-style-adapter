import { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import DashboardLayout from '@/components/DashboardLayout';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import {
  Truck,
  Package,
  TrendingUp,
  TrendingDown,
  AlertTriangle,
  Leaf,
  DollarSign,
  Clock,
  MapPin,
  Activity,
} from 'lucide-react';
import { useAuth } from '@/hooks/useAuth';
import { formatMontant, formatCO2, formatPourcentage, formatDistance } from '@/lib/tmsHelpers';
import type { PlanTransportComplet, AlerteCritique, CalculTMSKPIsResult } from '@/types/tms';

export default function DashboardTMS() {
  const { profile } = useAuth();
  const [periode, setPeriode] = useState<'7d' | '30d' | '90d'>('30d');

  // Calculer les dates de période
  const periodeJours = periode === '7d' ? 7 : periode === '30d' ? 30 : 90;
  const dateDebut = new Date();
  dateDebut.setDate(dateDebut.getDate() - periodeJours);

  // Query: Plans transport récents
  const { data: plans, isLoading: plansLoading } = useQuery({
    queryKey: ['plans-transport', profile?.client_id],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('v_plan_transport_complet')
        .select('*')
        .order('date_creation', { ascending: false })
        .limit(10);

      if (error) throw error;
      return data as PlanTransportComplet[];
    },
    enabled: !!profile,
  });

  // Query: Alertes critiques
  const { data: alertes, isLoading: alertesLoading } = useQuery({
    queryKey: ['alertes-critiques', profile?.client_id],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('v_alertes_critiques')
        .select('*')
        .limit(5);

      if (error) throw error;
      return data as AlerteCritique[];
    },
    enabled: !!profile,
  });

  // Query: KPIs de la période
  const { data: kpis, isLoading: kpisLoading } = useQuery({
    queryKey: ['kpis-tms', profile?.client_id, periode],
    queryFn: async () => {
      const { data, error } = await supabase.rpc('calculate_tms_kpis', {
        p_client_id: profile?.client_id,
        p_periode_debut: dateDebut.toISOString().split('T')[0],
        p_periode_fin: new Date().toISOString().split('T')[0],
      });

      if (error) throw error;
      return data[0] as CalculTMSKPIsResult;
    },
    enabled: !!profile?.client_id,
  });

  // Query: Plans par statut
  const { data: statsStatuts } = useQuery({
    queryKey: ['stats-statuts', profile?.client_id],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('plan_transport')
        .select('statut')
        .eq('client_id', profile?.client_id || '');

      if (error) throw error;

      const stats = data.reduce(
        (acc, plan) => {
          acc[plan.statut] = (acc[plan.statut] || 0) + 1;
          return acc;
        },
        {} as Record<string, number>
      );

      return stats;
    },
    enabled: !!profile?.client_id,
  });

  const isLoading = plansLoading || alertesLoading || kpisLoading;

  return (
    <DashboardLayout>
      <div className="space-y-6">
        {/* Header */}
        <div className="flex justify-between items-center">
          <div>
            <h1 className="text-3xl font-bold">Dashboard TMS</h1>
            <p className="text-gray-600">Transport Management System - Vue d'ensemble</p>
          </div>

          {/* Sélecteur de période */}
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

        {/* KPIs principaux */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
          {/* Nombre d'expéditions */}
          <Card>
            <CardHeader className="pb-3">
              <div className="flex items-center justify-between">
                <CardTitle className="text-sm font-medium">Expéditions</CardTitle>
                <Truck className="h-4 w-4 text-gray-500" />
              </div>
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">
                {isLoading ? '...' : kpis?.nb_expeditions || 0}
              </div>
              <p className="text-xs text-gray-600 mt-1">Sur {periodeJours} jours</p>
            </CardContent>
          </Card>

          {/* Coût total */}
          <Card>
            <CardHeader className="pb-3">
              <div className="flex items-center justify-between">
                <CardTitle className="text-sm font-medium">Coûts Transport</CardTitle>
                <DollarSign className="h-4 w-4 text-gray-500" />
              </div>
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">
                {isLoading ? '...' : formatMontant(kpis?.cout_total || 0)}
              </div>
              <p className="text-xs text-gray-600 mt-1">
                Moy: {formatMontant(kpis?.cout_moyen || 0)}
              </p>
            </CardContent>
          </Card>

          {/* Taux de ponctualité */}
          <Card>
            <CardHeader className="pb-3">
              <div className="flex items-center justify-between">
                <CardTitle className="text-sm font-medium">Ponctualité</CardTitle>
                <Clock className="h-4 w-4 text-gray-500" />
              </div>
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">
                {isLoading ? '...' : formatPourcentage(kpis?.taux_ponctualite_pct || 0)}
              </div>
              <div className="flex items-center gap-1 mt-1">
                {(kpis?.taux_ponctualite_pct || 0) >= 90 ? (
                  <TrendingUp className="h-3 w-3 text-green-600" />
                ) : (
                  <TrendingDown className="h-3 w-3 text-red-600" />
                )}
                <p className="text-xs text-gray-600">Livraisons à l'heure</p>
              </div>
            </CardContent>
          </Card>

          {/* Émissions CO2 */}
          <Card>
            <CardHeader className="pb-3">
              <div className="flex items-center justify-between">
                <CardTitle className="text-sm font-medium">Émissions CO₂</CardTitle>
                <Leaf className="h-4 w-4 text-green-600" />
              </div>
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">
                {isLoading ? '...' : formatCO2(kpis?.emission_co2_totale_kg || 0)}
              </div>
              <div className="flex items-center gap-1 mt-1">
                <TrendingDown className="h-3 w-3 text-green-600" />
                <p className="text-xs text-gray-600">
                  -{formatMontant(kpis?.economie_ia_eur || 0)} économisé
                </p>
              </div>
            </CardContent>
          </Card>
        </div>

        {/* Alertes critiques */}
        {alertes && alertes.length > 0 && (
          <Card className="border-red-200 bg-red-50/50">
            <CardHeader>
              <div className="flex items-center gap-2">
                <AlertTriangle className="h-5 w-5 text-red-600" />
                <CardTitle>Alertes critiques ({alertes.length})</CardTitle>
              </div>
              <CardDescription>
                Alertes nécessitant une attention immédiate
              </CardDescription>
            </CardHeader>
            <CardContent>
              <div className="space-y-3">
                {alertes.map((alerte) => (
                  <div
                    key={alerte.id}
                    className="flex items-start justify-between p-3 bg-white rounded-lg border"
                  >
                    <div className="flex-1">
                      <div className="flex items-center gap-2 mb-1">
                        <Badge
                          variant={alerte.severite === 'critical' ? 'destructive' : 'default'}
                        >
                          {alerte.severite === 'critical' ? '🚨 Critique' : '⚠️ Avertissement'}
                        </Badge>
                        <span className="text-sm font-medium">{alerte.numero_plan}</span>
                      </div>
                      <p className="text-sm font-medium">{alerte.titre}</p>
                      <p className="text-xs text-gray-600 mt-1">{alerte.description}</p>
                      <p className="text-xs text-gray-500 mt-1">
                        Il y a {Math.round(alerte.age_heures)}h - {alerte.nom_transporteur}
                      </p>
                    </div>
                    <Button size="sm" variant="outline">
                      Voir
                    </Button>
                  </div>
                ))}
              </div>
            </CardContent>
          </Card>
        )}

        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          {/* Plans récents */}
          <Card>
            <CardHeader>
              <CardTitle>Plans de transport récents</CardTitle>
              <CardDescription>Dernières expéditions planifiées</CardDescription>
            </CardHeader>
            <CardContent>
              {plansLoading ? (
                <div className="text-center py-8 text-gray-500">Chargement...</div>
              ) : plans && plans.length > 0 ? (
                <div className="space-y-3">
                  {plans.map((plan) => (
                    <div
                      key={plan.id}
                      className="flex items-center justify-between p-3 border rounded-lg hover:bg-gray-50 transition-colors"
                    >
                      <div className="flex-1">
                        <div className="flex items-center gap-2 mb-1">
                          <span className="text-sm font-medium">{plan.numero_plan}</span>
                          <Badge variant="outline">{plan.statut_label}</Badge>
                          {plan.optimise_par_ia && (
                            <Badge variant="secondary" className="text-xs">
                              🤖 IA
                            </Badge>
                          )}
                        </div>
                        <div className="flex items-center gap-4 text-xs text-gray-600">
                          <span className="flex items-center gap-1">
                            <MapPin className="h-3 w-3" />
                            {plan.destination_adresse?.ville}
                          </span>
                          {plan.poids_total_kg && (
                            <span>{Math.round(plan.poids_total_kg)}kg</span>
                          )}
                          {plan.distance_km && (
                            <span>{formatDistance(plan.distance_km)}</span>
                          )}
                        </div>
                        {plan.nb_alertes_actives > 0 && (
                          <div className="flex items-center gap-1 mt-2">
                            <AlertTriangle className="h-3 w-3 text-red-600" />
                            <span className="text-xs text-red-600">
                              {plan.nb_alertes_actives} alerte{plan.nb_alertes_actives > 1 ? 's' : ''}
                            </span>
                          </div>
                        )}
                      </div>
                      <Button size="sm" variant="ghost">
                        →
                      </Button>
                    </div>
                  ))}
                </div>
              ) : (
                <div className="text-center py-8">
                  <Package className="h-12 w-12 text-gray-300 mx-auto mb-3" />
                  <p className="text-gray-500">Aucun plan de transport</p>
                  <Button className="mt-4" size="sm">
                    Créer un plan
                  </Button>
                </div>
              )}
            </CardContent>
          </Card>

          {/* Statistiques par statut */}
          <Card>
            <CardHeader>
              <CardTitle>Plans par statut</CardTitle>
              <CardDescription>Répartition des expéditions</CardDescription>
            </CardHeader>
            <CardContent>
              {statsStatuts ? (
                <div className="space-y-3">
                  {Object.entries(statsStatuts).map(([statut, count]) => (
                    <div key={statut} className="flex items-center justify-between">
                      <div className="flex items-center gap-2">
                        <Activity className="h-4 w-4 text-gray-500" />
                        <span className="text-sm capitalize">
                          {statut.replace(/_/g, ' ')}
                        </span>
                      </div>
                      <Badge variant="secondary">{count}</Badge>
                    </div>
                  ))}
                </div>
              ) : (
                <div className="text-center py-8 text-gray-500">Aucune donnée</div>
              )}
            </CardContent>
          </Card>
        </div>

        {/* Actions rapides */}
        <Card>
          <CardHeader>
            <CardTitle>Actions rapides</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
              <Button variant="outline" className="justify-start">
                <Package className="h-4 w-4 mr-2" />
                Nouveau plan
              </Button>
              <Button variant="outline" className="justify-start">
                <Truck className="h-4 w-4 mr-2" />
                Comparateur tarifs
              </Button>
              <Button variant="outline" className="justify-start">
                <MapPin className="h-4 w-4 mr-2" />
                Tracking carte
              </Button>
              <Button variant="outline" className="justify-start">
                <Leaf className="h-4 w-4 mr-2" />
                Rapport CO₂
              </Button>
            </div>
          </CardContent>
        </Card>
      </div>
    </DashboardLayout>
  );
}
