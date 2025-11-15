import { useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { toast } from "sonner";
import { CheckCircle, XCircle, AlertCircle, Clock, Eye, RotateCcw, Loader2 } from "lucide-react";
import { format } from "date-fns";
import { fr } from "date-fns/locale";

interface SyncLog {
  id: number;
  run_id: string;
  job: string;
  client_id: string | null;
  status: 'running' | 'success' | 'partial' | 'error';
  started_at: string;
  finished_at: string | null;
  batch_count: number;
  item_count: number;
  error_message: string | null;
  metadata: Record<string, any> | null;
}

const statusConfig = {
  running: { label: 'En cours', variant: 'default' as const, icon: Clock, color: 'text-blue-500' },
  success: { label: 'Succès', variant: 'default' as const, icon: CheckCircle, color: 'text-green-500' },
  partial: { label: 'Partiel', variant: 'secondary' as const, icon: AlertCircle, color: 'text-amber-500' },
  error: { label: 'Erreur', variant: 'destructive' as const, icon: XCircle, color: 'text-red-500' },
};

const jobLabels: Record<string, string> = {
  orders: 'Commandes',
  products: 'Produits',
  parcels: 'Colis',
  carriers: 'Transporteurs',
  shipping_methods: 'Méthodes Expédition',
};

export function SyncJobList() {
  const queryClient = useQueryClient();
  const [statusFilter, setStatusFilter] = useState<string>('all');
  const [jobFilter, setJobFilter] = useState<string>('all');
  const [selectedLog, setSelectedLog] = useState<SyncLog | null>(null);
  const [detailsOpen, setDetailsOpen] = useState(false);
  const [retrying, setRetrying] = useState<string | null>(null);

  const { data: syncLogs, isLoading } = useQuery({
    queryKey: ['sendcloud_sync_logs', statusFilter, jobFilter],
    queryFn: async () => {
      let query = supabase
        .from('sendcloud_sync_logs')
        .select('*')
        .order('started_at', { ascending: false })
        .limit(50);

      if (statusFilter !== 'all') {
        query = query.eq('status', statusFilter);
      }
      if (jobFilter !== 'all') {
        query = query.eq('job', jobFilter);
      }

      const { data, error } = await query;
      if (error) throw error;
      return data as SyncLog[];
    },
    refetchInterval: 10000, // Refresh toutes les 10s
  });

  const calculateDuration = (startedAt: string, finishedAt: string | null): number => {
    if (!finishedAt) return 0;
    return new Date(finishedAt).getTime() - new Date(startedAt).getTime();
  };

  const formatDuration = (ms: number): string => {
    if (ms === 0) return '-';
    if (ms < 1000) return `${ms}ms`;
    if (ms < 60000) return `${(ms / 1000).toFixed(1)}s`;
    return `${(ms / 60000).toFixed(1)}min`;
  };

  const handleRetry = async (log: SyncLog) => {
    setRetrying(log.run_id);
    try {
      let functionName = '';
      let params = {};

      switch (log.job) {
        case 'orders':
          functionName = 'sendcloud-sync-orders';
          params = { mode: 'manual', limit: 50 };
          break;
        case 'products':
          functionName = 'sendcloud-sync-products';
          params = { sync_all: true };
          break;
        default:
          throw new Error(`Job type ${log.job} non pris en charge pour retry`);
      }

      const { error } = await supabase.functions.invoke(functionName, { body: params });
      if (error) throw error;

      toast.success('Job relancé avec succès', {
        description: 'Actualisez dans quelques instants pour voir le résultat'
      });

      setTimeout(() => {
        queryClient.invalidateQueries({ queryKey: ['sendcloud_sync_logs'] });
      }, 3000);
    } catch (error: any) {
      toast.error('Erreur lors du retry', {
        description: error.message
      });
    } finally {
      setRetrying(null);
    }
  };

  const handleViewDetails = (log: SyncLog) => {
    setSelectedLog(log);
    setDetailsOpen(true);
  };

  return (
    <Card>
      <CardHeader>
        <div className="flex items-center justify-between">
          <CardTitle className="flex items-center gap-2">
            <Clock className="w-5 h-5" />
            Historique des Synchronisations
          </CardTitle>
          <div className="flex gap-2">
            <Select value={statusFilter} onValueChange={setStatusFilter}>
              <SelectTrigger className="w-[150px]">
                <SelectValue placeholder="Statut" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">Tous les statuts</SelectItem>
                <SelectItem value="running">En cours</SelectItem>
                <SelectItem value="success">Succès</SelectItem>
                <SelectItem value="partial">Partiel</SelectItem>
                <SelectItem value="error">Erreur</SelectItem>
              </SelectContent>
            </Select>

            <Select value={jobFilter} onValueChange={setJobFilter}>
              <SelectTrigger className="w-[180px]">
                <SelectValue placeholder="Type de job" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">Tous les jobs</SelectItem>
                <SelectItem value="orders">Commandes</SelectItem>
                <SelectItem value="products">Produits</SelectItem>
                <SelectItem value="carriers">Transporteurs</SelectItem>
                <SelectItem value="shipping_methods">Méthodes Expédition</SelectItem>
              </SelectContent>
            </Select>
          </div>
        </div>
      </CardHeader>
      <CardContent>
        {isLoading ? (
          <div className="flex items-center justify-center py-8">
            <Loader2 className="w-6 h-6 animate-spin text-muted-foreground" />
          </div>
        ) : syncLogs && syncLogs.length > 0 ? (
          <div className="rounded-md border">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Run ID</TableHead>
                  <TableHead>Job Type</TableHead>
                  <TableHead>Statut</TableHead>
                  <TableHead className="text-right">Items</TableHead>
                  <TableHead className="text-right">Batches</TableHead>
                  <TableHead className="text-right">Durée</TableHead>
                  <TableHead>Démarré</TableHead>
                  <TableHead className="text-right">Actions</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {syncLogs.map((log) => {
                  const config = statusConfig[log.status];
                  const StatusIcon = config.icon;
                  const duration = calculateDuration(log.started_at, log.finished_at);

                  return (
                    <TableRow key={log.id}>
                      <TableCell className="font-mono text-xs">
                        {log.run_id.substring(0, 8)}...
                      </TableCell>
                      <TableCell>{jobLabels[log.job] || log.job}</TableCell>
                      <TableCell>
                        <Badge variant={config.variant} className="gap-1">
                          <StatusIcon className={`w-3 h-3 ${config.color}`} />
                          {config.label}
                        </Badge>
                      </TableCell>
                      <TableCell className="text-right">{log.item_count || 0}</TableCell>
                      <TableCell className="text-right">{log.batch_count || 0}</TableCell>
                      <TableCell className="text-right">{formatDuration(duration)}</TableCell>
                      <TableCell className="text-sm">
                        {format(new Date(log.started_at), "Pp", { locale: fr })}
                      </TableCell>
                      <TableCell className="text-right">
                        <div className="flex gap-1 justify-end">
                          <Button
                            variant="ghost"
                            size="sm"
                            onClick={() => handleViewDetails(log)}
                          >
                            <Eye className="w-4 h-4" />
                          </Button>
                          {(log.status === 'error' || log.status === 'partial') && (
                            <Button
                              variant="ghost"
                              size="sm"
                              onClick={() => handleRetry(log)}
                              disabled={retrying === log.run_id}
                            >
                              {retrying === log.run_id ? (
                                <Loader2 className="w-4 h-4 animate-spin" />
                              ) : (
                                <RotateCcw className="w-4 h-4" />
                              )}
                            </Button>
                          )}
                        </div>
                      </TableCell>
                    </TableRow>
                  );
                })}
              </TableBody>
            </Table>
          </div>
        ) : (
          <div className="text-center py-8 text-muted-foreground">
            Aucune synchronisation trouvée
          </div>
        )}

        {/* Dialog de détails */}
        <Dialog open={detailsOpen} onOpenChange={setDetailsOpen}>
          <DialogContent className="max-w-2xl">
            <DialogHeader>
              <DialogTitle>Détails de la Synchronisation</DialogTitle>
              <DialogDescription>
                Run ID: {selectedLog?.run_id}
              </DialogDescription>
            </DialogHeader>
            {selectedLog && (
              <div className="space-y-4">
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <p className="text-sm font-medium">Job Type</p>
                    <p className="text-sm text-muted-foreground">{jobLabels[selectedLog.job]}</p>
                  </div>
                  <div>
                    <p className="text-sm font-medium">Statut</p>
                    <Badge variant={statusConfig[selectedLog.status].variant}>
                      {statusConfig[selectedLog.status].label}
                    </Badge>
                  </div>
                  <div>
                    <p className="text-sm font-medium">Items traités</p>
                    <p className="text-sm text-muted-foreground">{selectedLog.item_count || 0}</p>
                  </div>
                  <div>
                    <p className="text-sm font-medium">Nombre de batches</p>
                    <p className="text-sm text-muted-foreground">{selectedLog.batch_count || 0}</p>
                  </div>
                  <div>
                    <p className="text-sm font-medium">Démarré à</p>
                    <p className="text-sm text-muted-foreground">
                      {format(new Date(selectedLog.started_at), "Pp", { locale: fr })}
                    </p>
                  </div>
                  <div>
                    <p className="text-sm font-medium">Terminé à</p>
                    <p className="text-sm text-muted-foreground">
                      {selectedLog.finished_at 
                        ? format(new Date(selectedLog.finished_at), "Pp", { locale: fr })
                        : 'En cours...'}
                    </p>
                  </div>
                </div>

                {selectedLog.error_message && (
                  <div>
                    <p className="text-sm font-medium text-destructive mb-2">Message d'erreur</p>
                    <pre className="text-xs bg-muted p-3 rounded-md overflow-auto max-h-32">
                      {selectedLog.error_message}
                    </pre>
                  </div>
                )}

                {selectedLog.metadata && Object.keys(selectedLog.metadata).length > 0 && (
                  <div>
                    <p className="text-sm font-medium mb-2">Métadonnées</p>
                    <pre className="text-xs bg-muted p-3 rounded-md overflow-auto max-h-48">
                      {JSON.stringify(selectedLog.metadata, null, 2)}
                    </pre>
                  </div>
                )}
              </div>
            )}
          </DialogContent>
        </Dialog>
      </CardContent>
    </Card>
  );
}
