import { Navigate } from 'react-router-dom';
import { useAuth } from '@/hooks/useAuth';

type AppRole = 'admin' | 'operateur' | 'gestionnaire' | 'client';

interface ProtectedRouteProps {
  children: React.ReactNode;
  allowedRoles?: AppRole[];
}

export function ProtectedRoute({ children, allowedRoles }: ProtectedRouteProps) {
  const { user, userRole, loading } = useAuth();

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary"></div>
      </div>
    );
  }

  if (!user) {
    return <Navigate to="/auth" replace />;
  }

  // If allowedRoles is specified, enforce strict role checking
  if (allowedRoles) {
    const isAllowedDirect = userRole && allowedRoles.includes(userRole);
    const isAdminViewingAsClient = allowedRoles.includes('client') && userRole === 'admin' && window.location.search.includes('asClient=');

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
