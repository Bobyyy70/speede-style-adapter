import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/hooks/useAuth';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Shield, Loader2 } from 'lucide-react';
import { toast } from 'sonner';

/**
 * AdminBootstrap - Page de démarrage pour créer le premier admin
 * Accessible uniquement si aucun admin n'existe dans le système
 */
export default function AdminBootstrap() {
  const { user, userRole } = useAuth();
  const navigate = useNavigate();
  const [checking, setChecking] = useState(true);
  const [adminExists, setAdminExists] = useState(false);
  const [making, setMaking] = useState(false);

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
    if (!user) return;
    
    setMaking(true);
    try {
      const { error } = await supabase
        .from('user_roles')
        .insert({
          user_id: user.id,
          role: 'admin'
        });

      if (error) throw error;

      toast.success("Vous êtes maintenant administrateur !");
      
      // Recharger la page pour mettre à jour le rôle
      window.location.href = '/';
    } catch (error: any) {
      console.error('Erreur création admin:', error);
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

  if (adminExists) {
    return (
      <div className="min-h-screen flex items-center justify-center p-4">
        <Card className="max-w-md">
          <CardHeader>
            <CardTitle>Système déjà configuré</CardTitle>
            <CardDescription>
              Un administrateur existe déjà dans le système
            </CardDescription>
          </CardHeader>
          <CardContent>
            <p className="text-sm text-muted-foreground mb-4">
              Contactez votre administrateur pour obtenir un rôle.
            </p>
            <Button onClick={() => navigate('/')} className="w-full">
              Retour à l'accueil
            </Button>
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
          <CardTitle>Configuration initiale</CardTitle>
          <CardDescription>
            Aucun administrateur n'existe dans le système
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="bg-muted p-4 rounded-lg">
            <p className="text-sm text-muted-foreground mb-2">
              <strong>Compte connecté:</strong>
            </p>
            <p className="text-sm font-mono">{user.email}</p>
          </div>
          
          <div className="text-sm text-muted-foreground space-y-2">
            <p>
              Vous êtes le premier utilisateur du système. Cliquez sur le bouton ci-dessous pour devenir administrateur.
            </p>
            <p className="text-xs">
              En tant qu'administrateur, vous pourrez créer des clients, gérer les utilisateurs et configurer le système.
            </p>
          </div>

          <Button 
            onClick={makeAdmin} 
            disabled={making}
            className="w-full"
            size="lg"
          >
            {making ? (
              <>
                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                Configuration...
              </>
            ) : (
              <>
                <Shield className="mr-2 h-4 w-4" />
                Devenir Administrateur
              </>
            )}
          </Button>
        </CardContent>
      </Card>
    </div>
  );
}
