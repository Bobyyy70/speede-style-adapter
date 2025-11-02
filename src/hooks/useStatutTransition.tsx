import { useEffect, useCallback } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useQueryClient } from '@tanstack/react-query';
import { toast } from 'sonner';
import { useAuth } from './useAuth';

type EntityType = 'commande' | 'retour' | 'attendu';

interface TransitionResult {
  success: boolean;
  statut_precedent?: string;
  statut_nouveau?: string;
  message?: string;
  error?: string;
  no_change?: boolean;
}

export const useStatutTransition = () => {
  const queryClient = useQueryClient();
  const { user } = useAuth();

  /**
   * Fonction principale de transition de statut
   */
  const transitionStatut = useCallback(async (
    type: EntityType,
    id: string,
    nouveauStatut: string,
    raison?: string,
    metadata?: Record<string, any>
  ): Promise<TransitionResult> => {
    try {
      let rpcFunctionName = '';
      let entityParam = {};

      switch (type) {
        case 'commande':
          rpcFunctionName = 'transition_statut_commande';
          entityParam = {
            p_commande_id: id,
            p_nouveau_statut: nouveauStatut,
            p_utilisateur_id: user?.id,
            p_raison: raison,
            p_metadata: metadata || {}
          };
          break;
        case 'retour':
          rpcFunctionName = 'transition_statut_retour';
          entityParam = {
            p_retour_id: id,
            p_nouveau_statut: nouveauStatut,
            p_utilisateur_id: user?.id,
            p_raison: raison,
            p_metadata: metadata || {}
          };
          break;
        case 'attendu':
          rpcFunctionName = 'transition_statut_attendu';
          entityParam = {
            p_attendu_id: id,
            p_nouveau_statut: nouveauStatut,
            p_utilisateur_id: user?.id,
            p_raison: raison,
            p_metadata: metadata || {}
          };
          break;
        default:
          throw new Error(`Type d'entité non supporté: ${type}`);
      }

      const { data, error } = await supabase.rpc(rpcFunctionName as any, entityParam);

      if (error) throw error;

      const result = data as TransitionResult;

      if (!result.success) {
        throw new Error(result.error || 'Transition refusée');
      }

      // Invalider les caches React Query pertinents
      queryClient.invalidateQueries({ queryKey: [type, id] });
      queryClient.invalidateQueries({ queryKey: [`${type}s`] });
      queryClient.invalidateQueries({ queryKey: [`${type}_transition_log`] });

      // Notifier l'utilisateur si pas de "no_change"
      if (!result.no_change) {
        toast.success(result.message || `Statut mis à jour: ${result.statut_nouveau}`);
      }

      return result;
    } catch (error: any) {
      console.error(`Erreur transition ${type}:`, error);
      toast.error(error.message || `Erreur lors de la transition`);
      return {
        success: false,
        error: error.message
      };
    }
  }, [user?.id, queryClient]);

  /**
   * S'abonner aux changements de statut en temps réel via Supabase Realtime
   */
  const subscribeToStatutChanges = useCallback((
    type: EntityType,
    callback: (payload: any) => void
  ) => {
    const tableName = type === 'commande' ? 'commande' :
                      type === 'retour' ? 'retour_produit' :
                      'attendu_reception';

    const channel = supabase
      .channel(`${type}-status-changes`)
      .on(
        'postgres_changes',
        {
          event: 'UPDATE',
          schema: 'public',
          table: tableName,
        },
        (payload) => {
          console.log(`[Realtime] ${type} updated:`, payload);
          callback(payload);
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, []);

  /**
   * Récupérer l'historique des transitions
   */
  const fetchTransitionHistory = useCallback(async (
    type: EntityType,
    id: string
  ): Promise<any[]> => {
    try {
      const tableName = `${type}_transition_log`;
      
      const { data, error } = await supabase
        .from(tableName as any)
        .select(`
          *,
          utilisateur:utilisateur_id(nom_complet)
        `)
        .eq(`${type}_id`, id)
        .order('date_transition', { ascending: false });

      if (error) throw error;
      return data || [];
    } catch (error: any) {
      console.error(`Erreur fetch historique ${type}:`, error);
      return [];
    }
  }, []);

  return {
    transitionStatut,
    subscribeToStatutChanges,
    fetchTransitionHistory
  };
};
