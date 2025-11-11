import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { DashboardLayout } from "@/components/DashboardLayout";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { toast } from "sonner";
import { 
  TrendingUp, TrendingDown, AlertTriangle, CheckCircle2, 
  Brain, Sparkles, Clock, Target, BarChart3, 
  RefreshCw, Bell, AlertCircle, Activity,
  ArrowUp, ArrowDown, Minus
} from "lucide-react";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Progress } from "@/components/ui/progress";
import { Separator } from "@/components/ui/separator";
import { LineChart, Line, AreaChart, Area, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer } from "recharts";

export default function ScoringPredictif() {
  const queryClient = useQueryClient();
  const [selectedTransporteur, setSelectedTransporteur] = useState<string | null>(null);
  const [predictionLoading, setPredictionLoading] = useState(false);

  // Fetch dashboard data
  const { data: dashboardData, isLoading } = useQuery({
    queryKey: ["dashboard-predictions"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("dashboard_predictions_transporteurs" as any)
        .select("*")
        .order("score_global_predit", { ascending: false, nullsFirst: false });
      if (error) throw error;
      return data as any[];
    },
  });

  // Fetch active alerts
  const { data: alertes } = useQuery({
    queryKey: ["alertes-performance"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("alerte_performance_transporteur" as any)
        .select("*")
        .eq("traitee", false)
        .order("date_creation", { ascending: false });
      if (error) throw error;
      return data as any[];
    },
  });

  // Fetch prediction history for chart
  const { data: predictionHistory } = useQuery({
    queryKey: ["prediction-history", selectedTransporteur],
    queryFn: async () => {
      if (!selectedTransporteur) return [];
      const { data, error } = await supabase
        .from("prediction_performance_transporteur" as any)
        .select("*")
        .eq("transporteur_id", selectedTransporteur)
        .order("date_prediction", { ascending: true })
        .limit(30);
      if (error) throw error;
      return data as any[];
    },
    enabled: !!selectedTransporteur,
  });

  // Run prediction mutation
  const runPredictionMutation = useMutation({
    mutationFn: async (transporteurId: string) => {
      setPredictionLoading(true);
      const { data, error } = await supabase.functions.invoke("predict-carrier-performance", {
        body: { transporteur_id: transporteurId, periode_jours: 30 },
      });

      if (error) throw error;
      
      if (data?.status === 429) {
        throw new Error("Limite de requêtes atteinte. Réessayez plus tard.");
      }
      if (data?.status === 402) {
        throw new Error("Crédit épuisé. Ajoutez des crédits à votre workspace.");
      }
      
      return data;
    },
    onSuccess: (data) => {
      queryClient.invalidateQueries({ queryKey: ["dashboard-predictions"] });
      queryClient.invalidateQueries({ queryKey: ["alertes-performance"] });
      queryClient.invalidateQueries({ queryKey: ["prediction-history"] });
      
      toast.success(
        data.alerte_creee 
          ? `Prédiction générée avec alerte: ${data.message_alerte}`
          : "Prédiction générée avec succès"
      );
      setPredictionLoading(false);
    },
    onError: (error: any) => {
      toast.error("Erreur: " + error.message);
      setPredictionLoading(false);
    },
  });

  // Mark alert as treated
  const traitAlertMutation = useMutation({
    mutationFn: async (alerteId: string) => {
      const { error } = await supabase
        .from("alerte_performance_transporteur" as any)
        .update({ traitee: true, date_traitement: new Date().toISOString() })
        .eq("id", alerteId);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["alertes-performance"] });
      toast.success("Alerte marquée comme traitée");
    },
  });

  const getScoreBadge = (score: number | null) => {
    if (!score) return <Badge variant="outline">N/A</Badge>;
    if (score >= 80) return <Badge variant="default" className="bg-green-600">{score.toFixed(0)}</Badge>;
    if (score >= 60) return <Badge variant="secondary">{score.toFixed(0)}</Badge>;
    return <Badge variant="destructive">{score.toFixed(0)}</Badge>;
  };

  const getAlerteBadge = (niveau: string) => {
    const config: Record<string, any> = {
      critique: { icon: AlertTriangle, variant: "destructive", label: "CRITIQUE" },
      moyenne: { icon: AlertCircle, variant: "default", label: "Moyenne" },
      faible: { icon: Bell, variant: "secondary", label: "Faible" },
      aucune: { icon: CheckCircle2, variant: "outline", label: "Aucune" },
    };
    const { icon: Icon, variant, label } = config[niveau] || config.aucune;
    return (
      <Badge variant={variant}>
        <Icon className="h-3 w-3 mr-1" />
        {label}
      </Badge>
    );
  };

  const getTrendIcon = (variation: number | null) => {
    if (!variation) return <Minus className="h-4 w-4 text-muted-foreground" />;
    if (variation > 5) return <ArrowUp className="h-4 w-4 text-green-600" />;
    if (variation < -5) return <ArrowDown className="h-4 w-4 text-red-600" />;
    return <Minus className="h-4 w-4 text-yellow-600" />;
  };

  const chartData = predictionHistory?.map((pred: any) => ({
    date: new Date(pred.date_prediction).toLocaleDateString('fr-FR', { day: 'numeric', month: 'short' }),
    global: pred.score_global_predit,
    delai: pred.score_delai_predit,
    fiabilite: pred.score_fiabilite_predit,
    cout: pred.score_cout_predit,
  })) || [];

  return (
    <DashboardLayout>
      <div className="space-y-6">
        {/* Header */}
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-3xl font-bold flex items-center gap-2">
              <Brain className="h-8 w-8" />
              Scoring Prédictif Transporteurs
            </h1>
            <p className="text-muted-foreground mt-1">
              Prédictions IA basées sur tendances saisonnières et performances récentes
            </p>
          </div>
          <Button
            onClick={() => {
              if (dashboardData && dashboardData.length > 0) {
                dashboardData.forEach(t => {
                  if (t.transporteur_id) {
                    setTimeout(() => runPredictionMutation.mutate(t.transporteur_id), Math.random() * 2000);
                  }
                });
              }
            }}
            disabled={predictionLoading}
          >
            <RefreshCw className={`h-4 w-4 mr-2 ${predictionLoading ? 'animate-spin' : ''}`} />
            Actualiser Toutes les Prédictions
          </Button>
        </div>

        {/* Critical Alerts */}
        {alertes && alertes.filter((a: any) => a.niveau_severite === 'critical').length > 0 && (
          <Alert variant="destructive">
            <AlertTriangle className="h-4 w-4" />
            <AlertTitle>Alertes Critiques Détectées</AlertTitle>
            <AlertDescription>
              {alertes.filter((a: any) => a.niveau_severite === 'critical').length} transporteur(s) nécessitent une attention immédiate
            </AlertDescription>
          </Alert>
        )}

        {/* Stats Cards */}
        <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-sm font-medium flex items-center gap-2">
                <Target className="h-4 w-4" />
                Transporteurs Suivis
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">{dashboardData?.length || 0}</div>
              <p className="text-xs text-muted-foreground mt-1">
                {dashboardData?.filter((d: any) => d.score_global_predit >= 80).length || 0} avec score excellent
              </p>
            </CardContent>
          </Card>
          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-sm font-medium flex items-center gap-2">
                <AlertTriangle className="h-4 w-4" />
                Alertes Actives
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold text-orange-600">
                {alertes?.filter((a: any) => !a.traitee).length || 0}
              </div>
              <p className="text-xs text-muted-foreground mt-1">
                {alertes?.filter((a: any) => a.niveau_severite === 'critical').length || 0} critiques
              </p>
            </CardContent>
          </Card>
          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-sm font-medium flex items-center gap-2">
                <TrendingUp className="h-4 w-4" />
                Score Moyen Prédit
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">
                {dashboardData && dashboardData.length > 0
                  ? (
                      dashboardData.reduce((sum: number, d: any) => sum + (d.score_global_predit || 0), 0) /
                      dashboardData.filter((d: any) => d.score_global_predit).length
                    ).toFixed(0)
                  : "N/A"}
              </div>
              <p className="text-xs text-muted-foreground mt-1">Sur 100</p>
            </CardContent>
          </Card>
          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-sm font-medium flex items-center gap-2">
                <Activity className="h-4 w-4" />
                Confiance Moyenne
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">
                {dashboardData && dashboardData.length > 0
                  ? (
                      (dashboardData.reduce((sum: number, d: any) => sum + (d.confiance_prediction || 0), 0) /
                      dashboardData.filter((d: any) => d.confiance_prediction).length) * 100
                    ).toFixed(0)
                  : "N/A"}
                %
              </div>
              <p className="text-xs text-muted-foreground mt-1">Fiabilité IA</p>
            </CardContent>
          </Card>
        </div>

        {/* Main Content */}
        <Tabs defaultValue="predictions" className="space-y-4">
          <TabsList>
            <TabsTrigger value="predictions">Prédictions</TabsTrigger>
            <TabsTrigger value="alertes">
              Alertes
              {alertes && alertes.length > 0 && (
                <Badge variant="destructive" className="ml-2">
                  {alertes.length}
                </Badge>
              )}
            </TabsTrigger>
            <TabsTrigger value="historique">Historique</TabsTrigger>
          </TabsList>

          <TabsContent value="predictions" className="space-y-4">
            <Card>
              <CardHeader>
                <CardTitle>Scores Prédictifs par Transporteur</CardTitle>
                <CardDescription>
                  Prédictions IA pour les 30 prochains jours
                </CardDescription>
              </CardHeader>
              <CardContent>
                {isLoading ? (
                  <div className="text-center py-8 text-muted-foreground">Chargement...</div>
                ) : dashboardData && dashboardData.length > 0 ? (
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead>Transporteur</TableHead>
                        <TableHead>Score Global</TableHead>
                        <TableHead>Délai</TableHead>
                        <TableHead>Fiabilité</TableHead>
                        <TableHead>Coût</TableHead>
                        <TableHead>Variation</TableHead>
                        <TableHead>Alerte</TableHead>
                        <TableHead>Confiance</TableHead>
                        <TableHead>Actions</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {dashboardData.map((item: any) => (
                        <TableRow key={item.transporteur_id}>
                          <TableCell>
                            <div>
                              <div className="font-medium">{item.nom_affichage}</div>
                              <div className="text-sm text-muted-foreground">{item.code_service}</div>
                            </div>
                          </TableCell>
                          <TableCell>
                            <div className="flex items-center gap-2">
                              {getScoreBadge(item.score_global_predit)}
                              {getTrendIcon(item.variation_score)}
                            </div>
                          </TableCell>
                          <TableCell>{getScoreBadge(item.score_delai_predit)}</TableCell>
                          <TableCell>{getScoreBadge(item.score_fiabilite_predit)}</TableCell>
                          <TableCell>
                            <Badge variant="outline">N/A</Badge>
                          </TableCell>
                          <TableCell>
                            {item.variation_score !== null ? (
                              <Badge variant={item.variation_score > 0 ? "default" : "destructive"}>
                                {item.variation_score > 0 ? "+" : ""}
                                {item.variation_score.toFixed(1)}
                              </Badge>
                            ) : (
                              <Badge variant="outline">-</Badge>
                            )}
                          </TableCell>
                          <TableCell>
                            {getAlerteBadge(item.niveau_alerte || "aucune")}
                            {item.alertes_non_traitees > 0 && (
                              <Badge variant="destructive" className="ml-1">
                                {item.alertes_non_traitees}
                              </Badge>
                            )}
                          </TableCell>
                          <TableCell>
                            {item.confiance_prediction ? (
                              <div className="space-y-1">
                                <Progress value={item.confiance_prediction * 100} className="h-2" />
                                <span className="text-xs text-muted-foreground">
                                  {(item.confiance_prediction * 100).toFixed(0)}%
                                </span>
                              </div>
                            ) : (
                              "N/A"
                            )}
                          </TableCell>
                          <TableCell>
                            <div className="flex gap-1">
                              <Button
                                size="sm"
                                variant="ghost"
                                onClick={() => {
                                  setSelectedTransporteur(item.transporteur_id);
                                  runPredictionMutation.mutate(item.transporteur_id);
                                }}
                                disabled={predictionLoading}
                              >
                                <RefreshCw className={`h-3 w-3 ${predictionLoading ? 'animate-spin' : ''}`} />
                              </Button>
                              <Button
                                size="sm"
                                variant="ghost"
                                onClick={() => setSelectedTransporteur(item.transporteur_id)}
                              >
                                <BarChart3 className="h-3 w-3" />
                              </Button>
                            </div>
                          </TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                ) : (
                  <div className="text-center py-12">
                    <Brain className="h-12 w-12 mx-auto text-muted-foreground mb-4" />
                    <h3 className="text-lg font-medium mb-2">Aucune prédiction disponible</h3>
                    <p className="text-muted-foreground mb-4">
                      Lancez votre première analyse prédictive
                    </p>
                  </div>
                )}
              </CardContent>
            </Card>

            {/* Chart */}
            {selectedTransporteur && chartData.length > 0 && (
              <Card>
                <CardHeader>
                  <CardTitle>Évolution des Scores Prédictifs</CardTitle>
                  <CardDescription>
                    Historique des 30 dernières prédictions
                  </CardDescription>
                </CardHeader>
                <CardContent>
                  <ResponsiveContainer width="100%" height={300}>
                    <AreaChart data={chartData}>
                      <CartesianGrid strokeDasharray="3 3" />
                      <XAxis dataKey="date" />
                      <YAxis domain={[0, 100]} />
                      <Tooltip />
                      <Legend />
                      <Area
                        type="monotone"
                        dataKey="global"
                        stackId="1"
                        stroke="#8884d8"
                        fill="#8884d8"
                        fillOpacity={0.6}
                        name="Score Global"
                      />
                      <Area
                        type="monotone"
                        dataKey="fiabilite"
                        stackId="2"
                        stroke="#82ca9d"
                        fill="#82ca9d"
                        fillOpacity={0.6}
                        name="Fiabilité"
                      />
                      <Area
                        type="monotone"
                        dataKey="delai"
                        stackId="3"
                        stroke="#ffc658"
                        fill="#ffc658"
                        fillOpacity={0.6}
                        name="Délai"
                      />
                    </AreaChart>
                  </ResponsiveContainer>
                </CardContent>
              </Card>
            )}
          </TabsContent>

          <TabsContent value="alertes" className="space-y-4">
            <Card>
              <CardHeader>
                <CardTitle>Alertes de Dégradation</CardTitle>
                <CardDescription>
                  Dégradations de qualité détectées par l'IA
                </CardDescription>
              </CardHeader>
              <CardContent>
                {alertes && alertes.length > 0 ? (
                  <div className="space-y-4">
                    {alertes.map((alerte: any) => (
                      <Alert
                        key={alerte.id}
                        variant={alerte.niveau_severite === 'critical' ? 'destructive' : 'default'}
                      >
                        <AlertTriangle className="h-4 w-4" />
                        <AlertTitle className="flex items-center justify-between">
                          <span>{alerte.type_alerte}</span>
                          {getAlerteBadge(alerte.niveau_severite)}
                        </AlertTitle>
                        <AlertDescription className="space-y-2">
                          <p>{alerte.message}</p>
                          {alerte.recommandation && (
                            <div className="mt-2 p-2 bg-muted rounded text-sm">
                              <strong>Recommandation:</strong> {alerte.recommandation}
                            </div>
                          )}
                          {alerte.score_avant && alerte.score_apres && (
                            <div className="flex items-center gap-4 text-sm mt-2">
                              <span>Score avant: <strong>{alerte.score_avant.toFixed(1)}</strong></span>
                              <ArrowDown className="h-4 w-4" />
                              <span>Score après: <strong>{alerte.score_apres.toFixed(1)}</strong></span>
                              <Badge variant="destructive">
                                {alerte.variation.toFixed(1)} points
                              </Badge>
                            </div>
                          )}
                          <div className="flex justify-end gap-2 mt-3">
                            <Button
                              size="sm"
                              variant="outline"
                              onClick={() => traitAlertMutation.mutate(alerte.id)}
                            >
                              <CheckCircle2 className="h-3 w-3 mr-1" />
                              Marquer comme traitée
                            </Button>
                          </div>
                        </AlertDescription>
                      </Alert>
                    ))}
                  </div>
                ) : (
                  <div className="text-center py-12">
                    <CheckCircle2 className="h-12 w-12 mx-auto text-green-600 mb-4" />
                    <h3 className="text-lg font-medium mb-2">Aucune alerte active</h3>
                    <p className="text-muted-foreground">
                      Tous les transporteurs performent normalement
                    </p>
                  </div>
                )}
              </CardContent>
            </Card>
          </TabsContent>

          <TabsContent value="historique" className="space-y-4">
            <Card>
              <CardHeader>
                <CardTitle>Historique des Prédictions</CardTitle>
                <CardDescription>
                  Sélectionnez un transporteur pour voir son historique détaillé
                </CardDescription>
              </CardHeader>
              <CardContent>
                <p className="text-center text-muted-foreground py-8">
                  Utilisez le bouton graphique dans l'onglet Prédictions pour voir l'historique détaillé
                </p>
              </CardContent>
            </Card>
          </TabsContent>
        </Tabs>
      </div>
    </DashboardLayout>
  );
}
