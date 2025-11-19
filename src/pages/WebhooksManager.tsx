import { useState } from "react";
import { DashboardLayout } from "@/components/DashboardLayout";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { toast } from "sonner";
import {
  Webhook,
  CheckCircle2,
  XCircle,
  Clock,
  Activity,
  AlertTriangle,
  Code,
  Send,
  PlayCircle,
  Trash2,
  Copy,
  Eye,
  RefreshCw,
  Zap,
  Filter,
  Download,
} from "lucide-react";
import { Progress } from "@/components/ui/progress";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Separator } from "@/components/ui/separator";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";

interface WebhookEndpoint {
  id: string;
  name: string;
  url: string;
  events: string[];
  status: 'active' | 'inactive' | 'error';
  successRate: number;
  totalCalls: number;
  lastTriggered?: string;
  createdAt: string;
}

interface WebhookLog {
  id: string;
  endpointId: string;
  event: string;
  status: 'success' | 'failed' | 'pending';
  statusCode?: number;
  duration: number;
  timestamp: string;
  payload: any;
  response?: any;
  error?: string;
  retries: number;
}

export default function WebhooksManager() {
  const [selectedEndpoint, setSelectedEndpoint] = useState<WebhookEndpoint | null>(null);
  const [selectedLog, setSelectedLog] = useState<WebhookLog | null>(null);
  const [logDialogOpen, setLogDialogOpen] = useState(false);
  const [testDialogOpen, setTestDialogOpen] = useState(false);

  // Données simulées
  const endpoints: WebhookEndpoint[] = [
    {
      id: '1',
      name: 'Shopify → Commandes',
      url: 'https://api.example.com/webhooks/shopify/orders',
      events: ['order.created', 'order.updated', 'order.cancelled'],
      status: 'active',
      successRate: 99.2,
      totalCalls: 1245,
      lastTriggered: '2024-11-19T11:35:00',
      createdAt: '2024-01-15T10:00:00',
    },
    {
      id: '2',
      name: 'Amazon → Stock',
      url: 'https://api.example.com/webhooks/amazon/inventory',
      events: ['inventory.updated', 'inventory.low'],
      status: 'active',
      successRate: 97.8,
      totalCalls: 892,
      lastTriggered: '2024-11-19T11:20:00',
      createdAt: '2024-02-20T14:30:00',
    },
    {
      id: '3',
      name: 'Stripe → Paiements',
      url: 'https://api.example.com/webhooks/stripe/payments',
      events: ['payment.succeeded', 'payment.failed', 'refund.created'],
      status: 'active',
      successRate: 100,
      totalCalls: 2341,
      lastTriggered: '2024-11-19T11:32:00',
      createdAt: '2024-01-10T09:00:00',
    },
    {
      id: '4',
      name: 'SendCloud → Tracking',
      url: 'https://api.example.com/webhooks/sendcloud/tracking',
      events: ['parcel.shipped', 'parcel.delivered', 'parcel.exception'],
      status: 'error',
      successRate: 45.2,
      totalCalls: 156,
      lastTriggered: '2024-11-19T10:15:00',
      createdAt: '2024-03-05T16:00:00',
    },
    {
      id: '5',
      name: 'WooCommerce → Produits',
      url: 'https://api.example.com/webhooks/woocommerce/products',
      events: ['product.created', 'product.updated', 'product.deleted'],
      status: 'inactive',
      successRate: 0,
      totalCalls: 0,
      createdAt: '2024-11-18T12:00:00',
    },
  ];

  const logs: WebhookLog[] = [
    {
      id: '1',
      endpointId: '1',
      event: 'order.created',
      status: 'success',
      statusCode: 200,
      duration: 145,
      timestamp: '2024-11-19T11:35:00',
      payload: {
        order_id: 'CMD-2024-1245',
        customer: 'John Doe',
        total: 129.99,
        items: 3,
      },
      response: { success: true, id: 'webhook_123' },
      retries: 0,
    },
    {
      id: '2',
      endpointId: '3',
      event: 'payment.succeeded',
      status: 'success',
      statusCode: 200,
      duration: 89,
      timestamp: '2024-11-19T11:32:00',
      payload: {
        payment_id: 'pi_abc123',
        amount: 12999,
        currency: 'eur',
      },
      response: { success: true },
      retries: 0,
    },
    {
      id: '3',
      endpointId: '4',
      event: 'parcel.shipped',
      status: 'failed',
      statusCode: 500,
      duration: 5002,
      timestamp: '2024-11-19T10:15:00',
      payload: {
        tracking_number: '6A12345678901',
        carrier: 'Colissimo',
      },
      error: 'Connection timeout after 5000ms',
      retries: 3,
    },
    {
      id: '4',
      endpointId: '2',
      event: 'inventory.low',
      status: 'success',
      statusCode: 201,
      duration: 234,
      timestamp: '2024-11-19T11:20:00',
      payload: {
        product_sku: 'TSHIRT-001',
        quantity: 5,
        threshold: 10,
      },
      response: { success: true, alert_created: true },
      retries: 0,
    },
    {
      id: '5',
      endpointId: '1',
      event: 'order.updated',
      status: 'pending',
      duration: 0,
      timestamp: '2024-11-19T11:36:00',
      payload: {
        order_id: 'CMD-2024-1246',
        status: 'processing',
      },
      retries: 0,
    },
  ];

  const availableEvents = [
    'order.created',
    'order.updated',
    'order.cancelled',
    'order.fulfilled',
    'payment.succeeded',
    'payment.failed',
    'refund.created',
    'inventory.updated',
    'inventory.low',
    'product.created',
    'product.updated',
    'product.deleted',
    'parcel.shipped',
    'parcel.delivered',
    'parcel.exception',
    'customer.created',
    'customer.updated',
  ];

  const stats = {
    totalEndpoints: endpoints.length,
    active: endpoints.filter(e => e.status === 'active').length,
    totalCalls: endpoints.reduce((sum, e) => sum + e.totalCalls, 0),
    avgSuccessRate: endpoints.reduce((sum, e) => sum + e.successRate, 0) / endpoints.length,
    failedLast24h: logs.filter(l => l.status === 'failed').length,
  };

  const getStatusBadge = (status: string) => {
    switch (status) {
      case 'active':
        return <Badge className="bg-green-600"><CheckCircle2 className="h-3 w-3 mr-1" /> Actif</Badge>;
      case 'inactive':
        return <Badge variant="secondary"><Clock className="h-3 w-3 mr-1" /> Inactif</Badge>;
      case 'error':
        return <Badge variant="destructive"><XCircle className="h-3 w-3 mr-1" /> Erreur</Badge>;
      default:
        return null;
    }
  };

  const getLogStatusIcon = (status: string) => {
    switch (status) {
      case 'success':
        return <CheckCircle2 className="h-4 w-4 text-green-600" />;
      case 'failed':
        return <XCircle className="h-4 w-4 text-red-600" />;
      case 'pending':
        return <Clock className="h-4 w-4 text-yellow-600" />;
      default:
        return null;
    }
  };

  return (
    <DashboardLayout>
      <div className="space-y-6">
        {/* Header */}
        <div>
          <h1 className="text-3xl font-bold flex items-center gap-2">
            <Webhook className="h-8 w-8 text-primary" />
            Gestionnaire de Webhooks
          </h1>
          <p className="text-muted-foreground mt-1">
            Gérez les événements temps réel de toutes vos intégrations • Monitoring & Debugging
          </p>
        </div>

        {/* Stats */}
        <div className="grid gap-4 md:grid-cols-5">
          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-sm font-medium">Endpoints</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">{stats.totalEndpoints}</div>
              <p className="text-xs text-muted-foreground mt-1">
                {stats.active} actifs
              </p>
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-sm font-medium">Appels Totaux</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">{stats.totalCalls.toLocaleString()}</div>
              <p className="text-xs text-muted-foreground mt-1">
                Depuis création
              </p>
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-sm font-medium">Taux de Succès</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold text-green-600">{stats.avgSuccessRate.toFixed(1)}%</div>
              <Progress value={stats.avgSuccessRate} className="mt-2" />
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-sm font-medium">Échecs 24h</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold text-red-600">{stats.failedLast24h}</div>
              <p className="text-xs text-muted-foreground mt-1">
                À investiguer
              </p>
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-sm font-medium">Latence Moy.</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">145ms</div>
              <p className="text-xs text-muted-foreground mt-1">
                Temps réponse
              </p>
            </CardContent>
          </Card>
        </div>

        <Tabs defaultValue="endpoints" className="space-y-4">
          <TabsList>
            <TabsTrigger value="endpoints">Endpoints</TabsTrigger>
            <TabsTrigger value="logs">Logs</TabsTrigger>
            <TabsTrigger value="events">Événements</TabsTrigger>
          </TabsList>

          {/* Endpoints */}
          <TabsContent value="endpoints" className="space-y-4">
            <div className="flex gap-2">
              <Button>
                <Zap className="h-4 w-4 mr-2" />
                Nouveau Webhook
              </Button>
              <Button variant="outline">
                <Download className="h-4 w-4 mr-2" />
                Exporter Config
              </Button>
            </div>

            <div className="space-y-3">
              {endpoints.map((endpoint) => (
                <Card key={endpoint.id} className={endpoint.status === 'error' ? 'border-red-500' : ''}>
                  <CardContent className="pt-6">
                    <div className="space-y-4">
                      <div className="flex items-start justify-between">
                        <div className="flex-1">
                          <div className="flex items-center gap-3 mb-2">
                            <h3 className="font-semibold">{endpoint.name}</h3>
                            {getStatusBadge(endpoint.status)}
                          </div>
                          <div className="text-sm font-mono text-muted-foreground bg-gray-50 p-2 rounded">
                            {endpoint.url}
                          </div>
                        </div>
                      </div>

                      <div className="grid grid-cols-4 gap-4">
                        <div>
                          <div className="text-sm text-muted-foreground">Taux de succès</div>
                          <div className="text-2xl font-bold text-green-600">{endpoint.successRate}%</div>
                          <Progress value={endpoint.successRate} className="mt-1 h-2" />
                        </div>
                        <div>
                          <div className="text-sm text-muted-foreground">Appels totaux</div>
                          <div className="text-2xl font-bold">{endpoint.totalCalls}</div>
                        </div>
                        <div>
                          <div className="text-sm text-muted-foreground">Dernière trigger</div>
                          <div className="text-sm font-medium">
                            {endpoint.lastTriggered
                              ? new Date(endpoint.lastTriggered).toLocaleString('fr-FR')
                              : 'Jamais'}
                          </div>
                        </div>
                        <div>
                          <div className="text-sm text-muted-foreground">Créé le</div>
                          <div className="text-sm font-medium">
                            {new Date(endpoint.createdAt).toLocaleDateString('fr-FR')}
                          </div>
                        </div>
                      </div>

                      <div>
                        <div className="text-sm font-medium mb-2">Événements écoutés:</div>
                        <div className="flex flex-wrap gap-1">
                          {endpoint.events.map((event, idx) => (
                            <Badge key={idx} variant="outline" className="text-xs">
                              {event}
                            </Badge>
                          ))}
                        </div>
                      </div>

                      <Separator />

                      <div className="flex gap-2">
                        <Button
                          size="sm"
                          variant="outline"
                          onClick={() => {
                            setSelectedEndpoint(endpoint);
                            setTestDialogOpen(true);
                          }}
                        >
                          <PlayCircle className="h-4 w-4 mr-2" />
                          Tester
                        </Button>
                        <Button size="sm" variant="outline">
                          <Eye className="h-4 w-4 mr-2" />
                          Voir Logs
                        </Button>
                        <Button size="sm" variant="outline">
                          <Code className="h-4 w-4 mr-2" />
                          Configurer
                        </Button>
                        <Button size="sm" variant="outline">
                          <Copy className="h-4 w-4 mr-2" />
                          Copier URL
                        </Button>
                        {endpoint.status === 'active' ? (
                          <Button size="sm" variant="outline">
                            <Clock className="h-4 w-4 mr-2" />
                            Désactiver
                          </Button>
                        ) : (
                          <Button size="sm" variant="default">
                            <CheckCircle2 className="h-4 w-4 mr-2" />
                            Activer
                          </Button>
                        )}
                        <Button size="sm" variant="destructive">
                          <Trash2 className="h-4 w-4 mr-2" />
                          Supprimer
                        </Button>
                      </div>
                    </div>
                  </CardContent>
                </Card>
              ))}
            </div>
          </TabsContent>

          {/* Logs */}
          <TabsContent value="logs" className="space-y-4">
            <div className="flex gap-2">
              <Select defaultValue="all">
                <SelectTrigger className="w-48">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">Tous les statuts</SelectItem>
                  <SelectItem value="success">Succès uniquement</SelectItem>
                  <SelectItem value="failed">Échecs uniquement</SelectItem>
                  <SelectItem value="pending">En attente</SelectItem>
                </SelectContent>
              </Select>
              <Button variant="outline">
                <RefreshCw className="h-4 w-4 mr-2" />
                Actualiser
              </Button>
              <Button variant="outline">
                <Download className="h-4 w-4 mr-2" />
                Exporter
              </Button>
            </div>

            <Card>
              <CardContent className="p-0">
                <div className="divide-y">
                  {logs.map((log) => {
                    const endpoint = endpoints.find(e => e.id === log.endpointId);
                    return (
                      <div
                        key={log.id}
                        className="p-4 hover:bg-gray-50 cursor-pointer"
                        onClick={() => {
                          setSelectedLog(log);
                          setLogDialogOpen(true);
                        }}
                      >
                        <div className="flex items-start justify-between">
                          <div className="flex items-start gap-3 flex-1">
                            {getLogStatusIcon(log.status)}
                            <div className="flex-1">
                              <div className="flex items-center gap-2 mb-1">
                                <span className="font-semibold">{log.event}</span>
                                <Badge variant="outline" className="text-xs">
                                  {endpoint?.name}
                                </Badge>
                              </div>
                              <div className="text-sm text-muted-foreground">
                                {new Date(log.timestamp).toLocaleString('fr-FR')}
                              </div>
                              {log.error && (
                                <div className="text-sm text-red-600 mt-1 font-mono">
                                  {log.error}
                                </div>
                              )}
                            </div>
                          </div>
                          <div className="text-right">
                            {log.statusCode && (
                              <Badge
                                variant={log.statusCode >= 200 && log.statusCode < 300 ? 'default' : 'destructive'}
                              >
                                {log.statusCode}
                              </Badge>
                            )}
                            <div className="text-sm text-muted-foreground mt-1">
                              {log.duration}ms
                            </div>
                            {log.retries > 0 && (
                              <div className="text-xs text-yellow-600 mt-1">
                                {log.retries} retries
                              </div>
                            )}
                          </div>
                        </div>
                      </div>
                    );
                  })}
                </div>
              </CardContent>
            </Card>
          </TabsContent>

          {/* Événements */}
          <TabsContent value="events" className="space-y-4">
            <Card>
              <CardHeader>
                <CardTitle>Événements Disponibles</CardTitle>
                <CardDescription>
                  Liste complète des événements que vous pouvez écouter via webhooks
                </CardDescription>
              </CardHeader>
              <CardContent>
                <div className="grid gap-3 md:grid-cols-2">
                  {availableEvents.map((event) => (
                    <div key={event} className="p-3 border rounded-lg flex items-center justify-between">
                      <div className="flex items-center gap-2">
                        <Activity className="h-4 w-4 text-primary" />
                        <code className="text-sm font-mono">{event}</code>
                      </div>
                      <Button size="sm" variant="ghost">
                        <Code className="h-4 w-4 mr-2" />
                        Exemple
                      </Button>
                    </div>
                  ))}
                </div>
              </CardContent>
            </Card>
          </TabsContent>
        </Tabs>

        {/* Log Detail Dialog */}
        <Dialog open={logDialogOpen} onOpenChange={setLogDialogOpen}>
          <DialogContent className="max-w-3xl max-h-[80vh] overflow-y-auto">
            <DialogHeader>
              <DialogTitle>Détails du Webhook</DialogTitle>
              <DialogDescription>
                {selectedLog?.event} • {selectedLog?.timestamp && new Date(selectedLog.timestamp).toLocaleString('fr-FR')}
              </DialogDescription>
            </DialogHeader>
            {selectedLog && (
              <div className="space-y-4">
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <Label>Statut</Label>
                    <div className="mt-1">{getLogStatusIcon(selectedLog.status)}</div>
                  </div>
                  <div>
                    <Label>Code HTTP</Label>
                    <div className="mt-1 font-mono">{selectedLog.statusCode || 'N/A'}</div>
                  </div>
                  <div>
                    <Label>Durée</Label>
                    <div className="mt-1 font-mono">{selectedLog.duration}ms</div>
                  </div>
                  <div>
                    <Label>Retries</Label>
                    <div className="mt-1 font-mono">{selectedLog.retries}</div>
                  </div>
                </div>

                <Separator />

                <div>
                  <Label>Payload Envoyé</Label>
                  <pre className="mt-2 p-3 bg-gray-50 rounded text-xs overflow-auto max-h-40">
                    {JSON.stringify(selectedLog.payload, null, 2)}
                  </pre>
                </div>

                {selectedLog.response && (
                  <div>
                    <Label>Réponse Reçue</Label>
                    <pre className="mt-2 p-3 bg-gray-50 rounded text-xs overflow-auto max-h-40">
                      {JSON.stringify(selectedLog.response, null, 2)}
                    </pre>
                  </div>
                )}

                {selectedLog.error && (
                  <div>
                    <Label>Erreur</Label>
                    <div className="mt-2 p-3 bg-red-50 border border-red-200 rounded text-sm text-red-900 font-mono">
                      {selectedLog.error}
                    </div>
                  </div>
                )}

                <div className="flex gap-2">
                  <Button variant="outline" className="flex-1">
                    <Send className="h-4 w-4 mr-2" />
                    Renvoyer
                  </Button>
                  <Button variant="outline" className="flex-1">
                    <Copy className="h-4 w-4 mr-2" />
                    Copier JSON
                  </Button>
                </div>
              </div>
            )}
          </DialogContent>
        </Dialog>

        {/* Test Dialog */}
        <Dialog open={testDialogOpen} onOpenChange={setTestDialogOpen}>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>Tester le Webhook</DialogTitle>
              <DialogDescription>
                {selectedEndpoint?.name}
              </DialogDescription>
            </DialogHeader>
            <div className="space-y-4">
              <div>
                <Label>Événement</Label>
                <Select>
                  <SelectTrigger>
                    <SelectValue placeholder="Choisir un événement" />
                  </SelectTrigger>
                  <SelectContent>
                    {selectedEndpoint?.events.map((event) => (
                      <SelectItem key={event} value={event}>
                        {event}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              <div>
                <Label>Payload de test (JSON)</Label>
                <textarea
                  className="w-full h-32 p-2 border rounded font-mono text-xs"
                  defaultValue={JSON.stringify({ test: true, timestamp: new Date().toISOString() }, null, 2)}
                />
              </div>

              <Button
                className="w-full"
                onClick={() => {
                  toast.success('Webhook envoyé !', {
                    description: 'Vérifiez les logs pour le résultat'
                  });
                  setTestDialogOpen(false);
                }}
              >
                <Send className="h-4 w-4 mr-2" />
                Envoyer le Test
              </Button>
            </div>
          </DialogContent>
        </Dialog>
      </div>
    </DashboardLayout>
  );
}
