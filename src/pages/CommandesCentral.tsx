import { useState, useEffect } from "react";
import { useQuery } from "@tanstack/react-query";
import { DashboardLayout } from "@/components/DashboardLayout";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Checkbox } from "@/components/ui/checkbox";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { toast } from "sonner";
import {
  Package,
  ShoppingCart,
  Filter,
  Download,
  Printer,
  FileText,
  MoreVertical,
  RefreshCw,
  Search,
  TrendingUp,
  Calendar,
  DollarSign,
  Globe,
  Truck,
  CheckCircle2,
  Clock,
  AlertTriangle,
  XCircle,
  Store,
  Zap,
  Eye,
  Edit,
  Archive,
  Settings,
} from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { ORDER_STATUSES, ORDER_STATUS_LABELS } from "@/lib/orderStatuses";
import { Separator } from "@/components/ui/separator";
import { DatePickerWithRange } from "@/components/ui/date-range-picker";
import { DateRange } from "react-day-picker";

// Types
interface Commande {
  id: string;
  numero_commande: string;
  date_creation: string;
  statut_wms: string; // Fixed: was 'statut'
  source: string;
  reference_client?: string; // Fixed: was 'marketplace_order_id'
  adresse_nom: string; // Fixed: was 'client_nom'
  adresse_pays?: string;
  pays_code?: string; // Fixed: was 'adresse_pays_code'
  valeur_totale?: number; // Fixed: was 'montant_total'
  poids_total?: number;
  nb_articles?: number;
  transporteur?: string;
  tracking_number?: string;
  client_id?: string;
}

interface FilterState {
  search: string;
  statuts: string[];
  sources: string[];
  dateRange: DateRange | undefined;
  montantMin?: number;
  montantMax?: number;
  pays: string[];
  transporteurs: string[];
  clientId?: string;
}

const MARKETPLACE_SOURCES = [
  { id: 'amazon', label: 'Amazon', icon: ShoppingCart, color: 'orange' },
  { id: 'shopify', label: 'Shopify', icon: Store, color: 'green' },
  { id: 'ebay', label: 'eBay', icon: ShoppingCart, color: 'blue' },
  { id: 'cdiscount', label: 'Cdiscount', icon: ShoppingCart, color: 'purple' },
  { id: 'woocommerce', label: 'WooCommerce', icon: ShoppingCart, color: 'violet' },
  { id: 'prestashop', label: 'PrestaShop', icon: ShoppingCart, color: 'pink' },
  { id: 'manuel', label: 'Manuel', icon: Edit, color: 'gray' },
  { id: 'api', label: 'API', icon: Zap, color: 'yellow' },
];

export default function CommandesCentral() {
  const { user, userRole, getViewingClientId } = useAuth();
  const [selectedCommandes, setSelectedCommandes] = useState<string[]>([]);
  const [detailDialogOpen, setDetailDialogOpen] = useState(false);
  const [selectedCommande, setSelectedCommande] = useState<Commande | null>(null);
  const [filters, setFilters] = useState<FilterState>({
    search: '',
    statuts: [],
    sources: [],
    dateRange: undefined,
    pays: [],
    transporteurs: [],
  });

  // Fetch commandes avec filtres
  const { data: commandesData, isLoading, refetch } = useQuery({
    queryKey: ["commandes-central", filters, getViewingClientId()],
    queryFn: async () => {
      let query = supabase
        .from("commande")
        .select("*")
        .order("date_creation", { ascending: false });

      const viewingClientId = getViewingClientId();
      if (viewingClientId) {
        query = query.eq("client_id", viewingClientId);
      } else if (userRole === 'client' && user) {
        const { data: profileData } = await supabase
          .from("profiles")
          .select("client_id")
          .eq("id", user.id)
          .maybeSingle();
        if (profileData?.client_id) {
          query = query.eq("client_id", profileData.client_id);
        }
      }

      // Appliquer les filtres
      if (filters.statuts.length > 0) {
        query = query.in("statut_wms", filters.statuts as any);
      }

      if (filters.sources.length > 0) {
        query = query.in("source", filters.sources);
      }

      if (filters.dateRange?.from) {
        query = query.gte("date_creation", filters.dateRange.from.toISOString());
      }

      if (filters.dateRange?.to) {
        query = query.lte("date_creation", filters.dateRange.to.toISOString());
      }

      if (filters.pays.length > 0) {
        query = query.in("pays_code", filters.pays);
      }

      const { data, error } = await query;
      if (error) throw error;

      // Filtrage côté client pour recherche et montant
      let filtered = data || [];

      if (filters.search) {
        const searchLower = filters.search.toLowerCase();
        filtered = filtered.filter(cmd =>
          cmd.numero_commande?.toLowerCase().includes(searchLower) ||
          cmd.adresse_nom?.toLowerCase().includes(searchLower) ||
          cmd.reference_client?.toLowerCase().includes(searchLower)
        );
      }

      if (filters.montantMin !== undefined) {
        filtered = filtered.filter(cmd => (cmd.valeur_totale || 0) >= filters.montantMin!);
      }

      if (filters.montantMax !== undefined) {
        filtered = filtered.filter(cmd => (cmd.valeur_totale || 0) <= filters.montantMax!);
      }

      return filtered;
    },
  });

  // Stats calculées
  const stats = {
    total: commandesData?.length || 0,
    parSource: MARKETPLACE_SOURCES.map(source => ({
      ...source,
      count: commandesData?.filter(cmd => cmd.source === source.id).length || 0,
      ca: commandesData
        ?.filter(cmd => cmd.source === source.id)
        .reduce((sum, cmd) => sum + (cmd.valeur_totale || 0), 0) || 0,
    })),
    parStatut: Object.entries(ORDER_STATUS_LABELS).map(([key, label]) => ({
      statut: key,
      label,
      count: commandesData?.filter(cmd => cmd.statut_wms === key).length || 0,
    })),
    caTotal: commandesData?.reduce((sum, cmd) => sum + (cmd.valeur_totale || 0), 0) || 0,
    poidsTotal: commandesData?.reduce((sum, cmd) => sum + (cmd.poids_total || 0), 0) || 0,
  };

  // Actions en masse
  const handlePrintLabels = async () => {
    if (selectedCommandes.length === 0) {
      toast.error("Aucune commande sélectionnée");
      return;
    }

    toast.info(`Impression de ${selectedCommandes.length} étiquette(s) via SendCloud...`);
    // TODO: Appeler API SendCloud pour créer les colis et télécharger les étiquettes
  };

  const handleGenerateCN23 = async () => {
    if (selectedCommandes.length === 0) {
      toast.error("Aucune commande sélectionnée");
      return;
    }

    toast.info(`Génération de ${selectedCommandes.length} CN23...`);
    // TODO: Appeler fonction generate-cn23 pour chaque commande
  };

  const handleExportCSV = () => {
    const data = commandesData || [];
    const csv = [
      ['N° Commande', 'Date', 'Source', 'Statut', 'Client', 'Montant', 'Pays'].join(';'),
      ...data.map(cmd => [
        cmd.numero_commande,
        new Date(cmd.date_creation).toLocaleDateString('fr-FR'),
        cmd.source,
        ORDER_STATUS_LABELS[cmd.statut_wms as keyof typeof ORDER_STATUS_LABELS] || cmd.statut_wms,
        cmd.adresse_nom,
        cmd.valeur_totale?.toFixed(2) || '0.00',
        cmd.pays_code || '',
      ].join(';'))
    ].join('\n');

    const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
    const link = document.createElement('a');
    link.href = URL.createObjectURL(blob);
    link.download = `commandes_${new Date().toISOString().split('T')[0]}.csv`;
    link.click();
    toast.success(`${data.length} commande(s) exportée(s)`);
  };

  const toggleSelectAll = () => {
    if (selectedCommandes.length === (commandesData?.length || 0)) {
      setSelectedCommandes([]);
    } else {
      setSelectedCommandes(commandesData?.map(cmd => cmd.id) || []);
    }
  };

  const getSourceBadge = (source: string) => {
    const sourceConfig = MARKETPLACE_SOURCES.find(s => s.id === source);
    if (!sourceConfig) return <Badge variant="outline">{source}</Badge>;

    const Icon = sourceConfig.icon;
    return (
      <Badge variant="outline" className={`border-${sourceConfig.color}-500 text-${sourceConfig.color}-700`}>
        <Icon className="w-3 h-3 mr-1" />
        {sourceConfig.label}
      </Badge>
    );
  };

  const getStatutBadge = (statut: string) => {
    const config: Record<string, { variant: any; icon: any }> = {
      [ORDER_STATUSES.EN_ATTENTE_REAPPRO]: { variant: 'secondary', icon: Clock },
      [ORDER_STATUSES.STOCK_RESERVE]: { variant: 'default', icon: Package },
      [ORDER_STATUSES.EN_PREPARATION]: { variant: 'default', icon: Package },
      [ORDER_STATUSES.PRET_EXPEDITION]: { variant: 'default', icon: CheckCircle2 },
      [ORDER_STATUSES.EXPEDIEE]: { variant: 'default', icon: Truck },
      [ORDER_STATUSES.LIVRE]: { variant: 'default', icon: CheckCircle2 },
      [ORDER_STATUSES.ANNULEE]: { variant: 'destructive', icon: XCircle },
      [ORDER_STATUSES.EN_ATTENTE_VALIDATION]: { variant: 'secondary', icon: AlertTriangle },
    };

    const cfg = config[statut] || { variant: 'outline', icon: Package };
    const Icon = cfg.icon;

    return (
      <Badge variant={cfg.variant}>
        <Icon className="w-3 h-3 mr-1" />
        {ORDER_STATUS_LABELS[statut as keyof typeof ORDER_STATUS_LABELS] || statut}
      </Badge>
    );
  };

  return (
    <DashboardLayout>
      <div className="space-y-6">
        {/* Header */}
        <div>
          <div className="flex items-center justify-between">
            <div>
              <h1 className="text-3xl font-bold flex items-center gap-2">
                <Package className="h-8 w-8 text-primary" />
                Central de Commandes
              </h1>
              <p className="text-muted-foreground mt-1">
                Vue centralisée de toutes vos commandes • Multi-sources • Filtres avancés
              </p>
            </div>
            <div className="flex items-center space-x-2">
              <Button variant="outline" size="sm" onClick={() => refetch()}>
                <RefreshCw className="w-4 h-4 mr-2" />
                Actualiser
              </Button>
              <Button variant="outline" size="sm" onClick={handleExportCSV}>
                <Download className="w-4 h-4 mr-2" />
                Exporter CSV
              </Button>
            </div>
          </div>
        </div>

        {/* Stats Cards */}
        <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-sm font-medium flex items-center">
                <Package className="w-4 h-4 mr-2 text-primary" />
                Total Commandes
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">{stats.total}</div>
              <p className="text-xs text-muted-foreground mt-1">
                Avec filtres appliqués
              </p>
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-sm font-medium flex items-center">
                <DollarSign className="w-4 h-4 mr-2 text-green-600" />
                CA Total
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">{stats.caTotal.toFixed(2)} €</div>
              <p className="text-xs text-muted-foreground mt-1">
                Montant total commandes
              </p>
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-sm font-medium flex items-center">
                <TrendingUp className="w-4 h-4 mr-2 text-blue-600" />
                Panier Moyen
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">
                {stats.total > 0 ? (stats.caTotal / stats.total).toFixed(2) : '0.00'} €
              </div>
              <p className="text-xs text-muted-foreground mt-1">
                Par commande
              </p>
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-sm font-medium flex items-center">
                <Globe className="w-4 h-4 mr-2 text-purple-600" />
                Sources Actives
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">
                {stats.parSource.filter(s => s.count > 0).length}
              </div>
              <p className="text-xs text-muted-foreground mt-1">
                Marketplaces connectées
              </p>
            </CardContent>
          </Card>
        </div>

        <Tabs defaultValue="table" className="space-y-4">
          <TabsList>
            <TabsTrigger value="table">
              <Package className="w-4 h-4 mr-2" />
              Vue Tableau
            </TabsTrigger>
            <TabsTrigger value="stats">
              <TrendingUp className="w-4 h-4 mr-2" />
              Statistiques
            </TabsTrigger>
            <TabsTrigger value="sources">
              <Globe className="w-4 h-4 mr-2" />
              Par Source
            </TabsTrigger>
          </TabsList>

          {/* Vue Tableau */}
          <TabsContent value="table" className="space-y-4">
            {/* Filtres */}
            <Card>
              <CardHeader>
                <CardTitle className="text-lg flex items-center">
                  <Filter className="w-5 h-5 mr-2" />
                  Filtres Avancés
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
                  {/* Recherche */}
                  <div className="space-y-2">
                    <Label>Recherche</Label>
                    <div className="relative">
                      <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                      <Input
                        placeholder="N° commande, client, ID..."
                        value={filters.search}
                        onChange={(e) => setFilters({ ...filters, search: e.target.value })}
                        className="pl-10"
                      />
                    </div>
                  </div>

                  {/* Sources */}
                  <div className="space-y-2">
                    <Label>Sources</Label>
                    <Select
                      value={filters.sources[0] || 'all'}
                      onValueChange={(value) =>
                        setFilters({
                          ...filters,
                          sources: value === 'all' ? [] : [value]
                        })
                      }
                    >
                      <SelectTrigger>
                        <SelectValue placeholder="Toutes les sources" />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="all">Toutes les sources</SelectItem>
                        {MARKETPLACE_SOURCES.map(source => (
                          <SelectItem key={source.id} value={source.id}>
                            {source.label}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>

                  {/* Statuts */}
                  <div className="space-y-2">
                    <Label>Statut</Label>
                    <Select
                      value={filters.statuts[0] || 'all'}
                      onValueChange={(value) =>
                        setFilters({
                          ...filters,
                          statuts: value === 'all' ? [] : [value]
                        })
                      }
                    >
                      <SelectTrigger>
                        <SelectValue placeholder="Tous les statuts" />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="all">Tous les statuts</SelectItem>
                        {Object.entries(ORDER_STATUS_LABELS).map(([key, label]) => (
                          <SelectItem key={key} value={key}>
                            {label}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>

                  {/* Montant Min/Max */}
                  <div className="space-y-2">
                    <Label>Montant (€)</Label>
                    <div className="flex items-center space-x-2">
                      <Input
                        type="number"
                        placeholder="Min"
                        value={filters.montantMin || ''}
                        onChange={(e) =>
                          setFilters({
                            ...filters,
                            montantMin: e.target.value ? parseFloat(e.target.value) : undefined
                          })
                        }
                        className="w-20"
                      />
                      <span className="text-muted-foreground">-</span>
                      <Input
                        type="number"
                        placeholder="Max"
                        value={filters.montantMax || ''}
                        onChange={(e) =>
                          setFilters({
                            ...filters,
                            montantMax: e.target.value ? parseFloat(e.target.value) : undefined
                          })
                        }
                        className="w-20"
                      />
                    </div>
                  </div>
                </div>

                {/* Actions de masse */}
                {selectedCommandes.length > 0 && (
                  <div className="flex items-center justify-between p-4 border rounded-lg bg-muted/30">
                    <div className="flex items-center space-x-2">
                      <CheckCircle2 className="w-5 h-5 text-primary" />
                      <span className="font-medium">
                        {selectedCommandes.length} commande(s) sélectionnée(s)
                      </span>
                    </div>
                    <div className="flex items-center space-x-2">
                      <Button size="sm" variant="outline" onClick={handlePrintLabels}>
                        <Printer className="w-4 h-4 mr-2" />
                        Imprimer Étiquettes
                      </Button>
                      <Button size="sm" variant="outline" onClick={handleGenerateCN23}>
                        <FileText className="w-4 h-4 mr-2" />
                        Générer CN23
                      </Button>
                      <Button
                        size="sm"
                        variant="ghost"
                        onClick={() => setSelectedCommandes([])}
                      >
                        Annuler
                      </Button>
                    </div>
                  </div>
                )}
              </CardContent>
            </Card>

            {/* Table */}
            <Card>
              <CardContent className="p-0">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead className="w-12">
                        <Checkbox
                          checked={selectedCommandes.length === (commandesData?.length || 0) && commandesData && commandesData.length > 0}
                          onCheckedChange={toggleSelectAll}
                        />
                      </TableHead>
                      <TableHead>N° Commande</TableHead>
                      <TableHead>Date</TableHead>
                      <TableHead>Source</TableHead>
                      <TableHead>Client</TableHead>
                      <TableHead>Statut</TableHead>
                      <TableHead>Montant</TableHead>
                      <TableHead>Pays</TableHead>
                      <TableHead className="text-right">Actions</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {isLoading ? (
                      <TableRow>
                        <TableCell colSpan={9} className="text-center py-8">
                          <RefreshCw className="w-6 h-6 animate-spin mx-auto mb-2" />
                          <p className="text-muted-foreground">Chargement...</p>
                        </TableCell>
                      </TableRow>
                    ) : commandesData && commandesData.length > 0 ? (
                      commandesData.map((commande) => (
                        <TableRow key={commande.id}>
                          <TableCell>
                            <Checkbox
                              checked={selectedCommandes.includes(commande.id)}
                              onCheckedChange={(checked) => {
                                if (checked) {
                                  setSelectedCommandes([...selectedCommandes, commande.id]);
                                } else {
                                  setSelectedCommandes(selectedCommandes.filter(id => id !== commande.id));
                                }
                              }}
                            />
                          </TableCell>
                          <TableCell className="font-mono font-medium">
                            {commande.numero_commande}
                          </TableCell>
                          <TableCell>
                            {new Date(commande.date_creation).toLocaleDateString('fr-FR', {
                              day: '2-digit',
                              month: '2-digit',
                              year: 'numeric',
                              hour: '2-digit',
                              minute: '2-digit'
                            })}
                          </TableCell>
                          <TableCell>{getSourceBadge(commande.source)}</TableCell>
                          <TableCell>{commande.adresse_nom}</TableCell>
                          <TableCell>{getStatutBadge(commande.statut_wms)}</TableCell>
                          <TableCell className="font-medium">
                            {commande.valeur_totale?.toFixed(2) || '0.00'} €
                          </TableCell>
                          <TableCell>
                            <div className="flex items-center space-x-1">
                              <Globe className="w-3 h-3 text-muted-foreground" />
                              <span className="text-xs">{commande.pays_code || '-'}</span>
                            </div>
                          </TableCell>
                          <TableCell className="text-right">
                            <DropdownMenu>
                              <DropdownMenuTrigger asChild>
                                <Button variant="ghost" size="sm">
                                  <MoreVertical className="w-4 h-4" />
                                </Button>
                              </DropdownMenuTrigger>
                              <DropdownMenuContent align="end">
                                <DropdownMenuLabel>Actions</DropdownMenuLabel>
                                <DropdownMenuItem
                                  onClick={() => {
                                    setSelectedCommande(commande);
                                    setDetailDialogOpen(true);
                                  }}
                                >
                                  <Eye className="w-4 h-4 mr-2" />
                                  Voir détails
                                </DropdownMenuItem>
                                <DropdownMenuSeparator />
                                <DropdownMenuItem>
                                  <Printer className="w-4 h-4 mr-2" />
                                  Imprimer étiquette
                                </DropdownMenuItem>
                                <DropdownMenuItem>
                                  <FileText className="w-4 h-4 mr-2" />
                                  Générer CN23
                                </DropdownMenuItem>
                                <DropdownMenuSeparator />
                                <DropdownMenuItem>
                                  <Archive className="w-4 h-4 mr-2" />
                                  Archiver
                                </DropdownMenuItem>
                              </DropdownMenuContent>
                            </DropdownMenu>
                          </TableCell>
                        </TableRow>
                      ))
                    ) : (
                      <TableRow>
                        <TableCell colSpan={9} className="text-center py-8">
                          <Package className="w-12 h-12 text-muted-foreground mx-auto mb-2" />
                          <p className="text-muted-foreground">Aucune commande trouvée</p>
                        </TableCell>
                      </TableRow>
                    )}
                  </TableBody>
                </Table>
              </CardContent>
            </Card>
          </TabsContent>

          {/* Vue Statistiques */}
          <TabsContent value="stats" className="space-y-4">
            <div className="grid gap-4 md:grid-cols-2">
              <Card>
                <CardHeader>
                  <CardTitle>Commandes par Statut</CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="space-y-3">
                    {stats.parStatut
                      .filter(s => s.count > 0)
                      .map(stat => (
                        <div key={stat.statut} className="flex items-center justify-between">
                          <span className="text-sm">{stat.label}</span>
                          <div className="flex items-center space-x-2">
                            <div className="w-32 h-2 bg-muted rounded-full overflow-hidden">
                              <div
                                className="h-full bg-primary"
                                style={{
                                  width: `${(stat.count / stats.total) * 100}%`
                                }}
                              />
                            </div>
                            <span className="text-sm font-semibold w-12 text-right">
                              {stat.count}
                            </span>
                          </div>
                        </div>
                      ))}
                  </div>
                </CardContent>
              </Card>

              <Card>
                <CardHeader>
                  <CardTitle>Top Sources (CA)</CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="space-y-3">
                    {stats.parSource
                      .filter(s => s.ca > 0)
                      .sort((a, b) => b.ca - a.ca)
                      .slice(0, 5)
                      .map(stat => {
                        const Icon = stat.icon;
                        return (
                          <div key={stat.id} className="flex items-center justify-between">
                            <div className="flex items-center space-x-2">
                              <Icon className="w-4 h-4 text-muted-foreground" />
                              <span className="text-sm">{stat.label}</span>
                            </div>
                            <div className="flex items-center space-x-4">
                              <span className="text-xs text-muted-foreground">
                                {stat.count} cmd
                              </span>
                              <span className="text-sm font-semibold">
                                {stat.ca.toFixed(2)} €
                              </span>
                            </div>
                          </div>
                        );
                      })}
                  </div>
                </CardContent>
              </Card>
            </div>
          </TabsContent>

          {/* Vue Par Source */}
          <TabsContent value="sources" className="space-y-4">
            <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
              {stats.parSource.map(source => {
                const Icon = source.icon;
                return (
                  <Card key={source.id}>
                    <CardHeader className="pb-3">
                      <CardTitle className="text-base flex items-center">
                        <Icon className="w-5 h-5 mr-2" />
                        {source.label}
                      </CardTitle>
                    </CardHeader>
                    <CardContent className="space-y-2">
                      <div className="flex items-center justify-between">
                        <span className="text-sm text-muted-foreground">Commandes:</span>
                        <span className="text-lg font-bold">{source.count}</span>
                      </div>
                      <div className="flex items-center justify-between">
                        <span className="text-sm text-muted-foreground">CA:</span>
                        <span className="text-lg font-bold text-green-600">
                          {source.ca.toFixed(2)} €
                        </span>
                      </div>
                      {source.count > 0 && (
                        <div className="flex items-center justify-between pt-2 border-t">
                          <span className="text-xs text-muted-foreground">Panier moyen:</span>
                          <span className="text-sm font-medium">
                            {(source.ca / source.count).toFixed(2)} €
                          </span>
                        </div>
                      )}
                    </CardContent>
                  </Card>
                );
              })}
            </div>
          </TabsContent>
        </Tabs>
      </div>

      {/* Dialog Détails Commande */}
      <Dialog open={detailDialogOpen} onOpenChange={setDetailDialogOpen}>
        <DialogContent className="max-w-3xl">
          <DialogHeader>
            <DialogTitle>
              Détails Commande {selectedCommande?.numero_commande}
            </DialogTitle>
            <DialogDescription>
              Informations complètes de la commande
            </DialogDescription>
          </DialogHeader>
          {selectedCommande && (
            <div className="space-y-4">
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <Label className="text-xs text-muted-foreground">Source</Label>
                  <div className="mt-1">{getSourceBadge(selectedCommande.source)}</div>
                </div>
                <div>
                  <Label className="text-xs text-muted-foreground">Statut</Label>
                  <div className="mt-1">{getStatutBadge(selectedCommande.statut_wms)}</div>
                </div>
                <div>
                  <Label className="text-xs text-muted-foreground">Client</Label>
                  <p className="text-sm font-medium mt-1">{selectedCommande.adresse_nom}</p>
                </div>
                <div>
                  <Label className="text-xs text-muted-foreground">Montant</Label>
                  <p className="text-sm font-medium mt-1">
                    {selectedCommande.valeur_totale?.toFixed(2) || '0.00'} €
                  </p>
                </div>
              </div>
            </div>
          )}
        </DialogContent>
      </Dialog>
    </DashboardLayout>
  );
}
