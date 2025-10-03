import { useState, useEffect } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Checkbox } from "@/components/ui/checkbox";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Search, Plus, TrendingUp, Package, Clock, CheckCircle2 } from "lucide-react";
import { toast } from "sonner";
import { Skeleton } from "@/components/ui/skeleton";

interface Commande {
  id: string;
  numero_commande: string;
  nom_client: string;
  date_creation: string;
  statut_wms: string;
  source: string;
  valeur_totale: number;
  nombre_produits?: number;
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

export function CommandesList() {
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
  const [selectedStatut, setSelectedStatut] = useState("all");
  const [selectedSource, setSelectedSource] = useState("all");
  const [selectedCommandes, setSelectedCommandes] = useState<string[]>([]);

  useEffect(() => {
    fetchCommandes();
  }, [selectedStatut, selectedSource]);

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
          valeur_totale
        `)
        .order("date_creation", { ascending: false });

      if (selectedStatut !== "all") {
        query = query.eq("statut_wms", selectedStatut);
      }

      if (selectedSource !== "all") {
        query = query.eq("source", selectedSource);
      }

      const { data, error } = await query;

      if (error) throw error;

      // Calculate stats
      const allCommandes = data || [];
      setStats({
        total: allCommandes.length,
        en_attente: allCommandes.filter(c => c.statut_wms === "En attente de réappro").length,
        pret_a_preparer: allCommandes.filter(c => c.statut_wms === "Prêt à préparer").length,
        en_preparation: allCommandes.filter(c => c.statut_wms === "En préparation").length,
        expedie: allCommandes.filter(c => ["En attente d'expédition", "En cours de livraison", "Livré"].includes(c.statut_wms)).length,
      });

      setCommandes(allCommandes);
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

  const toggleSelectAll = () => {
    if (selectedCommandes.length === filteredCommandes.length) {
      setSelectedCommandes([]);
    } else {
      setSelectedCommandes(filteredCommandes.map((c) => c.id));
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
    toast.info("Création de session - À implémenter en Phase 2");
  };

  if (loading) {
    return (
      <div className="space-y-6">
        <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
          {[1, 2, 3, 4].map((i) => (
            <Card key={i}>
              <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                <Skeleton className="h-4 w-24" />
                <Skeleton className="h-4 w-4" />
              </CardHeader>
              <CardContent>
                <Skeleton className="h-8 w-16" />
              </CardContent>
            </Card>
          ))}
        </div>
        <Card>
          <CardContent className="pt-6">
            <Skeleton className="h-64 w-full" />
          </CardContent>
        </Card>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Stats Cards */}
      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Total Commandes</CardTitle>
            <Package className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{stats.total}</div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">En attente</CardTitle>
            <Clock className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{stats.en_attente}</div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Prêt / En préparation</CardTitle>
            <TrendingUp className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">
              {stats.pret_a_preparer + stats.en_preparation}
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Expédié</CardTitle>
            <CheckCircle2 className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{stats.expedie}</div>
          </CardContent>
        </Card>
      </div>

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

            <Button
              onClick={handleCreateSession}
              disabled={selectedCommandes.length === 0}
              className="w-full lg:w-auto"
            >
              <Plus className="mr-2 h-4 w-4" />
              Créer une session ({selectedCommandes.length})
            </Button>
          </div>
        </CardHeader>

        <CardContent>
          <div className="rounded-md border">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead className="w-[50px]">
                    <Checkbox
                      checked={
                        filteredCommandes.length > 0 &&
                        selectedCommandes.length === filteredCommandes.length
                      }
                      onCheckedChange={toggleSelectAll}
                    />
                  </TableHead>
                  <TableHead>N° Commande</TableHead>
                  <TableHead>Client</TableHead>
                  <TableHead>Date</TableHead>
                  <TableHead>Statut</TableHead>
                  <TableHead>Source</TableHead>
                  <TableHead className="text-right">Valeur</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {filteredCommandes.length === 0 ? (
                  <TableRow>
                    <TableCell colSpan={7} className="text-center text-muted-foreground">
                      Aucune commande trouvée
                    </TableCell>
                  </TableRow>
                ) : (
                  filteredCommandes.map((commande) => (
                    <TableRow key={commande.id}>
                      <TableCell>
                        <Checkbox
                          checked={selectedCommandes.includes(commande.id)}
                          onCheckedChange={() => toggleCommandeSelection(commande.id)}
                        />
                      </TableCell>
                      <TableCell className="font-medium">
                        {commande.numero_commande}
                      </TableCell>
                      <TableCell>{commande.nom_client}</TableCell>
                      <TableCell>
                        {new Date(commande.date_creation).toLocaleDateString("fr-FR")}
                      </TableCell>
                      <TableCell>
                        <Badge variant={getStatutBadgeVariant(commande.statut_wms)}>
                          {commande.statut_wms}
                        </Badge>
                      </TableCell>
                      <TableCell>{commande.source}</TableCell>
                      <TableCell className="text-right">
                        {commande.valeur_totale.toFixed(2)} €
                      </TableCell>
                    </TableRow>
                  ))
                )}
              </TableBody>
            </Table>
          </div>

          {filteredCommandes.length > 0 && (
            <div className="mt-4 text-sm text-muted-foreground">
              {filteredCommandes.length} commande(s) affichée(s)
              {selectedCommandes.length > 0 && ` • ${selectedCommandes.length} sélectionnée(s)`}
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
