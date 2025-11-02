import { DashboardLayout } from "@/components/DashboardLayout";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { supabase } from "@/integrations/supabase/client";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useAuth } from "@/hooks/useAuth";
import { Plus, Trash2, Loader2, AlertCircle } from "lucide-react";
import { toast } from "sonner";
import { useState } from "react";
import { Switch } from "@/components/ui/switch";

const ReglesExpediteur = () => {
  const { user, getViewingClientId } = useAuth();
  const queryClient = useQueryClient();
  const [open, setOpen] = useState(false);
  const [nomRegle, setNomRegle] = useState("");
  const [conditionType, setConditionType] = useState("nom_client_contient");
  const [conditionValue, setConditionValue] = useState("");
  const [configExpediteurId, setConfigExpediteurId] = useState("");
  const [priorite, setPriorite] = useState(100);

  const clientId = getViewingClientId();

  // Récupérer les règles
  const { data: regles, isLoading } = useQuery({
    queryKey: ["regles-expediteur", clientId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("regle_expediteur_automatique")
        .select(`
          *,
          configuration_expediteur:configuration_expediteur_id (
            id,
            nom,
            entreprise
          )
        `)
        .eq("client_id", clientId!)
        .order("priorite", { ascending: false });

      if (error) throw error;
      return data;
    },
    enabled: !!clientId,
  });

  // Récupérer les configs expéditeur disponibles
  const { data: configsExpediteur } = useQuery({
    queryKey: ["configurations-expediteur", clientId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("configuration_expediteur")
        .select("id, nom, entreprise")
        .eq("client_id", clientId!)
        .eq("actif", true);

      if (error) throw error;
      return data;
    },
    enabled: !!clientId,
  });

  // Créer une règle
  const createMutation = useMutation({
    mutationFn: async () => {
      if (!nomRegle || !conditionValue || !configExpediteurId) {
        throw new Error("Tous les champs sont requis");
      }

      const { error } = await supabase
        .from("regle_expediteur_automatique")
        .insert({
          client_id: clientId!,
          nom_regle: nomRegle,
          condition_type: conditionType,
          condition_value: conditionValue,
          configuration_expediteur_id: configExpediteurId,
          priorite,
          actif: true,
        });

      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["regles-expediteur"] });
      toast.success("Règle créée avec succès");
      setOpen(false);
      setNomRegle("");
      setConditionValue("");
      setConfigExpediteurId("");
      setPriorite(100);
    },
    onError: (error: any) => {
      toast.error("Erreur lors de la création", { description: error.message });
    },
  });

  // Désactiver une règle
  const toggleMutation = useMutation({
    mutationFn: async ({ regleId, actif }: { regleId: string; actif: boolean }) => {
      const { error } = await supabase
        .from("regle_expediteur_automatique")
        .update({ actif })
        .eq("id", regleId);

      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["regles-expediteur"] });
      toast.success("Règle mise à jour");
    },
  });

  // Supprimer une règle
  const deleteMutation = useMutation({
    mutationFn: async (regleId: string) => {
      const { error } = await supabase
        .from("regle_expediteur_automatique")
        .delete()
        .eq("id", regleId);

      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["regles-expediteur"] });
      toast.success("Règle supprimée");
    },
  });

  const getConditionLabel = (type: string) => {
    const labels: Record<string, string> = {
      nom_client_exact: "Nom client exact",
      nom_client_contient: "Nom client contient",
      tags_commande: "Tags commande",
      sous_client_exact: "Sous-client exact",
    };
    return labels[type] || type;
  };

  return (
    <DashboardLayout>
      <div className="space-y-6">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-3xl font-bold tracking-tight">Règles Expéditeur Automatiques</h1>
            <p className="text-muted-foreground mt-1">
              Configurez des règles pour appliquer automatiquement la bonne configuration expéditeur
            </p>
          </div>
          <Dialog open={open} onOpenChange={setOpen}>
            <DialogTrigger asChild>
              <Button>
                <Plus className="h-4 w-4 mr-2" />
                Nouvelle Règle
              </Button>
            </DialogTrigger>
            <DialogContent className="sm:max-w-[500px]">
              <DialogHeader>
                <DialogTitle>Créer une Règle Expéditeur</DialogTitle>
                <DialogDescription>
                  La règle s'appliquera automatiquement lors de la création ou synchronisation de commandes
                </DialogDescription>
              </DialogHeader>
              <div className="space-y-4 py-4">
                <div className="space-y-2">
                  <Label htmlFor="nom-regle">Nom de la règle</Label>
                  <Input
                    id="nom-regle"
                    placeholder="Ex: Règle Eddy"
                    value={nomRegle}
                    onChange={(e) => setNomRegle(e.target.value)}
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="condition-type">Type de condition</Label>
                  <Select value={conditionType} onValueChange={setConditionType}>
                    <SelectTrigger id="condition-type">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="nom_client_exact">Nom client exact</SelectItem>
                      <SelectItem value="nom_client_contient">Nom client contient</SelectItem>
                      <SelectItem value="tags_commande">Tags commande</SelectItem>
                      <SelectItem value="sous_client_exact">Sous-client exact</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
                <div className="space-y-2">
                  <Label htmlFor="condition-value">Valeur de la condition</Label>
                  <Input
                    id="condition-value"
                    placeholder="Ex: Eddy"
                    value={conditionValue}
                    onChange={(e) => setConditionValue(e.target.value)}
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="config-expediteur">Configuration Expéditeur</Label>
                  <Select value={configExpediteurId} onValueChange={setConfigExpediteurId}>
                    <SelectTrigger id="config-expediteur">
                      <SelectValue placeholder="Sélectionner une configuration" />
                    </SelectTrigger>
                    <SelectContent>
                      {configsExpediteur?.map((config: any) => (
                        <SelectItem key={config.id} value={config.id}>
                          {config.entreprise} - {config.nom}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
                <div className="space-y-2">
                  <Label htmlFor="priorite">Priorité (plus élevé = prioritaire)</Label>
                  <Input
                    id="priorite"
                    type="number"
                    value={priorite}
                    onChange={(e) => setPriorite(parseInt(e.target.value))}
                  />
                </div>
              </div>
              <DialogFooter>
                <Button variant="outline" onClick={() => setOpen(false)}>
                  Annuler
                </Button>
                <Button onClick={() => createMutation.mutate()} disabled={createMutation.isPending}>
                  {createMutation.isPending && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                  Créer
                </Button>
              </DialogFooter>
            </DialogContent>
          </Dialog>
        </div>

        <Card>
          <CardHeader>
            <CardTitle>Règles Configurées</CardTitle>
            <CardDescription>
              Les règles sont évaluées par priorité décroissante. La première qui matche est appliquée.
            </CardDescription>
          </CardHeader>
          <CardContent>
            {isLoading ? (
              <div className="flex items-center justify-center py-8">
                <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
              </div>
            ) : regles && regles.length > 0 ? (
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Nom Règle</TableHead>
                    <TableHead>Condition</TableHead>
                    <TableHead>Valeur</TableHead>
                    <TableHead>Config Expéditeur</TableHead>
                    <TableHead>Priorité</TableHead>
                    <TableHead>Actif</TableHead>
                    <TableHead className="text-right">Actions</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {regles.map((regle: any) => (
                    <TableRow key={regle.id}>
                      <TableCell className="font-medium">{regle.nom_regle}</TableCell>
                      <TableCell>
                        <Badge variant="outline">{getConditionLabel(regle.condition_type)}</Badge>
                      </TableCell>
                      <TableCell className="font-mono text-sm">{regle.condition_value}</TableCell>
                      <TableCell>{regle.configuration_expediteur?.entreprise || "-"}</TableCell>
                      <TableCell>
                        <Badge variant="secondary">{regle.priorite}</Badge>
                      </TableCell>
                      <TableCell>
                        <Switch
                          checked={regle.actif}
                          onCheckedChange={(checked) =>
                            toggleMutation.mutate({ regleId: regle.id, actif: checked })
                          }
                        />
                      </TableCell>
                      <TableCell className="text-right">
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={() => deleteMutation.mutate(regle.id)}
                        >
                          <Trash2 className="h-4 w-4 text-destructive" />
                        </Button>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            ) : (
              <div className="text-center py-8">
                <AlertCircle className="mx-auto h-12 w-12 text-muted-foreground mb-4" />
                <p className="text-muted-foreground">Aucune règle configurée</p>
                <p className="text-sm text-muted-foreground mt-1">
                  Créez votre première règle pour automatiser la sélection d'expéditeur
                </p>
              </div>
            )}
          </CardContent>
        </Card>
      </div>
    </DashboardLayout>
  );
};

export default ReglesExpediteur;
