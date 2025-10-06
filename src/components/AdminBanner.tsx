import { X } from "lucide-react";
import { Button } from "@/components/ui/button";
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
    <div className="fixed top-0 left-0 right-0 z-50 bg-gradient-to-r from-orange-500 to-orange-600 text-white shadow-lg">
      <div className="container mx-auto px-4 py-2 flex items-center justify-between">
        <div className="flex items-center gap-2">
          <span className="text-lg">🔍</span>
          <span className="font-medium">
            Mode Vue Client : <span className="font-bold">{clientName}</span>
          </span>
        </div>
        <Button
          variant="ghost"
          size="sm"
          onClick={handleExitViewMode}
          className="text-white hover:bg-orange-700 hover:text-white"
        >
          <X className="mr-2 h-4 w-4" />
          Retour à mon espace Admin
        </Button>
      </div>
    </div>
  );
}
