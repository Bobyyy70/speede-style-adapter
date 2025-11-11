import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { toast } from "sonner";
import {
  Brain,
  TrendingUp,
  AlertTriangle,
  CheckCircle,
  XCircle,
  BarChart3,
  Clock,
  DollarSign,
  RefreshCw,
  ThumbsUp,
  ThumbsDown,
  Sparkles,
  Activity,
  Target
} from "lucide-react";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Progress } from "@/components/ui/progress";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";

export default function ApprentissageContinu() {
  const queryClient = useQueryClient();
  const [selectedSuggestion, setSelectedSuggestion] = useState<any>(null);
  const [rejectReason, setRejectReason] = useState("");
  const [showRejectDialog, setShowRejectDialog] = useState(false);

  // Récupérer les suggestions en attente
  const { data: suggestions, isLoading: suggestionsLoading } = useQuery({
    queryKey: ['suggestions-ajustement'],
    queryFn: async () => {
      const { data, error } = await (supabase as any)
        .from('suggestion_ajustement_regle')
        .select(`
          *,
          transporteur:transporteur_id(nom),
          regle:regle_cible_id(nom_regle)
        `)
        .order('confiance_score', { ascending: false })
        .order('created_at', { ascending: false });
      
      if (error) throw error;
      return data;
    }
  });

  // Récupérer les métriques d'apprentissage
  const { data: metriques, isLoading: metriquesLoading } = useQuery({
    queryKey: ['metriques-apprentissage'],
    queryFn: async () => {
      const { data, error } = await (supabase as any)
        .from('metrique_apprentissage')
        .select('*')
        .order('periode', { ascending: false })
        .limit(30);
      
      if (error) throw error;
      return data;
    }
  });

  // Récupérer le dashboard d'apprentissage
  const { data: dashboard, isLoading: dashboardLoading } = useQuery({
    queryKey: ['dashboard-apprentissage'],
    queryFn: async () => {
      const { data, error } = await (supabase as any)
        .from('dashboard_apprentissage')
        .select('*')
        .order('semaine', { ascending: false })
        .limit(12);
      
      if (error) throw error;
      return data;
    }
  });

  // Récupérer les patterns de changements
  const { data: patterns, isLoading: patternsLoading } = useQuery({
    queryKey: ['patterns-changements'],
    queryFn: async () => {
      const { data, error } = await (supabase as any)
        .from('patterns_changements_transporteur')
        .select('*')
        .limit(10);
      
      if (error) throw error;
      return data;
    }
  });

  // Lancer une analyse IA
  const analyzerMutation = useMutation({
    mutationFn: async (periodeJours: number) => {
      const { data, error } = await supabase.functions.invoke('analyze-carrier-learning', {
        body: { periode_jours: periodeJours }
      });
      
      if (error) throw error;
      return data;
    },
    onSuccess: (data) => {
      toast.success(`Analyse terminée : ${data.suggestions?.length || 0} nouvelles suggestions générées`);
      queryClient.invalidateQueries({ queryKey: ['suggestions-ajustement'] });
      queryClient.invalidateQueries({ queryKey: ['metriques-apprentissage'] });
    },
    onError: (error: any) => {
      toast.error("Erreur lors de l'analyse : " + error.message);
    }
  });

  // Traiter une suggestion (approuver/rejeter)
  const traiterSuggestionMutation = useMutation({
    mutationFn: async ({ suggestionId, action, raison }: { 
      suggestionId: string; 
      action: 'approuver' | 'rejeter';
      raison?: string;
    }) => {
      const { data, error } = await (supabase as any).rpc('traiter_suggestion_ajustement', {
        p_suggestion_id: suggestionId,
        p_action: action,
        p_raison_rejet: raison || null
      });
      
      if (error) throw error;
      return data;
    },
    onSuccess: (data: any, variables) => {
      toast.success(data.message || `Suggestion ${variables.action === 'approuver' ? 'approuvée' : 'rejetée'}`);
      queryClient.invalidateQueries({ queryKey: ['suggestions-ajustement'] });
      setShowRejectDialog(false);
      setSelectedSuggestion(null);
      setRejectReason("");
    },
    onError: (error: any) => {
      toast.error("Erreur : " + error.message);
    }
  });

  const getTypeSuggestionBadge = (type: string) => {
    const variants: Record<string, { label: string; variant: any }> = {
      'modifier_poids': { label: 'Modifier poids', variant: 'default' },
      'ajouter_condition': { label: 'Ajouter condition', variant: 'secondary' },
      'desactiver_regle': { label: 'Désactiver règle', variant: 'destructive' },
      'creer_regle': { label: 'Créer règle', variant: 'default' },
      'ajuster_seuil': { label: 'Ajuster seuil', variant: 'outline' }
    };
    const config = variants[type] || { label: type, variant: 'default' };
    return <Badge variant={config.variant as any}>{config.label}</Badge>;
  };

  const getStatutBadge = (statut: string) => {
    const variants: Record<string, { label: string; variant: any; icon: any }> = {
      'en_attente': { label: 'En attente', variant: 'default', icon: Clock },
      'approuvée': { label: 'Approuvée', variant: 'secondary', icon: CheckCircle },
      'rejetée': { label: 'Rejetée', variant: 'destructive', icon: XCircle },
      'appliquée': { label: 'Appliquée', variant: 'default', icon: Sparkles }
    };
    const config = variants[statut] || { label: statut, variant: 'default', icon: Activity };
    const Icon = config.icon;
    return (
      <Badge variant={config.variant as any} className="gap-1">
        <Icon className="h-3 w-3" />
        {config.label}
      </Badge>
    );
  };

  const handleApprouver = (suggestion: any) => {
    traiterSuggestionMutation.mutate({
      suggestionId: suggestion.id,
      action: 'approuver'
    });
  };

  const handleRejeter = (suggestion: any) => {
    setSelectedSuggestion(suggestion);
    setShowRejectDialog(true);
  };

  const confirmRejeter = () => {
    if (!selectedSuggestion) return;
    traiterSuggestionMutation.mutate({
      suggestionId: selectedSuggestion.id,
      action: 'rejeter',
      raison: rejectReason
    });
  };

  const derniereMetrique = metriques?.[0] as any;
  const suggestionsEnAttente = (suggestions as any)?.filter((s: any) => s.statut === 'en_attente') || [];
  const suggestionsApprouvees = (suggestions as any)?.filter((s: any) => s.statut === 'approuvée') || [];

  return (
    <div className="container mx-auto p-6 space-y-6">
      {/* En-tête */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold flex items-center gap-2">
            <Brain className="h-8 w-8 text-primary" />
            Apprentissage Continu
          </h1>
          <p className="text-muted-foreground mt-1">
            Amélioration automatique des règles de sélection via IA
          </p>
        </div>
        <Button
          onClick={() => analyzerMutation.mutate(30)}
          disabled={analyzerMutation.isPending}
          size="lg"
        >
          {analyzerMutation.isPending ? (
            <>
              <RefreshCw className="mr-2 h-4 w-4 animate-spin" />
              Analyse en cours...
            </>
          ) : (
            <>
              <Sparkles className="mr-2 h-4 w-4" />
              Lancer analyse IA
            </>
          )}
        </Button>
      </div>

      {/* KPIs principaux */}
      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Taux de changement</CardTitle>
            <Activity className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">
              {derniereMetrique?.taux_changement?.toFixed(1) || 0}%
            </div>
            <p className="text-xs text-muted-foreground">
              {derniereMetrique?.nb_changements_manuels || 0} changements manuels
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Taux de problèmes</CardTitle>
            <AlertTriangle className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">
              {derniereMetrique?.taux_problemes?.toFixed(1) || 0}%
            </div>
            <p className="text-xs text-muted-foreground">
              {derniereMetrique?.nb_problemes_livraison || 0} incidents détectés
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Économies réalisées</CardTitle>
            <DollarSign className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-green-600">
              +{derniereMetrique?.economie_realisee?.toFixed(0) || 0}€
            </div>
            <p className="text-xs text-muted-foreground">
              Via suggestions appliquées
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Suggestions actives</CardTitle>
            <Target className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">
              {suggestionsEnAttente.length}
            </div>
            <p className="text-xs text-muted-foreground">
              En attente de validation
            </p>
          </CardContent>
        </Card>
      </div>

      <Tabs defaultValue="suggestions" className="space-y-4">
        <TabsList>
          <TabsTrigger value="suggestions">
            Suggestions IA ({suggestionsEnAttente.length})
          </TabsTrigger>
          <TabsTrigger value="patterns">
            Patterns détectés
          </TabsTrigger>
          <TabsTrigger value="metriques">
            Métriques d'apprentissage
          </TabsTrigger>
        </TabsList>

        {/* Onglet Suggestions */}
        <TabsContent value="suggestions" className="space-y-4">
          {suggestionsEnAttente.length === 0 && !suggestionsLoading && (
            <Alert>
              <Sparkles className="h-4 w-4" />
              <AlertDescription>
                Aucune suggestion en attente. Lancez une analyse IA pour générer de nouvelles recommandations.
              </AlertDescription>
            </Alert>
          )}

          {suggestionsEnAttente.map((suggestion: any) => (
            <Card key={suggestion.id} className="border-l-4 border-l-primary">
              <CardHeader>
                <div className="flex items-start justify-between">
                  <div className="space-y-2">
                    <div className="flex items-center gap-2">
                      {getTypeSuggestionBadge(suggestion.type_suggestion)}
                      {getStatutBadge(suggestion.statut)}
                      <Badge variant="outline" className="gap-1">
                        <Brain className="h-3 w-3" />
                        Confiance: {(suggestion.confiance_score * 100).toFixed(0)}%
                      </Badge>
                    </div>
                    <CardTitle className="text-xl">{suggestion.titre}</CardTitle>
                    <CardDescription>{suggestion.description}</CardDescription>
                  </div>
                  <div className="flex gap-2">
                    <Button
                      variant="default"
                      size="sm"
                      onClick={() => handleApprouver(suggestion)}
                      disabled={traiterSuggestionMutation.isPending}
                    >
                      <ThumbsUp className="h-4 w-4 mr-1" />
                      Approuver
                    </Button>
                    <Button
                      variant="destructive"
                      size="sm"
                      onClick={() => handleRejeter(suggestion)}
                      disabled={traiterSuggestionMutation.isPending}
                    >
                      <ThumbsDown className="h-4 w-4 mr-1" />
                      Rejeter
                    </Button>
                  </div>
                </div>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="grid gap-4 md:grid-cols-3">
                  <div className="space-y-1">
                    <p className="text-sm font-medium text-muted-foreground">Impact coûts estimé</p>
                    <p className={`text-lg font-bold ${suggestion.impact_estime_cout > 0 ? 'text-green-600' : 'text-red-600'}`}>
                      {suggestion.impact_estime_cout > 0 ? '+' : ''}{suggestion.impact_estime_cout?.toFixed(0) || 0}€
                    </p>
                  </div>
                  <div className="space-y-1">
                    <p className="text-sm font-medium text-muted-foreground">Impact délais estimé</p>
                    <p className={`text-lg font-bold ${suggestion.impact_estime_delai > 0 ? 'text-green-600' : 'text-red-600'}`}>
                      {suggestion.impact_estime_delai > 0 ? '+' : ''}{suggestion.impact_estime_delai || 0}h
                    </p>
                  </div>
                  <div className="space-y-1">
                    <p className="text-sm font-medium text-muted-foreground">Basé sur</p>
                    <p className="text-lg font-bold">
                      {suggestion.base_sur_commandes} commandes
                    </p>
                  </div>
                </div>

                <div className="space-y-2">
                  <p className="text-sm font-medium">Justification IA:</p>
                  <p className="text-sm text-muted-foreground bg-muted p-3 rounded-md">
                    {suggestion.justification}
                  </p>
                </div>

                {suggestion.transporteur && (
                  <div className="flex items-center gap-2">
                    <Badge variant="outline">
                      Transporteur: {suggestion.transporteur.nom}
                    </Badge>
                  </div>
                )}

                <div className="space-y-2">
                  <p className="text-sm font-medium">Modifications proposées:</p>
                  <pre className="text-xs bg-muted p-3 rounded-md overflow-x-auto">
                    {JSON.stringify(suggestion.modifications_proposees, null, 2)}
                  </pre>
                </div>

                <Progress value={suggestion.confiance_score * 100} className="h-2" />
              </CardContent>
            </Card>
          ))}
        </TabsContent>

        {/* Onglet Patterns */}
        <TabsContent value="patterns" className="space-y-4">
          <Card>
            <CardHeader>
              <CardTitle>Patterns de changements fréquents</CardTitle>
              <CardDescription>
                Analyse des changements manuels récurrents (minimum 3 occurrences)
              </CardDescription>
            </CardHeader>
            <CardContent>
              {patternsLoading ? (
                <p className="text-muted-foreground">Chargement...</p>
              ) : patterns && patterns.length > 0 ? (
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>De</TableHead>
                      <TableHead>Vers</TableHead>
                      <TableHead>Occurrences</TableHead>
                      <TableHead>Impact coût moyen</TableHead>
                      <TableHead>Impact délai moyen</TableHead>
                      <TableHead>Pays concernés</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {patterns.map((pattern: any, idx: number) => (
                      <TableRow key={idx}>
                        <TableCell className="font-medium">{pattern.transporteur_initial}</TableCell>
                        <TableCell className="font-medium">{pattern.transporteur_final}</TableCell>
                        <TableCell>
                          <Badge variant="secondary">{pattern.nb_changements}</Badge>
                        </TableCell>
                        <TableCell className={pattern.impact_cout_moyen > 0 ? 'text-green-600' : 'text-red-600'}>
                          {pattern.impact_cout_moyen > 0 ? '+' : ''}{pattern.impact_cout_moyen?.toFixed(2) || 0}€
                        </TableCell>
                        <TableCell className={pattern.impact_delai_moyen > 0 ? 'text-green-600' : 'text-red-600'}>
                          {pattern.impact_delai_moyen > 0 ? '+' : ''}{pattern.impact_delai_moyen?.toFixed(0) || 0}h
                        </TableCell>
                        <TableCell>{pattern.nb_pays_concernes} pays</TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              ) : (
                <Alert>
                  <BarChart3 className="h-4 w-4" />
                  <AlertDescription>
                    Pas assez de données pour détecter des patterns récurrents.
                  </AlertDescription>
                </Alert>
              )}
            </CardContent>
          </Card>
        </TabsContent>

        {/* Onglet Métriques */}
        <TabsContent value="metriques" className="space-y-4">
          <Card>
            <CardHeader>
              <CardTitle>Évolution des métriques d'apprentissage</CardTitle>
              <CardDescription>Historique sur les 30 derniers jours</CardDescription>
            </CardHeader>
            <CardContent>
              {metriquesLoading ? (
                <p className="text-muted-foreground">Chargement...</p>
              ) : metriques && metriques.length > 0 ? (
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Date</TableHead>
                      <TableHead>Décisions</TableHead>
                      <TableHead>Taux changement</TableHead>
                      <TableHead>Taux problèmes</TableHead>
                      <TableHead>Économies</TableHead>
                      <TableHead>Suggestions</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {metriques.slice(0, 15).map((metrique: any) => (
                      <TableRow key={metrique.id}>
                        <TableCell>{new Date(metrique.periode).toLocaleDateString('fr-FR')}</TableCell>
                        <TableCell>{metrique.nb_decisions_totales}</TableCell>
                        <TableCell>
                          <Badge variant={metrique.taux_changement > 20 ? 'destructive' : 'secondary'}>
                            {metrique.taux_changement?.toFixed(1) || 0}%
                          </Badge>
                        </TableCell>
                        <TableCell>
                          <Badge variant={metrique.taux_problemes > 5 ? 'destructive' : 'secondary'}>
                            {metrique.taux_problemes?.toFixed(1) || 0}%
                          </Badge>
                        </TableCell>
                        <TableCell className="text-green-600 font-medium">
                          +{metrique.economie_realisee?.toFixed(0) || 0}€
                        </TableCell>
                        <TableCell>
                          {metrique.nb_suggestions_appliquees}/{metrique.nb_suggestions_generees}
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              ) : (
                <Alert>
                  <TrendingUp className="h-4 w-4" />
                  <AlertDescription>
                    Aucune métrique disponible pour le moment.
                  </AlertDescription>
                </Alert>
              )}
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>

      {/* Dialog de rejet */}
      <Dialog open={showRejectDialog} onOpenChange={setShowRejectDialog}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Rejeter la suggestion</DialogTitle>
            <DialogDescription>
              Veuillez indiquer la raison du rejet pour améliorer les futures recommandations.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4 py-4">
            <div className="space-y-2">
              <Label htmlFor="raison">Raison du rejet</Label>
              <Textarea
                id="raison"
                placeholder="Ex: Cette règle ne s'applique pas à notre contexte métier..."
                value={rejectReason}
                onChange={(e) => setRejectReason(e.target.value)}
                rows={4}
              />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setShowRejectDialog(false)}>
              Annuler
            </Button>
            <Button
              variant="destructive"
              onClick={confirmRejeter}
              disabled={traiterSuggestionMutation.isPending || !rejectReason.trim()}
            >
              Confirmer le rejet
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}