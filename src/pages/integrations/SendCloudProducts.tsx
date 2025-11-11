import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { DashboardLayout } from "@/components/DashboardLayout";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { RefreshCw, Download, AlertTriangle, Check, Clock, XCircle, Loader2 } from "lucide-react";
import { format } from "date-fns";
import { fr } from "date-fns/locale";

export default function SendCloudProducts() {
  const [syncing, setSyncing] = useState(false);
  const [reconciling, setReconciling] = useState(false);

  // Fetch sync stats
  const { data: stats, refetch: refetchStats } = useQuery({
    queryKey: ["sendcloud-sync-stats"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("sendcloud_product_sync_stats" as any)
        .select("*")
        .single();
      
      if (error) throw error;
      return data as any;
    },
  });

  // Fetch mapped products
  const { data: mappedProducts, refetch: refetchProducts } = useQuery({
    queryKey: ["sendcloud-product-mapping"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("sendcloud_product_mapping" as any)
        .select(`
          *,
          produit:produit_id (
            id,
            reference,
            nom,
            stock_actuel,
            client_id
          )
        `)
        .order("last_sync_at", { ascending: false });
      
      if (error) throw error;
      return data as any[];
    },
  });

  // Fetch stock discrepancies
  const { data: discrepancies, refetch: refetchDiscrepancies } = useQuery({
    queryKey: ["sendcloud-stock-discrepancies"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("sendcloud_stock_ecarts_actifs" as any)
        .select("*")
        .order("ecart", { ascending: false });
      
      if (error) throw error;
      return data as any[];
    },
  });

  // Fetch sync errors
  const { data: syncErrors, refetch: refetchErrors } = useQuery({
    queryKey: ["sendcloud-sync-errors"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("sendcloud_sync_errors" as any)
        .select("*")
        .eq("entity_type", "product")
        .eq("resolved", false)
        .order("created_at", { ascending: false })
        .limit(20);
      
      if (error) throw error;
      return data as any[];
    },
  });

  const handleSyncAll = async () => {
    setSyncing(true);
    try {
      const { data, error } = await supabase.functions.invoke("sendcloud-sync-products", {
        body: { sync_all: true },
      });

      if (error) throw error;

      toast.success(`Synchronisation terminée : ${data.synced} produits synchronisés`);
      refetchStats();
      refetchProducts();
    } catch (error) {
      console.error("Error syncing products:", error);
      toast.error("Erreur lors de la synchronisation");
    } finally {
      setSyncing(false);
    }
  };

  const handleImportFromSendCloud = async () => {
    setSyncing(true);
    try {
      const { data, error } = await supabase.functions.invoke("sendcloud-import-products");

      if (error) throw error;

      toast.success(
        `Import terminé : ${data.created} créés, ${data.updated} mis à jour`
      );
      refetchStats();
      refetchProducts();
    } catch (error) {
      console.error("Error importing products:", error);
      toast.error("Erreur lors de l'import");
    } finally {
      setSyncing(false);
    }
  };

  const handleReconcileStock = async () => {
    setReconciling(true);
    try {
      const { data, error } = await supabase.functions.invoke("sendcloud-import-stock", {
        body: { threshold_percent: 10 },
      });

      if (error) throw error;

      if (data.discrepancies > 0) {
        toast.warning(
          `${data.discrepancies} écart(s) de stock détecté(s) sur ${data.checked} produits`
        );
      } else {
        toast.success(`Tous les stocks sont synchronisés (${data.checked} produits vérifiés)`);
      }

      refetchDiscrepancies();
    } catch (error) {
      console.error("Error reconciling stock:", error);
      toast.error("Erreur lors de la réconciliation");
    } finally {
      setReconciling(false);
    }
  };

  const getSyncStatusBadge = (status: string) => {
    switch (status) {
      case "synced":
        return <Badge variant="default" className="gap-1"><Check className="h-3 w-3" /> Synchronisé</Badge>;
      case "pending":
        return <Badge variant="secondary" className="gap-1"><Clock className="h-3 w-3" /> En attente</Badge>;
      case "error":
        return <Badge variant="destructive" className="gap-1"><XCircle className="h-3 w-3" /> Erreur</Badge>;
      default:
        return <Badge variant="outline">{status}</Badge>;
    }
  };

  return (
    <DashboardLayout>
      <div className="space-y-6">
        {/* Header */}
        <div className="flex justify-between items-start">
          <div>
            <h1 className="text-3xl font-bold">Synchronisation Produits SendCloud</h1>
            <p className="text-muted-foreground mt-2">
              Gestion bidirectionnelle des produits et stocks entre le WMS et SendCloud
            </p>
          </div>
          <div className="flex gap-2">
            <Button
              onClick={handleSyncAll}
              disabled={syncing}
              className="gap-2"
            >
              {syncing ? <Loader2 className="h-4 w-4 animate-spin" /> : <RefreshCw className="h-4 w-4" />}
              Sync WMS → SendCloud
            </Button>
            <Button
              onClick={handleImportFromSendCloud}
              disabled={syncing}
              variant="secondary"
              className="gap-2"
            >
              {syncing ? <Loader2 className="h-4 w-4 animate-spin" /> : <Download className="h-4 w-4" />}
              Import SendCloud → WMS
            </Button>
          </div>
        </div>

        {/* Stats Cards */}
        <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
          <Card>
            <CardHeader className="pb-3">
              <CardTitle className="text-sm font-medium">Produits Mappés</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">{stats?.total_produits_mappes || 0}</div>
              <p className="text-xs text-muted-foreground mt-1">Total synchronisés</p>
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="pb-3">
              <CardTitle className="text-sm font-medium">Synchronisés</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold text-green-600">{stats?.produits_synchronises || 0}</div>
              <p className="text-xs text-muted-foreground mt-1">À jour</p>
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="pb-3">
              <CardTitle className="text-sm font-medium">En Erreur</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold text-red-600">{stats?.produits_en_erreur || 0}</div>
              <p className="text-xs text-muted-foreground mt-1">Nécessitent attention</p>
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="pb-3">
              <CardTitle className="text-sm font-medium">Dernière Sync</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="text-sm font-medium">
                {stats?.derniere_sync
                  ? format(new Date(stats.derniere_sync), "dd MMM à HH:mm", { locale: fr })
                  : "Jamais"}
              </div>
              <p className="text-xs text-muted-foreground mt-1">Heure de sync</p>
            </CardContent>
          </Card>
        </div>

        {/* Tabs */}
        <Tabs defaultValue="products" className="space-y-4">
          <TabsList>
            <TabsTrigger value="products">Produits Mappés</TabsTrigger>
            <TabsTrigger value="discrepancies" className="gap-2">
              Écarts de Stock
              {discrepancies && discrepancies.length > 0 && (
                <Badge variant="destructive" className="ml-1">{discrepancies.length}</Badge>
              )}
            </TabsTrigger>
            <TabsTrigger value="errors" className="gap-2">
              Erreurs
              {syncErrors && syncErrors.length > 0 && (
                <Badge variant="destructive" className="ml-1">{syncErrors.length}</Badge>
              )}
            </TabsTrigger>
          </TabsList>

          {/* Products Tab */}
          <TabsContent value="products" className="space-y-4">
            <Card>
              <CardHeader>
                <CardTitle>Produits Synchronisés</CardTitle>
                <CardDescription>
                  Liste des produits mappés entre le WMS et SendCloud
                </CardDescription>
              </CardHeader>
              <CardContent>
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>SKU / Référence</TableHead>
                      <TableHead>Nom Produit</TableHead>
                      <TableHead>Stock WMS</TableHead>
                      <TableHead>Statut Sync</TableHead>
                      <TableHead>Dernière Sync</TableHead>
                      <TableHead>SendCloud ID</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {mappedProducts && mappedProducts.length > 0 ? (
                      mappedProducts.map((mapping: any) => (
                        <TableRow key={mapping.id}>
                          <TableCell className="font-medium">{mapping.sendcloud_sku}</TableCell>
                          <TableCell>{mapping.produit?.nom || "-"}</TableCell>
                          <TableCell>{mapping.produit?.stock_actuel || 0}</TableCell>
                          <TableCell>{getSyncStatusBadge(mapping.sync_status)}</TableCell>
                          <TableCell className="text-sm text-muted-foreground">
                            {format(new Date(mapping.last_sync_at), "dd/MM/yyyy HH:mm")}
                          </TableCell>
                          <TableCell className="text-xs text-muted-foreground">
                            {mapping.sendcloud_product_id}
                          </TableCell>
                        </TableRow>
                      ))
                    ) : (
                      <TableRow>
                        <TableCell colSpan={6} className="text-center text-muted-foreground">
                          Aucun produit synchronisé
                        </TableCell>
                      </TableRow>
                    )}
                  </TableBody>
                </Table>
              </CardContent>
            </Card>
          </TabsContent>

          {/* Discrepancies Tab */}
          <TabsContent value="discrepancies" className="space-y-4">
            <Card>
              <CardHeader className="flex flex-row items-center justify-between">
                <div>
                  <CardTitle>Écarts de Stock</CardTitle>
                  <CardDescription>
                    Différences de stock détectées entre le WMS et SendCloud
                  </CardDescription>
                </div>
                <Button
                  onClick={handleReconcileStock}
                  disabled={reconciling}
                  variant="outline"
                  className="gap-2"
                >
                  {reconciling ? <Loader2 className="h-4 w-4 animate-spin" /> : <RefreshCw className="h-4 w-4" />}
                  Vérifier les Stocks
                </Button>
              </CardHeader>
              <CardContent>
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Référence</TableHead>
                      <TableHead>Nom Produit</TableHead>
                      <TableHead>Stock WMS</TableHead>
                      <TableHead>Stock SendCloud</TableHead>
                      <TableHead>Écart</TableHead>
                      <TableHead>% Écart</TableHead>
                      <TableHead>Détecté le</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {discrepancies && discrepancies.length > 0 ? (
                      discrepancies.map((disc: any) => (
                        <TableRow key={disc.id}>
                          <TableCell className="font-medium">{disc.produit_reference}</TableCell>
                          <TableCell>{disc.produit_nom}</TableCell>
                          <TableCell>{disc.stock_wms}</TableCell>
                          <TableCell>{disc.stock_sendcloud}</TableCell>
                          <TableCell>
                            <Badge variant={disc.ecart > 0 ? "default" : "destructive"}>
                              {disc.ecart > 0 ? "+" : ""}{disc.ecart}
                            </Badge>
                          </TableCell>
                          <TableCell>{disc.pourcentage_ecart?.toFixed(1)}%</TableCell>
                          <TableCell className="text-sm text-muted-foreground">
                            {format(new Date(disc.date_detection), "dd/MM/yyyy HH:mm")}
                          </TableCell>
                        </TableRow>
                      ))
                    ) : (
                      <TableRow>
                        <TableCell colSpan={7} className="text-center text-muted-foreground">
                          <div className="py-8">
                            <Check className="h-12 w-12 mx-auto mb-2 text-green-600" />
                            <p>Tous les stocks sont synchronisés !</p>
                          </div>
                        </TableCell>
                      </TableRow>
                    )}
                  </TableBody>
                </Table>
              </CardContent>
            </Card>
          </TabsContent>

          {/* Errors Tab */}
          <TabsContent value="errors" className="space-y-4">
            <Card>
              <CardHeader>
                <CardTitle>Erreurs de Synchronisation</CardTitle>
                <CardDescription>
                  Problèmes rencontrés lors de la synchronisation avec SendCloud
                </CardDescription>
              </CardHeader>
              <CardContent>
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Type</TableHead>
                      <TableHead>Opération</TableHead>
                      <TableHead>Message d'Erreur</TableHead>
                      <TableHead>Tentatives</TableHead>
                      <TableHead>Date</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {syncErrors && syncErrors.length > 0 ? (
                      syncErrors.map((error: any) => (
                        <TableRow key={error.id}>
                          <TableCell>
                            <Badge variant="outline">{error.entity_type}</Badge>
                          </TableCell>
                          <TableCell>{error.operation}</TableCell>
                          <TableCell className="max-w-md truncate">{error.error_message}</TableCell>
                          <TableCell>
                            <Badge variant={error.retry_count >= error.max_retries ? "destructive" : "secondary"}>
                              {error.retry_count} / {error.max_retries}
                            </Badge>
                          </TableCell>
                          <TableCell className="text-sm text-muted-foreground">
                            {format(new Date(error.created_at), "dd/MM/yyyy HH:mm")}
                          </TableCell>
                        </TableRow>
                      ))
                    ) : (
                      <TableRow>
                        <TableCell colSpan={5} className="text-center text-muted-foreground">
                          <div className="py-8">
                            <Check className="h-12 w-12 mx-auto mb-2 text-green-600" />
                            <p>Aucune erreur de synchronisation !</p>
                          </div>
                        </TableCell>
                      </TableRow>
                    )}
                  </TableBody>
                </Table>
              </CardContent>
            </Card>
          </TabsContent>
        </Tabs>
      </div>
    </DashboardLayout>
  );
}
