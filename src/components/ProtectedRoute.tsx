import { Navigate } from 'react-router-dom';
import { useAuth } from '@/hooks/useAuth';
import { useEffect, useState } from 'react';
import { supabase } from '@/integrations/supabase/client';

type AppRole = 'admin' | 'operateur' | 'gestionnaire' | 'client';

interface ProtectedRouteProps {
  children: React.ReactNode;
  allowedRoles?: AppRole[];
  requireServerVerification?: boolean;
}

export function ProtectedRoute({ children, allowedRoles, requireServerVerification = false }: ProtectedRouteProps) {
  const { user, userRole, loading } = useAuth();
  const [serverVerified, setServerVerified] = useState<boolean | null>(null);
  const [verifying, setVerifying] = useState(false);

  // Server-side permission verification for sensitive routes
  useEffect(() => {
    if (!requireServerVerification || !user || !allowedRoles) {
      setServerVerified(true);
      return;
    }

    const verifyPermission = async () => {
      setVerifying(true);
      try {
        const { data: session } = await supabase.auth.getSession();
        if (!session.session) {
          setServerVerified(false);
          return;
        }

        const response = await fetch(
          `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/verify-user-permission`,
          {
            method: 'POST',
            headers: {
              'Content-Type': 'application/json',
              'Authorization': `Bearer ${session.session.access_token}`,
            },
            body: JSON.stringify({
              required_role: allowedRoles[0], // Check most restrictive role
            }),
          }
        );

        const result = await response.json();
        setServerVerified(result.allowed === true);
      } catch (error) {
        console.error('[ProtectedRoute] Server verification failed:', error);
        setServerVerified(false);
      } finally {
        setVerifying(false);
      }
    };

    verifyPermission();
  }, [requireServerVerification, user, allowedRoles]);

  if (loading || verifying) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary"></div>
      </div>
    );
  }

  if (!user) {
    return <Navigate to="/auth" replace />;
  }

  // If allowedRoles is specified, enforce role checking
  if (allowedRoles) {
    // Client-side check (UX only, not security)
    const isAllowedDirect = userRole && allowedRoles.includes(userRole);
    const isAdminViewingAsClient = allowedRoles.includes('client') && userRole === 'admin' && window.location.search.includes('asClient=');

    // Server-side verification check (security layer)
    if (requireServerVerification && serverVerified === false) {
      return (
        <div className="min-h-screen flex items-center justify-center">
          <div className="text-center space-y-4">
            <h1 className="text-2xl font-bold text-destructive">Accès refusé</h1>
            <p className="text-muted-foreground">
              Vous n'avez pas les permissions nécessaires pour accéder à cette page.
            </p>
            <p className="text-xs text-muted-foreground">
              (Vérification serveur : accès non autorisé)
            </p>
          </div>
        </div>
      );
    }

    // Client-side check fallback (for non-verified routes)
    if (!isAllowedDirect && !isAdminViewingAsClient) {
      return (
        <div className="min-h-screen flex items-center justify-center">
          <div className="text-center space-y-4">
            <h1 className="text-2xl font-bold text-destructive">Accès refusé</h1>
            <p className="text-muted-foreground">
              Vous n'avez pas les permissions nécessaires pour accéder à cette page.
            </p>
          </div>
        </div>
      );
    }
  }

  return <>{children}</>;
}
