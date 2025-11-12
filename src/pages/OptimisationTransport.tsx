import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { DashboardLayout } from "@/components/DashboardLayout";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { Badge } from "@/components/ui/badge";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { toast } from "sonner";
import { 
  AlertTriangle, 
  TrendingDown, 
  Package, 
  Settings, 
  CheckCircle2, 
  Clock,
  Lightbulb,
  DollarSign
} from "lucide-react";
import { format } from "date-fns";
import { fr } from "date-fns/locale";

interface AlerteConfig {
  id: string;
  seuil_ecart_pourcentage: number;
  seuil_poids_minimum_kg: number;
  actif: boolean;
  notification_email: boolean;
  emails_notification: string[];
  description: string;
}

interface Alerte {
  id: string;
  commande_id: string;
  numero_commande: string;
  client_id: string;
  poids_reel_kg: number;
  poids_volumetrique_kg: number;
  ecart_kg: number;
  ecart_pourcentage: number;
  transporteur_code: string;
  facteur_division_utilise: number;
  recommandations: any[];
  statut: string;
  date_creation: string;
  client?: { nom: string };
}

export default function OptimisationTransport() {
  const queryClient = useQueryClient();
  const [editingConfig, setEditingConfig] = useState(false);
  const [configForm, setConfigForm] = useState<Partial<AlerteConfig>>({});

  // Charger la config
  const { data: config, isLoading: loadingConfig } = useQuery({
    queryKey: ["alerte-config"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("alerte_poids_volumetrique_config")
        .select("*")
        .order("date_creation", { ascending: false })
        .limit(1)
        .single();

      if (error) throw error;
      return data as AlerteConfig;
    },
  });

  // Charger les alertes
  const { data: alertes, isLoading: loadingAlertes } = useQuery({
    queryKey: ["alertes-poids"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("alerte_poids_volumetrique")
        .select("*")
        .order("date_creation", { ascending: false })
        .limit(100);

      if (error) throw error;
      return data as Alerte[];
    },
  });

  // Sauvegarder config
  const saveConfigMutation = useMutation({
    mutationFn: async (newConfig: Partial<AlerteConfig>) => {
      if (!config?.id) {
        const { error } = await supabase
          .from("alerte_poids_volumetrique_config")
          .insert([newConfig]);
        if (error) throw error;
      } else {
        const { error } = await supabase
          .from("alerte_poids_volumetrique_config")
          .update({ ...newConfig, date_modification: new Date().toISOString() })
          .eq("id", config.id);
        if (error) throw error;
      }
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["alerte-config"] });
      toast.success("Configuration enregistrée");
      setEditingConfig(false);
    },
    onError: (error: any) => {
      toast.error("Erreur lors de l'enregistrement");
      console.error(error);
    },
  });

  // Marquer alerte comme traitée
  const traiterAlerteMutation = useMutation({
    mutationFn: async ({ alerteId, notes }: { alerteId: string; notes?: string }) => {
      const { error } = await supabase
        .from("alerte_poids_volumetrique")
        .update({
          statut: "traite",
          date_traitement: new Date().toISOString(),
          notes_traitement: notes,
        })
        .eq("id", alerteId);

      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["alertes-poids"] });
      toast.success("Alerte marquée comme traitée");
    },
  });

  const handleSaveConfig = () => {
    saveConfigMutation.mutate(configForm);
  };

  const startEditConfig = () => {
    setConfigForm(config || {});
    setEditingConfig(true);
  };

  const getPriorityColor = (priorite: string) => {
    switch (priorite) {
      case "haute":
        return "destructive";
      case "moyenne":
        return "default";
      case "basse":
        return "secondary";
      default:
        return "outline";
    }
  };

  const getStatutBadge = (statut: string) => {
    switch (statut) {
      case "nouveau":
        return <Badge variant="destructive">Nouveau</Badge>;
      case "en_cours":
        return <Badge variant="default">En cours</Badge>;
      case "traite":
        return <Badge variant="secondary">Traité</Badge>;
      default:
        return <Badge variant="outline">{statut}</Badge>;
    }
  };

  const alertesNouvelles = alertes?.filter(a => a.statut === "nouveau") || [];
  const alertesEnCours = alertes?.filter(a => a.statut === "en_cours") || [];
  const alertesTraitees = alertes?.filter(a => a.statut === "traite") || [];

  const economiesPotentielles = alertesNouvelles.reduce((sum, alerte) => {
    const recommandations = alerte.recommandations || [];
    const ecoEmballage = recommandations.find((r: any) => r.type === "emballage");
    return sum + (ecoEmballage?.economies_estimees_pct || 0);
  }, 0);

  return (
    <DashboardLayout>
      <div className="space-y-6">
        {/* Header avec stats */}
        <div>
          <h1 className="text-3xl font-bold">Optimisation Transport</h1>
          <p className="text-muted-foreground mt-2">
            Alertes automatiques et recommandations pour réduire les coûts de transport
          </p>
        </div>

        {/* KPIs */}
        <div className="grid gap-4 md:grid-cols-4">
          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-sm font-medium text-muted-foreground">
                Alertes Actives
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">{alertesNouvelles.length}</div>
              <p className="text-xs text-muted-foreground mt-1">
                À traiter
              </p>
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-sm font-medium text-muted-foreground">
                En Cours
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">{alertesEnCours.length}</div>
              <p className="text-xs text-muted-foreground mt-1">
                En traitement
              </p>
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-sm font-medium text-muted-foreground">
                Traitées ce mois
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">{alertesTraitees.length}</div>
              <p className="text-xs text-muted-foreground mt-1">
                Optimisations appliquées
              </p>
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-sm font-medium text-muted-foreground flex items-center gap-2">
                <DollarSign className="h-4 w-4" />
                Économies Potentielles
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">~{economiesPotentielles.toFixed(0)}%</div>
              <p className="text-xs text-muted-foreground mt-1">
                Sur alertes actives
              </p>
            </CardContent>
          </Card>
        </div>

        <Tabs defaultValue="alertes" className="space-y-4">
          <TabsList>
            <TabsTrigger value="alertes">
              <AlertTriangle className="h-4 w-4 mr-2" />
              Alertes
            </TabsTrigger>
            <TabsTrigger value="config">
              <Settings className="h-4 w-4 mr-2" />
              Configuration
            </TabsTrigger>
          </TabsList>

          <TabsContent value="alertes" className="space-y-4">
            {loadingAlertes ? (
              <Card>
                <CardContent className="py-8 text-center text-muted-foreground">
                  Chargement des alertes...
                </CardContent>
              </Card>
            ) : alertesNouvelles.length === 0 ? (
              <Card>
                <CardContent className="py-8 text-center">
                  <CheckCircle2 className="h-12 w-12 mx-auto mb-4 text-muted-foreground opacity-50" />
                  <p className="text-muted-foreground">
                    Aucune alerte active. Tous vos emballages sont optimisés !
                  </p>
                </CardContent>
              </Card>
            ) : (
              <div className="space-y-4">
                {alertesNouvelles.map((alerte) => (
                  <Card key={alerte.id} className="border-l-4 border-l-destructive">
                    <CardHeader>
                      <div className="flex items-start justify-between">
                        <div className="space-y-1">
                          <CardTitle className="text-lg flex items-center gap-2">
                            <Package className="h-5 w-5" />
                            Commande {alerte.numero_commande}
                          </CardTitle>
                          <CardDescription>
                            {format(new Date(alerte.date_creation), "d MMM yyyy 'à' HH:mm", { locale: fr })}
                          </CardDescription>
                        </div>
                        <div className="flex items-center gap-2">
                          {getStatutBadge(alerte.statut)}
                          <Badge variant="outline" className="font-mono">
                            {alerte.ecart_pourcentage.toFixed(1)}%
                          </Badge>
                        </div>
                      </div>
                    </CardHeader>
                    <CardContent className="space-y-4">
                      {/* Détails poids */}
                      <Alert>
                        <TrendingDown className="h-4 w-4" />
                        <AlertDescription>
                          <div className="grid grid-cols-3 gap-4 text-sm">
                            <div>
                              <span className="font-medium">Poids réel:</span>
                              <p className="text-lg font-bold">{alerte.poids_reel_kg} kg</p>
                            </div>
                            <div>
                              <span className="font-medium">Poids volumétrique:</span>
                              <p className="text-lg font-bold text-destructive">
                                {alerte.poids_volumetrique_kg} kg
                              </p>
                            </div>
                            <div>
                              <span className="font-medium">Surcoût:</span>
                              <p className="text-lg font-bold">+{alerte.ecart_kg.toFixed(2)} kg</p>
                              <p className="text-xs text-muted-foreground">
                                Facteur: {alerte.facteur_division_utilise}
                              </p>
                            </div>
                          </div>
                        </AlertDescription>
                      </Alert>

                      {/* Recommandations */}
                      {alerte.recommandations && alerte.recommandations.length > 0 && (
                        <div className="space-y-2">
                          <h4 className="font-semibold text-sm flex items-center gap-2">
                            <Lightbulb className="h-4 w-4" />
                            Recommandations d'optimisation
                          </h4>
                          <div className="space-y-2">
                            {alerte.recommandations.map((reco: any, idx: number) => (
                              <Card key={idx} className="bg-muted/50">
                                <CardContent className="p-4">
                                  <div className="flex items-start gap-3">
                                    <Badge variant={getPriorityColor(reco.priorite)}>
                                      {reco.priorite}
                                    </Badge>
                                    <div className="flex-1 space-y-1">
                                      <p className="font-medium text-sm">{reco.titre}</p>
                                      <p className="text-xs text-muted-foreground">
                                        {reco.description}
                                      </p>
                                      {reco.action && (
                                        <p className="text-xs font-medium text-primary">
                                          💡 {reco.action}
                                        </p>
                                      )}
                                      {reco.economies_estimees_pct && (
                                        <p className="text-xs font-bold text-green-600">
                                          💰 Économies estimées: ~{reco.economies_estimees_pct}%
                                        </p>
                                      )}
                                    </div>
                                  </div>
                                </CardContent>
                              </Card>
                            ))}
                          </div>
                        </div>
                      )}

                      {/* Actions */}
                      <div className="flex gap-2">
                        <Button
                          size="sm"
                          onClick={() => traiterAlerteMutation.mutate({ alerteId: alerte.id })}
                        >
                          <CheckCircle2 className="h-4 w-4 mr-2" />
                          Marquer comme traité
                        </Button>
                        <Button size="sm" variant="outline">
                          Voir la commande
                        </Button>
                      </div>
                    </CardContent>
                  </Card>
                ))}
              </div>
            )}
          </TabsContent>

          <TabsContent value="config">
            <Card>
              <CardHeader>
                <CardTitle>Configuration des Alertes</CardTitle>
                <CardDescription>
                  Paramétrez les seuils et conditions de déclenchement des alertes d'optimisation
                </CardDescription>
              </CardHeader>
              <CardContent className="space-y-6">
                {loadingConfig ? (
                  <div className="text-center py-8 text-muted-foreground">
                    Chargement de la configuration...
                  </div>
                ) : editingConfig ? (
                  <div className="space-y-4">
                    <div className="grid gap-4 md:grid-cols-2">
                      <div className="space-y-2">
                        <Label>Seuil d'écart (%)</Label>
                        <Input
                          type="number"
                          value={configForm.seuil_ecart_pourcentage || 20}
                          onChange={(e) =>
                            setConfigForm({
                              ...configForm,
                              seuil_ecart_pourcentage: parseFloat(e.target.value),
                            })
                          }
                          min="1"
                          max="100"
                          step="0.1"
                        />
                        <p className="text-xs text-muted-foreground">
                          Alerte si poids volumétrique dépasse le réel de plus de X%
                        </p>
                      </div>

                      <div className="space-y-2">
                        <Label>Poids minimum (kg)</Label>
                        <Input
                          type="number"
                          value={configForm.seuil_poids_minimum_kg || 1}
                          onChange={(e) =>
                            setConfigForm({
                              ...configForm,
                              seuil_poids_minimum_kg: parseFloat(e.target.value),
                            })
                          }
                          min="0"
                          step="0.1"
                        />
                        <p className="text-xs text-muted-foreground">
                          Ne pas alerter pour les colis trop légers
                        </p>
                      </div>
                    </div>

                    <div className="flex items-center justify-between">
                      <div className="space-y-1">
                        <Label>Activer les alertes</Label>
                        <p className="text-xs text-muted-foreground">
                          Génération automatique des alertes
                        </p>
                      </div>
                      <Switch
                        checked={configForm.actif ?? true}
                        onCheckedChange={(checked) =>
                          setConfigForm({ ...configForm, actif: checked })
                        }
                      />
                    </div>

                    <div className="flex gap-2">
                      <Button onClick={handleSaveConfig} disabled={saveConfigMutation.isPending}>
                        Enregistrer
                      </Button>
                      <Button variant="outline" onClick={() => setEditingConfig(false)}>
                        Annuler
                      </Button>
                    </div>
                  </div>
                ) : (
                  <div className="space-y-4">
                    <div className="grid gap-4 md:grid-cols-2">
                      <div className="space-y-1">
                        <p className="text-sm font-medium">Seuil d'écart</p>
                        <p className="text-2xl font-bold">{config?.seuil_ecart_pourcentage}%</p>
                      </div>
                      <div className="space-y-1">
                        <p className="text-sm font-medium">Poids minimum</p>
                        <p className="text-2xl font-bold">{config?.seuil_poids_minimum_kg} kg</p>
                      </div>
                    </div>

                    <div className="flex items-center gap-2">
                      <span className="text-sm font-medium">Statut:</span>
                      <Badge variant={config?.actif ? "default" : "secondary"}>
                        {config?.actif ? "Actif" : "Inactif"}
                      </Badge>
                    </div>

                    {config?.description && (
                      <p className="text-sm text-muted-foreground">{config.description}</p>
                    )}

                    <Button onClick={startEditConfig}>
                      <Settings className="h-4 w-4 mr-2" />
                      Modifier la configuration
                    </Button>
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
