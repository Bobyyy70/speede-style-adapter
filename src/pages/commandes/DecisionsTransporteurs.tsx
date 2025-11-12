import { useState, useEffect } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { toast } from "sonner";
import { Brain, TrendingUp, AlertTriangle, Check, X, Eye, Repeat, Zap } from "lucide-react";
import { format } from "date-fns";
import { fr } from "date-fns/locale";
import { DecisionTransporteur, TransporteurService } from "@/types/transporteurs";

export default function DecisionsTransporteurs() {
  const [decisions, setDecisions] = useState<DecisionTransporteur[]>([]);
  const [loading, setLoading] = useState(true);
  const [filtreMode, setFiltreMode] = useState<string>("tous");
  const [selectedDecision, setSelectedDecision] = useState<DecisionTransporteur | null>(null);
  const [forceDialogOpen, setForceDialogOpen] = useState(false);
  const [forcageData, setForcageData] = useState({ code: "", nom: "", raison: "" });
  const [transporteurs, setTransporteurs] = useState<TransporteurService[]>([]);

  useEffect(() => {
    loadData();
    loadTransporteurs();
  }, [filtreMode]);

  const loadData = async () => {
    setLoading(true);
    try {
      let query = supabase
        .from('decision_transporteur')
        .select('*, commande:commande_id(numero_commande, statut_wms, client_id)')
        .order('date_decision', { ascending: false })
        .limit(100);

      if (filtreMode !== "tous") {
        query = query.eq('mode_decision', filtreMode);
      }

      const { data: decisionsData, error } = await query;
      if (error) throw error;

      // Fetch client names separately using nom_entreprise
      if (decisionsData && decisionsData.length > 0) {
        const clientIds = [...new Set(
          decisionsData
            .map(d => d.commande?.client_id)
            .filter(Boolean)
        )] as string[];

        if (clientIds.length > 0) {
          const { data: clientsData } = await supabase
            .from('client')
            .select('id, nom_entreprise')
            .in('id', clientIds);

          const enrichedDecisions = decisionsData.map(decision => ({
            ...decision,
            client_nom: clientsData?.find(c => c.id === decision.commande?.client_id)?.nom_entreprise || 'N/A'
          })) as DecisionTransporteur[];

          setDecisions(enrichedDecisions);
        } else {
          setDecisions(decisionsData as DecisionTransporteur[]);
        }
      } else {
        setDecisions([]);
      }
    } catch (error) {
      console.error('Error loading decisions:', error);
      toast.error("Erreur lors du chargement des décisions");
      setDecisions([]);
    } finally {
      setLoading(false);
    }
  };

  const loadTransporteurs = async () => {
    try {
      const { data, error } = await supabase
        .from('transporteur_service')
        .select('id, code_service, nom_affichage, actif')
        .eq('actif', true);
      
      if (error) throw error;
      setTransporteurs((data || []) as TransporteurService[]);
    } catch (error) {
      console.error('Error loading transporteurs:', error);
      toast.error("Erreur lors du chargement des transporteurs");
      setTransporteurs([]);
    }
  };

  const handleForceTransporteur = async () => {
    if (!selectedDecision || !forcageData.code || !forcageData.raison) {
      toast.error("Veuillez remplir tous les champs");
      return;
    }

    try {
      // Note: Cette fonction RPC n'existe pas encore dans Supabase
      // Il faudra la créer via une migration
      toast.warning("Fonction forcer_transporteur_commande à implémenter");
      setForceDialogOpen(false);
      setForcageData({ code: "", nom: "", raison: "" });
    } catch (error) {
      console.error('Error forcing carrier:', error);
      toast.error(error instanceof Error ? error.message : "Erreur lors du forçage du transporteur");
    }
  };

  const handleRecalculer = async (commandeId: string) => {
    try {
      const response = await supabase.functions.invoke('apply-automatic-carrier-selection', {
        body: { commande_id: commandeId },
      });

      if (response.error) throw response.error;

      toast.success("Transporteur recalculé avec succès");
      loadData();
    } catch (error) {
      console.error('Error recalculating:', error);
      toast.error(error instanceof Error ? error.message : "Erreur lors du recalcul");
    }
  };

  const parseTransporteursAlternatives = (jsonString: string | null): Array<{ nom: string; score: number }> => {
    if (!jsonString) return [];
    try {
      const parsed = JSON.parse(jsonString);
      return Array.isArray(parsed) ? parsed : [];
    } catch (error) {
      console.error('Error parsing alternatives:', error);
      return [];
    }
  };

  const getModeIcon = (mode: string) => {
    switch (mode) {
      case 'ia_suggere': return <Brain className="h-4 w-4" />;
      case 'regle_stricte': return <Zap className="h-4 w-4" />;
      case 'manuel': return <Repeat className="h-4 w-4" />;
      default: return <TrendingUp className="h-4 w-4" />;
    }
  };

  const getModeColor = (mode: string) => {
    switch (mode) {
      case 'ia_suggere': return 'bg-purple-500/10 text-purple-600 border-purple-500/20';
      case 'regle_stricte': return 'bg-blue-500/10 text-blue-600 border-blue-500/20';
      case 'manuel': return 'bg-orange-500/10 text-orange-600 border-orange-500/20';
      default: return 'bg-green-500/10 text-green-600 border-green-500/20';
    }
  };

  const getScoreColor = (score: number) => {
    if (score >= 80) return 'text-green-600';
    if (score >= 60) return 'text-yellow-600';
    return 'text-red-600';
  };

  return (
    <div className="container mx-auto p-6 space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold">Décisions Transporteurs</h1>
          <p className="text-muted-foreground">
            Historique des sélections automatiques et manuelles avec analyse IA
          </p>
        </div>
        <Badge variant="outline" className="text-lg px-4 py-2">
          {decisions.length} décisions
        </Badge>
      </div>

      <Tabs value={filtreMode} onValueChange={setFiltreMode}>
        <TabsList className="grid w-full grid-cols-5">
          <TabsTrigger value="tous">Tous</TabsTrigger>
          <TabsTrigger value="ia_suggere">IA Suggéré</TabsTrigger>
          <TabsTrigger value="automatique">Automatique</TabsTrigger>
          <TabsTrigger value="regle_stricte">Règle Stricte</TabsTrigger>
          <TabsTrigger value="manuel">Manuel</TabsTrigger>
        </TabsList>

        <TabsContent value={filtreMode} className="space-y-4">
          {loading ? (
            <div className="text-center py-12">Chargement...</div>
          ) : decisions.length === 0 ? (
            <Card>
              <CardContent className="text-center py-12">
                <p className="text-muted-foreground">Aucune décision trouvée</p>
              </CardContent>
            </Card>
          ) : (
            <ScrollArea className="h-[600px]">
              <div className="space-y-4">
                {decisions.map((decision) => (
                  <Card key={decision.id} className="hover:shadow-md transition-shadow">
                    <CardHeader>
                      <div className="flex items-start justify-between">
                        <div className="space-y-2">
                          <div className="flex items-center gap-2">
                            <CardTitle className="text-lg">
                              {decision.commande?.numero_commande || 'N/A'}
                            </CardTitle>
                            <Badge className={getModeColor(decision.mode_decision)}>
                              {getModeIcon(decision.mode_decision)}
                              <span className="ml-1">{decision.mode_decision}</span>
                            </Badge>
                            {decision.force_manuellement && (
                              <Badge variant="outline" className="bg-orange-500/10">
                                <Repeat className="h-3 w-3 mr-1" />
                                Forcé
                              </Badge>
                            )}
                          </div>
                          <CardDescription>
                            {format(new Date(decision.date_decision), "dd MMM yyyy 'à' HH:mm", { locale: fr })}
                          </CardDescription>
                        </div>
                        <div className="flex gap-2">
                          <Dialog>
                            <DialogTrigger asChild>
                              <Button variant="outline" size="sm" onClick={() => setSelectedDecision(decision)}>
                                <Eye className="h-4 w-4 mr-2" />
                                Détails
                              </Button>
                            </DialogTrigger>
                            <DialogContent className="max-w-3xl max-h-[80vh] overflow-y-auto">
                              <DialogHeader>
                                <DialogTitle>Détails de la décision</DialogTitle>
                              </DialogHeader>
                              <div className="space-y-4">
                                <div className="grid grid-cols-2 gap-4">
                                  <div>
                                    <Label className="text-xs text-muted-foreground">Commande</Label>
                                    <p className="font-semibold">{decision.commande?.numero_commande}</p>
                                  </div>
                                  <div>
                                    <Label className="text-xs text-muted-foreground">Client</Label>
                                    <p className="font-semibold">{decision.client_nom || 'N/A'}</p>
                                  </div>
                                  <div>
                                    <Label className="text-xs text-muted-foreground">Transporteur</Label>
                                    <p className="font-semibold">{decision.transporteur_choisi_nom}</p>
                                  </div>
                                  <div>
                                    <Label className="text-xs text-muted-foreground">Score</Label>
                                    <p className={`font-bold text-2xl ${getScoreColor(decision.score_transporteur)}`}>
                                      {decision.score_transporteur?.toFixed(1)}/100
                                    </p>
                                  </div>
                                </div>

                                <div>
                                  <Label className="text-xs text-muted-foreground">Critères</Label>
                                  <div className="flex gap-2 mt-2">
                                    <Badge variant="outline">{decision.poids_colis} kg</Badge>
                                    <Badge variant="outline">{decision.pays_destination}</Badge>
                                    <Badge variant="outline">{decision.delai_souhaite}</Badge>
                                    <Badge variant="outline">{decision.nombre_regles_matchees} règles</Badge>
                                  </div>
                                </div>

                                {decision.analyse_ia && (
                                  <div>
                                    <Label className="text-xs text-muted-foreground">Analyse IA</Label>
                                    <div className="mt-2 p-4 bg-muted rounded-lg">
                                      <p className="text-sm whitespace-pre-wrap">{decision.analyse_ia}</p>
                                    </div>
                                  </div>
                                )}

                                {decision.transporteurs_alternatives && (
                                  <div>
                                    <Label className="text-xs text-muted-foreground">Alternatives considérées</Label>
                                    <div className="mt-2 space-y-2">
                                      {parseTransporteursAlternatives(decision.transporteurs_alternatives).map((alt, idx) => (
                                        <div key={idx} className="flex items-center justify-between p-2 bg-muted rounded">
                                          <span className="font-medium">{alt.nom || 'N/A'}</span>
                                          <Badge variant="outline" className={getScoreColor(alt.score || 0)}>
                                            {alt.score || 0}/100
                                          </Badge>
                                        </div>
                                      ))}
                                    </div>
                                  </div>
                                )}

                                {decision.raison_forcage && (
                                  <div>
                                    <Label className="text-xs text-muted-foreground">Raison du forçage</Label>
                                    <p className="mt-2 p-3 bg-orange-500/10 border border-orange-500/20 rounded">
                                      {decision.raison_forcage}
                                    </p>
                                  </div>
                                )}
                              </div>
                            </DialogContent>
                          </Dialog>

                          <Button 
                            variant="outline" 
                            size="sm"
                            onClick={() => handleRecalculer(decision.commande_id)}
                          >
                            <Repeat className="h-4 w-4 mr-2" />
                            Recalculer
                          </Button>

                          <Button 
                            variant="outline" 
                            size="sm"
                            onClick={() => {
                              setSelectedDecision(decision);
                              setForceDialogOpen(true);
                            }}
                          >
                            Forcer
                          </Button>
                        </div>
                      </div>
                    </CardHeader>
                    <CardContent>
                      <div className="grid grid-cols-4 gap-4">
                        <div>
                          <Label className="text-xs text-muted-foreground">Transporteur</Label>
                          <p className="font-semibold">{decision.transporteur_choisi_nom}</p>
                          <p className="text-xs text-muted-foreground">{decision.transporteur_choisi_code}</p>
                        </div>
                        <div>
                          <Label className="text-xs text-muted-foreground">Score</Label>
                          <p className={`font-bold text-xl ${getScoreColor(decision.score_transporteur)}`}>
                            {decision.score_transporteur?.toFixed(1)}/100
                          </p>
                        </div>
                        <div>
                          <Label className="text-xs text-muted-foreground">Confiance</Label>
                          <p className="font-semibold">
                            {((decision.confiance_decision || 0) * 100).toFixed(0)}%
                          </p>
                        </div>
                        <div>
                          <Label className="text-xs text-muted-foreground">Règles matchées</Label>
                          <p className="font-semibold">{decision.nombre_regles_matchees}</p>
                        </div>
                      </div>
                    </CardContent>
                  </Card>
                ))}
              </div>
            </ScrollArea>
          )}
        </TabsContent>
      </Tabs>

      <Dialog open={forceDialogOpen} onOpenChange={setForceDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Forcer un transporteur</DialogTitle>
          </DialogHeader>
          <div className="space-y-4">
            <div>
              <Label>Transporteur</Label>
              <Select
                value={forcageData.code}
                onValueChange={(value) => {
                  const trans = transporteurs.find(t => t.code_service === value);
                  setForcageData({ ...forcageData, code: value, nom: trans?.nom_affichage || '' });
                }}
              >
                <SelectTrigger>
                  <SelectValue placeholder="Sélectionner un transporteur" />
                </SelectTrigger>
                <SelectContent>
                  {transporteurs.map((t) => (
                    <SelectItem key={t.code_service} value={t.code_service}>
                      {t.nom_affichage}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div>
              <Label>Raison du forçage</Label>
              <Textarea
                value={forcageData.raison}
                onChange={(e) => setForcageData({ ...forcageData, raison: e.target.value })}
                placeholder="Expliquez pourquoi vous forcez ce transporteur..."
                rows={4}
              />
            </div>

            <div className="flex gap-2">
              <Button onClick={handleForceTransporteur} className="flex-1">
                <Check className="h-4 w-4 mr-2" />
                Confirmer
              </Button>
              <Button variant="outline" onClick={() => setForceDialogOpen(false)} className="flex-1">
                <X className="h-4 w-4 mr-2" />
                Annuler
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}
