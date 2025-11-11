import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";

export interface RegleValidation {
  id: string;
  nom_regle: string;
  description?: string;
  conditions: any;
  action_a_effectuer: 'bloquer' | 'exiger_validation' | 'alerter';
  niveau_validation?: string;
  message_utilisateur?: string;
  approbateurs_autorises?: string[];
  client_id?: string;
  priorite: number;
  actif: boolean;
  delai_max_jours?: number;
  date_creation: string;
  date_modification: string;
}

export function useValidationRules() {
  const queryClient = useQueryClient();

  // Récupérer toutes les règles
  const { data: regles, isLoading } = useQuery({
    queryKey: ['regle_validation_commande'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('regle_validation_commande')
        .select('*')
        .order('priorite', { ascending: true });
      
      if (error) throw error;
      return data as RegleValidation[];
    }
  });

  // Créer une règle
  const createMutation = useMutation({
    mutationFn: async (regle: Partial<RegleValidation>) => {
      const { data, error } = await supabase
        .from('regle_validation_commande')
        .insert([regle as any])
        .select()
        .single();
      
      if (error) throw error;
      return data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['regle_validation_commande'] });
      toast.success("Règle de validation créée avec succès");
    },
    onError: (error: any) => {
      toast.error("Erreur lors de la création de la règle", {
        description: error.message
      });
    }
  });

  // Mettre à jour une règle
  const updateMutation = useMutation({
    mutationFn: async ({ id, ...updates }: Partial<RegleValidation> & { id: string }) => {
      const { data, error } = await supabase
        .from('regle_validation_commande')
        .update(updates)
        .eq('id', id)
        .select()
        .single();
      
      if (error) throw error;
      return data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['regle_validation_commande'] });
      toast.success("Règle mise à jour avec succès");
    },
    onError: (error: any) => {
      toast.error("Erreur lors de la mise à jour", {
        description: error.message
      });
    }
  });

  // Supprimer une règle
  const deleteMutation = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase
        .from('regle_validation_commande')
        .delete()
        .eq('id', id);
      
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['regle_validation_commande'] });
      toast.success("Règle supprimée avec succès");
    },
    onError: (error: any) => {
      toast.error("Erreur lors de la suppression", {
        description: error.message
      });
    }
  });

  // Basculer l'état actif
  const toggleActiveMutation = useMutation({
    mutationFn: async ({ id, actif }: { id: string; actif: boolean }) => {
      const { error } = await supabase
        .from('regle_validation_commande')
        .update({ actif })
        .eq('id', id);
      
      if (error) throw error;
    },
    onSuccess: (_, variables) => {
      queryClient.invalidateQueries({ queryKey: ['regle_validation_commande'] });
      toast.success(variables.actif ? "Règle activée" : "Règle désactivée");
    }
  });

  // Vérifier les règles pour une commande
  const checkRules = async (commandeId: string) => {
    try {
      const { data, error } = await supabase.functions.invoke('check-validation-rules', {
        body: { commandeId }
      });

      if (error) throw error;
      return data;
    } catch (error: any) {
      console.error('Erreur lors de la vérification des règles:', error);
      toast.error("Erreur lors de la vérification des règles");
      return null;
    }
  };

  return {
    regles,
    isLoading,
    createRegle: createMutation.mutateAsync,
    updateRegle: updateMutation.mutateAsync,
    deleteRegle: deleteMutation.mutateAsync,
    toggleActive: toggleActiveMutation.mutateAsync,
    checkRules
  };
}