import { supabase } from "@/integrations/supabase/client";

export interface ClientInfo {
  clientId: string;
  clientName?: string;
}

/**
 * Résout le clientId selon cet ordre de priorité:
 * 1. Paramètre URL ?asClient=xxx
 * 2. localStorage.selectedClientId
 * 3. Profile de l'utilisateur (client_id)
 * 4. Premier client actif (pour admin/gestionnaire)
 */
export async function getClientId(
  user: any,
  searchParams: URLSearchParams,
  userRole?: string | null
): Promise<ClientInfo> {
  // 1. Vérifier le paramètre URL
  const asClient = searchParams.get("asClient");
  if (asClient) {
    // Sauvegarder dans localStorage
    localStorage.setItem("selectedClientId", asClient);
    
    // Récupérer le nom du client
    const { data: client } = await supabase
      .from("client")
      .select("nom_entreprise")
      .eq("id", asClient)
      .single();
    
    return {
      clientId: asClient,
      clientName: client?.nom_entreprise,
    };
  }

  // 2. Vérifier localStorage
  const storedClientId = localStorage.getItem("selectedClientId");
  if (storedClientId) {
    const { data: client } = await supabase
      .from("client")
      .select("nom_entreprise")
      .eq("id", storedClientId)
      .single();
    
    return {
      clientId: storedClientId,
      clientName: client?.nom_entreprise,
    };
  }

  // 3. Vérifier le profile de l'utilisateur
  if (user?.id) {
    const { data: profile } = await supabase
      .from("profiles")
      .select("client_id")
      .eq("id", user.id)
      .single();

    if (profile?.client_id) {
      const { data: client } = await supabase
        .from("client")
        .select("nom_entreprise")
        .eq("id", profile.client_id)
        .single();
      
      return {
        clientId: profile.client_id,
        clientName: client?.nom_entreprise,
      };
    }
  }

  // 4. Pour admin/gestionnaire: prendre le premier client actif
  if (userRole === "admin" || userRole === "gestionnaire") {
    const { data: clients } = await supabase
      .from("client")
      .select("id, nom_entreprise")
      .eq("actif", true)
      .order("nom_entreprise")
      .limit(1);

    if (clients && clients.length > 0) {
      const clientId = clients[0].id;
      localStorage.setItem("selectedClientId", clientId);
      
      return {
        clientId,
        clientName: clients[0].nom_entreprise,
      };
    }
  }

  throw new Error("Aucun client trouvé. Veuillez utiliser le menu 'Vue Client' pour en sélectionner un.");
}
