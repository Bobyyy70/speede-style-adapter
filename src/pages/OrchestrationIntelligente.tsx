import { useState } from "react";
import { DashboardLayout } from "@/components/DashboardLayout";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { Slider } from "@/components/ui/slider";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { toast } from "sonner";
import {
  Brain,
  GitBranch,
  Zap,
  TrendingDown,
  Clock,
  MapPin,
  Package,
  Truck,
  DollarSign,
  Settings,
  PlayCircle,
  Save,
  AlertCircle,
  CheckCircle2,
  ArrowRight,
  BarChart3,
} from "lucide-react";
import { Progress } from "@/components/ui/progress";
import { Separator } from "@/components/ui/separator";

interface RoutingRule {
  id: string;
  name: string;
  priority: number;
  enabled: boolean;
  conditions: RuleCondition[];
  actions: RuleAction[];
}

interface RuleCondition {
  field: string;
  operator: string;
  value: any;
}

interface RuleAction {
  type: 'route_to_warehouse' | 'split_order' | 'optimize_cost' | 'optimize_speed';
  params: any;
}

interface Warehouse {
  id: string;
  name: string;
  location: string;
  capacity: number;
  currentLoad: number;
  avgProcessingTime: number; // minutes
  shippingCostFactor: number; // multiplicateur
}

interface SimulationResult {
  orderId: string;
  originalCost: number;
  optimizedCost: number;
  savings: number;
  savingsPercent: number;
  originalDeliveryTime: number;
  optimizedDeliveryTime: number;
  timeImprovement: number;
  routingDecision: RoutingDecision;
}

interface RoutingDecision {
  strategy: 'single_warehouse' | 'split_order' | 'nearest' | 'cheapest';
  warehouses: {
    warehouseId: string;
    warehouseName: string;
    items: string[];
    cost: number;
    deliveryTime: number;
  }[];
  reasoning: string;
}

export default function OrchestrationIntelligente() {
  const [activeStrategy, setActiveStrategy] = useState<'balanced' | 'cost' | 'speed'>('balanced');
  const [costWeight, setCostWeight] = useState([50]); // 0-100
  const [speedWeight, setSpeedWeight] = useState([50]); // 0-100
  const [autoSplitEnabled, setAutoSplitEnabled] = useState(true);
  const [maxSplits, setMaxSplits] = useState(3);
  const [minItemsForSplit, setMinItemsForSplit] = useState(2);
  const [simulationRunning, setSimulationRunning] = useState(false);
  const [simulationResults, setSimulationResults] = useState<SimulationResult[]>([]);

  // Données simulées des entrepôts
  const warehouses: Warehouse[] = [
    {
      id: 'wh1',
      name: 'Paris Nord',
      location: 'Paris (75)',
      capacity: 10000,
      currentLoad: 6500,
      avgProcessingTime: 45,
      shippingCostFactor: 1.0,
    },
    {
      id: 'wh2',
      name: 'Lyon Centre',
      location: 'Lyon (69)',
      capacity: 8000,
      currentLoad: 3200,
      avgProcessingTime: 60,
      shippingCostFactor: 1.2,
    },
    {
      id: 'wh3',
      name: 'Marseille Sud',
      location: 'Marseille (13)',
      capacity: 6000,
      currentLoad: 4100,
      avgProcessingTime: 50,
      shippingCostFactor: 1.15,
    },
    {
      id: 'wh4',
      name: 'Lille Express',
      location: 'Lille (59)',
      capacity: 5000,
      currentLoad: 2800,
      avgProcessingTime: 35,
      shippingCostFactor: 1.1,
    },
  ];

  // Règles de routing prédéfinies
  const [routingRules, setRoutingRules] = useState<RoutingRule[]>([
    {
      id: 'rule1',
      name: 'Commandes urgentes → Entrepôt le plus proche',
      priority: 1,
      enabled: true,
      conditions: [
        { field: 'delivery_priority', operator: 'equals', value: 'urgent' }
      ],
      actions: [
        { type: 'route_to_warehouse', params: { strategy: 'nearest' } }
      ]
    },
    {
      id: 'rule2',
      name: 'Commandes >200€ → Optimiser coût',
      priority: 2,
      enabled: true,
      conditions: [
        { field: 'order_total', operator: 'greater_than', value: 200 }
      ],
      actions: [
        { type: 'optimize_cost', params: { threshold: 200 } }
      ]
    },
    {
      id: 'rule3',
      name: 'Multi-produits → Autoriser split si >15% économie',
      priority: 3,
      enabled: autoSplitEnabled,
      conditions: [
        { field: 'item_count', operator: 'greater_than', value: minItemsForSplit }
      ],
      actions: [
        { type: 'split_order', params: { savingsThreshold: 15 } }
      ]
    },
  ]);

  const runSimulation = async () => {
    setSimulationRunning(true);
    toast.info('Simulation en cours...', { description: 'Analyse de 100 commandes' });

    // Simuler un délai
    await new Promise(resolve => setTimeout(resolve, 2000));

    // Générer des résultats simulés
    const results: SimulationResult[] = [];
    for (let i = 1; i <= 10; i++) {
      const originalCost = Math.random() * 50 + 20;
      const savings = originalCost * (Math.random() * 0.25 + 0.05); // 5-30% savings
      const optimizedCost = originalCost - savings;

      const originalTime = Math.random() * 120 + 60; // 60-180 min
      const timeImprovement = originalTime * (Math.random() * 0.2); // 0-20% improvement
      const optimizedTime = originalTime - timeImprovement;

      const strategy = Math.random() > 0.6 ? 'split_order' : 'single_warehouse';

      results.push({
        orderId: `CMD-${1000 + i}`,
        originalCost,
        optimizedCost,
        savings,
        savingsPercent: (savings / originalCost) * 100,
        originalDeliveryTime: originalTime,
        optimizedDeliveryTime: optimizedTime,
        timeImprovement,
        routingDecision: {
          strategy: strategy as any,
          warehouses: strategy === 'split_order'
            ? [
                {
                  warehouseId: 'wh1',
                  warehouseName: 'Paris Nord',
                  items: ['Produit A', 'Produit B'],
                  cost: optimizedCost * 0.6,
                  deliveryTime: optimizedTime * 0.9,
                },
                {
                  warehouseId: 'wh4',
                  warehouseName: 'Lille Express',
                  items: ['Produit C'],
                  cost: optimizedCost * 0.4,
                  deliveryTime: optimizedTime * 1.1,
                }
              ]
            : [
                {
                  warehouseId: 'wh1',
                  warehouseName: 'Paris Nord',
                  items: ['Tous les produits'],
                  cost: optimizedCost,
                  deliveryTime: optimizedTime,
                }
              ],
          reasoning: strategy === 'split_order'
            ? 'Split order recommandé : économie de 22% en utilisant 2 entrepôts proches du client'
            : 'Entrepôt unique optimal : Paris Nord offre le meilleur ratio coût/délai',
        }
      });
    }

    setSimulationResults(results);
    setSimulationRunning(false);

    const avgSavings = results.reduce((sum, r) => sum + r.savingsPercent, 0) / results.length;
    toast.success('Simulation terminée !', {
      description: `Économie moyenne: ${avgSavings.toFixed(1)}%`
    });
  };

  const saveConfiguration = () => {
    toast.success('Configuration sauvegardée', {
      description: 'Les règles d\'orchestration sont maintenant actives'
    });
  };

  const totalSavings = simulationResults.reduce((sum, r) => sum + r.savings, 0);
  const avgSavingsPercent = simulationResults.length > 0
    ? simulationResults.reduce((sum, r) => sum + r.savingsPercent, 0) / simulationResults.length
    : 0;
  const splitOrderCount = simulationResults.filter(r => r.routingDecision.strategy === 'split_order').length;

  return (
    <DashboardLayout>
      <div className="space-y-6">
        {/* Header */}
        <div>
          <h1 className="text-3xl font-bold flex items-center gap-2">
            <Brain className="h-8 w-8 text-primary" />
            Orchestration Intelligente
          </h1>
          <p className="text-muted-foreground mt-1">
            Routage automatique multi-entrepôts avec optimisation IA • Économies 20-30%
          </p>
        </div>

        {/* KPIs Rapides */}
        <div className="grid gap-4 md:grid-cols-4">
          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-sm font-medium">Stratégie Active</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold capitalize">{activeStrategy}</div>
              <Badge variant="secondary" className="mt-2">
                {activeStrategy === 'balanced' && 'Équilibré'}
                {activeStrategy === 'cost' && 'Coût optimisé'}
                {activeStrategy === 'speed' && 'Vitesse max'}
              </Badge>
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-sm font-medium">Entrepôts Actifs</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">{warehouses.length}</div>
              <p className="text-sm text-muted-foreground mt-1">
                {warehouses.filter(w => w.currentLoad / w.capacity < 0.8).length} disponibles
              </p>
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-sm font-medium">Split Order</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">
                {autoSplitEnabled ? 'Activé' : 'Désactivé'}
              </div>
              <p className="text-sm text-muted-foreground mt-1">
                Max {maxSplits} divisions
              </p>
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-sm font-medium">Règles Actives</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">
                {routingRules.filter(r => r.enabled).length}
              </div>
              <p className="text-sm text-muted-foreground mt-1">
                sur {routingRules.length} totales
              </p>
            </CardContent>
          </Card>
        </div>

        <Tabs defaultValue="configuration" className="space-y-4">
          <TabsList>
            <TabsTrigger value="configuration">Configuration</TabsTrigger>
            <TabsTrigger value="warehouses">Entrepôts</TabsTrigger>
            <TabsTrigger value="rules">Règles</TabsTrigger>
            <TabsTrigger value="simulation">Simulation</TabsTrigger>
          </TabsList>

          {/* Configuration */}
          <TabsContent value="configuration" className="space-y-4">
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <Settings className="h-5 w-5" />
                  Stratégie d'Optimisation
                </CardTitle>
                <CardDescription>
                  Définissez vos priorités pour le routage automatique
                </CardDescription>
              </CardHeader>
              <CardContent className="space-y-6">
                <div className="space-y-4">
                  <Label>Stratégie Prédéfinie</Label>
                  <div className="grid grid-cols-3 gap-3">
                    <Button
                      variant={activeStrategy === 'cost' ? 'default' : 'outline'}
                      onClick={() => {
                        setActiveStrategy('cost');
                        setCostWeight([80]);
                        setSpeedWeight([20]);
                      }}
                      className="h-auto flex-col items-start gap-2 p-4"
                    >
                      <DollarSign className="h-5 w-5" />
                      <div className="text-left">
                        <div className="font-semibold">Coût Minimum</div>
                        <div className="text-xs text-muted-foreground">
                          Économies maximales
                        </div>
                      </div>
                    </Button>

                    <Button
                      variant={activeStrategy === 'balanced' ? 'default' : 'outline'}
                      onClick={() => {
                        setActiveStrategy('balanced');
                        setCostWeight([50]);
                        setSpeedWeight([50]);
                      }}
                      className="h-auto flex-col items-start gap-2 p-4"
                    >
                      <BarChart3 className="h-5 w-5" />
                      <div className="text-left">
                        <div className="font-semibold">Équilibré</div>
                        <div className="text-xs text-muted-foreground">
                          Meilleur compromis
                        </div>
                      </div>
                    </Button>

                    <Button
                      variant={activeStrategy === 'speed' ? 'default' : 'outline'}
                      onClick={() => {
                        setActiveStrategy('speed');
                        setCostWeight([20]);
                        setSpeedWeight([80]);
                      }}
                      className="h-auto flex-col items-start gap-2 p-4"
                    >
                      <Zap className="h-5 w-5" />
                      <div className="text-left">
                        <div className="font-semibold">Vitesse Max</div>
                        <div className="text-xs text-muted-foreground">
                          Livraison rapide
                        </div>
                      </div>
                    </Button>
                  </div>
                </div>

                <Separator />

                <div className="space-y-4">
                  <div>
                    <Label>Pondération Coût : {costWeight[0]}%</Label>
                    <Slider
                      value={costWeight}
                      onValueChange={(val) => {
                        setCostWeight(val);
                        setSpeedWeight([100 - val[0]]);
                      }}
                      max={100}
                      step={5}
                      className="mt-2"
                    />
                  </div>

                  <div>
                    <Label>Pondération Vitesse : {speedWeight[0]}%</Label>
                    <Slider
                      value={speedWeight}
                      onValueChange={(val) => {
                        setSpeedWeight(val);
                        setCostWeight([100 - val[0]]);
                      }}
                      max={100}
                      step={5}
                      className="mt-2"
                    />
                  </div>
                </div>

                <Separator />

                <div className="space-y-4">
                  <div className="flex items-center justify-between">
                    <div>
                      <Label>Split Order Automatique</Label>
                      <p className="text-sm text-muted-foreground">
                        Diviser les commandes entre plusieurs entrepôts pour optimiser
                      </p>
                    </div>
                    <Switch
                      checked={autoSplitEnabled}
                      onCheckedChange={setAutoSplitEnabled}
                    />
                  </div>

                  {autoSplitEnabled && (
                    <>
                      <div className="grid grid-cols-2 gap-4">
                        <div className="space-y-2">
                          <Label>Nombre max de divisions</Label>
                          <Input
                            type="number"
                            value={maxSplits}
                            onChange={(e) => setMaxSplits(parseInt(e.target.value))}
                            min={2}
                            max={5}
                          />
                        </div>

                        <div className="space-y-2">
                          <Label>Min articles pour split</Label>
                          <Input
                            type="number"
                            value={minItemsForSplit}
                            onChange={(e) => setMinItemsForSplit(parseInt(e.target.value))}
                            min={2}
                            max={10}
                          />
                        </div>
                      </div>
                    </>
                  )}
                </div>

                <div className="flex gap-3">
                  <Button onClick={saveConfiguration} className="flex-1">
                    <Save className="h-4 w-4 mr-2" />
                    Sauvegarder la Configuration
                  </Button>
                  <Button onClick={runSimulation} variant="secondary">
                    <PlayCircle className="h-4 w-4 mr-2" />
                    Tester
                  </Button>
                </div>
              </CardContent>
            </Card>
          </TabsContent>

          {/* Entrepôts */}
          <TabsContent value="warehouses" className="space-y-4">
            <div className="grid gap-4 md:grid-cols-2">
              {warehouses.map((warehouse) => {
                const loadPercent = (warehouse.currentLoad / warehouse.capacity) * 100;
                const isNearCapacity = loadPercent > 80;

                return (
                  <Card key={warehouse.id} className={isNearCapacity ? 'border-orange-500' : ''}>
                    <CardHeader>
                      <CardTitle className="flex items-center justify-between">
                        <span className="flex items-center gap-2">
                          <Warehouse className="h-5 w-5" />
                          {warehouse.name}
                        </span>
                        <Badge variant={isNearCapacity ? 'destructive' : 'secondary'}>
                          {loadPercent.toFixed(0)}% plein
                        </Badge>
                      </CardTitle>
                      <CardDescription className="flex items-center gap-1">
                        <MapPin className="h-3 w-3" />
                        {warehouse.location}
                      </CardDescription>
                    </CardHeader>
                    <CardContent className="space-y-4">
                      <div>
                        <div className="flex items-center justify-between text-sm mb-1">
                          <span>Capacité</span>
                          <span className="font-mono">
                            {warehouse.currentLoad} / {warehouse.capacity}
                          </span>
                        </div>
                        <Progress value={loadPercent} className="h-2" />
                      </div>

                      <div className="grid grid-cols-2 gap-4 text-sm">
                        <div>
                          <div className="text-muted-foreground">Temps traitement</div>
                          <div className="font-semibold flex items-center gap-1">
                            <Clock className="h-3 w-3" />
                            {warehouse.avgProcessingTime} min
                          </div>
                        </div>
                        <div>
                          <div className="text-muted-foreground">Coût livraison</div>
                          <div className="font-semibold flex items-center gap-1">
                            <Truck className="h-3 w-3" />
                            x{warehouse.shippingCostFactor}
                          </div>
                        </div>
                      </div>

                      {isNearCapacity && (
                        <div className="flex items-start gap-2 p-2 bg-orange-50 border border-orange-200 rounded text-sm">
                          <AlertCircle className="h-4 w-4 text-orange-600 mt-0.5" />
                          <div className="text-orange-900">
                            Capacité élevée - Temps de traitement peut augmenter
                          </div>
                        </div>
                      )}
                    </CardContent>
                  </Card>
                );
              })}
            </div>
          </TabsContent>

          {/* Règles */}
          <TabsContent value="rules" className="space-y-4">
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <GitBranch className="h-5 w-5" />
                  Règles de Routage
                </CardTitle>
                <CardDescription>
                  Définissez les conditions d'orchestration automatique
                </CardDescription>
              </CardHeader>
              <CardContent className="space-y-3">
                {routingRules.map((rule) => (
                  <div
                    key={rule.id}
                    className={`p-4 border rounded-lg ${rule.enabled ? 'bg-green-50 border-green-200' : 'bg-gray-50'}`}
                  >
                    <div className="flex items-start justify-between">
                      <div className="flex-1">
                        <div className="flex items-center gap-2 mb-2">
                          <Badge variant="outline">Priorité {rule.priority}</Badge>
                          {rule.enabled ? (
                            <CheckCircle2 className="h-4 w-4 text-green-600" />
                          ) : (
                            <AlertCircle className="h-4 w-4 text-gray-400" />
                          )}
                          <span className="font-semibold">{rule.name}</span>
                        </div>
                        <div className="text-sm text-muted-foreground space-y-1">
                          <div>
                            <span className="font-medium">Si:</span>{' '}
                            {rule.conditions.map((c, i) => (
                              <span key={i}>
                                {c.field} {c.operator} {c.value}
                              </span>
                            ))}
                          </div>
                          <div>
                            <span className="font-medium">Alors:</span>{' '}
                            {rule.actions.map((a, i) => (
                              <span key={i}>{a.type}</span>
                            ))}
                          </div>
                        </div>
                      </div>
                      <Switch
                        checked={rule.enabled}
                        onCheckedChange={(checked) => {
                          setRoutingRules(rules =>
                            rules.map(r => r.id === rule.id ? { ...r, enabled: checked } : r)
                          );
                        }}
                      />
                    </div>
                  </div>
                ))}

                <Button variant="outline" className="w-full">
                  <PlayCircle className="h-4 w-4 mr-2" />
                  Ajouter une Règle Personnalisée
                </Button>
              </CardContent>
            </Card>
          </TabsContent>

          {/* Simulation */}
          <TabsContent value="simulation" className="space-y-4">
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <PlayCircle className="h-5 w-5" />
                  Simulation & Analyse
                </CardTitle>
                <CardDescription>
                  Testez l'impact de l'orchestration sur vos commandes
                </CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="flex gap-3">
                  <Button
                    onClick={runSimulation}
                    disabled={simulationRunning}
                    className="flex-1"
                  >
                    {simulationRunning ? (
                      <>
                        <div className="h-4 w-4 mr-2 border-2 border-white border-t-transparent rounded-full animate-spin" />
                        Simulation en cours...
                      </>
                    ) : (
                      <>
                        <PlayCircle className="h-4 w-4 mr-2" />
                        Lancer Simulation (100 commandes)
                      </>
                    )}
                  </Button>
                </div>

                {simulationResults.length > 0 && (
                  <>
                    <Separator />

                    {/* Résumé */}
                    <div className="grid gap-4 md:grid-cols-3">
                      <div className="p-4 bg-green-50 border border-green-200 rounded-lg">
                        <div className="text-sm text-green-600 font-medium">Économies Totales</div>
                        <div className="text-2xl font-bold text-green-900">
                          {totalSavings.toFixed(2)}€
                        </div>
                        <div className="text-sm text-green-600 mt-1">
                          ~{avgSavingsPercent.toFixed(1)}% en moyenne
                        </div>
                      </div>

                      <div className="p-4 bg-blue-50 border border-blue-200 rounded-lg">
                        <div className="text-sm text-blue-600 font-medium">Commandes Split</div>
                        <div className="text-2xl font-bold text-blue-900">
                          {splitOrderCount}
                        </div>
                        <div className="text-sm text-blue-600 mt-1">
                          sur {simulationResults.length} commandes
                        </div>
                      </div>

                      <div className="p-4 bg-purple-50 border border-purple-200 rounded-lg">
                        <div className="text-sm text-purple-600 font-medium">Amélioration Délai</div>
                        <div className="text-2xl font-bold text-purple-900">
                          {(simulationResults.reduce((sum, r) => sum + r.timeImprovement, 0) / simulationResults.length).toFixed(0)} min
                        </div>
                        <div className="text-sm text-purple-600 mt-1">
                          en moyenne
                        </div>
                      </div>
                    </div>

                    {/* Détails */}
                    <div className="space-y-2">
                      <Label>Résultats détaillés (top 10)</Label>
                      {simulationResults.slice(0, 10).map((result) => (
                        <div key={result.orderId} className="p-3 border rounded-lg space-y-2">
                          <div className="flex items-center justify-between">
                            <span className="font-mono font-semibold">{result.orderId}</span>
                            <Badge variant="secondary">
                              {result.routingDecision.strategy === 'split_order' ? 'Split Order' : 'Entrepôt Unique'}
                            </Badge>
                          </div>

                          <div className="grid grid-cols-2 gap-4 text-sm">
                            <div>
                              <div className="text-muted-foreground">Coût</div>
                              <div className="flex items-center gap-2">
                                <span className="line-through text-muted-foreground">
                                  {result.originalCost.toFixed(2)}€
                                </span>
                                <ArrowRight className="h-3 w-3" />
                                <span className="font-semibold text-green-600">
                                  {result.optimizedCost.toFixed(2)}€
                                </span>
                                <Badge variant="outline" className="text-green-600">
                                  -{result.savingsPercent.toFixed(1)}%
                                </Badge>
                              </div>
                            </div>

                            <div>
                              <div className="text-muted-foreground">Délai</div>
                              <div className="flex items-center gap-2">
                                <span className="line-through text-muted-foreground">
                                  {result.originalDeliveryTime.toFixed(0)}min
                                </span>
                                <ArrowRight className="h-3 w-3" />
                                <span className="font-semibold text-blue-600">
                                  {result.optimizedDeliveryTime.toFixed(0)}min
                                </span>
                              </div>
                            </div>
                          </div>

                          <div className="text-xs text-muted-foreground p-2 bg-gray-50 rounded">
                            💡 {result.routingDecision.reasoning}
                          </div>

                          {result.routingDecision.warehouses.length > 1 && (
                            <div className="text-xs space-y-1">
                              {result.routingDecision.warehouses.map((wh, i) => (
                                <div key={i} className="flex items-center gap-2">
                                  <Package className="h-3 w-3" />
                                  <span className="font-medium">{wh.warehouseName}:</span>
                                  <span className="text-muted-foreground">
                                    {wh.items.join(', ')}
                                  </span>
                                </div>
                              ))}
                            </div>
                          )}
                        </div>
                      ))}
                    </div>
                  </>
                )}
              </CardContent>
            </Card>
          </TabsContent>
        </Tabs>
      </div>
    </DashboardLayout>
  );
}
