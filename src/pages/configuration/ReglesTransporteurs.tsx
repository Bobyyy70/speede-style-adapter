import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { DashboardLayout } from "@/components/DashboardLayout";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Switch } from "@/components/ui/switch";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { toast } from "sonner";
import { Sparkles, Plus, TrendingUp, Target, DollarSign, Clock, BarChart3, AlertCircle, CheckCircle2, Zap, RefreshCw } from "lucide-react";
import { Separator } from "@/components/ui/separator";
import { Alert, AlertDescription } from "@/components/ui/alert";

export default function ReglesTransporteurs() {
  const queryClient = useQueryClient();
  const [openDialog, setOpenDialog] = useState(false);
  const [selectedRule, setSelectedRule] = useState<any>(null);
  const [aiLoading, setAiLoading] = useState(false);
  const [aiSuggestion, setAiSuggestion] = useState("");
  const [previewImpact, setPreviewImpact] = useState<any>(null);

  // Form state
  const [formData, setFormData] = useState({
    nom_regle: "",
    description: "",
    priorite: 100,
    actif: true,
    critere_principal: "cout",
    conditions: {
      poids_min_kg: 0,
      poids_max_kg: 30,
      pays_destination: [],
      delai_max_jours: 5,
      cout_max_euros: 50,
    },
  });

  // Fetch carrier rules
  const { data: rules, isLoading } = useQuery({
    queryKey: ["carrier-rules"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("regle_selection_transporteur" as any)
        .select("*")
        .order("priorite", { ascending: true });
      if (error) throw error;
      return data as any[];
    },
  });

  // Fetch carrier stats
  const { data: carrierStats } = useQuery({
    queryKey: ["carrier-stats"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("stats_performance_transporteur" as any)
        .select("*")
        .order("taux_succes", { ascending: false });
      if (error) throw error;
      return data as any[];
    },
  });

  // Fetch transporteurs
  const { data: transporteurs } = useQuery({
    queryKey: ["transporteur-services"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("transporteur_service")
        .select("*")
        .eq("actif", true);
      if (error) throw error;
      return data;
    },
  });

  // Create/Update rule mutation
  const saveMutation = useMutation({
    mutationFn: async (data: any) => {
      if (selectedRule) {
        const { error } = await supabase
          .from("regle_selection_transporteur" as any)
          .update(data)
          .eq("id", selectedRule.id);
        if (error) throw error;
      } else {
        const { error } = await supabase
          .from("regle_selection_transporteur" as any)
          .insert(data);
        if (error) throw error;
      }
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["carrier-rules"] });
      toast.success(selectedRule ? "Règle mise à jour" : "Règle créée");
      setOpenDialog(false);
      resetForm();
    },
    onError: (error: any) => {
      toast.error("Erreur: " + error.message);
    },
  });

  // Delete mutation
  const deleteMutation = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase
        .from("regle_selection_transporteur" as any)
        .delete()
        .eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["carrier-rules"] });
      toast.success("Règle supprimée");
    },
  });

  // Calculate performance mutation
  const calculatePerformanceMutation = useMutation({
    mutationFn: async (ruleId: string) => {
      const { data, error } = await supabase.rpc("calculer_score_performance_regle" as any, {
        p_regle_id: ruleId,
      });
      if (error) throw error;
      return data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["carrier-rules"] });
      toast.success("Score de performance recalculé");
    },
  });

  // AI Suggestions
  const getAISuggestions = async (type: "suggest" | "analyze" | "optimize", context?: any) => {
    setAiLoading(true);
    try {
      const { data, error } = await supabase.functions.invoke("suggest-carrier-rules", {
        body: { type, context },
      });

      if (error) throw error;

      if (data?.status === 429) {
        toast.error("Limite de requêtes atteinte. Réessayez plus tard.");
        return;
      }
      if (data?.status === 402) {
        toast.error("Crédit épuisé. Ajoutez des crédits à votre workspace.");
        return;
      }

      setAiSuggestion(data.suggestion);
      toast.success("Suggestions IA générées !");
    } catch (error: any) {
      console.error("AI Error:", error);
      toast.error("Erreur lors de la génération des suggestions");
    } finally {
      setAiLoading(false);
    }
  };

  const resetForm = () => {
    setFormData({
      nom_regle: "",
      description: "",
      priorite: 100,
      actif: true,
      critere_principal: "cout",
      conditions: {
        poids_min_kg: 0,
        poids_max_kg: 30,
        pays_destination: [],
        delai_max_jours: 5,
        cout_max_euros: 50,
      },
    });
    setSelectedRule(null);
    setAiSuggestion("");
    setPreviewImpact(null);
  };

  const handleEdit = (rule: any) => {
    setSelectedRule(rule);
    setFormData({
      nom_regle: rule.nom_regle,
      description: rule.description || "",
      priorite: rule.priorite,
      actif: rule.actif,
      critere_principal: rule.critere_principal,
      conditions: rule.conditions,
    });
    setOpenDialog(true);
  };

  const handleSave = () => {
    if (!formData.nom_regle) {
      toast.error("Le nom de la règle est requis");
      return;
    }
    saveMutation.mutate(formData);
  };

  const getCritereBadge = (critere: string) => {
    const badges: Record<string, { icon: any; label: string; variant: any }> = {
      cout: { icon: DollarSign, label: "Coût", variant: "default" },
      delai: { icon: Clock, label: "Délai", variant: "secondary" },
      performance: { icon: TrendingUp, label: "Performance", variant: "default" },
      eco: { icon: Target, label: "Écologique", variant: "outline" },
    };
    const config = badges[critere] || badges.cout;
    const Icon = config.icon;
    return (
      <Badge variant={config.variant}>
        <Icon className="h-3 w-3 mr-1" />
        {config.label}
      </Badge>
    );
  };

  return (
    <DashboardLayout>
      <div className="space-y-6">
        {/* Header */}
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-3xl font-bold">Règles Transporteurs Intelligentes</h1>
            <p className="text-muted-foreground mt-1">
              Configurez la sélection automatique des transporteurs avec suggestions IA
            </p>
          </div>
          <div className="flex gap-2">
            <Button
              variant="outline"
              onClick={() => getAISuggestions("analyze", { rules })}
              disabled={aiLoading}
            >
              <Sparkles className="h-4 w-4 mr-2" />
              Analyser avec IA
            </Button>
            <Dialog open={openDialog} onOpenChange={setOpenDialog}>
              <DialogTrigger asChild>
                <Button onClick={() => resetForm()}>
                  <Plus className="h-4 w-4 mr-2" />
                  Nouvelle Règle
                </Button>
              </DialogTrigger>
              <DialogContent className="max-w-3xl max-h-[90vh] overflow-y-auto">
                <DialogHeader>
                  <DialogTitle>
                    {selectedRule ? "Modifier la règle" : "Créer une règle"}
                  </DialogTitle>
                  <DialogDescription>
                    Définissez les conditions de sélection automatique du transporteur
                  </DialogDescription>
                </DialogHeader>

                <div className="space-y-4 py-4">
                  {/* AI Suggestion Button */}
                  <Button
                    variant="outline"
                    className="w-full"
                    onClick={() => getAISuggestions("suggest")}
                    disabled={aiLoading}
                  >
                    <Sparkles className="h-4 w-4 mr-2" />
                    {aiLoading ? "Génération..." : "Obtenir des suggestions IA"}
                  </Button>

                  {aiSuggestion && (
                    <Alert>
                      <Sparkles className="h-4 w-4" />
                      <AlertDescription className="whitespace-pre-wrap text-sm">
                        {aiSuggestion}
                      </AlertDescription>
                    </Alert>
                  )}

                  <Separator />

                  <div className="grid grid-cols-2 gap-4">
                    <div className="col-span-2">
                      <Label htmlFor="nom_regle">Nom de la règle *</Label>
                      <Input
                        id="nom_regle"
                        value={formData.nom_regle}
                        onChange={(e) =>
                          setFormData({ ...formData, nom_regle: e.target.value })
                        }
                        placeholder="Ex: Express Europe < 5kg"
                      />
                    </div>

                    <div className="col-span-2">
                      <Label htmlFor="description">Description</Label>
                      <Textarea
                        id="description"
                        value={formData.description}
                        onChange={(e) =>
                          setFormData({ ...formData, description: e.target.value })
                        }
                        placeholder="Décrivez la règle..."
                        rows={2}
                      />
                    </div>

                    <div>
                      <Label htmlFor="critere">Critère principal</Label>
                      <Select
                        value={formData.critere_principal}
                        onValueChange={(value) =>
                          setFormData({ ...formData, critere_principal: value })
                        }
                      >
                        <SelectTrigger>
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="cout">Coût optimal</SelectItem>
                          <SelectItem value="delai">Délai rapide</SelectItem>
                          <SelectItem value="performance">Performance</SelectItem>
                          <SelectItem value="eco">Écologique</SelectItem>
                        </SelectContent>
                      </Select>
                    </div>

                    <div>
                      <Label htmlFor="priorite">Priorité</Label>
                      <Input
                        id="priorite"
                        type="number"
                        value={formData.priorite}
                        onChange={(e) =>
                          setFormData({
                            ...formData,
                            priorite: parseInt(e.target.value) || 100,
                          })
                        }
                      />
                    </div>
                  </div>

                  <Separator />

                  <div className="space-y-3">
                    <h4 className="font-medium">Conditions</h4>
                    <div className="grid grid-cols-2 gap-4">
                      <div>
                        <Label>Poids min (kg)</Label>
                        <Input
                          type="number"
                          value={formData.conditions.poids_min_kg}
                          onChange={(e) =>
                            setFormData({
                              ...formData,
                              conditions: {
                                ...formData.conditions,
                                poids_min_kg: parseFloat(e.target.value) || 0,
                              },
                            })
                          }
                        />
                      </div>
                      <div>
                        <Label>Poids max (kg)</Label>
                        <Input
                          type="number"
                          value={formData.conditions.poids_max_kg}
                          onChange={(e) =>
                            setFormData({
                              ...formData,
                              conditions: {
                                ...formData.conditions,
                                poids_max_kg: parseFloat(e.target.value) || 30,
                              },
                            })
                          }
                        />
                      </div>
                      <div>
                        <Label>Délai max (jours)</Label>
                        <Input
                          type="number"
                          value={formData.conditions.delai_max_jours}
                          onChange={(e) =>
                            setFormData({
                              ...formData,
                              conditions: {
                                ...formData.conditions,
                                delai_max_jours: parseInt(e.target.value) || 5,
                              },
                            })
                          }
                        />
                      </div>
                      <div>
                        <Label>Coût max (€)</Label>
                        <Input
                          type="number"
                          value={formData.conditions.cout_max_euros}
                          onChange={(e) =>
                            setFormData({
                              ...formData,
                              conditions: {
                                ...formData.conditions,
                                cout_max_euros: parseFloat(e.target.value) || 50,
                              },
                            })
                          }
                        />
                      </div>
                    </div>
                  </div>

                  <div className="flex items-center justify-between">
                    <Label htmlFor="actif">Règle active</Label>
                    <Switch
                      id="actif"
                      checked={formData.actif}
                      onCheckedChange={(checked) =>
                        setFormData({ ...formData, actif: checked })
                      }
                    />
                  </div>
                </div>

                <div className="flex justify-end gap-2">
                  <Button variant="outline" onClick={() => setOpenDialog(false)}>
                    Annuler
                  </Button>
                  <Button onClick={handleSave} disabled={saveMutation.isPending}>
                    {saveMutation.isPending ? "Enregistrement..." : "Enregistrer"}
                  </Button>
                </div>
              </DialogContent>
            </Dialog>
          </div>
        </div>

        {/* Stats Cards */}
        <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-sm font-medium flex items-center gap-2">
                <Target className="h-4 w-4" />
                Règles Actives
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">
                {rules?.filter((r) => r.actif).length || 0}
              </div>
            </CardContent>
          </Card>
          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-sm font-medium flex items-center gap-2">
                <TrendingUp className="h-4 w-4" />
                Score Moyen
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">
                {rules && rules.length > 0
                  ? (
                      rules.reduce((sum, r) => sum + (r.score_performance || 0), 0) /
                      rules.length
                    ).toFixed(2)
                  : "N/A"}
              </div>
            </CardContent>
          </Card>
          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-sm font-medium flex items-center gap-2">
                <BarChart3 className="h-4 w-4" />
                Transporteurs
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">{carrierStats?.length || 0}</div>
            </CardContent>
          </Card>
          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-sm font-medium flex items-center gap-2">
                <CheckCircle2 className="h-4 w-4" />
                Taux Succès Moy.
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">
                {carrierStats && carrierStats.length > 0
                  ? (
                      carrierStats.reduce((sum, s) => sum + (s.taux_succes || 0), 0) /
                      carrierStats.length
                    ).toFixed(1)
                  : "0"}
                %
              </div>
            </CardContent>
          </Card>
        </div>

        {/* Main Content */}
        <Tabs defaultValue="rules" className="space-y-4">
          <TabsList>
            <TabsTrigger value="rules">Règles Configurées</TabsTrigger>
            <TabsTrigger value="performance">Performance Transporteurs</TabsTrigger>
          </TabsList>

          <TabsContent value="rules" className="space-y-4">
            <Card>
              <CardHeader>
                <CardTitle>Règles de Sélection</CardTitle>
                <CardDescription>
                  Gérez vos règles de sélection automatique des transporteurs
                </CardDescription>
              </CardHeader>
              <CardContent>
                {isLoading ? (
                  <div className="text-center py-8 text-muted-foreground">
                    Chargement...
                  </div>
                ) : rules && rules.length > 0 ? (
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead>Règle</TableHead>
                        <TableHead>Critère</TableHead>
                        <TableHead>Conditions</TableHead>
                        <TableHead>Score</TableHead>
                        <TableHead>Priorité</TableHead>
                        <TableHead>Statut</TableHead>
                        <TableHead>Actions</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {rules.map((rule) => (
                        <TableRow key={rule.id}>
                          <TableCell>
                            <div>
                              <div className="font-medium">{rule.nom_regle}</div>
                              {rule.description && (
                                <div className="text-sm text-muted-foreground">
                                  {rule.description}
                                </div>
                              )}
                            </div>
                          </TableCell>
                          <TableCell>{getCritereBadge(rule.critere_principal)}</TableCell>
                          <TableCell className="text-sm">
                            {rule.conditions.poids_min_kg}-{rule.conditions.poids_max_kg} kg
                            <br />
                            Max {rule.conditions.delai_max_jours}j, {rule.conditions.cout_max_euros}€
                          </TableCell>
                          <TableCell>
                            {rule.score_performance ? (
                              <Badge variant="outline">
                                {rule.score_performance.toFixed(2)}
                              </Badge>
                            ) : (
                              <Button
                                size="sm"
                                variant="ghost"
                                onClick={() =>
                                  calculatePerformanceMutation.mutate(rule.id)
                                }
                              >
                                <RefreshCw className="h-3 w-3" />
                              </Button>
                            )}
                          </TableCell>
                          <TableCell>{rule.priorite}</TableCell>
                          <TableCell>
                            {rule.actif ? (
                              <Badge variant="default">
                                <CheckCircle2 className="h-3 w-3 mr-1" />
                                Actif
                              </Badge>
                            ) : (
                              <Badge variant="secondary">
                                <AlertCircle className="h-3 w-3 mr-1" />
                                Inactif
                              </Badge>
                            )}
                          </TableCell>
                          <TableCell>
                            <div className="flex gap-1">
                              <Button
                                size="sm"
                                variant="ghost"
                                onClick={() => handleEdit(rule)}
                              >
                                Modifier
                              </Button>
                              <Button
                                size="sm"
                                variant="ghost"
                                onClick={() => {
                                  if (
                                    confirm("Supprimer cette règle ?")
                                  ) {
                                    deleteMutation.mutate(rule.id);
                                  }
                                }}
                              >
                                Supprimer
                              </Button>
                              <Button
                                size="sm"
                                variant="ghost"
                                onClick={() =>
                                  getAISuggestions("optimize", {
                                    rule,
                                    stats: carrierStats,
                                  })
                                }
                              >
                                <Zap className="h-3 w-3" />
                              </Button>
                            </div>
                          </TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                ) : (
                  <div className="text-center py-12">
                    <Target className="h-12 w-12 mx-auto text-muted-foreground mb-4" />
                    <h3 className="text-lg font-medium mb-2">Aucune règle configurée</h3>
                    <p className="text-muted-foreground mb-4">
                      Créez votre première règle de sélection de transporteur
                    </p>
                    <Button onClick={() => setOpenDialog(true)}>
                      <Plus className="h-4 w-4 mr-2" />
                      Créer une règle
                    </Button>
                  </div>
                )}
              </CardContent>
            </Card>
          </TabsContent>

          <TabsContent value="performance" className="space-y-4">
            <Card>
              <CardHeader>
                <CardTitle>Performance des Transporteurs</CardTitle>
                <CardDescription>
                  Statistiques sur 90 jours pour optimiser vos choix
                </CardDescription>
              </CardHeader>
              <CardContent>
                {carrierStats && carrierStats.length > 0 ? (
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead>Transporteur</TableHead>
                        <TableHead>Commandes</TableHead>
                        <TableHead>Taux Succès</TableHead>
                        <TableHead>Délai Moyen</TableHead>
                        <TableHead>Problèmes</TableHead>
                        <TableHead>Valeur Moy.</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {carrierStats.map((stat) => (
                        <TableRow key={stat.transporteur_id}>
                          <TableCell className="font-medium">
                            <div>{stat.nom_affichage}</div>
                            <div className="text-sm text-muted-foreground">
                              {stat.code_service}
                            </div>
                          </TableCell>
                          <TableCell>
                            {stat.nombre_commandes} ({stat.nombre_livrees} livrées)
                          </TableCell>
                          <TableCell>
                            <Badge
                              variant={
                                stat.taux_succes >= 90
                                  ? "default"
                                  : stat.taux_succes >= 75
                                  ? "secondary"
                                  : "destructive"
                              }
                            >
                              {stat.taux_succes?.toFixed(1)}%
                            </Badge>
                          </TableCell>
                          <TableCell>
                            {stat.delai_moyen_jours
                              ? `${stat.delai_moyen_jours.toFixed(1)} jours`
                              : "N/A"}
                          </TableCell>
                          <TableCell>
                            {stat.nombre_problemes > 0 ? (
                              <Badge variant="destructive">
                                <AlertCircle className="h-3 w-3 mr-1" />
                                {stat.nombre_problemes}
                              </Badge>
                            ) : (
                              <Badge variant="outline">0</Badge>
                            )}
                          </TableCell>
                          <TableCell>
                            {stat.valeur_moyenne_commande
                              ? `${stat.valeur_moyenne_commande.toFixed(2)}€`
                              : "N/A"}
                          </TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                ) : (
                  <div className="text-center py-8 text-muted-foreground">
                    Pas de données de performance disponibles
                  </div>
                )}
              </CardContent>
            </Card>
          </TabsContent>
        </Tabs>
      </div>
    </DashboardLayout>
  );
}
