import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";

export function useAutoRules() {
  const applyAutoRules = async (commandeId: string) => {
    try {
      const { data, error } = await supabase.functions.invoke('apply-automatic-rules', {
        body: { commandeId }
      });

      if (error) throw error;

      if (data?.updates && Object.keys(data.updates).length > 0) {
        toast.success("Règles automatiques appliquées", {
          description: `${Object.keys(data.updates).length} mise(s) à jour effectuée(s)`
        });
      }

      return data;
    } catch (error: any) {
      console.error('Erreur application règles auto:', error);
      toast.error("Erreur lors de l'application des règles automatiques");
      return null;
    }
  };

  return { applyAutoRules };
}
