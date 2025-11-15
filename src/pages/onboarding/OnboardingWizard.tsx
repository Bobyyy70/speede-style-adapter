import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Progress } from '@/components/ui/progress';
import { CheckCircle2 } from 'lucide-react';

import OnboardingStepCompany from './steps/OnboardingStepCompany';
import OnboardingStepUsers from './steps/OnboardingStepUsers';
import OnboardingStepSendcloud from './steps/OnboardingStepSendcloud';
import OnboardingStepImport from './steps/OnboardingStepImport';

const STEPS = [
  { id: 'company', label: 'Entreprise', component: OnboardingStepCompany },
  { id: 'users', label: 'Utilisateurs', component: OnboardingStepUsers },
  { id: 'sendcloud', label: 'SendCloud', component: OnboardingStepSendcloud },
  { id: 'import', label: 'Import Initial', component: OnboardingStepImport },
];

export default function OnboardingWizard() {
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
      // Wizard terminé
      navigate('/dashboard');
    }
  };

  const CurrentStepComponent = STEPS[currentStep].component;
  const progress = ((currentStep + 1) / STEPS.length) * 100;

  return (
    <div className="min-h-screen bg-gradient-to-br from-background via-muted/20 to-background p-6">
      <div className="max-w-4xl mx-auto space-y-6">
        {/* Header */}
        <Card>
          <CardHeader>
            <CardTitle className="text-2xl">Configuration Initiale WMS SpeedE</CardTitle>
            <CardDescription>
              Étape {currentStep + 1} sur {STEPS.length}: {STEPS[currentStep].label}
            </CardDescription>
          </CardHeader>
          <CardContent>
            <Progress value={progress} className="h-2" />
            <div className="flex justify-between mt-4">
              {STEPS.map((step, index) => (
                <div key={step.id} className="flex items-center space-x-2">
                  {completedSteps.has(index) ? (
                    <CheckCircle2 className="w-5 h-5 text-green-500" />
                  ) : (
                    <div className={`w-5 h-5 rounded-full border-2 ${
                      index === currentStep ? 'border-primary' : 'border-muted'
                    }`} />
                  )}
                  <span className={`text-sm ${index === currentStep ? 'font-semibold text-foreground' : 'text-muted-foreground'}`}>
                    {step.label}
                  </span>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>

        {/* Current Step */}
        <CurrentStepComponent
          onComplete={handleStepComplete}
          wizardData={wizardData}
        />

        {/* Navigation */}
        <div className="flex justify-between">
          <Button
            variant="outline"
            onClick={() => setCurrentStep(Math.max(0, currentStep - 1))}
            disabled={currentStep === 0}
          >
            Précédent
          </Button>
        </div>
      </div>
    </div>
  );
}
