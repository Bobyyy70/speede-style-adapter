import { useState } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Checkbox } from '@/components/ui/checkbox';
import {
  Rocket,
  Shirt,
  Laptop,
  Heart,
  Package,
  Zap,
  CheckCircle2,
  Settings,
  AlertCircle
} from 'lucide-react';
import { cn } from '@/lib/utils';
import { toast } from 'sonner';

interface QuickStartStepTemplateProps {
  onComplete: (data: any) => void;
  wizardData: Record<string, any>;
}

interface BusinessTemplate {
  id: string;
  name: string;
  icon: any;
  description: string;
  color: string;
  presets: {
    stockSync: string;
    orderImport: string;
    priceRules: string;
    notifications: string[];
  };
  bestFor: string;
  features: string[];
}

const TEMPLATES: BusinessTemplate[] = [
  {
    id: 'fashion',
    name: 'Mode & Vêtements',
    icon: Shirt,
    description: 'Optimisé pour la vente de vêtements, chaussures et accessoires',
    color: 'pink',
    presets: {
      stockSync: '15min',
      orderImport: 'real-time',
      priceRules: 'seasonal',
      notifications: ['stock_low', 'size_out_of_stock', 'seasonal_trends']
    },
    bestFor: '👗 Boutiques de mode, chaussures, accessoires',
    features: [
      'Gestion des tailles/couleurs',
      'Stock par variante',
      'Alertes tendances saisonnières',
      'Règles de prix dynamiques',
      'Import photos multi-angles'
    ]
  },
  {
    id: 'electronics',
    name: 'High-Tech & Électronique',
    icon: Laptop,
    description: 'Parfait pour les produits électroniques et technologiques',
    color: 'blue',
    presets: {
      stockSync: '5min',
      orderImport: 'real-time',
      priceRules: 'competitive',
      notifications: ['price_match', 'competitor_alert', 'warranty_reminder']
    },
    bestFor: '💻 Smartphones, laptops, accessoires tech',
    features: [
      'Sync ultra-rapide (5 min)',
      'Veille concurrentielle prix',
      'Gestion garanties',
      'Alertes stock critique',
      'Suivi numéros série'
    ]
  },
  {
    id: 'beauty',
    name: 'Beauté & Cosmétiques',
    icon: Heart,
    description: 'Configuration pour cosmétiques et produits de beauté',
    color: 'purple',
    presets: {
      stockSync: '15min',
      orderImport: 'real-time',
      priceRules: 'bundle',
      notifications: ['expiry_date', 'bundle_promo', 'restock_alert']
    },
    bestFor: '💄 Maquillage, soins, parfums',
    features: [
      'Gestion dates expiration',
      'Bundles & promotions',
      'Alertes restockage',
      'Règles prix pack',
      'Sync images produits'
    ]
  },
  {
    id: 'dropshipping',
    name: 'Dropshipping',
    icon: Package,
    description: 'Spécialement conçu pour le dropshipping multi-fournisseurs',
    color: 'orange',
    presets: {
      stockSync: '30min',
      orderImport: 'real-time',
      priceRules: 'margin',
      notifications: ['supplier_delay', 'margin_alert', 'order_routing']
    },
    bestFor: '📦 Business dropshipping, multi-fournisseurs',
    features: [
      'Routage fournisseurs auto',
      'Calcul marges temps réel',
      'Alertes délais livraison',
      'Gestion multi-suppliers',
      'Prix + marge automatique'
    ]
  },
  {
    id: 'general',
    name: 'Configuration Générique',
    icon: Zap,
    description: 'Configuration équilibrée pour tous types de produits',
    color: 'green',
    presets: {
      stockSync: '15min',
      orderImport: 'real-time',
      priceRules: 'standard',
      notifications: ['order_received', 'stock_low', 'daily_summary']
    },
    bestFor: '🛍️ Tout type de commerce',
    features: [
      'Configuration standard',
      'Toutes fonctionnalités actives',
      'Sync équilibrée',
      'Notifications essentielles',
      'Personnalisable après setup'
    ]
  }
];

const QUICK_WINS = [
  {
    id: 'auto_stock',
    label: 'Activer la mise à jour automatique du stock',
    description: 'Le stock est synchronisé automatiquement entre toutes vos plateformes',
    enabled: true
  },
  {
    id: 'order_notifications',
    label: 'Recevoir des notifications pour chaque nouvelle commande',
    description: 'Email + SMS pour chaque commande importée',
    enabled: true
  },
  {
    id: 'low_stock_alerts',
    label: 'Alertes de stock faible',
    description: 'Être averti quand un produit arrive à moins de 5 unités',
    enabled: true
  },
  {
    id: 'daily_report',
    label: 'Rapport quotidien des ventes',
    description: 'Recevoir un email récapitulatif tous les matins à 9h',
    enabled: false
  }
];

export default function QuickStartStepTemplate({ onComplete, wizardData }: QuickStartStepTemplateProps) {
  const [selectedTemplate, setSelectedTemplate] = useState<string | null>(null);
  const [quickWins, setQuickWins] = useState<Record<string, boolean>>(
    Object.fromEntries(QUICK_WINS.map(qw => [qw.id, qw.enabled]))
  );
  const [isLaunching, setIsLaunching] = useState(false);

  const handleSelectTemplate = (templateId: string) => {
    setSelectedTemplate(templateId);
  };

  const handleToggleQuickWin = (id: string) => {
    setQuickWins(prev => ({ ...prev, [id]: !prev[id] }));
  };

  const handleLaunch = async () => {
    if (!selectedTemplate) return;

    setIsLaunching(true);

    // Simulate setup
    toast.info('🚀 Initialisation de votre OMS...', {
      description: 'Configuration des intégrations en cours'
    });

    await new Promise(resolve => setTimeout(resolve, 1500));

    toast.success('✅ Configuration terminée !', {
      description: 'Votre OMS est opérationnel. Redirection...'
    });

    await new Promise(resolve => setTimeout(resolve, 1000));

    onComplete({
      template: selectedTemplate,
      quickWins: quickWins
    });
  };

  const selectedTemplateData = TEMPLATES.find(t => t.id === selectedTemplate);

  return (
    <div className="space-y-6">
      <Card className="border-2">
        <CardHeader>
          <CardTitle className="text-xl">3️⃣ Choisissez votre Configuration</CardTitle>
          <CardDescription>
            Sélectionnez le modèle adapté à votre type de business pour une configuration optimale
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-6">
          {/* Templates Grid */}
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {TEMPLATES.map((template) => {
              const Icon = template.icon;
              const isSelected = selectedTemplate === template.id;
              const isRecommended = template.id === 'general';

              return (
                <Card
                  key={template.id}
                  className={cn(
                    'cursor-pointer transition-all relative',
                    isSelected
                      ? 'border-primary border-2 shadow-lg'
                      : 'hover:border-primary/50 hover:shadow-md'
                  )}
                  onClick={() => handleSelectTemplate(template.id)}
                >
                  {isRecommended && (
                    <div className="absolute -top-2 -right-2 bg-green-500 text-white text-xs font-bold px-2 py-1 rounded-full">
                      Populaire
                    </div>
                  )}

                  <CardHeader className="pb-3">
                    <div className="flex items-start justify-between">
                      <div className={cn(
                        'w-10 h-10 rounded-lg flex items-center justify-center mb-2',
                        template.color === 'pink' && 'bg-pink-100 dark:bg-pink-900',
                        template.color === 'blue' && 'bg-blue-100 dark:bg-blue-900',
                        template.color === 'purple' && 'bg-purple-100 dark:bg-purple-900',
                        template.color === 'orange' && 'bg-orange-100 dark:bg-orange-900',
                        template.color === 'green' && 'bg-green-100 dark:bg-green-900'
                      )}>
                        <Icon className={cn(
                          'w-5 h-5',
                          template.color === 'pink' && 'text-pink-600 dark:text-pink-400',
                          template.color === 'blue' && 'text-blue-600 dark:text-blue-400',
                          template.color === 'purple' && 'text-purple-600 dark:text-purple-400',
                          template.color === 'orange' && 'text-orange-600 dark:text-orange-400',
                          template.color === 'green' && 'text-green-600 dark:text-green-400'
                        )} />
                      </div>
                      {isSelected && (
                        <CheckCircle2 className="w-5 h-5 text-primary" />
                      )}
                    </div>

                    <CardTitle className="text-base">{template.name}</CardTitle>
                    <CardDescription className="text-xs">
                      {template.description}
                    </CardDescription>
                  </CardHeader>

                  <CardContent className="space-y-3">
                    <div className="pt-2 border-t">
                      <p className="text-xs font-medium text-muted-foreground mb-1">Idéal pour:</p>
                      <p className="text-xs">{template.bestFor}</p>
                    </div>

                    <div className="pt-2 border-t">
                      <p className="text-xs font-medium text-muted-foreground mb-2">Inclus:</p>
                      <ul className="space-y-1">
                        {template.features.slice(0, 3).map((feature, idx) => (
                          <li key={idx} className="text-xs flex items-start space-x-1">
                            <span className="text-primary mt-0.5">✓</span>
                            <span>{feature}</span>
                          </li>
                        ))}
                      </ul>
                    </div>
                  </CardContent>
                </Card>
              );
            })}
          </div>

          {/* Selected Template Details */}
          {selectedTemplateData && (
            <Card className="bg-gradient-to-r from-blue-50/50 to-purple-50/50 dark:from-blue-950/20 dark:to-purple-950/20 border-2">
              <CardHeader>
                <div className="flex items-center space-x-3">
                  <Settings className="w-5 h-5 text-primary" />
                  <CardTitle className="text-lg">Configuration "{selectedTemplateData.name}"</CardTitle>
                </div>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                  <div>
                    <p className="text-xs text-muted-foreground mb-1">Sync Stock</p>
                    <Badge variant="secondary">{selectedTemplateData.presets.stockSync}</Badge>
                  </div>
                  <div>
                    <p className="text-xs text-muted-foreground mb-1">Import Commandes</p>
                    <Badge variant="secondary">{selectedTemplateData.presets.orderImport}</Badge>
                  </div>
                  <div>
                    <p className="text-xs text-muted-foreground mb-1">Règles Prix</p>
                    <Badge variant="secondary">{selectedTemplateData.presets.priceRules}</Badge>
                  </div>
                  <div>
                    <p className="text-xs text-muted-foreground mb-1">Notifications</p>
                    <Badge variant="secondary">{selectedTemplateData.presets.notifications.length} types</Badge>
                  </div>
                </div>

                <div className="pt-3 border-t">
                  <p className="text-sm font-medium mb-2">Toutes les fonctionnalités:</p>
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-2">
                    {selectedTemplateData.features.map((feature, idx) => (
                      <div key={idx} className="flex items-center space-x-2 text-sm">
                        <CheckCircle2 className="w-4 h-4 text-green-500" />
                        <span>{feature}</span>
                      </div>
                    ))}
                  </div>
                </div>
              </CardContent>
            </Card>
          )}

          {/* Quick Wins */}
          <div className="space-y-3">
            <div className="flex items-center space-x-2">
              <Zap className="w-5 h-5 text-yellow-500" />
              <h3 className="font-semibold">Quick Wins - Activez maintenant</h3>
            </div>

            <div className="space-y-2">
              {QUICK_WINS.map((qw) => (
                <div
                  key={qw.id}
                  className="flex items-start space-x-3 p-3 rounded-lg border bg-card hover:bg-accent/5 transition-colors"
                >
                  <Checkbox
                    id={qw.id}
                    checked={quickWins[qw.id]}
                    onCheckedChange={() => handleToggleQuickWin(qw.id)}
                    className="mt-1"
                  />
                  <div className="flex-1">
                    <label
                      htmlFor={qw.id}
                      className="text-sm font-medium cursor-pointer"
                    >
                      {qw.label}
                    </label>
                    <p className="text-xs text-muted-foreground mt-0.5">
                      {qw.description}
                    </p>
                  </div>
                </div>
              ))}
            </div>
          </div>

          {/* Launch Button */}
          <div className="flex items-center justify-end pt-4 border-t">
            <Button
              size="lg"
              onClick={handleLaunch}
              disabled={!selectedTemplate || isLaunching}
              className="min-w-[200px] bg-gradient-to-r from-blue-600 to-purple-600 hover:from-blue-700 hover:to-purple-700"
            >
              {isLaunching ? (
                <>
                  <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-white mr-2" />
                  Lancement...
                </>
              ) : (
                <>
                  <Rocket className="w-4 h-4 mr-2" />
                  Lancer mon OMS !
                </>
              )}
            </Button>
          </div>
        </CardContent>
      </Card>

      {/* Info Card */}
      <Card className="bg-green-50/50 dark:bg-green-950/20 border-green-200 dark:border-green-800">
        <CardContent className="pt-6">
          <div className="flex items-start space-x-3">
            <AlertCircle className="w-5 h-5 text-green-600 dark:text-green-400 mt-0.5" />
            <div className="space-y-1">
              <h4 className="font-semibold text-green-900 dark:text-green-100">
                ✨ Personnalisable à tout moment
              </h4>
              <p className="text-sm text-green-800 dark:text-green-200">
                Cette configuration est un <strong>point de départ</strong>. Vous pourrez modifier tous les paramètres
                depuis <strong>Paramètres → Configuration OMS</strong> après le lancement. Aucune configuration n'est définitive !
              </p>
            </div>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
