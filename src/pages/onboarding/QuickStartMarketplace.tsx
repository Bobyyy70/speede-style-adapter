import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Progress } from '@/components/ui/progress';
import { CheckCircle2, ShoppingCart, Store, Zap, ArrowRight, Sparkles, Clock } from 'lucide-react';
import { Badge } from '@/components/ui/badge';

import QuickStartStepMarketplace from './steps/QuickStartStepMarketplace';
import QuickStartStepConfig from './steps/QuickStartStepConfig';
import QuickStartStepTemplate from './steps/QuickStartStepTemplate';

const STEPS = [
  {
    id: 'marketplace',
    label: 'Marketplace',
    component: QuickStartStepMarketplace,
    description: 'Choisissez votre plateforme de vente'
  },
  {
    id: 'config',
    label: 'Configuration',
    component: QuickStartStepConfig,
    description: 'Connectez votre compte en 2 clics'
  },
  {
    id: 'template',
    label: 'Template',
    component: QuickStartStepTemplate,
    description: 'Personnalisez votre configuration'
  },
];

export default function QuickStartMarketplace() {
  const [currentStep, setCurrentStep] = useState(0);
  const [completedSteps, setCompletedSteps] = useState<Set<number>>(new Set());
  const [wizardData, setWizardData] = useState<Record<string, any>>({});
  const navigate = useNavigate();

  const handleStepComplete = (stepData: any) => {
    setWizardData(prev => ({ ...prev, ...stepData }));
    setCompletedSteps(prev => new Set(prev).add(currentStep));

    if (currentStep < STEPS.length - 1) {
      setCurrentStep(currentStep + 1);
    } else {
      // Wizard terminé - redirection vers dashboard OMS
      navigate('/oms-dashboard');
    }
  };

  const handleSkipToAdvanced = () => {
    navigate('/onboarding');
  };

  const CurrentStepComponent = STEPS[currentStep].component;
  const progress = ((currentStep + 1) / STEPS.length) * 100;

  return (
    <div className="min-h-screen bg-gradient-to-br from-blue-50 via-white to-purple-50 dark:from-gray-900 dark:via-gray-800 dark:to-gray-900 p-6">
      <div className="max-w-5xl mx-auto space-y-6">
        {/* Hero Header */}
        <div className="text-center space-y-4 mb-8">
          <div className="flex items-center justify-center space-x-2">
            <Zap className="w-8 h-8 text-yellow-500" />
            <h1 className="text-4xl font-bold bg-gradient-to-r from-blue-600 to-purple-600 bg-clip-text text-transparent">
              Quick Start Marketplace
            </h1>
          </div>
          <p className="text-lg text-muted-foreground max-w-2xl mx-auto">
            🚀 Connectez votre boutique <strong>Amazon Seller Central</strong> ou <strong>Shopify</strong> en moins de 5 minutes
          </p>
          <div className="flex items-center justify-center space-x-4">
            <Badge variant="secondary" className="text-sm">
              <Sparkles className="w-3 h-3 mr-1" />
              Parfait pour les petits clients
            </Badge>
            <Badge variant="outline" className="text-sm">
              <Clock className="w-3 h-3 mr-1" />
              Setup en 3 étapes
            </Badge>
          </div>
        </div>

        {/* Progress Card */}
        <Card className="border-2 shadow-lg">
          <CardHeader>
            <div className="flex items-center justify-between">
              <div>
                <CardTitle className="text-2xl">Configuration Rapide</CardTitle>
                <CardDescription className="text-base mt-1">
                  Étape {currentStep + 1} sur {STEPS.length}: {STEPS[currentStep].description}
                </CardDescription>
              </div>
              <Button
                variant="ghost"
                size="sm"
                onClick={handleSkipToAdvanced}
                className="text-muted-foreground"
              >
                Configuration avancée →
              </Button>
            </div>
          </CardHeader>
          <CardContent className="space-y-4">
            <Progress value={progress} className="h-3" />

            {/* Steps Timeline */}
            <div className="flex justify-between mt-6">
              {STEPS.map((step, index) => {
                const isCompleted = completedSteps.has(index);
                const isCurrent = index === currentStep;
                const isPast = index < currentStep;

                return (
                  <div key={step.id} className="flex items-center flex-1">
                    <div className="flex flex-col items-center space-y-2 flex-1">
                      <div className="relative">
                        {isCompleted ? (
                          <div className="w-10 h-10 rounded-full bg-green-500 flex items-center justify-center">
                            <CheckCircle2 className="w-6 h-6 text-white" />
                          </div>
                        ) : (
                          <div className={`w-10 h-10 rounded-full border-2 flex items-center justify-center ${
                            isCurrent
                              ? 'border-primary bg-primary/10 border-4'
                              : isPast
                              ? 'border-green-500'
                              : 'border-muted bg-muted/20'
                          }`}>
                            <span className={`text-sm font-semibold ${
                              isCurrent ? 'text-primary' : isPast ? 'text-green-500' : 'text-muted-foreground'
                            }`}>
                              {index + 1}
                            </span>
                          </div>
                        )}
                      </div>

                      <div className="text-center">
                        <p className={`text-sm font-medium ${
                          isCurrent ? 'text-foreground' : isCompleted ? 'text-green-600' : 'text-muted-foreground'
                        }`}>
                          {step.label}
                        </p>
                      </div>
                    </div>

                    {index < STEPS.length - 1 && (
                      <div className={`h-0.5 flex-1 mx-2 ${
                        isPast || isCompleted ? 'bg-green-500' : 'bg-muted'
                      }`} />
                    )}
                  </div>
                );
              })}
            </div>
          </CardContent>
        </Card>

        {/* Current Step Content */}
        <CurrentStepComponent
          onComplete={handleStepComplete}
          wizardData={wizardData}
        />

        {/* Navigation */}
        <div className="flex justify-between items-center">
          <Button
            variant="outline"
            onClick={() => setCurrentStep(Math.max(0, currentStep - 1))}
            disabled={currentStep === 0}
          >
            ← Précédent
          </Button>

          <p className="text-sm text-muted-foreground">
            💡 Besoin d'aide ? <a href="#" className="text-primary underline">Consulter le guide</a>
          </p>
        </div>

        {/* Benefits Section */}
        {currentStep === 0 && (
          <Card className="border-dashed bg-gradient-to-r from-blue-50/50 to-purple-50/50 dark:from-blue-950/20 dark:to-purple-950/20">
            <CardContent className="pt-6">
              <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                <div className="text-center space-y-2">
                  <div className="w-12 h-12 rounded-full bg-blue-100 dark:bg-blue-900 mx-auto flex items-center justify-center">
                    <ShoppingCart className="w-6 h-6 text-blue-600 dark:text-blue-400" />
                  </div>
                  <h4 className="font-semibold">Sync Automatique</h4>
                  <p className="text-sm text-muted-foreground">
                    Commandes importées toutes les 15 min
                  </p>
                </div>

                <div className="text-center space-y-2">
                  <div className="w-12 h-12 rounded-full bg-purple-100 dark:bg-purple-900 mx-auto flex items-center justify-center">
                    <Store className="w-6 h-6 text-purple-600 dark:text-purple-400" />
                  </div>
                  <h4 className="font-semibold">Stock Unifié</h4>
                  <p className="text-sm text-muted-foreground">
                    Évitez les surventes multi-canaux
                  </p>
                </div>

                <div className="text-center space-y-2">
                  <div className="w-12 h-12 rounded-full bg-green-100 dark:bg-green-900 mx-auto flex items-center justify-center">
                    <Zap className="w-6 h-6 text-green-600 dark:text-green-400" />
                  </div>
                  <h4 className="font-semibold">Setup Express</h4>
                  <p className="text-sm text-muted-foreground">
                    Opérationnel en moins de 5 minutes
                  </p>
                </div>
              </div>
            </CardContent>
          </Card>
        )}
      </div>
    </div>
  );
}
