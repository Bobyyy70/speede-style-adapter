import { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { DashboardLayout } from '@/components/DashboardLayout';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Search, Package, Truck, MapPin, Calendar, ExternalLink, RefreshCw } from 'lucide-react';
import { format } from 'date-fns';
import { fr } from 'date-fns/locale';
import { toast } from 'sonner';

interface TrackingEvent {
  id: string;
  event_timestamp: string;
  status_id: number;
  status_message: string;
  location?: string;
  carrier_message?: string;
  metadata?: any;
}

interface Parcel {
  id: string;
  parcel_id: string;
  commande_id: string;
  tracking_number: string;
  tracking_url: string;
  carrier_name: string;
  service_name: string;
  status_message: string;
  weight: number;
  country: string;
  city: string;
  label_url: string;
  created_at: string;
  updated_at: string;
  commande?: {
    numero_commande: string;
    client_id: string;
  };
  client_nom?: string;
}

export default function SendCloudTracking() {
  const [searchTerm, setSearchTerm] = useState('');

  const { data: parcels, isLoading, refetch } = useQuery({
    queryKey: ['sendcloud-parcels', searchTerm],
    queryFn: async () => {
      let query = supabase
        .from('sendcloud_parcels')
        .select(`
          *,
          commande:commande_id (
            numero_commande,
            client_id
          )
        `)
        .order('created_at', { ascending: false })
        .limit(50);

      if (searchTerm) {
        query = query.or(`tracking_number.ilike.%${searchTerm}%,parcel_id.ilike.%${searchTerm}%`);
      }

      const { data, error } = await query;
      if (error) throw error;

      // Enrichir avec les noms des clients
      const enriched = await Promise.all(
        (data || []).map(async (parcel: any) => {
          if (parcel.commande?.client_id) {
            const { data: client } = await supabase
              .from('client')
              .select('nom_entreprise')
              .eq('id', parcel.commande.client_id)
              .single();
            return { ...parcel, client_nom: client?.nom_entreprise };
          }
          return parcel;
        })
      );

      return enriched as Parcel[];
    },
  });

  const { data: selectedParcelEvents, refetch: refetchEvents } = useQuery({
    queryKey: ['tracking-events', parcels?.[0]?.parcel_id],
    enabled: !!parcels?.[0]?.parcel_id,
    queryFn: async () => {
      const { data, error } = await supabase
        .from('sendcloud_tracking_events')
        .select('*')
        .eq('parcel_id', parcels![0].parcel_id)
        .order('event_timestamp', { ascending: false });

      if (error) throw error;
      return data as TrackingEvent[];
    },
  });

  const handleRefreshTracking = async (parcelId: string) => {
    try {
      const parcel = parcels?.find(p => p.parcel_id === parcelId);
      if (!parcel?.commande_id) {
        toast.error('Commande non trouvée');
        return;
      }

      const { error } = await supabase.functions.invoke('sendcloud-get-tracking', {
        body: { commande_id: parcel.commande_id }
      });

      if (error) throw error;

      toast.success('Tracking mis à jour');
      refetch();
      refetchEvents();
    } catch (error: any) {
      console.error('Erreur refresh tracking:', error);
      toast.error(error.message || 'Erreur lors du rafraîchissement');
    }
  };

  const getStatusColor = (statusId: number) => {
    if (statusId >= 11) return 'default'; // Livré
    if (statusId >= 3) return 'secondary'; // En transit
    if (statusId >= 2) return 'outline'; // En préparation
    return 'destructive'; // Créé / Erreur
  };

  const formatDate = (date: string) => {
    return format(new Date(date), 'dd MMM yyyy HH:mm', { locale: fr });
  };

  return (
    <DashboardLayout>
      <div className="space-y-6">
        <div>
          <h1 className="text-3xl font-bold">Suivi des Colis SendCloud</h1>
          <p className="text-muted-foreground">
            Historique et événements de tracking en temps réel
          </p>
        </div>

        <Card>
          <CardHeader>
            <CardTitle>Rechercher un colis</CardTitle>
            <CardDescription>
              Par numéro de tracking ou ID SendCloud
            </CardDescription>
          </CardHeader>
          <CardContent>
            <div className="flex gap-2">
              <div className="relative flex-1">
                <Search className="absolute left-3 top-3 h-4 w-4 text-muted-foreground" />
                <Input
                  placeholder="Numéro de tracking, ID colis..."
                  value={searchTerm}
                  onChange={(e) => setSearchTerm(e.target.value)}
                  className="pl-9"
                />
              </div>
              <Button onClick={() => refetch()}>
                <RefreshCw className="h-4 w-4 mr-2" />
                Actualiser
              </Button>
            </div>
          </CardContent>
        </Card>

        <div className="grid gap-6 lg:grid-cols-2">
          {/* Liste des colis */}
          <Card>
            <CardHeader>
              <CardTitle>Colis récents ({parcels?.length || 0})</CardTitle>
            </CardHeader>
            <CardContent>
              {isLoading ? (
                <div className="text-center py-8 text-muted-foreground">
                  Chargement...
                </div>
              ) : !parcels || parcels.length === 0 ? (
                <div className="text-center py-8 text-muted-foreground">
                  <Package className="h-12 w-12 mx-auto mb-4 opacity-50" />
                  <p>Aucun colis trouvé</p>
                </div>
              ) : (
                <div className="space-y-3 max-h-[600px] overflow-y-auto">
                  {parcels.map((parcel) => (
                    <div
                      key={parcel.id}
                      className="p-4 border rounded-lg hover:bg-accent transition-colors"
                    >
                      <div className="flex items-start justify-between mb-2">
                        <div>
                          <p className="font-medium">
                            {parcel.commande?.numero_commande || 'N/A'}
                          </p>
                          <p className="text-sm text-muted-foreground">
                            {parcel.client_nom}
                          </p>
                        </div>
                        <Badge variant={getStatusColor(parcel.status_message ? 3 : 1)}>
                          {parcel.status_message}
                        </Badge>
                      </div>

                      <div className="space-y-1 text-sm">
                        <div className="flex items-center gap-2 text-muted-foreground">
                          <Truck className="h-4 w-4" />
                          {parcel.carrier_name} - {parcel.service_name}
                        </div>
                        <div className="flex items-center gap-2 text-muted-foreground">
                          <Package className="h-4 w-4" />
                          {parcel.tracking_number}
                        </div>
                        <div className="flex items-center gap-2 text-muted-foreground">
                          <MapPin className="h-4 w-4" />
                          {parcel.city}, {parcel.country}
                        </div>
                        <div className="flex items-center gap-2 text-muted-foreground">
                          <Calendar className="h-4 w-4" />
                          {formatDate(parcel.created_at)}
                        </div>
                      </div>

                      <div className="flex gap-2 mt-3">
                        {parcel.tracking_url && (
                          <Button
                            size="sm"
                            variant="outline"
                            onClick={() => window.open(parcel.tracking_url, '_blank')}
                          >
                            <ExternalLink className="h-4 w-4 mr-1" />
                            Suivre
                          </Button>
                        )}
                        {parcel.label_url && (
                          <Button
                            size="sm"
                            variant="outline"
                            onClick={() => window.open(parcel.label_url, '_blank')}
                          >
                            <Package className="h-4 w-4 mr-1" />
                            Étiquette
                          </Button>
                        )}
                        <Button
                          size="sm"
                          variant="ghost"
                          onClick={() => handleRefreshTracking(parcel.parcel_id)}
                        >
                          <RefreshCw className="h-4 w-4" />
                        </Button>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </CardContent>
          </Card>

          {/* Timeline des événements */}
          <Card>
            <CardHeader>
              <CardTitle>Historique de tracking</CardTitle>
              <CardDescription>
                {parcels?.[0]?.tracking_number || 'Sélectionnez un colis'}
              </CardDescription>
            </CardHeader>
            <CardContent>
              {!selectedParcelEvents || selectedParcelEvents.length === 0 ? (
                <div className="text-center py-8 text-muted-foreground">
                  <MapPin className="h-12 w-12 mx-auto mb-4 opacity-50" />
                  <p>Aucun événement de tracking</p>
                </div>
              ) : (
                <div className="space-y-4 max-h-[600px] overflow-y-auto">
                  {selectedParcelEvents.map((event, index) => (
                    <div
                      key={event.id}
                      className="relative pl-8 pb-4 border-l-2 border-border last:border-l-0"
                    >
                      <div
                        className={`absolute left-0 top-0 -translate-x-1/2 w-4 h-4 rounded-full ${
                          index === 0
                            ? 'bg-primary'
                            : 'bg-muted-foreground'
                        }`}
                      />
                      <div className="space-y-1">
                        <div className="flex items-start justify-between">
                          <p className="font-medium">{event.status_message}</p>
                          <Badge variant="outline" className="text-xs">
                            ID: {event.status_id}
                          </Badge>
                        </div>
                        <p className="text-sm text-muted-foreground">
                          {formatDate(event.event_timestamp)}
                        </p>
                        {event.location && (
                          <p className="text-sm flex items-center gap-1">
                            <MapPin className="h-3 w-3" />
                            {event.location}
                          </p>
                        )}
                        {event.carrier_message && (
                          <p className="text-sm text-muted-foreground italic">
                            {event.carrier_message}
                          </p>
                        )}
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </CardContent>
          </Card>
        </div>
      </div>
    </DashboardLayout>
  );
}
