import { useState } from "react";
import { DashboardLayout } from "@/components/DashboardLayout";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { Play, RefreshCw, CheckCircle2, XCircle, AlertCircle, Package, Truck, Weight, User, FileText } from "lucide-react";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Badge } from "@/components/ui/badge";
import { Separator } from "@/components/ui/separator";
import { ScrollArea } from "@/components/ui/scroll-area";

interface EnrichmentLog {
  timestamp: string;
  level: 'info' | 'success' | 'error' | 'warning';
  message: string;
  details?: any;
}

export default function SendCloudEnrichmentTest() {
  const [testing, setTesting] = useState(false);
  const [logs, setLogs] = useState<EnrichmentLog[]>([]);
  const [syncResult, setSyncResult] = useState<any>(null);
  const [enrichedOrders, setEnrichedOrders] = useState<any[]>([]);

  const addLog = (level: EnrichmentLog['level'], message: string, details?: any) => {
    setLogs(prev => [...prev, {
      timestamp: new Date().toLocaleTimeString('fr-FR'),
      level,
      message,
      details
    }]);
  };

  const testEnrichment = async () => {
    setTesting(true);
    setLogs([]);
    setSyncResult(null);
    setEnrichedOrders([]);

    try {
      addLog('info', '🚀 Démarrage de la synchronisation enrichie SendCloud...');

      // Déclencher la sync (mode incremental = 5 dernières minutes)
      const { data, error } = await supabase.functions.invoke('sendcloud-sync-orders', {
        body: { mode: 'incremental' }
      });

      if (error) {
        addLog('error', '❌ Erreur lors de la synchronisation', error);
        toast.error('Erreur de synchronisation: ' + error.message);
        return;
      }

      addLog('success', '✅ Synchronisation terminée', data);
      setSyncResult(data);

      // Attendre un peu pour que les données soient disponibles
      await new Promise(resolve => setTimeout(resolve, 2000));

      // Récupérer les logs d'enrichissement
      addLog('info', '📊 Récupération des logs d\'enrichissement...');
      
      const { data: apiLogs } = await supabase
        .from('sendcloud_api_log')
        .select('*')
        .eq('details->>strategy', 'parcel_detail')
        .order('date_appel', { ascending: false })
        .limit(10);

      if (apiLogs && apiLogs.length > 0) {
        addLog('success', `✅ ${apiLogs.length} appels d'enrichissement trouvés`);
        apiLogs.forEach((log: any) => {
          const parcelId = log.details?.parcel_id;
          const status = log.statut_http === 200 ? '✅' : '⚠️';
          addLog('info', `${status} Parcel ${parcelId}: ${log.statut_http} (${log.duree_ms}ms)`);
        });
      } else {
        addLog('warning', '⚠️ Aucun log d\'enrichissement trouvé');
      }

      // Récupérer les commandes récemment créées avec données enrichies
      addLog('info', '🔍 Vérification des données enrichies...');
      
      const { data: orders } = await supabase
        .from('commande')
        .select('numero_commande, sendcloud_id, transporteur, methode_expedition, poids_reel_kg, expediteur_nom, expediteur_entreprise, date_creation')
        .eq('source', 'sendcloud')
        .order('date_creation', { ascending: false })
        .limit(5);

      if (orders) {
        setEnrichedOrders(orders);
        
        const enrichedCount = orders.filter(o => 
          o.transporteur || o.methode_expedition || o.poids_reel_kg
        ).length;

        if (enrichedCount > 0) {
          addLog('success', `✅ ${enrichedCount}/${orders.length} commandes ont des données enrichies`);
          
          orders.forEach((order: any) => {
            const hasData = order.transporteur || order.methode_expedition || order.poids_reel_kg;
            const icon = hasData ? '✅' : '❌';
            addLog('info', `${icon} ${order.numero_commande}: Transporteur=${order.transporteur || 'N/A'}, Poids=${order.poids_reel_kg || 'N/A'}kg`);
          });
        } else {
          addLog('warning', '⚠️ Aucune commande avec données enrichies trouvée');
          addLog('info', 'ℹ️ Cela peut signifier que les parcels n\'ont pas de données détaillées dans SendCloud');
        }
      }

      addLog('success', '🎉 Test terminé !');
      toast.success('Test d\'enrichissement terminé');

    } catch (err: any) {
      addLog('error', '❌ Erreur fatale', err);
      toast.error('Erreur: ' + err.message);
    } finally {
      setTesting(false);
    }
  };

  const getLevelColor = (level: EnrichmentLog['level']) => {
    switch (level) {
      case 'success': return 'text-green-600';
      case 'error': return 'text-red-600';
      case 'warning': return 'text-yellow-600';
      default: return 'text-gray-600';
    }
  };

  return (
    <DashboardLayout>
      <div className="space-y-6">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-3xl font-bold">Test Enrichissement SendCloud</h1>
            <p className="text-muted-foreground mt-2">
              Tester la récupération complète des données (transporteur, poids, expéditeur, produits)
            </p>
          </div>
          <Button 
            onClick={testEnrichment} 
            disabled={testing}
            size="lg"
            className="gap-2"
          >
            {testing ? (
              <>
                <RefreshCw className="h-4 w-4 animate-spin" />
                Test en cours...
              </>
            ) : (
              <>
                <Play className="h-4 w-4" />
                Lancer le test
              </>
            )}
          </Button>
        </div>

        <Alert>
          <AlertCircle className="h-4 w-4" />
          <AlertTitle>Comment ça marche ?</AlertTitle>
          <AlertDescription>
            Ce test déclenche une synchronisation SendCloud, puis vérifie que pour chaque parcel:
            <ul className="list-disc list-inside mt-2 space-y-1">
              <li>Un appel GET /parcels/&#123;id&#125; est fait pour récupérer les détails complets</li>
              <li>Les données carrier, shipment, weight, sender sont extraites</li>
              <li>Les commandes sont créées avec toutes ces informations</li>
            </ul>
          </AlertDescription>
        </Alert>

        {/* Résultat de la sync */}
        {syncResult && (
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                {syncResult.success ? (
                  <CheckCircle2 className="h-5 w-5 text-green-500" />
                ) : (
                  <XCircle className="h-5 w-5 text-red-500" />
                )}
                Résultat de la synchronisation
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="grid grid-cols-4 gap-4">
                <div className="space-y-1">
                  <p className="text-sm text-muted-foreground">Trouvées</p>
                  <p className="text-2xl font-bold">{syncResult.found || 0}</p>
                </div>
                <div className="space-y-1">
                  <p className="text-sm text-muted-foreground">Créées</p>
                  <p className="text-2xl font-bold text-green-600">{syncResult.created || 0}</p>
                </div>
                <div className="space-y-1">
                  <p className="text-sm text-muted-foreground">Existantes</p>
                  <p className="text-2xl font-bold text-blue-600">{syncResult.existing || 0}</p>
                </div>
                <div className="space-y-1">
                  <p className="text-sm text-muted-foreground">Erreurs</p>
                  <p className="text-2xl font-bold text-red-600">{syncResult.errors || 0}</p>
                </div>
              </div>
              
              <Separator />
              
              <div className="space-y-2">
                <p className="text-sm">
                  <span className="font-medium">Stratégie:</span> {syncResult.strategy}
                </p>
                <p className="text-sm">
                  <span className="font-medium">Mode:</span> {syncResult.mode}
                </p>
                {syncResult.message && (
                  <p className="text-sm text-muted-foreground">{syncResult.message}</p>
                )}
              </div>
            </CardContent>
          </Card>
        )}

        {/* Logs en temps réel */}
        {logs.length > 0 && (
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <FileText className="h-5 w-5" />
                Logs d'exécution
              </CardTitle>
              <CardDescription>
                Détail des étapes d'enrichissement
              </CardDescription>
            </CardHeader>
            <CardContent>
              <ScrollArea className="h-[400px] w-full rounded-md border p-4">
                <div className="space-y-2 font-mono text-sm">
                  {logs.map((log, idx) => (
                    <div key={idx} className={getLevelColor(log.level)}>
                      <span className="text-muted-foreground">[{log.timestamp}]</span>{' '}
                      {log.message}
                      {log.details && (
                        <pre className="mt-1 text-xs text-muted-foreground overflow-x-auto">
                          {JSON.stringify(log.details, null, 2)}
                        </pre>
                      )}
                    </div>
                  ))}
                </div>
              </ScrollArea>
            </CardContent>
          </Card>
        )}

        {/* Commandes enrichies */}
        {enrichedOrders.length > 0 && (
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Package className="h-5 w-5" />
                Commandes récentes (vérification enrichissement)
              </CardTitle>
              <CardDescription>
                Vérification des données transporteur, poids, expéditeur
              </CardDescription>
            </CardHeader>
            <CardContent>
              <div className="space-y-4">
                {enrichedOrders.map((order, idx) => {
                  const isEnriched = order.transporteur || order.methode_expedition || order.poids_reel_kg;
                  
                  return (
                    <div key={idx} className="border rounded-lg p-4 space-y-3">
                      <div className="flex items-center justify-between">
                        <div className="flex items-center gap-3">
                          <h3 className="font-semibold">{order.numero_commande}</h3>
                          <Badge variant={isEnriched ? "default" : "secondary"}>
                            {isEnriched ? "✅ Enrichie" : "❌ Non enrichie"}
                          </Badge>
                        </div>
                        <span className="text-sm text-muted-foreground">
                          SendCloud ID: {order.sendcloud_id}
                        </span>
                      </div>
                      
                      <div className="grid grid-cols-2 md:grid-cols-4 gap-4 text-sm">
                        <div className="flex items-center gap-2">
                          <Truck className="h-4 w-4 text-muted-foreground" />
                          <div>
                            <p className="text-muted-foreground">Transporteur</p>
                            <p className="font-medium">{order.transporteur || '—'}</p>
                          </div>
                        </div>
                        
                        <div className="flex items-center gap-2">
                          <Package className="h-4 w-4 text-muted-foreground" />
                          <div>
                            <p className="text-muted-foreground">Service</p>
                            <p className="font-medium">{order.methode_expedition || '—'}</p>
                          </div>
                        </div>
                        
                        <div className="flex items-center gap-2">
                          <Weight className="h-4 w-4 text-muted-foreground" />
                          <div>
                            <p className="text-muted-foreground">Poids</p>
                            <p className="font-medium">
                              {order.poids_reel_kg ? `${order.poids_reel_kg} kg` : '—'}
                            </p>
                          </div>
                        </div>
                        
                        <div className="flex items-center gap-2">
                          <User className="h-4 w-4 text-muted-foreground" />
                          <div>
                            <p className="text-muted-foreground">Expéditeur</p>
                            <p className="font-medium">{order.expediteur_entreprise || '—'}</p>
                          </div>
                        </div>
                      </div>
                    </div>
                  );
                })}
              </div>
            </CardContent>
          </Card>
        )}
      </div>
    </DashboardLayout>
  );
}
