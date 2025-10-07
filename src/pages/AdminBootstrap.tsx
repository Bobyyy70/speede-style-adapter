import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/hooks/useAuth';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Shield, Loader2 } from 'lucide-react';
import { toast } from 'sonner';

/**
 * AdminBootstrap - Page de diagnostic et promotion admin
 * Accessible par tout utilisateur connecté pour vérifier/obtenir le rôle admin
 */
export default function AdminBootstrap() {
  const { user, userRole } = useAuth();
  const navigate = useNavigate();
  const [checking, setChecking] = useState(true);
  const [adminExists, setAdminExists] = useState(false);
  const [making, setMaking] = useState(false);
  const [showPromotion, setShowPromotion] = useState(false);

  useEffect(() => {
    checkAdminExists();
  }, [user, userRole]);

  const checkAdminExists = async () => {
    try {
      const { data, error } = await supabase
        .from('user_roles')
        .select('id, user_id')
        .eq('role', 'admin')
        .limit(1)
        .maybeSingle();

      if (error) throw error;
      setAdminExists(!!data);

      // Si un admin existe et que c'est l'utilisateur connecté, rediriger
      if (data && user && data.user_id === user.id) {
        navigate('/');
      }
    } catch (error) {
      console.error('Erreur vérification admin:', error);
    } finally {
      setChecking(false);
    }
  };

  const makeAdmin = async () => {
    if (!user?.email) return;
    
    setMaking(true);
    try {
      // Utiliser la fonction SQL sécurisée pour promouvoir l'utilisateur
      const { error } = await supabase.rpc('promote_user_to_admin', {
        user_email: user.email
      });

      if (error) throw error;

      toast.success("Vous êtes maintenant administrateur !");
      
      // Recharger la page pour mettre à jour le rôle
      window.location.href = '/';
    } catch (error: any) {
      console.error('Erreur promotion admin:', error);
      toast.error(`Erreur: ${error.message}`);
    } finally {
      setMaking(false);
    }
  };

  if (checking) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
      </div>
    );
  }

  if (adminExists && userRole === 'admin') {
    return (
      <div className="min-h-screen flex items-center justify-center p-4">
        <Card className="max-w-md">
          <CardHeader>
            <CardTitle className="text-green-600">✓ Vous êtes admin</CardTitle>
            <CardDescription>
              Votre compte dispose des droits administrateur
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="bg-muted p-4 rounded-lg">
              <p className="text-sm text-muted-foreground mb-1">
                <strong>Compte:</strong>
              </p>
              <p className="text-sm font-mono">{user?.email}</p>
              <p className="text-sm text-muted-foreground mt-2 mb-1">
                <strong>Rôle:</strong>
              </p>
              <p className="text-sm font-semibold text-green-600">Administrateur</p>
            </div>
            <Button onClick={() => navigate('/')} className="w-full">
              Accéder au tableau de bord
            </Button>
          </CardContent>
        </Card>
      </div>
    );
  }

  if (adminExists && !showPromotion) {
    return (
      <div className="min-h-screen flex items-center justify-center p-4">
        <Card className="max-w-md">
          <CardHeader>
            <CardTitle>Diagnostic de compte</CardTitle>
            <CardDescription>
              Vérification de vos permissions
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="bg-muted p-4 rounded-lg">
              <p className="text-sm text-muted-foreground mb-1">
                <strong>Compte:</strong>
              </p>
              <p className="text-sm font-mono">{user?.email}</p>
              <p className="text-sm text-muted-foreground mt-2 mb-1">
                <strong>Rôle actuel:</strong>
              </p>
              <p className="text-sm font-semibold text-orange-600">
                {userRole || 'Aucun rôle assigné'}
              </p>
            </div>
            
            <div className="text-sm text-muted-foreground space-y-2 p-3 bg-yellow-50 dark:bg-yellow-950/20 rounded-lg border border-yellow-200 dark:border-yellow-900">
              <p className="font-medium text-yellow-900 dark:text-yellow-200">
                ⚠️ Permissions insuffisantes
              </p>
              <p className="text-xs">
                Vous n'avez pas le rôle administrateur. Si vous devez gérer ce système, cliquez ci-dessous pour vous promouvoir en admin.
              </p>
            </div>

            <div className="space-y-2">
              <Button 
                onClick={() => setShowPromotion(true)} 
                variant="default"
                className="w-full"
              >
                <Shield className="mr-2 h-4 w-4" />
                Me promouvoir en Admin
              </Button>
              <Button 
                onClick={() => navigate('/')} 
                variant="outline"
                className="w-full"
              >
                Retour à l'accueil
              </Button>
            </div>
          </CardContent>
        </Card>
      </div>
    );
  }

  if (!user) {
    return (
      <div className="min-h-screen flex items-center justify-center p-4">
        <Card className="max-w-md">
          <CardHeader>
            <CardTitle>Connexion requise</CardTitle>
            <CardDescription>
              Vous devez être connecté pour configurer le premier administrateur
            </CardDescription>
          </CardHeader>
          <CardContent>
            <Button onClick={() => navigate('/auth')} className="w-full">
              Se connecter
            </Button>
          </CardContent>
        </Card>
      </div>
    );
  }

  return (
    <div className="min-h-screen flex items-center justify-center p-4 bg-gradient-to-br from-primary/5 to-background">
      <Card className="max-w-md">
        <CardHeader className="text-center">
          <div className="mx-auto w-12 h-12 rounded-full bg-primary/10 flex items-center justify-center mb-4">
            <Shield className="h-6 w-6 text-primary" />
          </div>
          <CardTitle>
            {adminExists ? 'Promotion administrateur' : 'Configuration initiale'}
          </CardTitle>
          <CardDescription>
            {adminExists 
              ? 'Obtenir les droits administrateur' 
              : 'Aucun administrateur n\'existe dans le système'}
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="bg-muted p-4 rounded-lg">
            <p className="text-sm text-muted-foreground mb-1">
              <strong>Compte:</strong>
            </p>
            <p className="text-sm font-mono">{user.email}</p>
            <p className="text-sm text-muted-foreground mt-2 mb-1">
              <strong>Rôle actuel:</strong>
            </p>
            <p className="text-sm font-semibold text-orange-600">
              {userRole || 'Aucun rôle assigné'}
            </p>
          </div>
          
          <div className="text-sm text-muted-foreground space-y-2">
            {!adminExists ? (
              <>
                <p>
                  Vous êtes le premier utilisateur du système. Cliquez sur le bouton ci-dessous pour devenir administrateur.
                </p>
                <p className="text-xs">
                  En tant qu'administrateur, vous pourrez créer des clients, gérer les utilisateurs et configurer le système.
                </p>
              </>
            ) : (
              <>
                <p>
                  Cliquez sur le bouton ci-dessous pour vous promouvoir en administrateur.
                </p>
                <p className="text-xs bg-yellow-50 dark:bg-yellow-950/20 p-2 rounded border border-yellow-200 dark:border-yellow-900">
                  ⚠️ Cette action remplacera votre rôle actuel par le rôle administrateur.
                </p>
              </>
            )}
          </div>

          <div className="space-y-2">
            <Button 
              onClick={makeAdmin} 
              disabled={making}
              className="w-full"
              size="lg"
            >
              {making ? (
                <>
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                  Promotion en cours...
                </>
              ) : (
                <>
                  <Shield className="mr-2 h-4 w-4" />
                  Devenir Administrateur
                </>
              )}
            </Button>
            
            {adminExists && (
              <Button 
                onClick={() => setShowPromotion(false)} 
                variant="outline"
                className="w-full"
              >
                Annuler
              </Button>
            )}
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
