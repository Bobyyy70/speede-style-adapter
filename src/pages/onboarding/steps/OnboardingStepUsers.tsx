import { useState, useEffect } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/hooks/useAuth';
import { toast } from 'sonner';
import { Loader2, UserCheck, CheckCircle } from 'lucide-react';

interface StepProps {
  onComplete: (data: any) => void;
  wizardData: Record<string, any>;
}

export default function OnboardingStepUsers({ onComplete, wizardData }: StepProps) {
  const { user, refreshUserRole } = useAuth();
  const [loading, setLoading] = useState(false);
  const [linked, setLinked] = useState(false);

  useEffect(() => {
    checkIfLinked();
  }, []);

  const checkIfLinked = async () => {
    if (!user) return;
    
    const { data } = await supabase
      .from('profiles')
      .select('client_id')
      .eq('id', user.id)
      .single();
    
    if (data?.client_id === wizardData.client_id) {
      setLinked(true);
    }
  };

  const handleLinkUser = async () => {
    if (!user || !wizardData.client_id) {
      toast.error('Données manquantes');
      return;
    }

    setLoading(true);

    try {
      // Lier l'utilisateur courant au client
      const { error } = await supabase
        .from('profiles')
        .update({ client_id: wizardData.client_id })
        .eq('id', user.id);

      if (error) throw error;

      // Assigner le rôle client si pas déjà fait
      await supabase
        .from('user_roles')
        .upsert({
          user_id: user.id,
          role: 'client'
        }, {
          onConflict: 'user_id,role'
        });

      await refreshUserRole();
      setLinked(true);
      toast.success('Utilisateur lié à l\'entreprise');
      
      // Auto-continue après 1s
      setTimeout(() => {
        onComplete({ user_linked: true });
      }, 1000);
    } catch (error: any) {
      console.error('Erreur liaison utilisateur:', error);
      toast.error(error.message || 'Erreur lors de la liaison');
    } finally {
      setLoading(false);
    }
  };

  return (
    <Card>
      <CardHeader>
        <div className="flex items-center gap-2">
          <UserCheck className="h-6 w-6 text-primary" />
          <CardTitle>Liaison Utilisateur</CardTitle>
        </div>
        <CardDescription>
          Liez votre compte à l'entreprise {wizardData.nom_entreprise}
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        {linked ? (
          <Alert className="border-green-200 bg-green-50">
            <CheckCircle className="h-4 w-4 text-green-600" />
            <AlertDescription className="text-green-800">
              Votre compte est maintenant lié à <strong>{wizardData.nom_entreprise}</strong>
            </AlertDescription>
          </Alert>
        ) : (
          <>
            <Alert>
              <AlertDescription>
                En cliquant sur "Lier mon compte", vous serez associé à l'entreprise <strong>{wizardData.nom_entreprise}</strong> et aurez accès à ses données.
              </AlertDescription>
            </Alert>

            <Button onClick={handleLinkUser} disabled={loading} className="w-full">
              {loading && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
              Lier mon compte
            </Button>
          </>
        )}

        {linked && (
          <Button onClick={() => onComplete({ user_linked: true })} className="w-full">
            Continuer
          </Button>
        )}
      </CardContent>
    </Card>
  );
}
