import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { ScrollArea } from "@/components/ui/scroll-area";
import { CheckCircle2, XCircle, Clock } from "lucide-react";

interface Workflow {
  id: string;
  nom: string;
  description: string | null;
  webhook_url: string;
  config_json: any;
  actif: boolean;
  categorie: string | null;
  declencheur_auto: any;
  nombre_executions: number;
  derniere_execution: string | null;
  date_creation: string;
}

interface WorkflowDetailsDialogProps {
  workflow: Workflow;
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

export function WorkflowDetailsDialog({ workflow, open, onOpenChange }: WorkflowDetailsDialogProps) {
  // Fetch execution logs
  const { data: logs } = useQuery({
    queryKey: ['workflow-logs', workflow.id],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('n8n_execution_log')
        .select('*')
        .eq('workflow_id', workflow.id)
        .order('date_execution', { ascending: false })
        .limit(10);

      if (error) throw error;
      return data;
    },
    enabled: open,
  });

  const getStatusIcon = (statut: string) => {
    switch (statut) {
      case 'success':
        return <CheckCircle2 className="h-4 w-4 text-green-500" />;
      case 'error':
        return <XCircle className="h-4 w-4 text-red-500" />;
      case 'pending':
        return <Clock className="h-4 w-4 text-yellow-500" />;
      default:
        return null;
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-4xl max-h-[90vh]">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            {workflow.nom}
            <Badge variant={workflow.actif ? "default" : "secondary"}>
              {workflow.actif ? "Actif" : "Inactif"}
            </Badge>
          </DialogTitle>
          <DialogDescription>
            {workflow.description || 'Aucune description'}
          </DialogDescription>
        </DialogHeader>

        <ScrollArea className="h-[calc(90vh-8rem)]">
          <div className="space-y-4 pr-4">
            {/* Informations générales */}
            <Card>
              <CardHeader>
                <CardTitle className="text-lg">Informations générales</CardTitle>
              </CardHeader>
              <CardContent className="space-y-2 text-sm">
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <span className="text-muted-foreground">ID:</span>
                    <p className="font-mono text-xs break-all">{workflow.id}</p>
                  </div>
                  <div>
                    <span className="text-muted-foreground">Catégorie:</span>
                    <p>{workflow.categorie || 'Non définie'}</p>
                  </div>
                  <div>
                    <span className="text-muted-foreground">Nombre d'exécutions:</span>
                    <p className="font-semibold">{workflow.nombre_executions}</p>
                  </div>
                  <div>
                    <span className="text-muted-foreground">Dernière exécution:</span>
                    <p>
                      {workflow.derniere_execution 
                        ? new Date(workflow.derniere_execution).toLocaleString()
                        : 'Jamais exécuté'}
                    </p>
                  </div>
                  <div className="col-span-2">
                    <span className="text-muted-foreground">Webhook URL:</span>
                    <p className="font-mono text-xs break-all">{workflow.webhook_url}</p>
                  </div>
                </div>
              </CardContent>
            </Card>

            {/* Configuration JSON */}
            <Card>
              <CardHeader>
                <CardTitle className="text-lg">Configuration n8n</CardTitle>
                <CardDescription>Export JSON du workflow</CardDescription>
              </CardHeader>
              <CardContent>
                <pre className="text-xs bg-muted p-4 rounded-lg overflow-x-auto">
                  {JSON.stringify(workflow.config_json, null, 2)}
                </pre>
              </CardContent>
            </Card>

            {/* Déclencheur automatique */}
            {workflow.declencheur_auto && (
              <Card>
                <CardHeader>
                  <CardTitle className="text-lg">Déclencheur automatique</CardTitle>
                  <CardDescription>Conditions de déclenchement</CardDescription>
                </CardHeader>
                <CardContent>
                  <pre className="text-xs bg-muted p-4 rounded-lg overflow-x-auto">
                    {JSON.stringify(workflow.declencheur_auto, null, 2)}
                  </pre>
                </CardContent>
              </Card>
            )}

            {/* Historique d'exécution */}
            <Card>
              <CardHeader>
                <CardTitle className="text-lg">Historique d'exécution</CardTitle>
                <CardDescription>10 dernières exécutions</CardDescription>
              </CardHeader>
              <CardContent>
                {logs && logs.length > 0 ? (
                  <div className="space-y-2">
                    {logs.map((log) => (
                      <div 
                        key={log.id} 
                        className="flex items-center justify-between p-3 bg-muted rounded-lg"
                      >
                        <div className="flex items-center gap-3">
                          {getStatusIcon(log.statut)}
                          <div>
                            <p className="text-sm font-medium">
                              {new Date(log.date_execution).toLocaleString()}
                            </p>
                            <p className="text-xs text-muted-foreground">
                              Déclencheur: {log.declencheur} • Durée: {log.duree_ms}ms
                            </p>
                            {log.error_message && (
                              <p className="text-xs text-red-500 mt-1">
                                Erreur: {log.error_message}
                              </p>
                            )}
                          </div>
                        </div>
                        <Badge variant={log.statut === 'success' ? 'default' : 'destructive'}>
                          {log.statut}
                        </Badge>
                      </div>
                    ))}
                  </div>
                ) : (
                  <p className="text-sm text-muted-foreground text-center py-4">
                    Aucune exécution enregistrée
                  </p>
                )}
              </CardContent>
            </Card>
          </div>
        </ScrollArea>
      </DialogContent>
    </Dialog>
  );
}