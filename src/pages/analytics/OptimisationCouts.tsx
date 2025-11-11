import { useState, useEffect } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { toast } from "sonner";
import { TrendingDown, TrendingUp, DollarSign, Sparkles, CheckCircle, XCircle, Clock, BarChart3 } from "lucide-react";
import { LineChart, Line, BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer } from 'recharts';
import { format } from "date-fns";
import { fr } from "date-fns/locale";

export default function OptimisationCouts() {
  const [analyses, setAnalyses] = useState<any[]>([]);
  const [suggestions, setSuggestions] = useState<any[]>([]);
  const [comparaison, setComparaison] = useState<any[]>([]);
  const [evolution, setEvolution] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [analyzing, setAnalyzing] = useState(false);

  useEffect(() => {
    loadData();
  }, []);

  const loadData = async () => {
    setLoading(true);
    try {
      const [analysesRes, suggestionsRes, comparaisonRes, evolutionRes] = await Promise.all([
        (supabase as any).from('analyse_optimisation_couts').select('*').order('date_analyse', { ascending: false }).limit(10),
        (supabase as any).from('suggestion_optimisation').select('*').eq('statut', 'pending').order('impact_estime_mensuel', { ascending: false }).limit(20),
        (supabase as any).from('comparaison_couts_transporteurs').select('*'),
        (supabase as any).from('evolution_couts_temporelle').select('*').limit(30)
      ]);

      setAnalyses(analysesRes.data || []);
      setSuggestions(suggestionsRes.data || []);
      setComparaison(comparaisonRes.data || []);
      setEvolution((evolutionRes.data || []).reverse()); // Plus ancien au plus récent
    } catch (error: any) {
      console.error('Error loading data:', error);
      toast.error("Erreur lors du chargement");
    } finally {
      setLoading(false);
    }
  };

  const handleLancerAnalyse = async () => {
    setAnalyzing(true);
    try {
      const response = await supabase.functions.invoke('analyze-cost-optimization', {
        body: { periode_jours: 30 },
      });

      if (response.error) throw response.error;

      toast.success(`Analyse terminée: ${response.data.economies_potentielles?.toFixed(2)}€ d'économies potentielles`);
      loadData();
    } catch (error: any) {
      console.error('Error analyzing:', error);
      toast.error("Erreur lors de l'analyse");
    } finally {
      setAnalyzing(false);
    }
  };

  const handleAppliquerSuggestion = async (suggestionId: string) => {
    try {
      await (supabase as any)
        .from('suggestion_optimisation')
        .update({ 
          statut: 'approved',
          appliquee_le: new Date().toISOString(),
          appliquee_par: (await supabase.auth.getUser()).data.user?.id
        })
        .eq('id', suggestionId);

      toast.success("Suggestion approuvée");
      loadData();
    } catch (error: any) {
      console.error('Error approving:', error);
      toast.error("Erreur lors de l'approbation");
    }
  };

  const handleRejeterSuggestion = async (suggestionId: string) => {
    try {
      await (supabase as any)
        .from('suggestion_optimisation')
        .update({ statut: 'rejected' })
        .eq('id', suggestionId);

      toast.success("Suggestion rejetée");
      loadData();
    } catch (error: any) {
      console.error('Error rejecting:', error);
      toast.error("Erreur lors du rejet");
    }
  };

  const latestAnalyse = analyses[0];
  const economiesData = comparaison.map(t => ({
    name: t.transporteur_choisi_nom?.substring(0, 15) || 'N/A',
    reel: parseFloat(t.cout_total_reel) || 0,
    optimal: parseFloat(t.cout_optimal_estime) || 0,
    economies: parseFloat(t.economies_potentielles) || 0,
  }));

  const evolutionData = evolution.map(e => ({
    date: format(new Date(e.jour), 'dd MMM', { locale: fr }),
    cout: parseFloat(e.cout_total_jour) || 0,
    commandes: e.nombre_commandes,
    score: parseFloat(e.score_moyen_jour) || 0,
  }));

  return (
    <div className="container mx-auto p-6 space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold">Optimisation des Coûts</h1>
          <p className="text-muted-foreground">
            Analyse IA des économies potentielles et suggestions d'amélioration
          </p>
        </div>
        <Button onClick={handleLancerAnalyse} disabled={analyzing}>
          <Sparkles className="h-4 w-4 mr-2" />
          {analyzing ? "Analyse en cours..." : "Lancer nouvelle analyse"}
        </Button>
      </div>

      {latestAnalyse && (
        <div className="grid grid-cols-4 gap-4">
          <Card>
            <CardHeader className="pb-3">
              <CardTitle className="text-sm font-medium">Économies Potentielles</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="text-3xl font-bold text-green-600">
                {latestAnalyse.economies_potentielles?.toFixed(2) || 0}€
              </div>
              <p className="text-xs text-muted-foreground mt-1">
                {latestAnalyse.pourcentage_economie?.toFixed(1) || 0}% d'économie possible
              </p>
            </CardContent>
          </Card>
          <Card>
            <CardHeader className="pb-3">
              <CardTitle className="text-sm font-medium">Coût Total Réel</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="text-3xl font-bold">
                {latestAnalyse.cout_total_reel?.toFixed(2) || 0}€
              </div>
              <p className="text-xs text-muted-foreground mt-1">
                Sur {latestAnalyse.nombre_commandes_analysees} commandes
              </p>
            </CardContent>
          </Card>
          <Card>
            <CardHeader className="pb-3">
              <CardTitle className="text-sm font-medium">Coût Optimal</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="text-3xl font-bold text-blue-600">
                {latestAnalyse.cout_total_optimal?.toFixed(2) || 0}€
              </div>
              <p className="text-xs text-muted-foreground mt-1">
                Avec sélection optimale
              </p>
            </CardContent>
          </Card>
          <Card>
            <CardHeader className="pb-3">
              <CardTitle className="text-sm font-medium">Suggestions IA</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="text-3xl font-bold text-purple-600">
                {latestAnalyse.nombre_suggestions || 0}
              </div>
              <p className="text-xs text-muted-foreground mt-1">
                Impact: {latestAnalyse.impact_financier_total?.toFixed(2) || 0}€
              </p>
            </CardContent>
          </Card>
        </div>
      )}

      <Tabs defaultValue="graphiques">
        <TabsList className="grid w-full grid-cols-3">
          <TabsTrigger value="graphiques">Graphiques</TabsTrigger>
          <TabsTrigger value="suggestions">
            Suggestions ({suggestions.length})
          </TabsTrigger>
          <TabsTrigger value="historique">Historique</TabsTrigger>
        </TabsList>

        <TabsContent value="graphiques" className="space-y-4">
          <Card>
            <CardHeader>
              <CardTitle>Comparaison Coûts Réels vs Optimaux</CardTitle>
              <CardDescription>Par transporteur sur les 30 derniers jours</CardDescription>
            </CardHeader>
            <CardContent>
              <ResponsiveContainer width="100%" height={350}>
                <BarChart data={economiesData}>
                  <CartesianGrid strokeDasharray="3 3" />
                  <XAxis dataKey="name" angle={-45} textAnchor="end" height={80} />
                  <YAxis />
                  <Tooltip />
                  <Legend />
                  <Bar dataKey="reel" fill="hsl(var(--primary))" name="Coût Réel (€)" />
                  <Bar dataKey="optimal" fill="hsl(var(--chart-2))" name="Coût Optimal (€)" />
                </BarChart>
              </ResponsiveContainer>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle>Évolution Temporelle des Coûts</CardTitle>
              <CardDescription>Derniers 30 jours</CardDescription>
            </CardHeader>
            <CardContent>
              <ResponsiveContainer width="100%" height={300}>
                <LineChart data={evolutionData}>
                  <CartesianGrid strokeDasharray="3 3" />
                  <XAxis dataKey="date" />
                  <YAxis yAxisId="left" />
                  <YAxis yAxisId="right" orientation="right" />
                  <Tooltip />
                  <Legend />
                  <Line yAxisId="left" type="monotone" dataKey="cout" stroke="hsl(var(--primary))" name="Coût (€)" strokeWidth={2} />
                  <Line yAxisId="right" type="monotone" dataKey="commandes" stroke="hsl(var(--chart-2))" name="Commandes" strokeWidth={2} />
                </LineChart>
              </ResponsiveContainer>
            </CardContent>
          </Card>

          <div className="grid grid-cols-2 gap-4">
            {comparaison.slice(0, 4).map((trans: any) => (
              <Card key={trans.transporteur_choisi_code}>
                <CardHeader>
                  <CardTitle className="text-lg">{trans.transporteur_choisi_nom}</CardTitle>
                  <CardDescription>{trans.nombre_utilisations} commandes</CardDescription>
                </CardHeader>
                <CardContent className="space-y-2">
                  <div className="flex justify-between">
                    <span className="text-sm text-muted-foreground">Coût total réel:</span>
                    <span className="font-bold">{trans.cout_total_reel?.toFixed(2)}€</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-sm text-muted-foreground">Coût optimal:</span>
                    <span className="font-bold text-blue-600">{trans.cout_optimal_estime?.toFixed(2)}€</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-sm text-muted-foreground">Économies:</span>
                    <span className="font-bold text-green-600">
                      {trans.economies_potentielles?.toFixed(2)}€
                    </span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-sm text-muted-foreground">Score moyen:</span>
                    <Badge variant="outline">{trans.score_moyen?.toFixed(1)}/100</Badge>
                  </div>
                </CardContent>
              </Card>
            ))}
          </div>
        </TabsContent>

        <TabsContent value="suggestions">
          <ScrollArea className="h-[600px]">
            <div className="space-y-4">
              {suggestions.map((suggestion) => (
                <Card key={suggestion.id} className="border-l-4 border-l-purple-500">
                  <CardHeader>
                    <div className="flex items-start justify-between">
                      <div className="space-y-1">
                        <div className="flex items-center gap-2">
                          <Sparkles className="h-5 w-5 text-purple-600" />
                          <CardTitle className="text-lg">{suggestion.titre}</CardTitle>
                        </div>
                        <Badge variant="outline" className="text-xs">
                          {suggestion.type_suggestion}
                        </Badge>
                      </div>
                      <div className="text-right">
                        <div className="text-2xl font-bold text-green-600">
                          +{suggestion.impact_estime_mensuel?.toFixed(2)}€
                        </div>
                        <p className="text-xs text-muted-foreground">par mois</p>
                      </div>
                    </div>
                  </CardHeader>
                  <CardContent className="space-y-4">
                    <div>
                      <p className="text-sm">{suggestion.description}</p>
                    </div>
                    {suggestion.justification_ia && (
                      <div className="p-3 bg-muted rounded-lg">
                        <p className="text-xs font-semibold mb-1">Justification IA:</p>
                        <p className="text-xs text-muted-foreground">{suggestion.justification_ia}</p>
                      </div>
                    )}
                    <div className="flex items-center gap-2">
                      <Badge variant="outline">
                        Confiance: {((suggestion.confiance_suggestion || 0) * 100).toFixed(0)}%
                      </Badge>
                      <Badge variant="outline" className="text-xs">
                        {format(new Date(suggestion.date_creation), "dd MMM yyyy", { locale: fr })}
                      </Badge>
                    </div>
                    <div className="flex gap-2">
                      <Button 
                        onClick={() => handleAppliquerSuggestion(suggestion.id)}
                        className="flex-1"
                        size="sm"
                      >
                        <CheckCircle className="h-4 w-4 mr-2" />
                        Approuver
                      </Button>
                      <Button 
                        onClick={() => handleRejeterSuggestion(suggestion.id)}
                        variant="outline"
                        className="flex-1"
                        size="sm"
                      >
                        <XCircle className="h-4 w-4 mr-2" />
                        Rejeter
                      </Button>
                    </div>
                  </CardContent>
                </Card>
              ))}
              {suggestions.length === 0 && (
                <Card>
                  <CardContent className="text-center py-12">
                    <p className="text-muted-foreground">
                      Aucune suggestion en attente. Lancez une nouvelle analyse pour obtenir des recommandations.
                    </p>
                  </CardContent>
                </Card>
              )}
            </div>
          </ScrollArea>
        </TabsContent>

        <TabsContent value="historique">
          <ScrollArea className="h-[600px]">
            <div className="space-y-4">
              {analyses.map((analyse) => (
                <Card key={analyse.id}>
                  <CardHeader>
                    <div className="flex items-center justify-between">
                      <div>
                        <CardTitle className="text-lg">
                          Analyse du {format(new Date(analyse.date_analyse), "dd MMM yyyy 'à' HH:mm", { locale: fr })}
                        </CardTitle>
                        <CardDescription>
                          {format(new Date(analyse.periode_debut), "dd MMM", { locale: fr })} - {format(new Date(analyse.periode_fin), "dd MMM yyyy", { locale: fr })}
                        </CardDescription>
                      </div>
                      <Badge variant="outline" className="text-lg px-3 py-1">
                        <TrendingDown className="h-4 w-4 mr-1" />
                        {analyse.pourcentage_economie?.toFixed(1)}%
                      </Badge>
                    </div>
                  </CardHeader>
                  <CardContent>
                    <div className="grid grid-cols-4 gap-4">
                      <div>
                        <p className="text-xs text-muted-foreground">Commandes</p>
                        <p className="text-xl font-bold">{analyse.nombre_commandes_analysees}</p>
                      </div>
                      <div>
                        <p className="text-xs text-muted-foreground">Coût réel</p>
                        <p className="text-xl font-bold">{analyse.cout_total_reel?.toFixed(2)}€</p>
                      </div>
                      <div>
                        <p className="text-xs text-muted-foreground">Coût optimal</p>
                        <p className="text-xl font-bold text-blue-600">{analyse.cout_total_optimal?.toFixed(2)}€</p>
                      </div>
                      <div>
                        <p className="text-xs text-muted-foreground">Économies</p>
                        <p className="text-xl font-bold text-green-600">
                          {analyse.economies_potentielles?.toFixed(2)}€
                        </p>
                      </div>
                    </div>
                    {analyse.nombre_suggestions > 0 && (
                      <div className="mt-4 p-3 bg-purple-500/10 border border-purple-500/20 rounded">
                        <p className="text-sm">
                          <strong>{analyse.nombre_suggestions} suggestions</strong> générées avec impact total estimé de <strong>{analyse.impact_financier_total?.toFixed(2)}€/mois</strong>
                        </p>
                      </div>
                    )}
                  </CardContent>
                </Card>
              ))}
            </div>
          </ScrollArea>
        </TabsContent>
      </Tabs>
    </div>
  );
}
