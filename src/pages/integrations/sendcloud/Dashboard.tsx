import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { DashboardLayout } from "@/components/DashboardLayout";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { toast } from "sonner";
import { RefreshCw, CheckCircle, XCircle, AlertCircle, Activity, Loader2 } from "lucide-react";
import { format } from "date-fns";
import { fr } from "date-fns/locale";
import { SyncJobList } from "@/components/integrations/sendcloud/SyncJobList";
import { SyncCharts } from "@/components/integrations/sendcloud/SyncCharts";

export default function SendCloudDashboard() {
  const queryClient = useQueryClient();
  const [syncingOrders, setSyncingOrders] = useState(false);
  const [syncingProducts, setSyncingProducts] = useState(false);

  // Test de connexion
  const { data: connectionStatus, isLoading: testingConnection } = useQuery({
    queryKey: ['sendcloud-connection-test'],
    queryFn: async () => {
      const { data, error } = await supabase.functions.invoke('sendcloud-test-connection');
      if (error) throw error;
      return data;
    },
    refetchInterval: 60000, // Refresh toutes les minutes
  });

  // Dernière sync réussie
  const { data: lastSuccessfulSync } = useQuery({
    queryKey: ['sendcloud-last-sync'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('sendcloud_sync_logs')
        .select('*')
        .eq('status', 'success')
        .order('finished_at', { ascending: false })
        .limit(1)
        .single();
      
      if (error && error.code !== 'PGRST116') throw error;
      return data;
    },
  });

  // Stats rapides
  const { data: quickStats } = useQuery({
    queryKey: ['sendcloud-quick-stats'],
    queryFn: async () => {
      const today = new Date();
      today.setHours(0, 0, 0, 0);

      const { data: logs, error } = await supabase
        .from('sendcloud_sync_logs')
        .select('*')
        .gte('started_at', today.toISOString());

      if (error) throw error;

      const successCount = logs?.filter(l => l.status === 'success').length || 0;
      const totalCount = logs?.length || 0;
      const totalItems = logs?.reduce((sum, l) => sum + (l.item_count || 0), 0) || 0;

      return {
        todayRuns: totalCount,
        successRate: totalCount > 0 ? Math.round((successCount / totalCount) * 100) : 0,
        itemsProcessed: totalItems,
      };
    },
    refetchInterval: 30000,
  });

  // Sync manuelle orders
  const syncOrdersMutation = useMutation({
    mutationFn: async () => {
      setSyncingOrders(true);
      const { data, error } = await supabase.functions.invoke('sendcloud-sync-orders', {
        body: { mode: 'manual', limit: 50 }
      });
      if (error) throw error;
      return data;
    },
    onSuccess: () => {
      toast.success('Synchronisation des commandes lancée', {
        description: 'Actualisez dans 30 secondes pour voir les résultats'
      });
      setTimeout(() => {
        queryClient.invalidateQueries({ queryKey: ['sendcloud_sync_logs'] });
        setSyncingOrders(false);
      }, 5000);
    },
    onError: (error: Error) => {
      toast.error('Erreur lors de la synchronisation', {
        description: error.message
      });
      setSyncingOrders(false);
    },
  });

  // Sync manuelle products
  const syncProductsMutation = useMutation({
    mutationFn: async () => {
      setSyncingProducts(true);
      const { data, error } = await supabase.functions.invoke('sendcloud-sync-products', {
        body: { sync_all: true }
      });
      if (error) throw error;
      return data;
    },
    onSuccess: () => {
      toast.success('Synchronisation des produits lancée', {
        description: 'Actualisez dans 30 secondes pour voir les résultats'
      });
      setTimeout(() => {
        queryClient.invalidateQueries({ queryKey: ['sendcloud_sync_logs'] });
        setSyncingProducts(false);
      }, 5000);
    },
    onError: (error: Error) => {
      toast.error('Erreur lors de la synchronisation', {
        description: error.message
      });
      setSyncingProducts(false);
    },
  });

  const isConnected = connectionStatus?.success && connectionStatus?.connectionValid;

  return (
    <DashboardLayout>
      <div className="space-y-6 p-6">
        <div className="flex items-center justify-between">
          <h1 className="text-3xl font-bold">Dashboard SendCloud</h1>
        </div>
        {/* État de connexion */}
        <div className="grid gap-4 md:grid-cols-3">
          <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">État de Connexion</CardTitle>
              <Activity className="h-4 w-4 text-muted-foreground" />
            </CardHeader>
            <CardContent>
              {testingConnection ? (
                <div className="flex items-center gap-2">
                  <Loader2 className="h-4 w-4 animate-spin" />
                  <span className="text-sm">Test en cours...</span>
                </div>
              ) : (
                <div className="flex items-center gap-2">
                  <Badge variant={isConnected ? "default" : "destructive"}>
                    {isConnected ? (
                      <>
                        <CheckCircle className="w-3 h-3 mr-1" />
                        Connecté
                      </>
                    ) : (
                      <>
                        <XCircle className="w-3 h-3 mr-1" />
                        Déconnecté
                      </>
                    )}
                  </Badge>
                </div>
              )}
              {lastSuccessfulSync && (
                <p className="text-xs text-muted-foreground mt-2">
                  Dernière sync : {format(new Date(lastSuccessfulSync.finished_at || lastSuccessfulSync.started_at), "Pp", { locale: fr })}
                </p>
              )}
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">Stats Aujourd'hui</CardTitle>
              <Activity className="h-4 w-4 text-muted-foreground" />
            </CardHeader>
            <CardContent>
              <div className="space-y-1">
                <div className="flex items-center justify-between text-sm">
                  <span className="text-muted-foreground">Runs</span>
                  <span className="font-semibold">{quickStats?.todayRuns || 0}</span>
                </div>
                <div className="flex items-center justify-between text-sm">
                  <span className="text-muted-foreground">Taux succès</span>
                  <span className="font-semibold">{quickStats?.successRate || 0}%</span>
                </div>
                <div className="flex items-center justify-between text-sm">
                  <span className="text-muted-foreground">Items traités</span>
                  <span className="font-semibold">{quickStats?.itemsProcessed || 0}</span>
                </div>
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">Actions Rapides</CardTitle>
              <RefreshCw className="h-4 w-4 text-muted-foreground" />
            </CardHeader>
            <CardContent className="space-y-2">
              <Button
                onClick={() => syncOrdersMutation.mutate()}
                disabled={syncingOrders || !isConnected}
                className="w-full"
                size="sm"
              >
                {syncingOrders ? (
                  <>
                    <Loader2 className="w-3 h-3 mr-2 animate-spin" />
                    Sync en cours...
                  </>
                ) : (
                  <>
                    <RefreshCw className="w-3 h-3 mr-2" />
                    Sync Commandes
                  </>
                )}
              </Button>
              <Button
                onClick={() => syncProductsMutation.mutate()}
                disabled={syncingProducts || !isConnected}
                variant="outline"
                className="w-full"
                size="sm"
              >
                {syncingProducts ? (
                  <>
                    <Loader2 className="w-3 h-3 mr-2 animate-spin" />
                    Sync en cours...
                  </>
                ) : (
                  <>
                    <RefreshCw className="w-3 h-3 mr-2" />
                    Sync Produits
                  </>
                )}
              </Button>
            </CardContent>
          </Card>
        </div>

        {!isConnected && !testingConnection && (
          <Alert variant="destructive">
            <AlertCircle className="h-4 w-4" />
            <AlertDescription>
              Impossible de se connecter à SendCloud. Vérifiez vos clés API dans les paramètres.
            </AlertDescription>
          </Alert>
        )}

        {/* Graphiques Analytics */}
        <SyncCharts />

        {/* Liste des jobs */}
        <SyncJobList />
      </div>
    </DashboardLayout>
  );
}
