import { createContext, useContext, useEffect, useState } from 'react';
import { User, Session } from '@supabase/supabase-js';
import { supabase } from '@/integrations/supabase/client';
import { useNavigate } from 'react-router-dom';
import { toast } from '@/hooks/use-toast';

type AppRole = 'admin' | 'operateur' | 'gestionnaire' | 'client';

const DEFAULT_TABS = ['dashboard', 'stock', 'orders', 'invoices', 'reports', 'settings', 'analytics', 'notifications'];

interface AuthContextType {
  user: User | null;
  session: Session | null;
  userRole: AppRole | null;
  viewingClientId: string | null;
  tabsAccess: string[];
  loading: boolean;
  signIn: (email: string, password: string) => Promise<void>;
  signUp: (email: string, password: string, nomComplet: string) => Promise<void>;
  signOut: () => Promise<void>;
  hasRole: (role: AppRole) => boolean;
  isViewingAsClient: () => boolean;
  getViewingClientId: () => string | null;
  refreshUserRole: () => Promise<void>;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

// Function to get viewing client ID from URL or localStorage (defined outside component)
const getViewingClientId = (): string | null => {
  const params = new URLSearchParams(window.location.search);
  const urlClientId = params.get("asClient");
  if (urlClientId) return urlClientId;
  
  return localStorage.getItem("viewingAsClient");
};

// Check if currently viewing as client (defined outside component)
const isViewingAsClient = (): boolean => {
  return getViewingClientId() !== null;
};

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [user, setUser] = useState<User | null>(null);
  const [session, setSession] = useState<Session | null>(null);
  const [userRole, setUserRole] = useState<AppRole | null>(null);
  const [viewingClientId, setViewingClientId] = useState<string | null>(null);
  const [tabsAccess, setTabsAccess] = useState<string[]>(DEFAULT_TABS);
  const [loading, setLoading] = useState(true);
  const navigate = useNavigate();

  // Fetch user role using RPC to avoid RLS issues
  const fetchUserRole = async (userId: string) => {
    try {
      console.log('[useAuth] Fetching role for user:', userId.substring(0, 8) + '...');
      const { data, error } = await supabase.rpc('get_user_role', { user_id: userId });
      
      if (error) throw error;
      console.log('[useAuth] Role fetched:', data);
      
      // If no role found, check if user has a client_id in profiles
      if (!data) {
        console.log('[useAuth] No role found, checking profile for client_id...');
        const { data: profile, error: profileError } = await supabase
          .from('profiles')
          .select('client_id')
          .eq('id', userId)
          .single();
        
        if (!profileError && profile?.client_id) {
          console.log('[useAuth] Fallback to client via profile');
          setUserRole('client');
          return;
        }
      }
      
      setUserRole(data as AppRole || null);
    } catch (error) {
      console.error('[useAuth] Error fetching user role:', error);
      setUserRole(null);
    }
  };

  // Clean obsolete localStorage entries
  const cleanObsoleteStorage = () => {
    const obsoleteKeys = ['userRole', 'cachedRole', 'roleCache'];
    obsoleteKeys.forEach(key => {
      if (localStorage.getItem(key)) {
        console.log('[useAuth] Removing obsolete localStorage key:', key);
        localStorage.removeItem(key);
      }
    });
  };

  // Force refresh user role from backend
  const refreshUserRole = async () => {
    if (!user) {
      console.warn('[useAuth] Cannot refresh role: no user logged in');
      return;
    }
    
    console.log('[useAuth] Forcing role refresh for user:', user.id.substring(0, 8) + '...');
    cleanObsoleteStorage();
    await fetchUserRole(user.id);
    
    toast({
      title: "Permissions rafraîchies",
      description: "Vos autorisations ont été mises à jour",
    });
  };

  useEffect(() => {
    console.log('[useAuth] Initializing auth context');
    
    // Clean obsolete localStorage on startup
    cleanObsoleteStorage();
    
    // Update viewingClientId whenever URL changes
    setViewingClientId(getViewingClientId());

    // Set up auth state listener FIRST
    const { data: { subscription } } = supabase.auth.onAuthStateChange(
      (event, session) => {
        console.log('[useAuth] Auth state changed:', event);
        setSession(session);
        setUser(session?.user ?? null);
        
        // Defer role fetching with setTimeout
        if (session?.user) {
          setTimeout(() => {
            fetchUserRole(session.user.id);
            // Set tabs from app_metadata or default
            const tabs = session.user.app_metadata?.tabs_access || DEFAULT_TABS;
            setTabsAccess(tabs);
          }, 0);
        } else {
          setUserRole(null);
          setTabsAccess(DEFAULT_TABS);
        }
        
        setLoading(false);
      }
    );

    // THEN check for existing session
    supabase.auth.getSession().then(({ data: { session } }) => {
      setSession(session);
      setUser(session?.user ?? null);
      
      if (session?.user) {
        setTimeout(() => {
          fetchUserRole(session.user.id);
          const tabs = session.user.app_metadata?.tabs_access || DEFAULT_TABS;
          setTabsAccess(tabs);
        }, 0);
      }
      
      setLoading(false);
    });

    return () => subscription.unsubscribe();
  }, []);

  // Subscribe to realtime updates for tabs_access
  useEffect(() => {
    if (!user?.id) return;

    const channel = supabase
      .channel('profile-tabs-changes')
      .on(
        'postgres_changes',
        {
          event: 'UPDATE',
          schema: 'public',
          table: 'profiles',
          filter: `id=eq.${user.id}`,
        },
        (payload) => {
          console.log('[useAuth] Profile tabs updated via realtime:', payload.new);
          const newTabs = (payload.new as any).tabs_access || DEFAULT_TABS;
          setTabsAccess(newTabs);
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [user?.id]);

  const signIn = async (email: string, password: string) => {
    try {
      const { error } = await supabase.auth.signInWithPassword({
        email,
        password,
      });

      if (error) throw error;

      // Get session after sign in
      const { data: { session: currentSession } } = await supabase.auth.getSession();
      
      if (currentSession?.user) {
        const userId = currentSession.user.id;
        
        // Backfill profiles if needed
        await supabase.rpc('backfill_missing_profiles');
        
        // Get or create profile with tabs_access
        let { data: profile, error: profileError } = await supabase
          .from('profiles')
          .select('client_id, tabs_access')
          .eq('id', userId)
          .single();
        
        if (!profile) {
          // Create profile with default tabs
          const { data: newProfile } = await supabase
            .from('profiles')
            .insert({
              id: userId,
              email: currentSession.user.email,
              nom_complet: currentSession.user.email,
              tabs_access: DEFAULT_TABS,
            })
            .select('client_id, tabs_access')
            .single();
          profile = newProfile;
        } else if (!profile.tabs_access || profile.tabs_access.length === 0) {
          // Update profile with default tabs
          const { data: updatedProfile } = await supabase
            .from('profiles')
            .update({ tabs_access: DEFAULT_TABS })
            .eq('id', userId)
            .select('client_id, tabs_access')
            .single();
          profile = updatedProfile;
        }
        
        // Update app_metadata via edge function
        const tabs = profile?.tabs_access || DEFAULT_TABS;
        await supabase.functions.invoke('update-user-tabs-access', {
          body: { user_id: userId, tabs_access: tabs },
        });
        
        // Set tabs in state
        const finalTabs = currentSession.user.app_metadata?.tabs_access || profile?.tabs_access || DEFAULT_TABS;
        setTabsAccess(finalTabs);
        console.log('Affichage des onglets :', finalTabs.join(', '));
        
        // Get role and redirect
        const { data: role } = await supabase.rpc('get_user_role', { user_id: userId });
        
        if (role === 'client') {
          navigate('/client/dashboard');
        } else {
          navigate('/');
        }
      } else {
        navigate('/');
      }

      toast({
        title: "Connexion réussie",
        description: "Bienvenue dans le WMS Speed E-Log",
      });
    } catch (error: any) {
      toast({
        title: "Erreur de connexion",
        description: error.message || "Email ou mot de passe incorrect",
        variant: "destructive",
      });
      throw error;
    }
  };

  const signUp = async (email: string, password: string, nomComplet: string) => {
    try {
      const redirectUrl = `${window.location.origin}/`;
      
      const { error } = await supabase.auth.signUp({
        email,
        password,
        options: {
          emailRedirectTo: redirectUrl,
          data: {
            nom_complet: nomComplet,
          },
        },
      });

      if (error) throw error;

      toast({
        title: "Compte créé avec succès",
        description: "Vous pouvez maintenant vous connecter",
      });
    } catch (error: any) {
      toast({
        title: "Erreur d'inscription",
        description: error.message || "Impossible de créer le compte",
        variant: "destructive",
      });
      throw error;
    }
  };

  const signOut = async () => {
    try {
      const { error } = await supabase.auth.signOut();
      if (error) throw error;

      setUser(null);
      setSession(null);
      setUserRole(null);
      
      toast({
        title: "Déconnexion réussie",
        description: "À bientôt !",
      });

      navigate('/auth');
    } catch (error: any) {
      toast({
        title: "Erreur de déconnexion",
        description: error.message,
        variant: "destructive",
      });
    }
  };

  const hasRole = (role: AppRole): boolean => {
    return userRole === role;
  };

  return (
    <AuthContext.Provider
      value={{
        user,
        session,
        userRole,
        viewingClientId,
        tabsAccess,
        loading,
        signIn,
        signUp,
        signOut,
        hasRole,
        isViewingAsClient,
        getViewingClientId,
        refreshUserRole,
      }}
    >
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  const context = useContext(AuthContext);
  if (context === undefined) {
    throw new Error('useAuth must be used within an AuthProvider');
  }
  return context;
}
