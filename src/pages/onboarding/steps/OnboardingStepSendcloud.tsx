import { useState } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';
import { Loader2, Package, CheckCircle, AlertCircle } from 'lucide-react';

interface StepProps {
  onComplete: (data: any) => void;
  wizardData: Record<string, any>;
}

export default function OnboardingStepSendcloud({ onComplete, wizardData }: StepProps) {
  const [loading, setLoading] = useState(false);
  const [testing, setTesting] = useState(false);
  const [testResult, setTestResult] = useState<'success' | 'error' | null>(null);
  const [formData, setFormData] = useState({
    public_key: wizardData.sendcloud_public_key || '',
    secret_key: wizardData.sendcloud_secret_key || '',
  });

  const handleTestConnection = async () => {
    if (!formData.public_key || !formData.secret_key) {
      toast.error('Veuillez renseigner les deux clés');
      return;
    }

    setTesting(true);
    setTestResult(null);

    try {
      const { data, error } = await supabase.functions.invoke('sendcloud-test-connection', {
        body: {
          public_key: formData.public_key,
          secret_key: formData.secret_key,
        },
      });

      if (error) throw error;

      if (data?.success) {
        setTestResult('success');
        toast.success('Connexion SendCloud réussie');
      } else {
        setTestResult('error');
        toast.error('Connexion échouée: ' + (data?.error || 'Erreur inconnue'));
      }
    } catch (error: any) {
      console.error('Erreur test SendCloud:', error);
      setTestResult('error');
      toast.error(error.message || 'Erreur lors du test de connexion');
    } finally {
      setTesting(false);
    }
  };

  const handleContinue = () => {
    if (testResult !== 'success') {
      toast.error('Veuillez d\'abord tester la connexion');
      return;
    }

    onComplete({
      sendcloud_public_key: formData.public_key,
      sendcloud_secret_key: formData.secret_key,
      sendcloud_configured: true,
    });
  };

  return (
    <Card>
      <CardHeader>
        <div className="flex items-center gap-2">
          <Package className="h-6 w-6 text-primary" />
          <CardTitle>Configuration SendCloud</CardTitle>
        </div>
        <CardDescription>
          Connectez votre compte SendCloud pour la gestion des expéditions
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        <Alert>
          <AlertDescription>
            Vous trouverez vos clés API SendCloud dans votre panneau SendCloud → Settings → API.
          </AlertDescription>
        </Alert>

        <div className="space-y-2">
          <Label htmlFor="public_key">Public Key *</Label>
          <Input
            id="public_key"
            type="text"
            required
            value={formData.public_key}
            onChange={(e) => setFormData({ ...formData, public_key: e.target.value })}
            placeholder="public_xxx"
          />
        </div>

        <div className="space-y-2">
          <Label htmlFor="secret_key">Secret Key *</Label>
          <Input
            id="secret_key"
            type="password"
            required
            value={formData.secret_key}
            onChange={(e) => setFormData({ ...formData, secret_key: e.target.value })}
            placeholder="secret_xxx"
          />
        </div>

        <Button
          onClick={handleTestConnection}
          disabled={testing || !formData.public_key || !formData.secret_key}
          variant="outline"
          className="w-full"
        >
          {testing && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
          Tester la connexion
        </Button>

        {testResult === 'success' && (
          <Alert className="border-green-200 bg-green-50">
            <CheckCircle className="h-4 w-4 text-green-600" />
            <AlertDescription className="text-green-800">
              Connexion réussie ! Vous pouvez continuer.
            </AlertDescription>
          </Alert>
        )}

        {testResult === 'error' && (
          <Alert className="border-red-200 bg-red-50">
            <AlertCircle className="h-4 w-4 text-red-600" />
            <AlertDescription className="text-red-800">
              Échec de la connexion. Vérifiez vos clés API.
            </AlertDescription>
          </Alert>
        )}

        <Button
          onClick={handleContinue}
          disabled={testResult !== 'success'}
          className="w-full"
        >
          Continuer
        </Button>
      </CardContent>
    </Card>
  );
}
