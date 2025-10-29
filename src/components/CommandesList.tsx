import { useState, useEffect } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Search, Plus, AlertCircle, X } from "lucide-react";
import { toast } from "sonner";
import { Skeleton } from "@/components/ui/skeleton";
import { CreateSessionDialog } from "./CreateSessionDialog";
import { CommandeDetailDialog } from "./CommandeDetailDialog";
import { Checkbox } from "@/components/ui/checkbox";

interface Commande {
  id: string;
  numero_commande: string;
  nom_client: string;
  date_creation: string;
  statut_wms: string;
  source: string;
  valeur_totale: number;
  ville?: string;
  pays_code?: string;
}

interface StatsData {
  total: number;
  en_attente: number;
  pret_a_preparer: number;
  en_preparation: number;
  expedie: number;
}

const STATUTS = [
  { value: "all", label: "Tous les statuts" },
  { value: "En attente de réappro", label: "En attente de réappro" },
  { value: "Prêt à préparer", label: "Prêt à préparer" },
  { value: "En préparation", label: "En préparation" },
  { value: "En attente d'expédition", label: "En attente d'expédition" },
  { value: "En cours de livraison", label: "En cours de livraison" },
  { value: "Livré", label: "Livré" },
];

const SOURCES = [
  { value: "all", label: "Toutes les sources" },
  { value: "SendCloud", label: "SendCloud" },
  { value: "maraiches", label: "Maraiches" },
  { value: "SupplyCo's", label: "SupplyCo's" },
];

interface CommandesListProps {
  filter?: string;
  onUpdate?: () => void;
  userRole?: string | null;
  userId?: string;
  viewingClientId?: string | null;
  clientFilter?: string | null;
  statusFilters?: string[];
}

export function CommandesList({
  filter,
  onUpdate,
  userRole,
  userId,
  viewingClientId,
  clientFilter,
  statusFilters,
}: CommandesListProps = {}) {
  const [commandes, setCommandes] = useState<Commande[]>([]);
  const [stats, setStats] = useState<StatsData>({
    total: 0,
    en_attente: 0,
    pret_a_preparer: 0,
    en_preparation: 0,
    expedie: 0,
  });
  const [loading, setLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState("");
  const [selectedStatut, setSelectedStatut] = useState(filter || "all");
  const [selectedSource, setSelectedSource] = useState("all");
  const [selectedCommandes, setSelectedCommandes] = useState<string[]>([]);
  const [createDialogOpen, setCreateDialogOpen] = useState(false);
  const [detailDialogOpen, setDetailDialogOpen] = useState(false);
  const [selectedCommandeId, setSelectedCommandeId] = useState<string | null>(null);

  useEffect(() => {
    if (filter) {
      setSelectedStatut(filter);
    }
  }, [filter]);

  useEffect(() => {
    fetchCommandes();
  }, [selectedStatut, selectedSource, clientFilter, viewingClientId, statusFilters]);

  const fetchCommandes = async () => {
    setLoading(true);
    try {
      let query = supabase
        .from("commande")
        .select(`
          id,
          numero_commande,
          nom_client,
          date_creation,
          statut_wms,
          source,
          valeur_totale,
          ville,
          pays_code
        `)
        .neq("statut_wms", "Archivé")
        .order("date_creation", { ascending: false });

      if (clientFilter) {
        query = query.eq("client_id", clientFilter);
      } else if (viewingClientId) {
        query = query.eq("client_id", viewingClientId);
      } else if (userRole === "client" && userId) {
        const { data: profileData } = await supabase
          .from("profiles")
          .select("client_id")
          .eq("id", userId)
          .single();

        if (profileData?.client_id) {
          query = query.eq("client_id", profileData.client_id);
        }
      }

      if (statusFilters && statusFilters.length > 0) {
        query = query.in("statut_wms", statusFilters);
      } else if (selectedStatut !== "all") {
        query = query.eq("statut_wms", selectedStatut);
      }

      if (selectedSource !== "all") {
        query = query.eq("source", selectedSource);
      }

      const { data, error } = await query;
      if (error) throw error;

      const allCommandes = data || [];
      setStats({
        total: allCommandes.length,
        en_attente: allCommandes.filter((c) => c.statut_wms === "En attente de réappro").length,
        pret_a_preparer: allCommandes.filter((c) => c.statut_wms === "Prêt à préparer").length,
        en_preparation: allCommandes.filter((c) => c.statut_wms === "En préparation").length,
        expedie: allCommandes.filter((c) =>
          ["En attente d'expédition", "En cours de livraison", "Livré"].includes(c.statut_wms)
        ).length,
      });
      setCommandes(allCommandes);
      if (onUpdate) {
        onUpdate();
      }
    } catch (error) {
      console.error("Erreur lors du chargement des commandes:", error);
      toast.error("Erreur lors du chargement des commandes");
    } finally {
      setLoading(false);
    }
  };

  const filteredCommandes = commandes.filter((commande) => {
    const matchesSearch =
      commande.numero_commande.toLowerCase().includes(searchQuery.toLowerCase()) ||
      commande.nom_client.toLowerCase().includes(searchQuery.toLowerCase());
    return matchesSearch;
  });

  const toggleCommandeSelection = (id: string) => {
    setSelectedCommandes((prev) =>
      prev.includes(id) ? prev.filter((cId) => cId !== id) : [...prev, id]
    );
  };

  const handleCreateSession = () => {
    if (selectedCommandes.length === 0) {
      toast.error("Veuillez sélectionner au moins une commande");
      return;
    }
    setCreateDialogOpen(true);
  };

  const handleDeleteCommandes = async () => {
    if (selectedCommandes.length === 0) {
      toast.error("Veuillez sélectionner au moins une commande");
      return;
    }

    const confirmed = window.confirm(
      `Êtes-vous sûr de vouloir supprimer ${selectedCommandes.length} commande(s) ?`
    );

    if (!confirmed) return;

    try {
      const { error } = await supabase
        .from("commande")
        .delete()
        .in("id", selectedCommandes);

      if (error) throw error;

      toast.success(`${selectedCommandes.length} commande(s) supprimée(s)`);
      setSelectedCommandes([]);
      fetchCommandes();
    } catch (error) {
      console.error("Erreur lors de la suppression:", error);
      toast.error("Erreur lors de la suppression des commandes");
    }
  };

  const handleDialogClose = (open: boolean) => {
    setCreateDialogOpen(open);
    if (!open) {
      setSelectedCommandes([]);
      fetchCommandes();
    }
  };

  const handleViewDetails = (commandeId: string) => {
    setSelectedCommandeId(commandeId);
    setDetailDialogOpen(true);
  };

  const getStatutColor = (statut: string): string => {
    switch (statut) {
      case "En attente de réappro":
        return "text-orange-600";
      case "Prêt à préparer":
        return "text-blue-600";
      case "En préparation":
        return "text-yellow-600";
      case "En attente d'expédition":
        return "text-purple-600";
      case "En cours de livraison":
        return "text-indigo-600";
      case "Livré":
        return "text-green-600";
      case "Expédié":
        return "text-green-600";
      default:
        return "text-muted-foreground";
    }
  };

  const needsStockAlert = (statut: string): boolean => {
    return statut === "En attente de réappro";
  };

  // Tri intelligent: non expédiées en haut, expédiées en bas
  const sortedCommandes = [...filteredCommandes].sort((a, b) => {
    const statusOrder: Record<string, number> = {
      "En attente de réappro": 1,
      "Prêt à préparer": 2,
      "En préparation": 3,
      "En attente d'expédition": 4,
      "Expédié": 5,
      "En cours de livraison": 5,
      "Livré": 6,
      "Archivé": 7,
    };

    const aOrder = statusOrder[a.statut_wms] || 999;
    const bOrder = statusOrder[b.statut_wms] || 999;

    if (aOrder !== bOrder) return aOrder - bOrder;

    return new Date(b.date_creation).getTime() - new Date(a.date_creation).getTime();
  });

  const toggleSelectAll = () => {
    if (selectedCommandes.length === sortedCommandes.length) {
      // Tout désélectionner
      setSelectedCommandes([]);
    } else {
      // Tout sélectionner
      setSelectedCommandes(sortedCommandes.map((c) => c.id));
    }
  };

  const allSelected = sortedCommandes.length > 0 && selectedCommandes.length === sortedCommandes.length;
  const someSelected = selectedCommandes.length > 0 && selectedCommandes.length < sortedCommandes.length;

  if (loading) {
    return (
      <div className="space-y-4">
        {[1, 2, 3, 4, 5, 6].map((i) => (
          <div key={i} className="border rounded-lg p-4">
            <Skeleton className="h-6 w-3/4 mb-2" />
            <Skeleton className="h-4 w-1/2" />
          </div>
        ))}
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Filters and Actions */}
      <Card>
        <CardHeader>
          <div className="flex flex-col space-y-4 lg:flex-row lg:items-center lg:justify-between lg:space-y-0">
            <div className="flex-1 space-y-4 lg:space-y-0 lg:flex lg:items-center lg:gap-4">
              <div className="relative flex-1 max-w-sm">
                <Search className="absolute left-2.5 top-2.5 h-4 w-4 text-muted-foreground" />
                <Input
                  placeholder="Rechercher par N° ou client..."
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  className="pl-8"
                />
              </div>

              <Select value={selectedStatut} onValueChange={setSelectedStatut}>
                <SelectTrigger className="w-full lg:w-[200px]">
                  <SelectValue placeholder="Statut" />
                </SelectTrigger>
                <SelectContent>
                  {STATUTS.map((statut) => (
                    <SelectItem key={statut.value} value={statut.value}>
                      {statut.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>

              <Select value={selectedSource} onValueChange={setSelectedSource}>
                <SelectTrigger className="w-full lg:w-[200px]">
                  <SelectValue placeholder="Source" />
                </SelectTrigger>
                <SelectContent>
                  {SOURCES.map((source) => (
                    <SelectItem key={source.value} value={source.value}>
                      {source.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div className="flex gap-2">
              {selectedCommandes.length > 0 && (
                <>
                  <Button onClick={handleCreateSession} className="w-full lg:w-auto">
                    <Plus className="mr-2 h-4 w-4" />
                    Créer session ({selectedCommandes.length})
                  </Button>
                  <Button 
                    variant="destructive" 
                    onClick={handleDeleteCommandes} 
                    className="w-full lg:w-auto"
                  >
                    <X className="mr-2 h-4 w-4" />
                    Supprimer ({selectedCommandes.length})
                  </Button>
                </>
              )}
            </div>
          </div>
        </CardHeader>

        <CardContent>
          {sortedCommandes.length === 0 ? (
            <p className="text-center text-muted-foreground py-8">Aucune commande trouvée</p>
          ) : (
            <>
              <div className="flex items-center gap-3 p-3 mb-2 border-b">
                <Checkbox
                  checked={allSelected}
                  onCheckedChange={toggleSelectAll}
                  className="flex-shrink-0"
                />
                <span className="text-sm font-medium text-muted-foreground">
                  {allSelected 
                    ? `Tout désélectionner (${sortedCommandes.length})` 
                    : someSelected 
                    ? `Sélectionner tout (${selectedCommandes.length}/${sortedCommandes.length})` 
                    : `Sélectionner tout (${sortedCommandes.length})`
                  }
                </span>
              </div>

              <div className="space-y-2">
                {sortedCommandes.map((commande) => (
                <div
                  key={commande.id}
                  className="flex items-center gap-3 p-4 border rounded-lg hover:bg-muted/50 transition-colors cursor-pointer group"
                  onClick={() => handleViewDetails(commande.id)}
                >
                  <Checkbox
                    checked={selectedCommandes.includes(commande.id)}
                    onCheckedChange={() => toggleCommandeSelection(commande.id)}
                    onClick={(e) => e.stopPropagation()}
                    className="flex-shrink-0"
                  />
                  
                  <div className="flex-1 min-w-0">
                    <div className="flex items-start justify-between gap-4">
                      <div className="flex-1 min-w-0">
                        <div className="flex items-baseline gap-3 mb-1">
                          <span className="font-semibold text-base">
                            {commande.numero_commande}
                          </span>
                          <span className="text-sm text-muted-foreground">
                            {commande.nom_client}
                          </span>
                        </div>
                        
                        <div className="flex items-center gap-2 flex-wrap">
                          <span className={`text-sm font-medium ${getStatutColor(commande.statut_wms)}`}>
                            {commande.statut_wms}
                          </span>
                          
                          {needsStockAlert(commande.statut_wms) && (
                            <span className="inline-flex items-center gap-1 text-xs text-orange-600">
                              <AlertCircle className="h-3 w-3" />
                              Alerte stock
                            </span>
                          )}
                        </div>
                      </div>

                      <div className="text-right flex-shrink-0">
                        <div className="text-sm text-muted-foreground mb-1">
                          {new Date(commande.date_creation).toLocaleDateString("fr-FR")}
                        </div>
                        <div className="font-semibold">
                          {commande.valeur_totale.toFixed(2)} €
                        </div>
                      </div>
                    </div>
                  </div>
                </div>
              ))}
            </div>
            </>
          )}
        </CardContent>
      </Card>

      <CreateSessionDialog
        open={createDialogOpen}
        onOpenChange={handleDialogClose}
        selectedCommandeIds={selectedCommandes}
      />

      {selectedCommandeId && (
        <CommandeDetailDialog
          open={detailDialogOpen}
          onOpenChange={setDetailDialogOpen}
          commandeId={selectedCommandeId}
        />
      )}
    </div>
  );
}
