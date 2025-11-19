import { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import DashboardLayout from '@/components/DashboardLayout';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { useAuth } from '@/hooks/useAuth';
import {
  MapPin,
  Clock,
  Package,
  Search,
  AlertCircle,
  CheckCircle,
  Circle,
  Navigation,
} from 'lucide-react';
import { formatSeveriteAlerte, formatTypeAlerte } from '@/lib/tmsHelpers';
import type { PlanTransportComplet, TrackingEvent, AlerteTransport } from '@/types/tms';

export default function Tracking() {
  const { profile } = useAuth();
  const [selectedPlan, setSelectedPlan] = useState<string>('');
  const [searchTerm, setSearchTerm] = useState('');

  // Query: Plans en cours
  const { data: plansEnCours } = useQuery({
    queryKey: ['plans-en-cours', profile?.client_id],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('v_plan_transport_complet')
        .select('*')
        .in('statut', [
          'en_attente_pickup',
          'pickup_effectue',
          'en_transit',
          'en_livraison',
        ])
        .order('date_creation', { ascending: false });

      if (error) throw error;
      return data as PlanTransportComplet[];
    },
    enabled: !!profile,
  });

  // Query: Événements de tracking du plan sélectionné
  const { data: events } = useQuery({
    queryKey: ['tracking-events', selectedPlan],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('tracking_event')
        .select('*')
        .eq('plan_transport_id', selectedPlan)
        .order('timestamp', { ascending: false });

      if (error) throw error;
      return data as TrackingEvent[];
    },
    enabled: !!selectedPlan,
  });

  // Query: Alertes du plan sélectionné
  const { data: alertes } = useQuery({
    queryKey: ['alertes-plan', selectedPlan],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('alerte_transport')
        .select('*')
        .eq('plan_transport_id', selectedPlan)
        .order('date_alerte', { ascending: false });

      if (error) throw error;
      return data as AlerteTransport[];
    },
    enabled: !!selectedPlan,
  });

  // Plan sélectionné
  const planDetails = plansEnCours?.find((p) => p.id === selectedPlan);

  // Filtrer les plans
  const filteredPlans = plansEnCours?.filter((plan) => {
    if (!searchTerm) return true;
    return plan.numero_plan.toLowerCase().includes(searchTerm.toLowerCase());
  });

  const getEventIcon = (type: string) => {
    switch (type) {
      case 'created':
        return <Circle className="h-4 w-4 text-blue-500" />;
      case 'confirmed':
        return <CheckCircle className="h-4 w-4 text-green-500" />;
      case 'pickup_completed':
        return <Package className="h-4 w-4 text-purple-500" />;
      case 'in_transit':
        return <Navigation className="h-4 w-4 text-blue-500" />;
      case 'checkpoint':
        return <MapPin className="h-4 w-4 text-cyan-500" />;
      case 'delivered':
        return <CheckCircle className="h-4 w-4 text-green-600" />;
      case 'incident':
        return <AlertCircle className="h-4 w-4 text-red-500" />;
      default:
        return <Circle className="h-4 w-4 text-gray-400" />;
    }
  };

  const getEventLabel = (type: string): string => {
    const labels: Record<string, string> = {
      created: 'Plan créé',
      confirmed: 'Plan confirmé',
      pickup_scheduled: 'Enlèvement planifié',
      pickup_completed: 'Enlèvement effectué',
      in_transit: 'En transit',
      checkpoint: 'Point de passage',
      customs_clearance: 'Dédouanement',
      out_for_delivery: 'En cours de livraison',
      delivered: 'Livré',
      failed_delivery: 'Échec livraison',
      returned: 'Retourné',
      incident: 'Incident',
      delayed: 'Retard',
      cancelled: 'Annulé',
    };
    return labels[type] || type;
  };

  return (
    <DashboardLayout>
      <div className="space-y-6">
        {/* Header */}
        <div>
          <h1 className="text-3xl font-bold">Tracking Transport</h1>
          <p className="text-gray-600">Suivi temps réel de vos expéditions</p>
        </div>

        {/* Sélection du plan */}
        <Card>
          <CardHeader>
            <CardTitle>Sélectionner une expédition</CardTitle>
            <CardDescription>
              {plansEnCours?.length || 0} expédition{(plansEnCours?.length || 0) > 1 ? 's' : ''} en
              cours
            </CardDescription>
          </CardHeader>
          <CardContent>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div className="relative">
                <Search className="absolute left-3 top-3 h-4 w-4 text-gray-400" />
                <Input
                  placeholder="Rechercher un plan..."
                  value={searchTerm}
                  onChange={(e) => setSearchTerm(e.target.value)}
                  className="pl-9"
                />
              </div>

              <Select value={selectedPlan} onValueChange={setSelectedPlan}>
                <SelectTrigger>
                  <SelectValue placeholder="Sélectionner un plan de transport" />
                </SelectTrigger>
                <SelectContent>
                  {filteredPlans?.map((plan) => (
                    <SelectItem key={plan.id} value={plan.id}>
                      <div className="flex items-center gap-2">
                        <span className="font-medium">{plan.numero_plan}</span>
                        <span className="text-sm text-gray-500">
                          → {plan.destination_adresse?.ville}
                        </span>
                        <Badge variant="outline">{plan.statut_label}</Badge>
                      </div>
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </CardContent>
        </Card>

        {selectedPlan && planDetails && (
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
            {/* Timeline */}
            <div className="lg:col-span-2 space-y-4">
              {/* Détails du plan */}
              <Card>
                <CardHeader>
                  <div className="flex items-center justify-between">
                    <div>
                      <CardTitle>{planDetails.numero_plan}</CardTitle>
                      <CardDescription>
                        {planDetails.origine_adresse?.ville} →{' '}
                        {planDetails.destination_adresse?.ville}
                      </CardDescription>
                    </div>
                    <Badge variant="default">{planDetails.statut_label}</Badge>
                  </div>
                </CardHeader>
                <CardContent>
                  <div className="grid grid-cols-2 md:grid-cols-4 gap-4 text-sm">
                    <div>
                      <p className="text-gray-600">Transporteur</p>
                      <p className="font-medium">
                        {planDetails.nom_transporteur || 'Non assigné'}
                      </p>
                    </div>
                    <div>
                      <p className="text-gray-600">Mode</p>
                      <p className="font-medium">{planDetails.mode_nom}</p>
                    </div>
                    {planDetails.poids_total_kg && (
                      <div>
                        <p className="text-gray-600">Poids</p>
                        <p className="font-medium">{Math.round(planDetails.poids_total_kg)}kg</p>
                      </div>
                    )}
                    {planDetails.eta_predit && (
                      <div>
                        <p className="text-gray-600">ETA prédit</p>
                        <p className="font-medium">
                          {new Date(planDetails.eta_predit).toLocaleDateString('fr-FR')}
                        </p>
                      </div>
                    )}
                  </div>
                </CardContent>
              </Card>

              {/* Timeline des événements */}
              <Card>
                <CardHeader>
                  <CardTitle>Timeline</CardTitle>
                  <CardDescription>
                    {events?.length || 0} événement{(events?.length || 0) > 1 ? 's' : ''}
                  </CardDescription>
                </CardHeader>
                <CardContent>
                  {events && events.length > 0 ? (
                    <div className="space-y-4">
                      {events.map((event, index) => (
                        <div key={event.id} className="relative">
                          {/* Ligne verticale */}
                          {index < events.length - 1 && (
                            <div className="absolute left-[11px] top-8 h-full w-0.5 bg-gray-200" />
                          )}

                          <div className="flex gap-4">
                            {/* Icône */}
                            <div className="relative z-10 flex-shrink-0 mt-1">
                              {getEventIcon(event.type_evenement)}
                            </div>

                            {/* Contenu */}
                            <div className="flex-1 pb-6">
                              <div className="flex items-start justify-between">
                                <div>
                                  <p className="font-medium">
                                    {getEventLabel(event.type_evenement)}
                                  </p>
                                  {event.description && (
                                    <p className="text-sm text-gray-600 mt-1">
                                      {event.description}
                                    </p>
                                  )}
                                  {event.lieu && (
                                    <p className="text-sm text-gray-500 mt-1 flex items-center gap-1">
                                      <MapPin className="h-3 w-3" />
                                      {event.lieu}
                                      {event.ville && `, ${event.ville}`}
                                      {event.pays && `, ${event.pays}`}
                                    </p>
                                  )}
                                </div>
                                <div className="text-right">
                                  <p className="text-sm text-gray-600">
                                    {new Date(event.timestamp).toLocaleDateString('fr-FR')}
                                  </p>
                                  <p className="text-xs text-gray-500">
                                    {new Date(event.timestamp).toLocaleTimeString('fr-FR')}
                                  </p>
                                </div>
                              </div>
                            </div>
                          </div>
                        </div>
                      ))}
                    </div>
                  ) : (
                    <div className="text-center py-8 text-gray-500">
                      Aucun événement de tracking
                    </div>
                  )}
                </CardContent>
              </Card>
            </div>

            {/* Alertes */}
            <div>
              <Card>
                <CardHeader>
                  <CardTitle>Alertes</CardTitle>
                  <CardDescription>
                    {alertes?.filter((a) => !a.resolue).length || 0} active
                    {(alertes?.filter((a) => !a.resolue).length || 0) > 1 ? 's' : ''}
                  </CardDescription>
                </CardHeader>
                <CardContent>
                  {alertes && alertes.length > 0 ? (
                    <div className="space-y-3">
                      {alertes.map((alerte) => {
                        const severiteInfo = formatSeveriteAlerte(alerte.severite);
                        return (
                          <div
                            key={alerte.id}
                            className={`p-3 rounded-lg border ${
                              alerte.resolue ? 'opacity-50' : ''
                            }`}
                            style={{
                              backgroundColor: severiteInfo.bgColor,
                            }}
                          >
                            <div className="flex items-start gap-2">
                              <span className="text-lg">{severiteInfo.icon}</span>
                              <div className="flex-1">
                                <div className="flex items-center gap-2 mb-1">
                                  <span className="text-xs font-medium">
                                    {formatTypeAlerte(alerte.type_alerte)}
                                  </span>
                                  {alerte.resolue && (
                                    <Badge variant="outline" className="text-xs">
                                      Résolu
                                    </Badge>
                                  )}
                                </div>
                                <p className="text-sm font-medium">{alerte.titre}</p>
                                {alerte.description && (
                                  <p className="text-xs text-gray-600 mt-1">
                                    {alerte.description}
                                  </p>
                                )}
                                <p className="text-xs text-gray-500 mt-2 flex items-center gap-1">
                                  <Clock className="h-3 w-3" />
                                  {new Date(alerte.date_alerte).toLocaleString('fr-FR')}
                                </p>
                              </div>
                            </div>
                          </div>
                        );
                      })}
                    </div>
                  ) : (
                    <div className="text-center py-8 text-gray-500">Aucune alerte</div>
                  )}
                </CardContent>
              </Card>
            </div>
          </div>
        )}

        {!selectedPlan && (
          <Card>
            <CardContent className="py-12">
              <div className="text-center">
                <MapPin className="h-16 w-16 text-gray-300 mx-auto mb-4" />
                <h3 className="text-lg font-semibold mb-2">Sélectionnez une expédition</h3>
                <p className="text-gray-600">
                  Sélectionnez un plan de transport pour voir le tracking en temps réel
                </p>
              </div>
            </CardContent>
          </Card>
        )}
      </div>
    </DashboardLayout>
  );
}
