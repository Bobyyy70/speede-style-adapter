import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { DashboardLayout } from "@/components/DashboardLayout";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { RefreshCw, Activity, ArrowUpRight, ArrowDownLeft, CheckCircle2, XCircle, Clock, AlertTriangle } from "lucide-react";
import { format } from "date-fns";
import { fr } from "date-fns/locale";

export default function SendCloudEvents() {
  const [retrying, setRetrying] = useState(false);

  // Stats globales
  const { data: stats, refetch: refetchStats } = useQuery({
    queryKey: ["sendcloud-event-stats"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("sendcloud_event_stats" as any)
        .select("*");
      
      if (error) throw error;
      return data as any[];
    },
  });

  // Événements récents (30 derniers)
  const { data: recentEvents, refetch: refetchEvents } = useQuery({
    queryKey: ["sendcloud-recent-events"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("sendcloud_event_history" as any)
        .select("*")
        .order("created_at", { ascending: false })
        .limit(30);
      
      if (error) throw error;
      return data as any[];
    },
  });

  // Webhooks entrants non traités
  const { data: incomingWebhooks, refetch: refetchIncoming } = useQuery({
    queryKey: ["sendcloud-incoming-webhooks"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("sendcloud_webhook_events" as any)
        .select("*")
        .eq("processed", false)
        .order("created_at", { ascending: false })
        .limit(20);
      
      if (error) throw error;
      return data as any[];
    },
  });

  // Webhooks sortants en échec
  const { data: failedOutgoing, refetch: refetchFailed } = useQuery({
    queryKey: ["sendcloud-failed-webhooks"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("sendcloud_failed_webhooks" as any)
        .select("*")
        .order("created_at", { ascending: false })
        .limit(20);
      
      if (error) throw error;
      return data as any[];
    },
  });

  // Tracking temps réel
  const { data: trackingData, refetch: refetchTracking } = useQuery({
    queryKey: ["sendcloud-status-tracking"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("sendcloud_status_tracking" as any)
        .select(`
          *,
          commande:commande_id (
            numero_commande,
            destinataire_nom
          )
        `)
        .order("updated_at", { ascending: false })
        .limit(20);
      
      if (error) throw error;
      return data as any[];
    },
  });

  const handleRetryFailed = async () => {
    setRetrying(true);
    try {
      const { data, error } = await supabase.functions.invoke("sendcloud-retry-webhooks");

      if (error) throw error;

      toast.success(`Retry terminé : ${data.succeeded} succès, ${data.failed} échecs`);
      refetchFailed();
      refetchStats();
      refetchEvents();
    } catch (error) {
      console.error("Error retrying webhooks:", error);
      toast.error("Erreur lors du retry");
    } finally {
      setRetrying(false);
    }
  };

  const getDirectionBadge = (direction: string) => {
    if (direction === 'incoming') {
      return <Badge variant="outline" className="gap-1"><ArrowDownLeft className="h-3 w-3" /> Entrant</Badge>;
    }
    return <Badge variant="outline" className="gap-1"><ArrowUpRight className="h-3 w-3" /> Sortant</Badge>;
  };

  const getSuccessBadge = (success: boolean) => {
    if (success) {
      return <Badge variant="default" className="gap-1 bg-green-600"><CheckCircle2 className="h-3 w-3" /> Succès</Badge>;
    }
    return <Badge variant="destructive" className="gap-1"><XCircle className="h-3 w-3" /> Échec</Badge>;
  };

  const getStatusBadge = (status: string) => {
    switch (status) {
      case 'pending':
        return <Badge variant="secondary" className="gap-1"><Clock className="h-3 w-3" /> En attente</Badge>;
      case 'sent':
        return <Badge variant="default" className="gap-1 bg-green-600"><CheckCircle2 className="h-3 w-3" /> Envoyé</Badge>;
      case 'failed':
        return <Badge variant="destructive" className="gap-1"><XCircle className="h-3 w-3" /> Échec</Badge>;
      default:
        return <Badge variant="outline">{status}</Badge>;
    }
  };

  return (
    <DashboardLayout>
      <div className="space-y-6">
        {/* Header */}
        <div className="flex justify-between items-start">
          <div>
            <h1 className="text-3xl font-bold">Événements SendCloud</h1>
            <p className="text-muted-foreground mt-2">
              Monitoring temps réel des webhooks et événements bidirectionnels
            </p>
          </div>
          <Button
            onClick={() => {
              refetchStats();
              refetchEvents();
              refetchIncoming();
              refetchFailed();
              refetchTracking();
            }}
            variant="outline"
            className="gap-2"
          >
            <RefreshCw className="h-4 w-4" />
            Actualiser
          </Button>
        </div>

        {/* Stats Cards */}
        <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
          <Card>
            <CardHeader className="pb-3">
              <CardTitle className="text-sm font-medium flex items-center gap-2">
                <Activity className="h-4 w-4" />
                Événements Total (30j)
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">
                {stats?.reduce((sum, s) => sum + (s.total_events || 0), 0) || 0}
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="pb-3">
              <CardTitle className="text-sm font-medium flex items-center gap-2">
                <CheckCircle2 className="h-4 w-4 text-green-600" />
                Succès
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold text-green-600">
                {stats?.reduce((sum, s) => sum + (s.successful_events || 0), 0) || 0}
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="pb-3">
              <CardTitle className="text-sm font-medium flex items-center gap-2">
                <XCircle className="h-4 w-4 text-red-600" />
                Échecs
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold text-red-600">
                {stats?.reduce((sum, s) => sum + (s.failed_events || 0), 0) || 0}
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="pb-3">
              <CardTitle className="text-sm font-medium flex items-center gap-2">
                <Clock className="h-4 w-4" />
                Temps Moyen
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">
                {Math.round(
                  stats?.reduce((sum, s, _, arr) => sum + (s.avg_processing_time_ms || 0), 0) / (stats?.length || 1)
                )}ms
              </div>
            </CardContent>
          </Card>
        </div>

        {/* Tabs */}
        <Tabs defaultValue="recent" className="space-y-4">
          <TabsList>
            <TabsTrigger value="recent">Événements Récents</TabsTrigger>
            <TabsTrigger value="incoming" className="gap-2">
              Webhooks Entrants
              {incomingWebhooks && incomingWebhooks.length > 0 && (
                <Badge variant="secondary">{incomingWebhooks.length}</Badge>
              )}
            </TabsTrigger>
            <TabsTrigger value="failed" className="gap-2">
              En Échec
              {failedOutgoing && failedOutgoing.length > 0 && (
                <Badge variant="destructive">{failedOutgoing.length}</Badge>
              )}
            </TabsTrigger>
            <TabsTrigger value="tracking">Tracking Temps Réel</TabsTrigger>
            <TabsTrigger value="stats">Statistiques</TabsTrigger>
          </TabsList>

          {/* Recent Events Tab */}
          <TabsContent value="recent" className="space-y-4">
            <Card>
              <CardHeader>
                <CardTitle>Événements Récents (30 derniers)</CardTitle>
                <CardDescription>
                  Historique complet des événements entrants et sortants
                </CardDescription>
              </CardHeader>
              <CardContent>
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Date</TableHead>
                      <TableHead>Type</TableHead>
                      <TableHead>Direction</TableHead>
                      <TableHead>Entité</TableHead>
                      <TableHead>Statut</TableHead>
                      <TableHead>Temps</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {recentEvents && recentEvents.length > 0 ? (
                      recentEvents.map((event: any) => (
                        <TableRow key={event.id}>
                          <TableCell className="text-sm">
                            {format(new Date(event.created_at), "dd/MM HH:mm:ss", { locale: fr })}
                          </TableCell>
                          <TableCell className="font-mono text-xs">{event.event_type}</TableCell>
                          <TableCell>{getDirectionBadge(event.direction)}</TableCell>
                          <TableCell>
                            <span className="text-xs text-muted-foreground">
                              {event.entity_type || '-'}
                            </span>
                          </TableCell>
                          <TableCell>{getSuccessBadge(event.success)}</TableCell>
                          <TableCell className="text-right tabular-nums text-sm">
                            {event.processing_time_ms}ms
                          </TableCell>
                        </TableRow>
                      ))
                    ) : (
                      <TableRow>
                        <TableCell colSpan={6} className="text-center text-muted-foreground">
                          Aucun événement récent
                        </TableCell>
                      </TableRow>
                    )}
                  </TableBody>
                </Table>
              </CardContent>
            </Card>
          </TabsContent>

          {/* Incoming Webhooks Tab */}
          <TabsContent value="incoming" className="space-y-4">
            <Card>
              <CardHeader>
                <CardTitle>Webhooks Entrants Non Traités</CardTitle>
                <CardDescription>
                  Événements reçus de SendCloud en attente de traitement
                </CardDescription>
              </CardHeader>
              <CardContent>
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Date</TableHead>
                      <TableHead>Type</TableHead>
                      <TableHead>SendCloud ID</TableHead>
                      <TableHead>Tentatives</TableHead>
                      <TableHead>Erreur</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {incomingWebhooks && incomingWebhooks.length > 0 ? (
                      incomingWebhooks.map((webhook: any) => (
                        <TableRow key={webhook.id}>
                          <TableCell className="text-sm">
                            {format(new Date(webhook.created_at), "dd/MM HH:mm", { locale: fr })}
                          </TableCell>
                          <TableCell className="font-mono text-xs">{webhook.event_type}</TableCell>
                          <TableCell className="text-xs">{webhook.sendcloud_id || '-'}</TableCell>
                          <TableCell>
                            <Badge variant={webhook.retry_count > 0 ? "destructive" : "secondary"}>
                              {webhook.retry_count}
                            </Badge>
                          </TableCell>
                          <TableCell className="max-w-md truncate text-xs text-muted-foreground">
                            {webhook.processing_error || '-'}
                          </TableCell>
                        </TableRow>
                      ))
                    ) : (
                      <TableRow>
                        <TableCell colSpan={5} className="text-center text-muted-foreground py-8">
                          <CheckCircle2 className="h-12 w-12 mx-auto mb-2 text-green-600" />
                          <p>Tous les webhooks sont traités !</p>
                        </TableCell>
                      </TableRow>
                    )}
                  </TableBody>
                </Table>
              </CardContent>
            </Card>
          </TabsContent>

          {/* Failed Webhooks Tab */}
          <TabsContent value="failed" className="space-y-4">
            <Card>
              <CardHeader className="flex flex-row items-center justify-between">
                <div>
                  <CardTitle>Webhooks Sortants en Échec</CardTitle>
                  <CardDescription>
                    Événements qui n'ont pas pu être envoyés à SendCloud
                  </CardDescription>
                </div>
                <Button
                  onClick={handleRetryFailed}
                  disabled={retrying || !failedOutgoing || failedOutgoing.length === 0}
                  variant="outline"
                  className="gap-2"
                >
                  <RefreshCw className={`h-4 w-4 ${retrying ? 'animate-spin' : ''}`} />
                  Retrier Maintenant
                </Button>
              </CardHeader>
              <CardContent>
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Date</TableHead>
                      <TableHead>Type</TableHead>
                      <TableHead>Entité</TableHead>
                      <TableHead>Tentatives</TableHead>
                      <TableHead>Prochain Retry</TableHead>
                      <TableHead>Erreur</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {failedOutgoing && failedOutgoing.length > 0 ? (
                      failedOutgoing.map((webhook: any) => (
                        <TableRow key={webhook.id}>
                          <TableCell className="text-sm">
                            {format(new Date(webhook.created_at), "dd/MM HH:mm", { locale: fr })}
                          </TableCell>
                          <TableCell className="font-mono text-xs">{webhook.event_type}</TableCell>
                          <TableCell className="text-xs">{webhook.entity_type}</TableCell>
                          <TableCell>
                            <Badge variant="destructive">
                              {webhook.retry_count} / {webhook.max_retries}
                            </Badge>
                          </TableCell>
                          <TableCell className="text-sm">
                            {webhook.next_retry_at
                              ? format(new Date(webhook.next_retry_at), "dd/MM HH:mm", { locale: fr })
                              : 'Max atteint'}
                          </TableCell>
                          <TableCell className="max-w-md truncate text-xs text-muted-foreground">
                            {webhook.error_message}
                          </TableCell>
                        </TableRow>
                      ))
                    ) : (
                      <TableRow>
                        <TableCell colSpan={6} className="text-center text-muted-foreground py-8">
                          <CheckCircle2 className="h-12 w-12 mx-auto mb-2 text-green-600" />
                          <p>Aucun webhook en échec !</p>
                        </TableCell>
                      </TableRow>
                    )}
                  </TableBody>
                </Table>
              </CardContent>
            </Card>
          </TabsContent>

          {/* Tracking Tab */}
          <TabsContent value="tracking" className="space-y-4">
            <Card>
              <CardHeader>
                <CardTitle>Suivi des Expéditions en Temps Réel</CardTitle>
                <CardDescription>
                  Statuts mis à jour automatiquement via webhooks SendCloud
                </CardDescription>
              </CardHeader>
              <CardContent>
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Commande</TableHead>
                      <TableHead>Client</TableHead>
                      <TableHead>Transporteur</TableHead>
                      <TableHead>N° Suivi</TableHead>
                      <TableHead>Statut</TableHead>
                      <TableHead>Dernière MAJ</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {trackingData && trackingData.length > 0 ? (
                      trackingData.map((track: any) => (
                        <TableRow key={track.id}>
                          <TableCell className="font-medium">
                            {track.commande?.numero_commande || '-'}
                          </TableCell>
                          <TableCell>{track.commande?.destinataire_nom || '-'}</TableCell>
                          <TableCell>{track.carrier || '-'}</TableCell>
                          <TableCell className="font-mono text-xs">
                            {track.tracking_number || '-'}
                          </TableCell>
                          <TableCell>
                            <Badge variant="outline">{track.current_status || 'Inconnu'}</Badge>
                          </TableCell>
                          <TableCell className="text-sm">
                            {format(new Date(track.updated_at), "dd/MM HH:mm", { locale: fr })}
                          </TableCell>
                        </TableRow>
                      ))
                    ) : (
                      <TableRow>
                        <TableCell colSpan={6} className="text-center text-muted-foreground">
                          Aucune expédition en cours de suivi
                        </TableCell>
                      </TableRow>
                    )}
                  </TableBody>
                </Table>
              </CardContent>
            </Card>
          </TabsContent>

          {/* Stats Tab */}
          <TabsContent value="stats" className="space-y-4">
            <Card>
              <CardHeader>
                <CardTitle>Statistiques par Type d'Événement (30 jours)</CardTitle>
                <CardDescription>
                  Performance et fiabilité des événements
                </CardDescription>
              </CardHeader>
              <CardContent>
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Type</TableHead>
                      <TableHead>Direction</TableHead>
                      <TableHead>Total</TableHead>
                      <TableHead>Succès</TableHead>
                      <TableHead>Échecs</TableHead>
                      <TableHead>Taux Succès</TableHead>
                      <TableHead>Temps Moyen</TableHead>
                      <TableHead>Dernier</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {stats && stats.length > 0 ? (
                      stats.map((stat: any) => {
                        const successRate = stat.total_events > 0
                          ? ((stat.successful_events / stat.total_events) * 100).toFixed(1)
                          : '0';
                        
                        return (
                          <TableRow key={`${stat.event_type}-${stat.direction}`}>
                            <TableCell className="font-mono text-xs">{stat.event_type}</TableCell>
                            <TableCell>{getDirectionBadge(stat.direction)}</TableCell>
                            <TableCell className="font-semibold">{stat.total_events}</TableCell>
                            <TableCell className="text-green-600">{stat.successful_events}</TableCell>
                            <TableCell className="text-red-600">{stat.failed_events}</TableCell>
                            <TableCell>
                              <Badge variant={parseFloat(successRate) >= 95 ? "default" : "destructive"}>
                                {successRate}%
                              </Badge>
                            </TableCell>
                            <TableCell className="tabular-nums">{stat.avg_processing_time_ms}ms</TableCell>
                            <TableCell className="text-sm">
                              {format(new Date(stat.last_event_at), "dd/MM HH:mm", { locale: fr })}
                            </TableCell>
                          </TableRow>
                        );
                      })
                    ) : (
                      <TableRow>
                        <TableCell colSpan={8} className="text-center text-muted-foreground">
                          Aucune statistique disponible
                        </TableCell>
                      </TableRow>
                    )}
                  </TableBody>
                </Table>
              </CardContent>
            </Card>
          </TabsContent>
        </Tabs>
      </div>
    </DashboardLayout>
  );
}
