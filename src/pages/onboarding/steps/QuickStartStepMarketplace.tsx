import { useState } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { ShoppingCart, Store, CheckCircle2, ArrowRight, Sparkles, TrendingUp } from 'lucide-react';
import { cn } from '@/lib/utils';

interface QuickStartStepMarketplaceProps {
  onComplete: (data: any) => void;
  wizardData: Record<string, any>;
}

interface MarketplaceOption {
  id: 'amazon' | 'shopify' | 'both';
  name: string;
  icon: any;
  description: string;
  features: string[];
  bestFor: string;
  popularity: number;
  setupTime: string;
  color: string;
}

const MARKETPLACE_OPTIONS: MarketplaceOption[] = [
  {
    id: 'amazon',
    name: 'Amazon Seller Central',
    icon: ShoppingCart,
    description: 'Synchronisez vos ventes Amazon (FR, UK, DE, ES, IT)',
    features: [
      'Import automatique commandes',
      'Gestion stock temps réel',
      'Support FBA + FBM',
      'Multi-pays (5 marketplaces EU)',
      'Sync toutes les 15 min'
    ],
    bestFor: '📦 Vendeurs Amazon exclusifs ou dominants',
    popularity: 92,
    setupTime: '3 min',
    color: 'orange'
  },
  {
    id: 'shopify',
    name: 'Shopify',
    icon: Store,
    description: 'Connectez votre boutique Shopify en 2 clics',
    features: [
      'Import produits + commandes',
      'Sync bidirectionnel stock',
      'Support multi-magasins',
      'Webhooks temps réel',
      'Compatible Shopify Plus'
    ],
    bestFor: '🛍️ Boutiques e-commerce indépendantes',
    popularity: 88,
    setupTime: '2 min',
    color: 'green'
  },
  {
    id: 'both',
    name: 'Amazon + Shopify',
    icon: Sparkles,
    description: 'Configuration multi-canal pour maximiser vos ventes',
    features: [
      'Stock unifié Amazon + Shopify',
      'Évite les surventes cross-canal',
      'Commandes centralisées',
      'Prix différenciés par canal',
      'Règles de routage intelligentes'
    ],
    bestFor: '🚀 Stratégie omnicanal (recommandé)',
    popularity: 95,
    setupTime: '5 min',
    color: 'purple'
  }
];

export default function QuickStartStepMarketplace({ onComplete, wizardData }: QuickStartStepMarketplaceProps) {
  const [selectedMarketplace, setSelectedMarketplace] = useState<string | null>(
    wizardData.marketplace || null
  );

  const handleSelect = (marketplaceId: string) => {
    setSelectedMarketplace(marketplaceId);
  };

  const handleContinue = () => {
    if (!selectedMarketplace) return;

    onComplete({
      marketplace: selectedMarketplace
    });
  };

  return (
    <div className="space-y-6">
      <Card className="border-2">
        <CardHeader>
          <CardTitle className="text-xl">1️⃣ Choisissez votre Marketplace</CardTitle>
          <CardDescription>
            Sélectionnez la plateforme que vous utilisez pour vendre en ligne
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            {MARKETPLACE_OPTIONS.map((option) => {
              const Icon = option.icon;
              const isSelected = selectedMarketplace === option.id;
              const isRecommended = option.id === 'both';

              return (
                <Card
                  key={option.id}
                  className={cn(
                    'cursor-pointer transition-all relative overflow-hidden',
                    isSelected
                      ? 'border-primary border-2 shadow-lg scale-105'
                      : 'hover:border-primary/50 hover:shadow-md'
                  )}
                  onClick={() => handleSelect(option.id)}
                >
                  {isRecommended && (
                    <div className="absolute top-0 right-0 bg-gradient-to-l from-yellow-500 to-yellow-400 text-white text-xs font-bold px-3 py-1 rounded-bl-lg">
                      ⭐ Recommandé
                    </div>
                  )}

                  <CardHeader className="pb-3">
                    <div className="flex items-start justify-between">
                      <div className={cn(
                        'w-12 h-12 rounded-lg flex items-center justify-center',
                        option.color === 'orange' && 'bg-orange-100 dark:bg-orange-900',
                        option.color === 'green' && 'bg-green-100 dark:bg-green-900',
                        option.color === 'purple' && 'bg-purple-100 dark:bg-purple-900'
                      )}>
                        <Icon className={cn(
                          'w-6 h-6',
                          option.color === 'orange' && 'text-orange-600 dark:text-orange-400',
                          option.color === 'green' && 'text-green-600 dark:text-green-400',
                          option.color === 'purple' && 'text-purple-600 dark:text-purple-400'
                        )} />
                      </div>
                      {isSelected && (
                        <CheckCircle2 className="w-6 h-6 text-primary" />
                      )}
                    </div>
                    <CardTitle className="text-lg mt-3">{option.name}</CardTitle>
                    <CardDescription className="text-sm">
                      {option.description}
                    </CardDescription>
                  </CardHeader>

                  <CardContent className="space-y-4">
                    {/* Setup Time */}
                    <div className="flex items-center justify-between text-sm">
                      <span className="text-muted-foreground">Setup:</span>
                      <Badge variant="secondary" className="text-xs">
                        ⏱️ {option.setupTime}
                      </Badge>
                    </div>

                    {/* Popularity */}
                    <div className="space-y-1">
                      <div className="flex items-center justify-between text-sm">
                        <span className="text-muted-foreground">Popularité:</span>
                        <span className="font-semibold text-primary">{option.popularity}%</span>
                      </div>
                      <div className="w-full bg-muted rounded-full h-2">
                        <div
                          className={cn(
                            'h-2 rounded-full transition-all',
                            option.color === 'orange' && 'bg-orange-500',
                            option.color === 'green' && 'bg-green-500',
                            option.color === 'purple' && 'bg-purple-500'
                          )}
                          style={{ width: `${option.popularity}%` }}
                        />
                      </div>
                    </div>

                    {/* Best For */}
                    <div className="pt-2 border-t">
                      <p className="text-xs font-medium text-muted-foreground mb-2">Idéal pour:</p>
                      <p className="text-sm font-medium">{option.bestFor}</p>
                    </div>

                    {/* Features */}
                    <div className="pt-2 border-t">
                      <p className="text-xs font-medium text-muted-foreground mb-2">Fonctionnalités:</p>
                      <ul className="space-y-1">
                        {option.features.slice(0, 3).map((feature, idx) => (
                          <li key={idx} className="text-xs flex items-start space-x-1">
                            <span className="text-primary mt-0.5">✓</span>
                            <span>{feature}</span>
                          </li>
                        ))}
                      </ul>
                      {option.features.length > 3 && (
                        <p className="text-xs text-muted-foreground mt-1">
                          + {option.features.length - 3} autres fonctionnalités
                        </p>
                      )}
                    </div>
                  </CardContent>
                </Card>
              );
            })}
          </div>

          {/* Continue Button */}
          <div className="mt-6 flex justify-end">
            <Button
              size="lg"
              onClick={handleContinue}
              disabled={!selectedMarketplace}
              className="min-w-[200px]"
            >
              Continuer
              <ArrowRight className="w-4 h-4 ml-2" />
            </Button>
          </div>
        </CardContent>
      </Card>

      {/* Info Card */}
      <Card className="bg-blue-50/50 dark:bg-blue-950/20 border-blue-200 dark:border-blue-800">
        <CardContent className="pt-6">
          <div className="flex items-start space-x-3">
            <TrendingUp className="w-5 h-5 text-blue-600 dark:text-blue-400 mt-0.5" />
            <div className="space-y-1">
              <h4 className="font-semibold text-blue-900 dark:text-blue-100">
                💡 Conseil Pro
              </h4>
              <p className="text-sm text-blue-800 dark:text-blue-200">
                <strong>Amazon + Shopify</strong> est notre configuration la plus populaire chez les petits clients.
                Elle permet de <strong>centraliser toutes vos ventes</strong> et d'éviter les surventes en synchronisant
                le stock en temps réel. Prix: <strong>137€/mois</strong> pour jusqu'à 200 commandes.
              </p>
            </div>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
