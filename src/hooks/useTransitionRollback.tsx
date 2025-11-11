import { useCallback } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useQueryClient } from '@tanstack/react-query';
import { toast } from 'sonner';
import { useAuth } from './useAuth';

type EntityType = 'commande' | 'retour' | 'attendu';

interface RollbackResult {
  success: boolean;
  message?: string;
  error?: string;
  entity_id?: string;
  old_status?: string;
  new_status?: string;
}

export const useTransitionRollback = () => {
  const queryClient = useQueryClient();
  const { user } = useAuth();

  const rollbackTransition = useCallback(async (
    type: EntityType,
    transitionId: string,
    raison: string
  ): Promise<RollbackResult> => {
    try {
      if (!raison || raison.trim().length < 10) {
        throw new Error('La raison doit contenir au moins 10 caractères');
      }

      const { data, error } = await supabase.rpc('rollback_transition', {
        p_type: type,
        p_transition_id: transitionId,
        p_raison: raison,
        p_user_id: user?.id
      });

      if (error) throw error;

      const result = data as unknown as RollbackResult;

      if (!result.success) {
        throw new Error(result.error || 'Échec du rollback');
      }

      // Invalider les caches pertinents
      queryClient.invalidateQueries({ queryKey: ['transitions'] });
      queryClient.invalidateQueries({ queryKey: [type, result.entity_id] });
      queryClient.invalidateQueries({ queryKey: [`${type}s`] });
      queryClient.invalidateQueries({ queryKey: ['transition-stats'] });

      toast.success(result.message || 'Transition annulée avec succès');
      return result;
    } catch (error: any) {
      console.error('Erreur rollback transition:', error);
      toast.error(error.message || 'Erreur lors de l\'annulation');
      return {
        success: false,
        error: error.message
      };
    }
  }, [user?.id, queryClient]);

  return { rollbackTransition };
};
