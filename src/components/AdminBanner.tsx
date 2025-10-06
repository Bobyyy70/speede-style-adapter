import { Eye } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip";
import { useNavigate } from "react-router-dom";
import { toast } from "sonner";
import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";

export function AdminBanner() {
  const navigate = useNavigate();
  const [clientName, setClientName] = useState<string>("");

  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    const clientId = params.get("asClient") || localStorage.getItem("viewingAsClient");
    
    if (clientId) {
      fetchClientName(clientId);
    }
  }, []);

  const fetchClientName = async (clientId: string) => {
    try {
      const { data, error } = await supabase
        .from("client")
        .select("nom_entreprise")
        .eq("id", clientId)
        .single();

      if (error) throw error;
      setClientName(data.nom_entreprise);
    } catch (error) {
      console.error("Erreur lors de la récupération du nom du client:", error);
    }
  };

  const handleExitViewMode = () => {
    localStorage.removeItem("viewingAsClient");
    const url = new URL(window.location.href);
    url.searchParams.delete("asClient");
    window.history.replaceState({}, "", url.toString());
    
    toast.success("Retour à votre espace admin");
    navigate("/");
  };

  return (
    <TooltipProvider>
      <div className="fixed bottom-4 right-4 z-50">
        <Tooltip>
          <TooltipTrigger asChild>
            <Button
              onClick={handleExitViewMode}
              size="icon"
              className="h-12 w-12 rounded-full shadow-lg bg-orange-500 hover:bg-orange-600 text-white"
            >
              <Eye className="h-5 w-5" />
            </Button>
          </TooltipTrigger>
          <TooltipContent side="left" className="max-w-xs">
            <p className="font-semibold">Vue Client: {clientName}</p>
            <p className="text-xs text-muted-foreground">Cliquer pour revenir à l'espace admin</p>
          </TooltipContent>
        </Tooltip>
      </div>
    </TooltipProvider>
  );
}
