import { useState } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { Progress } from '@/components/ui/progress';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';
import { Loader2, Download, CheckCircle, AlertCircle } from 'lucide-react';

interface StepProps {
  onComplete: (data: any) => void;
  wizardData: Record<string, any>;
}

interface ImportStep {
  id: string;
  label: string;
  status: 'pending' | 'running' | 'success' | 'error';
  message?: string;
}

export default function OnboardingStepImport({ onComplete, wizardData }: StepProps) {
  const [loading, setLoading] = useState(false);
  const [steps, setSteps] = useState<ImportStep[]>([
    { id: 'carriers', label: 'Import des transporteurs', status: 'pending' },
    { id: 'methods', label: 'Import des méthodes d\'expédition', status: 'pending' },
    { id: 'products', label: 'Synchronisation des produits', status: 'pending' },
    { id: 'orders', label: 'Import des commandes récentes', status: 'pending' },
  ]);

  const updateStep = (id: string, updates: Partial<ImportStep>) => {
    setSteps(prev => prev.map(step =>
      step.id === id ? { ...step, ...updates } : step
    ));
  };

  const handleStartImport = async () => {
    setLoading(true);

    try {
      // 1. Import carriers
      updateStep('carriers', { status: 'running' });
      const carriersResult = await supabase.functions.invoke('sendcloud-import-carriers');
      if (carriersResult.error) throw new Error('Erreur import carriers');
      updateStep('carriers', { status: 'success', message: 'Transporteurs importés' });

      // 2. Import shipping methods
      updateStep('methods', { status: 'running' });
      const methodsResult = await supabase.functions.invoke('sendcloud-import-shipping-methods');
      if (methodsResult.error) throw new Error('Erreur import shipping methods');
      updateStep('methods', { status: 'success', message: 'Méthodes importées' });

      // 3. Sync products
      updateStep('products', { status: 'running' });
      const productsResult = await supabase.functions.invoke('sendcloud-sync-products', {
        body: { sync_all: true }
      });
      if (productsResult.error) throw new Error('Erreur sync produits');
      updateStep('products', { status: 'success', message: 'Produits synchronisés' });

      // 4. Import recent orders
      updateStep('orders', { status: 'running' });
      const ordersResult = await supabase.functions.invoke('sendcloud-sync-orders', {
        body: { initial: true, limit: 100 }
      });
      if (ordersResult.error) throw new Error('Erreur import commandes');
      updateStep('orders', { status: 'success', message: 'Commandes importées' });

      toast.success('Import initial terminé avec succès');
      
      // Auto-complete après 2s
      setTimeout(() => {
        onComplete({ import_completed: true });
      }, 2000);
    } catch (error: any) {
      console.error('Erreur import initial:', error);
      toast.error(error.message || 'Erreur lors de l\'import');
      // Marquer l'étape courante en erreur
      setSteps(prev => {
        const runningIndex = prev.findIndex(s => s.status === 'running');
        if (runningIndex !== -1) {
          const updated = [...prev];
          updated[runningIndex].status = 'error';
          updated[runningIndex].message = error.message;
          return updated;
        }
        return prev;
      });
    } finally {
      setLoading(false);
    }
  };

  const allSuccess = steps.every(s => s.status === 'success');
  const hasError = steps.some(s => s.status === 'error');
  const completedSteps = steps.filter(s => s.status === 'success').length;
  const progress = (completedSteps / steps.length) * 100;

  return (
    <Card>
      <CardHeader>
        <div className="flex items-center gap-2">
          <Download className="h-6 w-6 text-primary" />
          <CardTitle>Import Initial des Données</CardTitle>
        </div>
        <CardDescription>
          Importation des données depuis SendCloud pour initialiser le système
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        <Alert>
          <AlertDescription>
            Cette opération peut prendre quelques minutes. Ne fermez pas cette page pendant l'import.
          </AlertDescription>
        </Alert>

        {loading && (
          <div className="space-y-2">
            <Progress value={progress} className="h-2" />
            <p className="text-sm text-muted-foreground text-center">
              {completedSteps} / {steps.length} étapes complétées
            </p>
          </div>
        )}

        <div className="space-y-2">
          {steps.map((step) => (
            <div key={step.id} className="flex items-center justify-between p-3 border rounded-lg">
              <div className="flex items-center gap-2">
                {step.status === 'running' && <Loader2 className="h-4 w-4 animate-spin text-primary" />}
                {step.status === 'success' && <CheckCircle className="h-4 w-4 text-green-500" />}
                {step.status === 'error' && <AlertCircle className="h-4 w-4 text-red-500" />}
                {step.status === 'pending' && <div className="h-4 w-4 rounded-full border-2 border-muted" />}
                <span className="font-medium">{step.label}</span>
              </div>
              {step.message && (
                <span className={`text-sm ${step.status === 'error' ? 'text-red-600' : 'text-muted-foreground'}`}>
                  {step.message}
                </span>
              )}
            </div>
          ))}
        </div>

        {!loading && !allSuccess && (
          <Button onClick={handleStartImport} disabled={loading} className="w-full">
            {loading && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
            Démarrer l'import
          </Button>
        )}

        {allSuccess && (
          <Alert className="border-green-200 bg-green-50">
            <CheckCircle className="h-4 w-4 text-green-600" />
            <AlertDescription className="text-green-800">
              Import terminé avec succès ! Vous allez être redirigé vers le dashboard...
            </AlertDescription>
          </Alert>
        )}

        {hasError && (
          <Button onClick={handleStartImport} variant="outline" className="w-full">
            Réessayer
          </Button>
        )}
      </CardContent>
    </Card>
  );
}
