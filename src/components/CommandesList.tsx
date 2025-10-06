import { useState, useEffect } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Checkbox } from "@/components/ui/checkbox";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Search, Plus, TrendingUp, Package, Clock, CheckCircle2, Columns, Eye } from "lucide-react";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { ScrollArea } from "@/components/ui/scroll-area";
import { toast } from "sonner";
import { Skeleton } from "@/components/ui/skeleton";
import { CreateSessionDialog } from "./CreateSessionDialog";
import { CommandeDetailDialog } from "./CommandeDetailDialog";
import { SendCloudActions } from "./SendCloudActions";

interface Commande {
  id: string;
  numero_commande: string;
  nom_client: string;
  date_creation: string;
  statut_wms: string;
  source: string;
  valeur_totale: number;
  methode_expedition?: string;
  transporteur?: string;
  poids_total?: number;
  sendcloud_id?: string;
  sendcloud_shipment_id?: string;
  label_url?: string;
  tracking_number?: string;
  tracking_url?: string;
  numero_facture_commerciale?: string;
  devise?: string;
  date_modification?: string;
  ville?: string;
  code_postal?: string;
  pays_code?: string;
  adresse_ligne_1?: string;
  adresse_ligne_2?: string;
  adresse_nom?: string;
  email_client?: string;
  telephone_client?: string;
  remarques?: string;
}
interface StatsData {
  total: number;
  en_attente: number;
  pret_a_preparer: number;
  en_preparation: number;
  expedie: number;
}
const STATUTS = [{
  value: "all",
  label: "Tous les statuts"
}, {
  value: "En attente de réappro",
  label: "En attente de réappro"
}, {
  value: "Prêt à préparer",
  label: "Prêt à préparer"
}, {
  value: "En préparation",
  label: "En préparation"
}, {
  value: "En attente d'expédition",
  label: "En attente d'expédition"
}, {
  value: "En cours de livraison",
  label: "En cours de livraison"
}, {
  value: "Livré",
  label: "Livré"
}];
const SOURCES = [{
  value: "all",
  label: "Toutes les sources"
}, {
  value: "SendCloud",
  label: "SendCloud"
}, {
  value: "maraiches",
  label: "Maraiches"
}, {
  value: "SupplyCo's",
  label: "SupplyCo's"
}];
const ALL_COLUMNS = [{
  key: "numero_commande",
  label: "N° Commande",
  defaultVisible: true
}, {
  key: "nom_client",
  label: "Client",
  defaultVisible: true
}, {
  key: "date_creation",
  label: "Date de création",
  defaultVisible: true
}, {
  key: "statut_wms",
  label: "Statut",
  defaultVisible: true
}, {
  key: "source",
  label: "Source",
  defaultVisible: true
}, {
  key: "valeur_totale",
  label: "Valeur",
  defaultVisible: true
}, {
  key: "methode_expedition",
  label: "Méthode d'expédition",
  defaultVisible: false
}, {
  key: "transporteur",
  label: "Transporteur",
  defaultVisible: false
}, {
  key: "poids_total",
  label: "Poids total",
  defaultVisible: false
}, {
  key: "sendcloud_id",
  label: "SendCloud ID",
  defaultVisible: false
}, {
  key: "numero_facture_commerciale",
  label: "N° Facture",
  defaultVisible: false
}, {
  key: "devise",
  label: "Devise",
  defaultVisible: false
}, {
  key: "date_modification",
  label: "Date de modification",
  defaultVisible: false
}, {
  key: "ville",
  label: "Ville",
  defaultVisible: false
}, {
  key: "code_postal",
  label: "Code postal",
  defaultVisible: false
}, {
  key: "pays_code",
  label: "Pays",
  defaultVisible: false
}, {
  key: "adresse_ligne_1",
  label: "Adresse ligne 1",
  defaultVisible: false
}, {
  key: "adresse_ligne_2",
  label: "Adresse ligne 2",
  defaultVisible: false
}, {
  key: "adresse_nom",
  label: "Adresse nom",
  defaultVisible: false
}, {
  key: "email_client",
  label: "Email client",
  defaultVisible: false
}, {
  key: "telephone_client",
  label: "Téléphone client",
  defaultVisible: false
}, {
  key: "remarques",
  label: "Remarques",
  defaultVisible: false
}];
const DEFAULT_VISIBLE_COLUMNS = ALL_COLUMNS.filter(col => col.defaultVisible).map(col => col.key);
interface CommandesListProps {
  filter?: string;
  onUpdate?: () => void;
  userRole?: string | null;
  userId?: string;
  viewingClientId?: string | null;
}
export function CommandesList({
  filter,
  onUpdate,
  userRole,
  userId,
  viewingClientId
}: CommandesListProps = {}) {
  const [commandes, setCommandes] = useState<Commande[]>([]);
  const [stats, setStats] = useState<StatsData>({
    total: 0,
    en_attente: 0,
    pret_a_preparer: 0,
    en_preparation: 0,
    expedie: 0
  });
  const [loading, setLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState("");
  const [selectedStatut, setSelectedStatut] = useState(filter || "all");
  const [selectedSource, setSelectedSource] = useState("all");
  const [selectedCommandes, setSelectedCommandes] = useState<string[]>([]);
  const [createDialogOpen, setCreateDialogOpen] = useState(false);
  const [detailDialogOpen, setDetailDialogOpen] = useState(false);
  const [selectedCommandeId, setSelectedCommandeId] = useState<string | null>(null);
  const [visibleColumns, setVisibleColumns] = useState<string[]>(() => {
    const saved = localStorage.getItem("commandes-visible-columns");
    return saved ? JSON.parse(saved) : DEFAULT_VISIBLE_COLUMNS;
  });
  useEffect(() => {
    if (filter) {
      setSelectedStatut(filter);
    }
  }, [filter]);
  useEffect(() => {
    fetchCommandes();
  }, [selectedStatut, selectedSource]);
  const fetchCommandes = async () => {
    setLoading(true);
    try {
      let query = supabase.from("commande").select(`
          id,
          numero_commande,
          nom_client,
          date_creation,
          statut_wms,
          source,
          valeur_totale,
          methode_expedition,
          transporteur,
          poids_total,
          sendcloud_id,
          numero_facture_commerciale,
          devise,
          date_modification,
          ville,
          code_postal,
          pays_code,
          adresse_ligne_1,
          adresse_ligne_2,
          adresse_nom,
          email_client,
          telephone_client,
          remarques
        `).order("date_creation", {
        ascending: false
      });
      
      // Filter by client_id if viewing as client or if user is a client
      if (viewingClientId) {
        query = query.eq("client_id", viewingClientId);
      } else if (userRole === 'client' && userId) {
        const { data: profileData } = await supabase
          .from("profiles")
          .select("client_id")
          .eq("id", userId)
          .single();
        
        if (profileData?.client_id) {
          query = query.eq("client_id", profileData.client_id);
        }
      }
      
      if (selectedStatut !== "all") {
        query = query.eq("statut_wms", selectedStatut);
      }
      if (selectedSource !== "all") {
        query = query.eq("source", selectedSource);
      }
      const {
        data,
        error
      } = await query;
      if (error) throw error;

      // Calculate stats
      const allCommandes = data || [];
      setStats({
        total: allCommandes.length,
        en_attente: allCommandes.filter(c => c.statut_wms === "En attente de réappro").length,
        pret_a_preparer: allCommandes.filter(c => c.statut_wms === "Prêt à préparer").length,
        en_preparation: allCommandes.filter(c => c.statut_wms === "En préparation").length,
        expedie: allCommandes.filter(c => ["En attente d'expédition", "En cours de livraison", "Livré"].includes(c.statut_wms)).length
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
  const filteredCommandes = commandes.filter(commande => {
    const matchesSearch = commande.numero_commande.toLowerCase().includes(searchQuery.toLowerCase()) || commande.nom_client.toLowerCase().includes(searchQuery.toLowerCase());
    return matchesSearch;
  });
  const toggleCommandeSelection = (id: string) => {
    setSelectedCommandes(prev => prev.includes(id) ? prev.filter(cId => cId !== id) : [...prev, id]);
  };
  const toggleSelectAll = () => {
    if (selectedCommandes.length === filteredCommandes.length) {
      setSelectedCommandes([]);
    } else {
      setSelectedCommandes(filteredCommandes.map(c => c.id));
    }
  };
  const getStatutBadgeVariant = (statut: string) => {
    switch (statut) {
      case "En attente de réappro":
        return "destructive";
      case "Prêt à préparer":
        return "default";
      case "En préparation":
        return "secondary";
      case "En attente d'expédition":
      case "En cours de livraison":
        return "outline";
      case "Livré":
        return "default";
      default:
        return "outline";
    }
  };
  const handleCreateSession = () => {
    if (selectedCommandes.length === 0) {
      toast.error("Veuillez sélectionner au moins une commande");
      return;
    }
    setCreateDialogOpen(true);
  };
  const handleSessionCreated = () => {
    setSelectedCommandes([]);
    fetchCommandes();
  };
  const toggleColumnVisibility = (columnKey: string) => {
    setVisibleColumns(prev => {
      const newColumns = prev.includes(columnKey) ? prev.filter(k => k !== columnKey) : [...prev, columnKey];
      localStorage.setItem("commandes-visible-columns", JSON.stringify(newColumns));
      return newColumns;
    });
  };
  const resetColumns = () => {
    setVisibleColumns(DEFAULT_VISIBLE_COLUMNS);
    localStorage.setItem("commandes-visible-columns", JSON.stringify(DEFAULT_VISIBLE_COLUMNS));
  };
  const isColumnVisible = (columnKey: string) => visibleColumns.includes(columnKey);
  const handleViewDetails = (commandeId: string) => {
    setSelectedCommandeId(commandeId);
    setDetailDialogOpen(true);
  };
  const renderCellContent = (commande: Commande, columnKey: string) => {
    switch (columnKey) {
      case "numero_commande":
        return <span className="font-medium">{commande.numero_commande}</span>;
      case "nom_client":
        return commande.nom_client;
      case "date_creation":
        return new Date(commande.date_creation).toLocaleDateString("fr-FR");
      case "statut_wms":
        return <Badge variant={getStatutBadgeVariant(commande.statut_wms)}>{commande.statut_wms}</Badge>;
      case "source":
        return commande.source;
      case "valeur_totale":
        return <span className="text-right block">{commande.valeur_totale.toFixed(2)} €</span>;
      case "date_modification":
        return commande.date_modification ? new Date(commande.date_modification).toLocaleDateString("fr-FR") : "-";
      case "poids_total":
        return commande.poids_total ? `${commande.poids_total} kg` : "-";
      default:
        return (commande as any)[columnKey] || "-";
    }
  };
  if (loading) {
    return <div className="space-y-6">
        <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
          {[1, 2, 3, 4].map(i => <Card key={i}>
              <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                <Skeleton className="h-4 w-24" />
                <Skeleton className="h-4 w-4" />
              </CardHeader>
              <CardContent>
                <Skeleton className="h-8 w-16" />
              </CardContent>
            </Card>)}
        </div>
        <Card>
          <CardContent className="pt-6">
            <Skeleton className="h-64 w-full" />
          </CardContent>
        </Card>
      </div>;
  }
  return <div className="space-y-6">
      {/* Stats Cards */}
      

      {/* Filters and Actions */}
      <Card>
        <CardHeader>
          <div className="flex flex-col space-y-4 lg:flex-row lg:items-center lg:justify-between lg:space-y-0">
            <div className="flex-1 space-y-4 lg:space-y-0 lg:flex lg:items-center lg:gap-4">
              <div className="relative flex-1 max-w-sm">
                <Search className="absolute left-2.5 top-2.5 h-4 w-4 text-muted-foreground" />
                <Input placeholder="Rechercher par N° ou client..." value={searchQuery} onChange={e => setSearchQuery(e.target.value)} className="pl-8" />
              </div>

              <Select value={selectedStatut} onValueChange={setSelectedStatut}>
                <SelectTrigger className="w-full lg:w-[200px]">
                  <SelectValue placeholder="Statut" />
                </SelectTrigger>
                <SelectContent>
                  {STATUTS.map(statut => <SelectItem key={statut.value} value={statut.value}>
                      {statut.label}
                    </SelectItem>)}
                </SelectContent>
              </Select>

              <Select value={selectedSource} onValueChange={setSelectedSource}>
                <SelectTrigger className="w-full lg:w-[200px]">
                  <SelectValue placeholder="Source" />
                </SelectTrigger>
                <SelectContent>
                  {SOURCES.map(source => <SelectItem key={source.value} value={source.value}>
                      {source.label}
                    </SelectItem>)}
                </SelectContent>
              </Select>
            </div>

            <div className="flex gap-2">
              <Popover>
                <PopoverTrigger asChild>
                  <Button variant="outline" size="icon">
                    <Columns className="h-4 w-4" />
                  </Button>
                </PopoverTrigger>
                <PopoverContent className="w-80" align="end">
                  <div className="space-y-4">
                    <div className="flex items-center justify-between">
                      <h4 className="font-medium text-sm">Colonnes visibles</h4>
                      <Badge variant="secondary">{visibleColumns.length}</Badge>
                    </div>
                    <ScrollArea className="h-[300px] pr-4">
                      <div className="space-y-2">
                        {ALL_COLUMNS.map(column => <div key={column.key} className="flex items-center space-x-2">
                            <Checkbox id={column.key} checked={isColumnVisible(column.key)} onCheckedChange={() => toggleColumnVisibility(column.key)} />
                            <label htmlFor={column.key} className="text-sm font-normal leading-none peer-disabled:cursor-not-allowed peer-disabled:opacity-70 cursor-pointer">
                              {column.label}
                            </label>
                          </div>)}
                      </div>
                    </ScrollArea>
                    <Button variant="outline" size="sm" onClick={resetColumns} className="w-full">
                      Réinitialiser par défaut
                    </Button>
                  </div>
                </PopoverContent>
              </Popover>

              <Button onClick={handleCreateSession} disabled={selectedCommandes.length === 0} className="w-full lg:w-auto">
                <Plus className="mr-2 h-4 w-4" />
                Créer une session ({selectedCommandes.length})
              </Button>
            </div>
          </div>
        </CardHeader>

        <CardContent>
          <div className="rounded-md border">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead className="w-[50px]">
                    <Checkbox checked={filteredCommandes.length > 0 && selectedCommandes.length === filteredCommandes.length} onCheckedChange={toggleSelectAll} />
                  </TableHead>
                  {ALL_COLUMNS.filter(col => isColumnVisible(col.key)).map(column => <TableHead key={column.key} className={column.key === "valeur_totale" ? "text-right" : ""}>
                      {column.label}
                    </TableHead>)}
                  <TableHead className="w-[300px]">Actions</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {filteredCommandes.length === 0 ? <TableRow>
                    <TableCell colSpan={visibleColumns.length + 2} className="text-center text-muted-foreground">
                      Aucune commande trouvée
                    </TableCell>
                  </TableRow> : filteredCommandes.map(commande => <TableRow key={commande.id}>
                      <TableCell>
                        <Checkbox checked={selectedCommandes.includes(commande.id)} onCheckedChange={() => toggleCommandeSelection(commande.id)} />
                      </TableCell>
                      {ALL_COLUMNS.filter(col => isColumnVisible(col.key)).map(column => <TableCell key={column.key}>
                          {renderCellContent(commande, column.key)}
                        </TableCell>)}
                      <TableCell>
                        <div className="flex gap-2 items-center">
                          <Button variant="ghost" size="sm" onClick={() => handleViewDetails(commande.id)}>
                            <Eye className="h-4 w-4" />
                          </Button>
                          <SendCloudActions
                            commandeId={commande.id}
                            hasLabel={!!commande.label_url}
                            hasSendcloudId={!!commande.sendcloud_shipment_id}
                            onSuccess={fetchCommandes}
                          />
                        </div>
                      </TableCell>
                    </TableRow>)}
              </TableBody>
            </Table>
          </div>

          {filteredCommandes.length > 0 && <div className="mt-4 text-sm text-muted-foreground">
              {filteredCommandes.length} commande(s) affichée(s)
              {selectedCommandes.length > 0 && ` • ${selectedCommandes.length} sélectionnée(s)`}
            </div>}
        </CardContent>
      </Card>

      <CreateSessionDialog open={createDialogOpen} onOpenChange={setCreateDialogOpen} selectedCommandeIds={selectedCommandes} onSuccess={handleSessionCreated} />
      
      {selectedCommandeId && <CommandeDetailDialog commandeId={selectedCommandeId} open={detailDialogOpen} onOpenChange={setDetailDialogOpen} onSuccess={fetchCommandes} />}
    </div>;
}