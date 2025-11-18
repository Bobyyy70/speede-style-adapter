import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { DashboardLayout } from "@/components/DashboardLayout";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Plus, Play, Trash2, Eye } from "lucide-react";
import { toast } from "sonner";
import { ImportWorkflowDialog } from "@/components/ImportWorkflowDialog";
import { WorkflowDetailsDialog } from "@/components/WorkflowDetailsDialog";

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

export default function Workflows() {
  const [importDialogOpen, setImportDialogOpen] = useState(false);
  const [detailsDialogOpen, setDetailsDialogOpen] = useState(false);
  const [selectedWorkflow, setSelectedWorkflow] = useState<Workflow | null>(null);
  const queryClient = useQueryClient();

  // Fetch workflows
  const { data: workflows, isLoading } = useQuery({
    queryKey: ['n8n-workflows'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('n8n_workflows')
        .select('*')
        .order('date_creation', { ascending: false });

      if (error) throw error;
      return data as Workflow[];
    },
  });

  // Toggle workflow active status
  const toggleActiveMutation = useMutation({
    mutationFn: async ({ id, actif }: { id: string; actif: boolean }) => {
      const { error } = await supabase
        .from('n8n_workflows')
        .update({ actif: !actif })
        .eq('id', id);

      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['n8n-workflows'] });
      toast.success('Statut du workflow mis à jour');
    },
    onError: (error: any) => {
      toast.error(`Erreur: ${error.message}`);
    },
  });

  // Delete workflow
  const deleteMutation = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase
        .from('n8n_workflows')
        .delete()
        .eq('id', id);

      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['n8n-workflows'] });
      toast.success('Workflow supprimé');
    },
    onError: (error: any) => {
      toast.error(`Erreur: ${error.message}`);
    },
  });

  // Execute workflow
  const executeMutation = useMutation({
    mutationFn: async (workflow: Workflow) => {
      // Note: Authentication is handled automatically via Supabase auth token
      // No need to send API key from frontend (security improvement)
      const { data } = await supabase.functions.invoke('n8n-gateway', {
        body: {
          action: 'execute',
          workflow_id: workflow.id,
          payload: { test: true, timestamp: new Date().toISOString() },
        },
      });

      return data;
    },
    onSuccess: () => {
      toast.success('Workflow déclenché avec succès');
      queryClient.invalidateQueries({ queryKey: ['n8n-workflows'] });
    },
    onError: (error: any) => {
      toast.error(`Erreur d'exécution: ${error.message}`);
    },
  });

  const handleViewDetails = (workflow: Workflow) => {
    setSelectedWorkflow(workflow);
    setDetailsDialogOpen(true);
  };

  if (isLoading) {
    return (
      <DashboardLayout>
        <div className="flex items-center justify-center h-96">
          <div className="text-muted-foreground">Chargement des workflows...</div>
        </div>
      </DashboardLayout>
    );
  }

  return (
    <DashboardLayout>
      <div className="space-y-6">
        <div className="flex justify-between items-center">
          <div>
            <h1 className="text-3xl font-bold">Workflows n8n</h1>
            <p className="text-muted-foreground mt-1">
              Gérez vos workflows d'automatisation n8n dynamiques
            </p>
          </div>
          <Button onClick={() => setImportDialogOpen(true)}>
            <Plus className="mr-2 h-4 w-4" />
            Importer un workflow
          </Button>
        </div>

        <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
          {workflows?.map((workflow) => (
            <Card key={workflow.id} className="relative">
              <CardHeader>
                <div className="flex items-start justify-between">
                  <div className="space-y-1">
                    <CardTitle className="text-lg">{workflow.nom}</CardTitle>
                    <CardDescription className="line-clamp-2">
                      {workflow.description || 'Aucune description'}
                    </CardDescription>
                  </div>
                  <Badge variant={workflow.actif ? "default" : "secondary"}>
                    {workflow.actif ? "Actif" : "Inactif"}
                  </Badge>
                </div>
              </CardHeader>
              <CardContent className="space-y-4">
                {workflow.categorie && (
                  <Badge variant="outline" className="mr-2">
                    {workflow.categorie}
                  </Badge>
                )}
                
                <div className="text-sm text-muted-foreground space-y-1">
                  <div className="flex justify-between">
                    <span>Exécutions:</span>
                    <span className="font-medium">{workflow.nombre_executions}</span>
                  </div>
                  {workflow.derniere_execution && (
                    <div className="flex justify-between">
                      <span>Dernière exécution:</span>
                      <span className="font-medium">
                        {new Date(workflow.derniere_execution).toLocaleDateString()}
                      </span>
                    </div>
                  )}
                </div>

                <div className="flex gap-2 pt-2">
                  <Button
                    size="sm"
                    variant="outline"
                    className="flex-1"
                    onClick={() => handleViewDetails(workflow)}
                  >
                    <Eye className="h-4 w-4 mr-1" />
                    Détails
                  </Button>
                  <Button
                    size="sm"
                    variant="outline"
                    onClick={() => executeMutation.mutate(workflow)}
                    disabled={!workflow.actif || executeMutation.isPending}
                  >
                    <Play className="h-4 w-4" />
                  </Button>
                  <Button
                    size="sm"
                    variant="outline"
                    onClick={() => toggleActiveMutation.mutate({ id: workflow.id, actif: workflow.actif })}
                  >
                    {workflow.actif ? 'Désactiver' : 'Activer'}
                  </Button>
                  <Button
                    size="sm"
                    variant="destructive"
                    onClick={() => {
                      if (confirm('Êtes-vous sûr de vouloir supprimer ce workflow ?')) {
                        deleteMutation.mutate(workflow.id);
                      }
                    }}
                  >
                    <Trash2 className="h-4 w-4" />
                  </Button>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>

        {workflows?.length === 0 && (
          <Card>
            <CardContent className="py-12 text-center">
              <p className="text-muted-foreground mb-4">
                Aucun workflow configuré. Importez votre premier workflow n8n pour commencer.
              </p>
              <Button onClick={() => setImportDialogOpen(true)}>
                <Plus className="mr-2 h-4 w-4" />
                Importer un workflow
              </Button>
            </CardContent>
          </Card>
        )}
      </div>

      <ImportWorkflowDialog 
        open={importDialogOpen} 
        onOpenChange={setImportDialogOpen} 
      />

      {selectedWorkflow && (
        <WorkflowDetailsDialog
          workflow={selectedWorkflow}
          open={detailsDialogOpen}
          onOpenChange={setDetailsDialogOpen}
        />
      )}
    </DashboardLayout>
  );
}