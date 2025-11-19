import { useState } from "react";
import { DashboardLayout } from "@/components/DashboardLayout";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { toast } from "sonner";
import {
  Brain,
  TrendingUp,
  TrendingDown,
  AlertTriangle,
  Package,
  DollarSign,
  Activity,
  Zap,
  BarChart3,
  LineChart,
  Target,
  ShieldAlert,
  Sparkles,
  RefreshCw,
} from "lucide-react";
import { Progress } from "@/components/ui/progress";

interface Prediction {
  id: string;
  type: 'sales' | 'stock' | 'demand' | 'risk';
  title: string;
  confidence: number;
  impact: 'high' | 'medium' | 'low';
  prediction: string;
  recommendation: string;
  data: any;
}

interface ProductForecast {
  productId: string;
  productName: string;
  currentStock: number;
  predictedDemand7d: number;
  predictedDemand30d: number;
  stockoutRisk: number;
  recommendedReorder: number;
  reorderUrgency: 'urgent' | 'soon' | 'normal';
  trend: 'up' | 'down' | 'stable';
  seasonality: number;
}

interface RiskScore {
  orderId: string;
  customerName: string;
  orderValue: number;
  fraudScore: number;
  deliveryRisk: number;
  returnProbability: number;
  overallRisk: 'high' | 'medium' | 'low';
  reasons: string[];
  recommendations: string[];
}

export default function AnalyticsPredictifs() {
  const [timeHorizon, setTimeHorizon] = useState<'7d' | '30d' | '90d'>('30d');
  const [analysisRunning, setAnalysisRunning] = useState(false);

  // Données de prédictions simulées
  const predictions: Prediction[] = [
    {
      id: '1',
      type: 'sales',
      title: 'Pic de ventes prévu',
      confidence: 87,
      impact: 'high',
      prediction: '+45% de commandes attendues ce weekend (Black Friday)',
      recommendation: 'Augmenter la capacité de préparation de 30% et avertir les transporteurs',
      data: { increase: 45, daysUntil: 3 },
    },
    {
      id: '2',
      type: 'stock',
      title: 'Risque de rupture - T-Shirt Blanc',
      confidence: 92,
      impact: 'high',
      prediction: 'Rupture de stock prévue dans 6 jours au rythme actuel',
      recommendation: 'Commander 200 unités en URGENCE (délai fournisseur: 5 jours)',
      data: { product: 'T-Shirt Blanc', daysUntilStockout: 6, recommendedQuantity: 200 },
    },
    {
      id: '3',
      type: 'demand',
      title: 'Nouvelle tendance détectée',
      confidence: 78,
      impact: 'medium',
      prediction: 'Hausse de 25% sur la catégorie "Hoodies" détectée',
      recommendation: 'Augmenter le stock de hoodies de 40% pour les 2 prochaines semaines',
      data: { category: 'Hoodies', increase: 25 },
    },
    {
      id: '4',
      type: 'risk',
      title: 'Fraude potentielle détectée',
      confidence: 65,
      impact: 'medium',
      prediction: '3 commandes récentes présentent des patterns suspects',
      recommendation: 'Vérifier manuellement les commandes CMD-1234, CMD-1235, CMD-1240',
      data: { suspiciousOrders: 3 },
    },
  ];

  const productForecasts: ProductForecast[] = [
    {
      productId: '1',
      productName: 'T-Shirt Premium Blanc',
      currentStock: 45,
      predictedDemand7d: 38,
      predictedDemand30d: 165,
      stockoutRisk: 85,
      recommendedReorder: 200,
      reorderUrgency: 'urgent',
      trend: 'up',
      seasonality: 1.2,
    },
    {
      productId: '2',
      productName: 'Jeans Slim Noir',
      currentStock: 120,
      predictedDemand7d: 15,
      predictedDemand30d: 62,
      stockoutRisk: 12,
      recommendedReorder: 0,
      reorderUrgency: 'normal',
      trend: 'stable',
      seasonality: 1.0,
    },
    {
      productId: '3',
      productName: 'Hoodie Gris Premium',
      currentStock: 78,
      predictedDemand7d: 42,
      predictedDemand30d: 185,
      stockoutRisk: 68,
      recommendedReorder: 150,
      reorderUrgency: 'soon',
      trend: 'up',
      seasonality: 1.35,
    },
    {
      productId: '4',
      productName: 'Chaussettes Pack x3',
      currentStock: 250,
      predictedDemand7d: 22,
      predictedDemand30d: 95,
      stockoutRisk: 5,
      recommendedReorder: 0,
      reorderUrgency: 'normal',
      trend: 'down',
      seasonality: 0.9,
    },
  ];

  const riskScores: RiskScore[] = [
    {
      orderId: 'CMD-1234',
      customerName: 'Client A',
      orderValue: 450.00,
      fraudScore: 72,
      deliveryRisk: 35,
      returnProbability: 28,
      overallRisk: 'high',
      reasons: [
        'Première commande de montant élevé',
        'Adresse de livraison différente de facturation',
        'IP localisée à l\'étranger',
      ],
      recommendations: [
        'Vérifier l\'identité du client',
        'Demander une pièce d\'identité',
        'Envoyer en recommandé avec signature',
      ],
    },
    {
      orderId: 'CMD-1235',
      customerName: 'Client B',
      orderValue: 89.99,
      fraudScore: 18,
      deliveryRisk: 45,
      returnProbability: 62,
      overallRisk: 'medium',
      reasons: [
        'Historique de 2 retours sur 3 commandes',
        'Zone géographique à fort taux de retour',
      ],
      recommendations: [
        'Inclure documentation détaillée',
        'Proposer assistance pré-vente',
      ],
    },
  ];

  const runAnalysis = async () => {
    setAnalysisRunning(true);
    toast.info('Analyse ML en cours...', { description: 'Traitement des données historiques' });

    await new Promise(resolve => setTimeout(resolve, 2500));

    setAnalysisRunning(false);
    toast.success('Analyse terminée !', {
      description: `${predictions.length} insights générés avec IA`
    });
  };

  const getImpactColor = (impact: string) => {
    switch (impact) {
      case 'high': return 'text-red-600 bg-red-50 border-red-200';
      case 'medium': return 'text-orange-600 bg-orange-50 border-orange-200';
      case 'low': return 'text-blue-600 bg-blue-50 border-blue-200';
      default: return 'text-gray-600 bg-gray-50 border-gray-200';
    }
  };

  const getImpactIcon = (impact: string) => {
    switch (impact) {
      case 'high': return <AlertTriangle className="h-5 w-5 text-red-600" />;
      case 'medium': return <Activity className="h-5 w-5 text-orange-600" />;
      case 'low': return <Target className="h-5 w-5 text-blue-600" />;
      default: return <Activity className="h-5 w-5" />;
    }
  };

  const getTrendIcon = (trend: string) => {
    switch (trend) {
      case 'up': return <TrendingUp className="h-4 w-4 text-green-600" />;
      case 'down': return <TrendingDown className="h-4 w-4 text-red-600" />;
      default: return <Activity className="h-4 w-4 text-gray-600" />;
    }
  };

  const getUrgencyBadge = (urgency: string) => {
    switch (urgency) {
      case 'urgent':
        return <Badge variant="destructive">URGENT</Badge>;
      case 'soon':
        return <Badge variant="default" className="bg-orange-500">À prévoir</Badge>;
      default:
        return <Badge variant="secondary">Normal</Badge>;
    }
  };

  return (
    <DashboardLayout>
      <div className="space-y-6">
        {/* Header */}
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-3xl font-bold flex items-center gap-2">
              <Brain className="h-8 w-8 text-purple-600" />
              Analytics Prédictifs IA
            </h1>
            <p className="text-muted-foreground mt-1">
              Machine Learning • Prévisions automatiques • Recommandations intelligentes
            </p>
          </div>
          <div className="flex items-center gap-3">
            <Select value={timeHorizon} onValueChange={(v: any) => setTimeHorizon(v)}>
              <SelectTrigger className="w-32">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="7d">7 jours</SelectItem>
                <SelectItem value="30d">30 jours</SelectItem>
                <SelectItem value="90d">90 jours</SelectItem>
              </SelectContent>
            </Select>
            <Button
              onClick={runAnalysis}
              disabled={analysisRunning}
            >
              {analysisRunning ? (
                <>
                  <RefreshCw className="h-4 w-4 mr-2 animate-spin" />
                  Analyse...
                </>
              ) : (
                <>
                  <Sparkles className="h-4 w-4 mr-2" />
                  Lancer Analyse IA
                </>
              )}
            </Button>
          </div>
        </div>

        {/* KPIs */}
        <div className="grid gap-4 md:grid-cols-4">
          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-sm font-medium">Précision Modèle</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">94.3%</div>
              <Progress value={94.3} className="mt-2" />
              <p className="text-xs text-muted-foreground mt-1">
                Sur 1000+ prédictions
              </p>
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-sm font-medium">Insights Actifs</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">{predictions.length}</div>
              <p className="text-xs text-muted-foreground mt-1">
                {predictions.filter(p => p.impact === 'high').length} haute priorité
              </p>
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-sm font-medium">Économies Prévues</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold text-green-600">12,450€</div>
              <p className="text-xs text-muted-foreground mt-1">
                Via optimisations suggérées
              </p>
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-sm font-medium">Ruptures Évitées</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold text-blue-600">23</div>
              <p className="text-xs text-muted-foreground mt-1">
                Ce mois grâce à l'IA
              </p>
            </CardContent>
          </Card>
        </div>

        <Tabs defaultValue="predictions" className="space-y-4">
          <TabsList>
            <TabsTrigger value="predictions">Prédictions</TabsTrigger>
            <TabsTrigger value="forecasts">Prévisions Stock</TabsTrigger>
            <TabsTrigger value="risk">Scoring Risque</TabsTrigger>
            <TabsTrigger value="recommendations">Recommandations</TabsTrigger>
          </TabsList>

          {/* Prédictions */}
          <TabsContent value="predictions" className="space-y-4">
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <Sparkles className="h-5 w-5 text-purple-600" />
                  Insights IA en Temps Réel
                </CardTitle>
                <CardDescription>
                  Détection automatique de patterns et anomalies
                </CardDescription>
              </CardHeader>
              <CardContent className="space-y-3">
                {predictions.map((prediction) => (
                  <div
                    key={prediction.id}
                    className={`p-4 border rounded-lg ${getImpactColor(prediction.impact)}`}
                  >
                    <div className="flex items-start gap-3 mb-3">
                      {getImpactIcon(prediction.impact)}
                      <div className="flex-1">
                        <div className="flex items-center justify-between mb-2">
                          <span className="font-semibold">{prediction.title}</span>
                          <div className="flex items-center gap-2">
                            <Badge variant="outline" className="bg-white">
                              {prediction.confidence}% confiance
                            </Badge>
                            <Badge variant="outline" className="capitalize bg-white">
                              {prediction.type}
                            </Badge>
                          </div>
                        </div>
                        <div className="text-sm mb-2">
                          <span className="font-medium">Prédiction:</span> {prediction.prediction}
                        </div>
                        <div className="text-sm p-2 bg-white rounded border">
                          💡 <span className="font-medium">Recommandation:</span> {prediction.recommendation}
                        </div>
                      </div>
                    </div>
                    <div className="flex gap-2">
                      <Button size="sm" variant="default">
                        Appliquer Recommandation
                      </Button>
                      <Button size="sm" variant="outline">
                        Voir Détails
                      </Button>
                    </div>
                  </div>
                ))}
              </CardContent>
            </Card>
          </TabsContent>

          {/* Prévisions Stock */}
          <TabsContent value="forecasts" className="space-y-4">
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <LineChart className="h-5 w-5" />
                  Prévisions de Demande par Produit
                </CardTitle>
                <CardDescription>
                  Algorithme ML basé sur historique + saisonnalité + tendances
                </CardDescription>
              </CardHeader>
              <CardContent className="space-y-3">
                {productForecasts.map((forecast) => (
                  <div
                    key={forecast.productId}
                    className={`p-4 border rounded-lg ${
                      forecast.stockoutRisk > 60 ? 'border-red-300 bg-red-50' : ''
                    }`}
                  >
                    <div className="flex items-start justify-between mb-3">
                      <div className="flex items-center gap-2">
                        <Package className="h-5 w-5 text-muted-foreground" />
                        <div>
                          <div className="font-semibold">{forecast.productName}</div>
                          <div className="text-sm text-muted-foreground flex items-center gap-2">
                            Stock actuel: <span className="font-mono font-bold">{forecast.currentStock}</span> unités
                            {getTrendIcon(forecast.trend)}
                          </div>
                        </div>
                      </div>
                      {getUrgencyBadge(forecast.reorderUrgency)}
                    </div>

                    <div className="grid grid-cols-3 gap-4 mb-3">
                      <div className="text-sm">
                        <div className="text-muted-foreground">Demande 7j</div>
                        <div className="font-semibold text-lg">{forecast.predictedDemand7d}</div>
                      </div>
                      <div className="text-sm">
                        <div className="text-muted-foreground">Demande 30j</div>
                        <div className="font-semibold text-lg">{forecast.predictedDemand30d}</div>
                      </div>
                      <div className="text-sm">
                        <div className="text-muted-foreground">Risque Rupture</div>
                        <div className="flex items-center gap-2">
                          <Progress value={forecast.stockoutRisk} className="h-2 flex-1" />
                          <span className="font-semibold text-sm">{forecast.stockoutRisk}%</span>
                        </div>
                      </div>
                    </div>

                    {forecast.recommendedReorder > 0 && (
                      <div className="p-3 bg-blue-50 border border-blue-200 rounded">
                        <div className="text-sm font-medium text-blue-900 mb-1">
                          💡 Recommandation de Réappro
                        </div>
                        <div className="text-sm text-blue-700">
                          Commander <span className="font-bold">{forecast.recommendedReorder} unités</span> maintenant
                          {forecast.reorderUrgency === 'urgent' && ' (URGENT)'}
                        </div>
                        <div className="flex gap-2 mt-2">
                          <Button size="sm" variant="default">
                            Créer Commande Fournisseur
                          </Button>
                          <Button size="sm" variant="outline">
                            Simuler Scenario
                          </Button>
                        </div>
                      </div>
                    )}

                    {forecast.seasonality !== 1.0 && (
                      <div className="text-xs text-muted-foreground mt-2 flex items-center gap-1">
                        <Activity className="h-3 w-3" />
                        Saisonnalité détectée: x{forecast.seasonality.toFixed(2)}
                      </div>
                    )}
                  </div>
                ))}
              </CardContent>
            </Card>
          </TabsContent>

          {/* Scoring Risque */}
          <TabsContent value="risk" className="space-y-4">
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <ShieldAlert className="h-5 w-5" />
                  Scoring Risque Multi-Critères
                </CardTitle>
                <CardDescription>
                  Détection fraude • Prédiction retours • Évaluation delivery
                </CardDescription>
              </CardHeader>
              <CardContent className="space-y-3">
                {riskScores.map((risk) => (
                  <div
                    key={risk.orderId}
                    className={`p-4 border rounded-lg ${
                      risk.overallRisk === 'high'
                        ? 'border-red-300 bg-red-50'
                        : risk.overallRisk === 'medium'
                        ? 'border-orange-300 bg-orange-50'
                        : 'border-green-300 bg-green-50'
                    }`}
                  >
                    <div className="flex items-start justify-between mb-3">
                      <div>
                        <div className="font-semibold">{risk.orderId}</div>
                        <div className="text-sm text-muted-foreground">
                          {risk.customerName} • {risk.orderValue.toFixed(2)}€
                        </div>
                      </div>
                      <Badge
                        variant={risk.overallRisk === 'high' ? 'destructive' : 'default'}
                      >
                        Risque {risk.overallRisk === 'high' ? 'ÉLEVÉ' : risk.overallRisk === 'medium' ? 'MOYEN' : 'FAIBLE'}
                      </Badge>
                    </div>

                    <div className="grid grid-cols-3 gap-3 mb-3">
                      <div>
                        <div className="text-xs text-muted-foreground mb-1">Fraude</div>
                        <div className="flex items-center gap-2">
                          <Progress
                            value={risk.fraudScore}
                            className="h-2 flex-1"
                          />
                          <span className="text-xs font-medium">{risk.fraudScore}%</span>
                        </div>
                      </div>
                      <div>
                        <div className="text-xs text-muted-foreground mb-1">Delivery</div>
                        <div className="flex items-center gap-2">
                          <Progress
                            value={risk.deliveryRisk}
                            className="h-2 flex-1"
                          />
                          <span className="text-xs font-medium">{risk.deliveryRisk}%</span>
                        </div>
                      </div>
                      <div>
                        <div className="text-xs text-muted-foreground mb-1">Retour</div>
                        <div className="flex items-center gap-2">
                          <Progress
                            value={risk.returnProbability}
                            className="h-2 flex-1"
                          />
                          <span className="text-xs font-medium">{risk.returnProbability}%</span>
                        </div>
                      </div>
                    </div>

                    <div className="space-y-2 mb-3">
                      <div className="text-sm font-medium">Raisons détectées:</div>
                      <ul className="text-sm space-y-1">
                        {risk.reasons.map((reason, idx) => (
                          <li key={idx} className="flex items-start gap-2">
                            <AlertTriangle className="h-3 w-3 mt-0.5 flex-shrink-0" />
                            {reason}
                          </li>
                        ))}
                      </ul>
                    </div>

                    <div className="p-3 bg-white border rounded">
                      <div className="text-sm font-medium mb-2">💡 Actions recommandées:</div>
                      <ul className="text-sm space-y-1">
                        {risk.recommendations.map((rec, idx) => (
                          <li key={idx}>✓ {rec}</li>
                        ))}
                      </ul>
                    </div>

                    <div className="flex gap-2 mt-3">
                      <Button size="sm" variant="default">
                        Valider Manuellement
                      </Button>
                      <Button size="sm" variant="outline">
                        Mettre en Attente
                      </Button>
                      <Button size="sm" variant="destructive">
                        Annuler Commande
                      </Button>
                    </div>
                  </div>
                ))}

                <div className="p-4 bg-green-50 border border-green-200 rounded-lg">
                  <div className="flex items-center gap-2 mb-2">
                    <CheckCircle2 className="h-5 w-5 text-green-600" />
                    <span className="font-semibold text-green-900">
                      Performance du Modèle
                    </span>
                  </div>
                  <div className="grid grid-cols-3 gap-4 text-sm">
                    <div>
                      <div className="text-green-600">Fraudes détectées</div>
                      <div className="text-2xl font-bold text-green-900">12</div>
                      <div className="text-xs text-green-600">Ce mois</div>
                    </div>
                    <div>
                      <div className="text-green-600">Économies</div>
                      <div className="text-2xl font-bold text-green-900">8,450€</div>
                      <div className="text-xs text-green-600">Pertes évitées</div>
                    </div>
                    <div>
                      <div className="text-green-600">Précision</div>
                      <div className="text-2xl font-bold text-green-900">96%</div>
                      <div className="text-xs text-green-600">Taux de détection</div>
                    </div>
                  </div>
                </div>
              </CardContent>
            </Card>
          </TabsContent>

          {/* Recommandations */}
          <TabsContent value="recommendations" className="space-y-4">
            <div className="grid gap-4 md:grid-cols-2">
              <Card>
                <CardHeader>
                  <CardTitle className="text-sm">Top Recommandations IA</CardTitle>
                </CardHeader>
                <CardContent className="space-y-2">
                  {predictions
                    .filter(p => p.impact === 'high')
                    .map((p, idx) => (
                      <div key={p.id} className="flex items-start gap-2 p-2 bg-gray-50 rounded">
                        <span className="font-bold text-primary">{idx + 1}.</span>
                        <div className="text-sm flex-1">
                          <div className="font-medium">{p.title}</div>
                          <div className="text-muted-foreground text-xs mt-1">
                            {p.recommendation}
                          </div>
                        </div>
                      </div>
                    ))}
                </CardContent>
              </Card>

              <Card>
                <CardHeader>
                  <CardTitle className="text-sm">Impact Estimé</CardTitle>
                </CardHeader>
                <CardContent className="space-y-3">
                  <div className="p-3 bg-green-50 border border-green-200 rounded">
                    <div className="text-sm text-green-600">Économies potentielles</div>
                    <div className="text-2xl font-bold text-green-900">12,450€</div>
                    <div className="text-xs text-green-600">Si toutes recommandations appliquées</div>
                  </div>
                  <div className="p-3 bg-blue-50 border border-blue-200 rounded">
                    <div className="text-sm text-blue-600">Amélioration service</div>
                    <div className="text-2xl font-bold text-blue-900">+15%</div>
                    <div className="text-xs text-blue-600">Taux de satisfaction client</div>
                  </div>
                  <div className="p-3 bg-purple-50 border border-purple-200 rounded">
                    <div className="text-sm text-purple-600">Réduction risques</div>
                    <div className="text-2xl font-bold text-purple-900">-40%</div>
                    <div className="text-xs text-purple-600">Ruptures de stock évitées</div>
                  </div>
                </CardContent>
              </Card>
            </div>
          </TabsContent>
        </Tabs>
      </div>
    </DashboardLayout>
  );
}
