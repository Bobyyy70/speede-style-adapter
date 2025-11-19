import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { useToast } from "@/hooks/use-toast";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Loader2, Plus, Play, CheckCircle2, XCircle, UserPlus, BarChart3, Package, Clock, TrendingUp } from "lucide-react";
import { format } from "date-fns";
import { fr } from "date-fns/locale";

interface Wave {
  id: string;
  nom_wave: string;
  statut: string;
  zone_picking: string | null;
  priorite: number;
  type_wave: string;
  nombre_commandes: number;
  nombre_lignes_total: number;
  nombre_articles_total: number;
  operateur_assigne: string | null;
  date_creation: string;
  date_debut_picking: string | null;
  date_fin_picking: string | null;
  duree_picking_minutes: number | null;
  taux_completion: number;
}

const getStatutBadge = (statut: string) => {
  const variants: Record<string, { label: string; className: string; icon: any }> = {
    'planifie': { label: 'Planifiée', className: 'bg-blue-100 text-blue-800', icon: Clock },
    'en_cours': { label: 'En cours', className: 'bg-yellow-100 text-yellow-800', icon: Play },
    'termine': { label: 'Terminée', className: 'bg-green-100 text-green-800', icon: CheckCircle2 },
    'annule': { label: 'Annulée', className: 'bg-gray-100 text-gray-800', icon: XCircle },
  };
  return variants[statut] || variants['planifie'];
};

const getPrioriteBadge = (priorite: number) => {
  const variants: Record<number, { label: string; className: string }> = {
    1: { label: 'Normale', className: 'bg-gray-100 text-gray-800' },
    2: { label: 'Haute', className: 'bg-orange-100 text-orange-800' },
    3: { label: 'Urgente', className: 'bg-red-100 text-red-800' },
  };
  return variants[priorite] || variants[1];
};

export const GestionWaves = () => {
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const [createDialogOpen, setCreateDialogOpen] = useState(false);
  const [activeTab, setActiveTab] = useState<string>("planifie");

  // Formulaire nouvelle wave
  const [newWave, setNewWave] = useState({
    nom_wave: "",
    zone_picking: "",
    priorite: 1,
    type_wave: "standard",
  });

  // Fetch waves - Feature disabled (table not in database)
  const { data: waves, isLoading } = useQuery({
    queryKey: ["wave_picking"],
    queryFn: async () => {
      // Wave picking feature requires wave_picking table
      // Currently disabled until database migration is run
      return [] as Wave[];
    },
    refetchInterval: 10000, // Refresh every 10s
  });

  // Fetch operateurs disponibles
  const { data: operateurs } = useQuery({
    queryKey: ["operateurs"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("user_roles")
        .select(`
          user_id,
          profiles:user_id (
            id,
            nom,
            prenom,
            email
          )
        `)
        .in("role", ["operateur", "gestionnaire"]);

      if (error) throw error;
      return data;
    },
  });

  // Créer une wave
  const createWaveMutation = useMutation({
    mutationFn: async (waveData: typeof newWave) => {
      // Wave creation disabled - requires database function
      toast({
        title: "Fonctionnalité désactivée",
        description: "La création de waves nécessite une migration de base de données",
        variant: "destructive",
      });
      throw new Error("Feature disabled");
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["wave_picking"] });
      toast({
        title: "Wave créée",
        description: "La wave de picking a été créée avec succès",
      });
      setCreateDialogOpen(false);
      setNewWave({
        nom_wave: "",
        zone_picking: "",
        priorite: 1,
        type_wave: "standard",
      });
    },
    onError: (error: any) => {
      toast({
        title: "Erreur",
        description: error.message || "Impossible de créer la wave",
        variant: "destructive",
      });
    },
  });

  // Assigner un opérateur - Feature disabled
  const assignerOperateurMutation = useMutation({
    mutationFn: async ({ waveId, operateurId }: { waveId: string; operateurId: string }) => {
      toast({
        title: "Fonctionnalité désactivée",
        description: "L'assignation d'opérateur nécessite une migration de base de données",
        variant: "destructive",
      });
      throw new Error("Feature disabled");
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["wave_picking"] });
      toast({
        title: "Opérateur assigné",
        description: "L'opérateur a été assigné à la wave",
      });
    },
    onError: (error: any) => {
      toast({
        title: "Erreur",
        description: error.message || "Impossible d'assigner l'opérateur",
        variant: "destructive",
      });
    },
  });

  // Démarrer une wave - Feature disabled
  const demarrerWaveMutation = useMutation({
    mutationFn: async (waveId: string) => {
      toast({
        title: "Fonctionnalité désactivée",
        description: "Le démarrage de wave nécessite une migration de base de données",
        variant: "destructive",
      });
      throw new Error("Feature disabled");
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["wave_picking"] });
      toast({
        title: "Wave démarrée",
        description: "Le picking de la wave a démarré",
      });
    },
    onError: (error: any) => {
      toast({
        title: "Erreur",
        description: error.message || "Impossible de démarrer la wave",
        variant: "destructive",
      });
    },
  });

  // Finaliser une wave - Feature disabled
  const finaliserWaveMutation = useMutation({
    mutationFn: async (waveId: string) => {
      toast({
        title: "Fonctionnalité désactivée",
        description: "La finalisation de wave nécessite une migration de base de données",
        variant: "destructive",
      });
      throw new Error("Feature disabled");
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["wave_picking"] });
      toast({
        title: "Wave finalisée",
        description: "La wave a été finalisée avec succès",
      });
    },
    onError: (error: any) => {
      toast({
        title: "Erreur",
        description: error.message || "Impossible de finaliser la wave",
        variant: "destructive",
      });
    },
  });

  const handleCreateWave = () => {
    if (!newWave.nom_wave.trim()) {
      toast({
        title: "Erreur",
        description: "Le nom de la wave est requis",
        variant: "destructive",
      });
      return;
    }

    createWaveMutation.mutate(newWave);
  };

  const filteredWaves = waves?.filter((w) => {
    if (activeTab === "toutes") return true;
    return w.statut === activeTab;
  });

  const stats = {
    total: waves?.length || 0,
    planifiees: waves?.filter((w) => w.statut === "planifie").length || 0,
    en_cours: waves?.filter((w) => w.statut === "en_cours").length || 0,
    terminees: waves?.filter((w) => w.statut === "termine").length || 0,
  };

  if (isLoading) {
    return (
      <div className="flex items-center justify-center h-64">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-3xl font-bold tracking-tight">Gestion des Waves</h2>
          <p className="text-muted-foreground">
            Optimisez le picking avec le regroupement intelligent de commandes
          </p>
        </div>

        <Dialog open={createDialogOpen} onOpenChange={setCreateDialogOpen}>
          <DialogTrigger asChild>
            <Button size="lg" className="gap-2">
              <Plus className="h-4 w-4" />
              Nouvelle Wave
            </Button>
          </DialogTrigger>
          <DialogContent className="sm:max-w-[500px]">
            <DialogHeader>
              <DialogTitle>Créer une nouvelle wave de picking</DialogTitle>
              <DialogDescription>
                Configurez les paramètres de la wave. Vous pourrez ajouter des commandes ensuite.
              </DialogDescription>
            </DialogHeader>

            <div className="grid gap-4 py-4">
              <div className="grid gap-2">
                <Label htmlFor="nom_wave">Nom de la wave *</Label>
                <Input
                  id="nom_wave"
                  placeholder="Ex: Wave matinée Zone A"
                  value={newWave.nom_wave}
                  onChange={(e) => setNewWave({ ...newWave, nom_wave: e.target.value })}
                />
              </div>

              <div className="grid gap-2">
                <Label htmlFor="zone_picking">Zone de picking</Label>
                <Input
                  id="zone_picking"
                  placeholder="Ex: Zone A, B, C..."
                  value={newWave.zone_picking}
                  onChange={(e) => setNewWave({ ...newWave, zone_picking: e.target.value })}
                />
              </div>

              <div className="grid gap-2">
                <Label htmlFor="priorite">Priorité</Label>
                <Select
                  value={newWave.priorite.toString()}
                  onValueChange={(value) => setNewWave({ ...newWave, priorite: parseInt(value) })}
                >
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="1">Normale</SelectItem>
                    <SelectItem value="2">Haute</SelectItem>
                    <SelectItem value="3">Urgente</SelectItem>
                  </SelectContent>
                </Select>
              </div>

              <div className="grid gap-2">
                <Label htmlFor="type_wave">Type de wave</Label>
                <Select
                  value={newWave.type_wave}
                  onValueChange={(value) => setNewWave({ ...newWave, type_wave: value })}
                >
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="standard">Standard</SelectItem>
                    <SelectItem value="express">Express</SelectItem>
                    <SelectItem value="fragile">Fragile</SelectItem>
                    <SelectItem value="volumineux">Volumineux</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>

            <DialogFooter>
              <Button
                type="button"
                variant="outline"
                onClick={() => setCreateDialogOpen(false)}
              >
                Annuler
              </Button>
              <Button
                type="button"
                onClick={handleCreateWave}
                disabled={createWaveMutation.isPending}
              >
                {createWaveMutation.isPending && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                Créer la wave
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      </div>

      {/* Stats */}
      <div className="grid gap-4 md:grid-cols-4">
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Total</CardTitle>
            <Package className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{stats.total}</div>
            <p className="text-xs text-muted-foreground">Toutes les waves</p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Planifiées</CardTitle>
            <Clock className="h-4 w-4 text-blue-600" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{stats.planifiees}</div>
            <p className="text-xs text-muted-foreground">En attente</p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">En cours</CardTitle>
            <Play className="h-4 w-4 text-yellow-600" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{stats.en_cours}</div>
            <p className="text-xs text-muted-foreground">Picking actif</p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Terminées</CardTitle>
            <CheckCircle2 className="h-4 w-4 text-green-600" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{stats.terminees}</div>
            <p className="text-xs text-muted-foreground">Complétées</p>
          </CardContent>
        </Card>
      </div>

      {/* Waves List */}
      <Tabs value={activeTab} onValueChange={setActiveTab}>
        <TabsList>
          <TabsTrigger value="toutes">Toutes</TabsTrigger>
          <TabsTrigger value="planifie">Planifiées</TabsTrigger>
          <TabsTrigger value="en_cours">En cours</TabsTrigger>
          <TabsTrigger value="termine">Terminées</TabsTrigger>
        </TabsList>

        <TabsContent value={activeTab} className="space-y-4">
          {filteredWaves && filteredWaves.length === 0 ? (
            <Card>
              <CardContent className="flex flex-col items-center justify-center py-12">
                <Package className="h-12 w-12 text-muted-foreground mb-4" />
                <p className="text-lg font-medium text-muted-foreground">Aucune wave trouvée</p>
                <p className="text-sm text-muted-foreground">
                  Créez une nouvelle wave pour commencer
                </p>
              </CardContent>
            </Card>
          ) : (
            <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
              {filteredWaves?.map((wave) => {
                const statutInfo = getStatutBadge(wave.statut);
                const prioriteInfo = getPrioriteBadge(wave.priorite);
                const StatusIcon = statutInfo.icon;

                return (
                  <Card key={wave.id} className="hover:shadow-lg transition-shadow">
                    <CardHeader>
                      <div className="flex items-start justify-between">
                        <div className="space-y-1">
                          <CardTitle className="text-lg">{wave.nom_wave}</CardTitle>
                          <CardDescription>
                            {wave.zone_picking && `Zone: ${wave.zone_picking}`}
                          </CardDescription>
                        </div>
                        <div className="flex flex-col gap-2">
                          <Badge className={`gap-1 ${statutInfo.className}`}>
                            <StatusIcon className="h-3 w-3" />
                            {statutInfo.label}
                          </Badge>
                          <Badge variant="outline" className={prioriteInfo.className}>
                            {prioriteInfo.label}
                          </Badge>
                        </div>
                      </div>
                    </CardHeader>

                    <CardContent className="space-y-4">
                      {/* Métriques */}
                      <div className="grid grid-cols-3 gap-2 text-sm">
                        <div className="text-center">
                          <div className="font-bold text-lg">{wave.nombre_commandes}</div>
                          <div className="text-xs text-muted-foreground">Commandes</div>
                        </div>
                        <div className="text-center">
                          <div className="font-bold text-lg">{wave.nombre_lignes_total}</div>
                          <div className="text-xs text-muted-foreground">Lignes</div>
                        </div>
                        <div className="text-center">
                          <div className="font-bold text-lg">{wave.nombre_articles_total}</div>
                          <div className="text-xs text-muted-foreground">Articles</div>
                        </div>
                      </div>

                      {/* Progression */}
                      {wave.statut === "en_cours" && (
                        <div className="space-y-2">
                          <div className="flex justify-between text-sm">
                            <span>Progression</span>
                            <span className="font-medium">{wave.taux_completion.toFixed(0)}%</span>
                          </div>
                          <div className="w-full bg-gray-200 rounded-full h-2">
                            <div
                              className="bg-primary h-2 rounded-full transition-all"
                              style={{ width: `${wave.taux_completion}%` }}
                            />
                          </div>
                        </div>
                      )}

                      {/* Timing */}
                      {wave.date_debut_picking && (
                        <div className="text-xs text-muted-foreground">
                          Démarré:{" "}
                          {format(new Date(wave.date_debut_picking), "dd/MM/yyyy HH:mm", {
                            locale: fr,
                          })}
                          {wave.duree_picking_minutes && (
                            <span className="ml-2">({wave.duree_picking_minutes} min)</span>
                          )}
                        </div>
                      )}

                      {/* Actions */}
                      <div className="flex gap-2">
                        {wave.statut === "planifie" && !wave.operateur_assigne && operateurs && (
                          <Select
                            onValueChange={(value) =>
                              assignerOperateurMutation.mutate({
                                waveId: wave.id,
                                operateurId: value,
                              })
                            }
                          >
                            <SelectTrigger className="h-8 text-xs">
                              <SelectValue placeholder="Assigner opérateur" />
                            </SelectTrigger>
                            <SelectContent>
                              {operateurs.map((op: any) => (
                                <SelectItem key={op.user_id} value={op.user_id}>
                                  {op.profiles?.prenom} {op.profiles?.nom}
                                </SelectItem>
                              ))}
                            </SelectContent>
                          </Select>
                        )}

                        {wave.statut === "planifie" && wave.operateur_assigne && (
                          <Button
                            size="sm"
                            onClick={() => demarrerWaveMutation.mutate(wave.id)}
                            disabled={demarrerWaveMutation.isPending}
                            className="w-full"
                          >
                            <Play className="h-4 w-4 mr-2" />
                            Démarrer
                          </Button>
                        )}

                        {wave.statut === "en_cours" && wave.taux_completion === 100 && (
                          <Button
                            size="sm"
                            variant="default"
                            onClick={() => finaliserWaveMutation.mutate(wave.id)}
                            disabled={finaliserWaveMutation.isPending}
                            className="w-full"
                          >
                            <CheckCircle2 className="h-4 w-4 mr-2" />
                            Finaliser
                          </Button>
                        )}
                      </div>
                    </CardContent>
                  </Card>
                );
              })}
            </div>
          )}
        </TabsContent>
      </Tabs>
    </div>
  );
};
