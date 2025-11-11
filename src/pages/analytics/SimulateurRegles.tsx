import { DashboardLayout } from "@/components/DashboardLayout";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Switch } from "@/components/ui/switch";
import { Separator } from "@/components/ui/separator";
import { PlayCircle, TrendingDown, TrendingUp, Package, DollarSign } from "lucide-react";
import { useState } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer, PieChart, Pie, Cell } from 'recharts';

const SimulateurRegles = () => {
  const [regleModifiee, setRegleModifiee] = useState<any>({
    nom_regle: '',
    description: '',
    priorite: 100,
    actif: true,
    force_transporteur: false,
    transporteur_force_id: null,
    conditions: {
      poids_min: null,
      poids_max: null,
      pays: [],
      delai_souhaite: null
    }
  });
  const [periodeJours, setPeriodeJours] = useState(30);
  const [resultatsSimulation, setResultatsSimulation] = useState<any>(null);

  const { data: transporteurs } = useQuery({
    queryKey: ['transporteurs'],
    queryFn: async () => {
      const { data } = await supabase
        .from('transporteur_service')
        .select('*')
        .eq('actif', true);
      return data || [];
    }
  });

  const simulerMutation = useMutation({
    mutationFn: async () => {
      const { data, error } = await supabase.functions.invoke('simulate-rule-impact', {
        body: {
          regle_modifiee: regleModifiee,
          periode_jours: periodeJours
        }
      });
      
      if (error) throw error;
      return data;
    },
    onSuccess: (data) => {
      setResultatsSimulation(data);
      toast.success('Simulation terminée avec succès');
    },
    onError: (error: any) => {
      toast.error(error.message || 'Erreur lors de la simulation');
    }
  });

  const COLORS = ['hsl(var(--primary))', 'hsl(var(--secondary))', 'hsl(var(--accent))', 'hsl(var(--muted))'];

  return (
    <DashboardLayout>
      <div className="space-y-6">
        <div>
          <h1 className="text-3xl font-bold tracking-tight">Simulateur de Règles</h1>
          <p className="text-muted-foreground">
            Testez l'impact de modifications de règles sur l'historique de commandes
          </p>
        </div>

        <div className="grid gap-6 lg:grid-cols-2">
          {/* Configuration de la règle */}
          <Card>
            <CardHeader>
              <CardTitle>Configuration de la Règle</CardTitle>
              <CardDescription>Définissez les paramètres de la règle à simuler</CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="space-y-2">
                <Label htmlFor="nom">Nom de la règle</Label>
                <Input 
                  id="nom"
                  value={regleModifiee.nom_regle}
                  onChange={(e) => setRegleModifiee({...regleModifiee, nom_regle: e.target.value})}
                  placeholder="Ex: Privilégier DHL pour Europe"
                />
              </div>

              <div className="space-y-2">
                <Label htmlFor="description">Description</Label>
                <Textarea 
                  id="description"
                  value={regleModifiee.description}
                  onChange={(e) => setRegleModifiee({...regleModifiee, description: e.target.value})}
                  placeholder="Décrivez la règle..."
                />
              </div>

              <div className="space-y-2">
                <Label htmlFor="priorite">Priorité (1-1000)</Label>
                <Input 
                  id="priorite"
                  type="number"
                  value={regleModifiee.priorite}
                  onChange={(e) => setRegleModifiee({...regleModifiee, priorite: parseInt(e.target.value)})}
                />
              </div>

              <div className="flex items-center justify-between">
                <Label htmlFor="force">Forcer un transporteur</Label>
                <Switch 
                  id="force"
                  checked={regleModifiee.force_transporteur}
                  onCheckedChange={(checked) => setRegleModifiee({...regleModifiee, force_transporteur: checked})}
                />
              </div>

              {regleModifiee.force_transporteur && (
                <div className="space-y-2">
                  <Label htmlFor="transporteur">Transporteur forcé</Label>
                  <Select 
                    value={regleModifiee.transporteur_force_id || ''}
                    onValueChange={(value) => setRegleModifiee({...regleModifiee, transporteur_force_id: value})}
                  >
                    <SelectTrigger>
                      <SelectValue placeholder="Sélectionner un transporteur" />
                    </SelectTrigger>
                    <SelectContent>
                      {transporteurs?.map((t: any) => (
                        <SelectItem key={t.id} value={t.id}>
                          {t.nom_affichage}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
              )}

              <Separator />

              <div className="space-y-4">
                <h3 className="font-semibold">Conditions d'application</h3>
                
                <div className="grid grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <Label htmlFor="poids-min">Poids min (kg)</Label>
                    <Input 
                      id="poids-min"
                      type="number"
                      step="0.1"
                      value={regleModifiee.conditions.poids_min || ''}
                      onChange={(e) => setRegleModifiee({
                        ...regleModifiee, 
                        conditions: {...regleModifiee.conditions, poids_min: parseFloat(e.target.value) || null}
                      })}
                    />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="poids-max">Poids max (kg)</Label>
                    <Input 
                      id="poids-max"
                      type="number"
                      step="0.1"
                      value={regleModifiee.conditions.poids_max || ''}
                      onChange={(e) => setRegleModifiee({
                        ...regleModifiee, 
                        conditions: {...regleModifiee.conditions, poids_max: parseFloat(e.target.value) || null}
                      })}
                    />
                  </div>
                </div>

                <div className="space-y-2">
                  <Label htmlFor="periode">Période de simulation (jours)</Label>
                  <Input 
                    id="periode"
                    type="number"
                    value={periodeJours}
                    onChange={(e) => setPeriodeJours(parseInt(e.target.value))}
                  />
                </div>
              </div>

              <Button 
                className="w-full"
                onClick={() => simulerMutation.mutate()}
                disabled={simulerMutation.isPending || !regleModifiee.nom_regle}
              >
                <PlayCircle className="h-4 w-4 mr-2" />
                {simulerMutation.isPending ? 'Simulation en cours...' : 'Lancer la simulation'}
              </Button>
            </CardContent>
          </Card>

          {/* Résultats de la simulation */}
          <Card>
            <CardHeader>
              <CardTitle>Résultats de Simulation</CardTitle>
              <CardDescription>Impact estimé sur les {periodeJours} derniers jours</CardDescription>
            </CardHeader>
            <CardContent>
              {!resultatsSimulation ? (
                <div className="text-center py-12 text-muted-foreground">
                  <Package className="h-12 w-12 mx-auto mb-4 opacity-50" />
                  <p>Lancez une simulation pour voir les résultats</p>
                </div>
              ) : (
                <div className="space-y-6">
                  {/* KPIs */}
                  <div className="grid grid-cols-2 gap-4">
                    <Card>
                      <CardContent className="pt-6">
                        <div className="flex items-center gap-2 mb-2">
                          <Package className="h-4 w-4 text-muted-foreground" />
                          <span className="text-sm text-muted-foreground">Commandes impactées</span>
                        </div>
                        <p className="text-2xl font-bold">
                          {resultatsSimulation.simulation?.commandes_impactees || 0}
                        </p>
                        <p className="text-xs text-muted-foreground">
                          {resultatsSimulation.simulation?.pourcentage_impact || 0}% du total
                        </p>
                      </CardContent>
                    </Card>

                    <Card>
                      <CardContent className="pt-6">
                        <div className="flex items-center gap-2 mb-2">
                          <DollarSign className="h-4 w-4 text-muted-foreground" />
                          <span className="text-sm text-muted-foreground">Économies estimées</span>
                        </div>
                        <p className="text-2xl font-bold">
                          {parseFloat(resultatsSimulation.simulation?.economies_estimees || 0) >= 0 ? (
                            <span className="text-green-600">
                              +{resultatsSimulation.simulation?.economies_estimees} €
                            </span>
                          ) : (
                            <span className="text-destructive">
                              {resultatsSimulation.simulation?.economies_estimees} €
                            </span>
                          )}
                        </p>
                        <p className="text-xs text-muted-foreground">
                          {resultatsSimulation.simulation?.pourcentage_economie || 0}% d'économie
                        </p>
                      </CardContent>
                    </Card>
                  </div>

                  {/* Graphique de distribution */}
                  {resultatsSimulation.simulation && (
                    <>
                      <div className="space-y-2">
                        <h3 className="font-semibold">Distribution des transporteurs</h3>
                        <ResponsiveContainer width="100%" height={200}>
                          <BarChart data={[
                            { name: 'Avant', ...resultatsSimulation.simulation.distribution_avant },
                            { name: 'Après', ...resultatsSimulation.simulation.distribution_apres }
                          ]}>
                            <CartesianGrid strokeDasharray="3 3" />
                            <XAxis dataKey="name" />
                            <YAxis />
                            <Tooltip />
                            <Legend />
                            {Object.keys(resultatsSimulation.simulation.distribution_avant || {}).map((key, idx) => (
                              <Bar key={key} dataKey={key} fill={COLORS[idx % COLORS.length]} />
                            ))}
                          </BarChart>
                        </ResponsiveContainer>
                      </div>

                      <div className="space-y-2">
                        <h3 className="font-semibold">Comparaison des coûts</h3>
                        <div className="grid grid-cols-2 gap-4 text-sm">
                          <div>
                            <p className="text-muted-foreground">Coût total avant</p>
                            <p className="text-xl font-bold">{resultatsSimulation.simulation.cout_total_avant} €</p>
                          </div>
                          <div>
                            <p className="text-muted-foreground">Coût total après</p>
                            <p className="text-xl font-bold">{resultatsSimulation.simulation.cout_total_apres} €</p>
                          </div>
                        </div>
                      </div>
                    </>
                  )}
                </div>
              )}
            </CardContent>
          </Card>
        </div>
      </div>
    </DashboardLayout>
  );
};

export default SimulateurRegles;