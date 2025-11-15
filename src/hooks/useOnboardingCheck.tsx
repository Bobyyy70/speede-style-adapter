import { useEffect } from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import { useAuth } from '@/hooks/useAuth';
import { supabase } from '@/integrations/supabase/client';

export function useOnboardingCheck() {
  const { user, userRole, loading } = useAuth();
  const navigate = useNavigate();
  const location = useLocation();

  useEffect(() => {
    if (loading || !user) return;

    const checkOnboarding = async () => {
      // Ignorer si déjà sur les pages autorisées
      const allowedPaths = ['/onboarding', '/auth', '/admin-bootstrap'];
      if (allowedPaths.some(path => location.pathname.startsWith(path))) {
        return;
      }

      // Admin bypass
      if (userRole === 'admin') return;

      // Vérifier si client_id est défini
      const { data: profile } = await supabase
        .from('profiles')
        .select('client_id')
        .eq('id', user.id)
        .single();

      if (!profile?.client_id) {
        console.warn('[Onboarding] client_id manquant, redirection...');
        navigate('/onboarding', { replace: true });
      }
    };

    checkOnboarding();
  }, [user, userRole, loading, navigate, location]);
}
