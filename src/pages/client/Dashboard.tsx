import { useEffect, useState } from "react";
import { Link, useSearchParams } from "react-router-dom";
import { DashboardLayout } from "@/components/DashboardLayout";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import { Package, ShoppingCart, TrendingUp, AlertTriangle, Plus, PackageOpen, Undo2, Boxes, ClipboardList, Warehouse } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { toast } from "@/hooks/use-toast";

export default function ClientDashboard() {
  const { user, userRole } = useAuth();
  const [searchParams] = useSearchParams();
  const [stats, setStats] = useState({
    totalProduits: 0,
    commandesEnCours: 0,
    stockTotal: 0,
    alertesStock: 0,
  });
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetchStats();
  }, [user, searchParams]);

  const fetchStats = async () => {
    try {
      if (!user) return;

      const asClient = searchParams.get('asClient');
      let clientId: string | null = asClient;

      if (!clientId) {
        // Get client_id from profile
        const { data: profile } = await supabase
          .from("profiles")
          .select("client_id")
          .eq("id", user.id)
          .single();
        clientId = profile?.client_id || null;
      }

      if (!clientId) {
        // Si admin/gestionnaire sans client lié, prendre le premier client actif par défaut
        if (userRole === 'admin' || userRole === 'gestionnaire') {
          const { data: firstClients } = await supabase
            .from('client' as any)
            .select('id')
            .eq('actif', true)
            .order('nom_entreprise', { ascending: true })
            .limit(1);
          clientId = (firstClients as any)?.[0]?.id || null;
        }
      }

      if (!clientId) {
        toast({
          title: "Erreur",
          description: "Aucun client sélectionné. Ajoutez ?asClient=<client_id> à l’URL ou reliez un profil.",
          variant: "destructive",
        });
        return;
      }

      // Fetch products count
      const { count: produitsCount } = await supabase
        .from("produit")
        .select("*", { count: "exact", head: true })
        .eq("client_id", clientId)
        .eq("statut_actif", true);

      // Fetch orders in progress
      const { count: commandesCount } = await supabase
        .from("commande")
        .select("*", { count: "exact", head: true })
        .eq("client_id", clientId)
        .in("statut_wms", ["En attente de réappro", "Prêt à préparer", "En préparation"]);

      // Fetch total stock - get product IDs first then query stock
      const { data: produitsData } = await supabase
        .from("produit")
        .select("id")
        .eq("client_id", clientId);

      const produitIds = produitsData?.map(p => p.id) || [];

      let stockTotal = 0;
      if (produitIds.length > 0) {
        const { data: stockData } = await supabase
          .from("stock_disponible")
          .select("stock_actuel")
          .in("produit_id", produitIds);

        stockTotal = stockData?.reduce((sum, item) => sum + (item.stock_actuel || 0), 0) || 0;
      }

      // Fetch stock alerts
      const { count: alertesCount } = await supabase
        .from("produit")
        .select("*", { count: "exact", head: true })
        .eq("client_id", clientId)
        .lt("stock_actuel", "stock_minimum");

      setStats({
        totalProduits: produitsCount || 0,
        commandesEnCours: commandesCount || 0,
        stockTotal,
        alertesStock: alertesCount || 0,
      });
    } catch (error: any) {
      console.error("Error fetching stats:", error);
      toast({
        title: "Erreur",
        description: "Impossible de charger les statistiques",
        variant: "destructive",
      });
    } finally {
      setLoading(false);
    }
  };

  return (
    <DashboardLayout>
      <div className="space-y-6">
        <div>
          <h1 className="text-3xl font-bold tracking-tight">Espace Client</h1>
          <p className="text-muted-foreground">
            Vue d'ensemble et accès rapide à vos opérations
          </p>
        </div>

        <Tabs defaultValue="commandes" className="w-full">
          <TabsList className="grid w-full grid-cols-5">
            <TabsTrigger value="commandes" className="gap-2"><ClipboardList className="h-4 w-4" /> Commandes</TabsTrigger>
            <TabsTrigger value="produits" className="gap-2"><Boxes className="h-4 w-4" /> Produits</TabsTrigger>
            <TabsTrigger value="retours" className="gap-2"><Undo2 className="h-4 w-4" /> Retours</TabsTrigger>
            <TabsTrigger value="stocks" className="gap-2"><Warehouse className="h-4 w-4" /> Stocks</TabsTrigger>
            <TabsTrigger value="attendus" className="gap-2"><PackageOpen className="h-4 w-4" /> Attendus</TabsTrigger>
          </TabsList>

          <TabsContent value="commandes" className="space-y-6">
            {/* Stats commandes */}
            <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
              <Link to="/client/commandes">
                <Card className="cursor-pointer hover:shadow-lg transition-shadow">
                  <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                    <CardTitle className="text-sm font-medium">Commandes en cours</CardTitle>
                    <ShoppingCart className="h-4 w-4 text-muted-foreground" />
                  </CardHeader>
                  <CardContent>
                    <div className="text-2xl font-bold">{stats.commandesEnCours}</div>
                    <p className="text-xs text-muted-foreground">En préparation/attente</p>
                  </CardContent>
                </Card>
              </Link>
            </div>

            {/* Actions commandes */}
            <div>
              <h2 className="text-xl font-semibold mb-4">Actions rapides</h2>
              <div className="grid gap-4 md:grid-cols-3">
                <Link to="/client/commandes/creer">
                  <Button className="w-full h-24 text-lg" size="lg">
                    <Plus className="mr-2 h-5 w-5" />
                    Créer une commande
                  </Button>
                </Link>
                <Link to="/client/reception">
                  <Button className="w-full h-24 text-lg" size="lg" variant="secondary">
                    <PackageOpen className="mr-2 h-5 w-5" />
                    Annoncer une réception
                  </Button>
                </Link>
                <Link to="/client/retours">
                  <Button className="w-full h-24 text-lg" size="lg" variant="outline">
                    <Undo2 className="mr-2 h-5 w-5" />
                    Déclarer un retour
                  </Button>
                </Link>
              </div>
            </div>
          </TabsContent>

          <TabsContent value="produits" className="space-y-6">
            <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
              <Link to="/client/produits">
                <Card className="cursor-pointer hover:shadow-lg transition-shadow">
                  <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                    <CardTitle className="text-sm font-medium">Mes Produits</CardTitle>
                    <Package className="h-4 w-4 text-muted-foreground" />
                  </CardHeader>
                  <CardContent>
                    <div className="text-2xl font-bold">{stats.totalProduits}</div>
                    <p className="text-xs text-muted-foreground">Références actives</p>
                  </CardContent>
                </Card>
              </Link>

              <Link to="/client/produits">
                <Card className="cursor-pointer hover:shadow-lg transition-shadow">
                  <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                    <CardTitle className="text-sm font-medium">Alertes Stock</CardTitle>
                    <AlertTriangle className="h-4 w-4 text-muted-foreground" />
                  </CardHeader>
                  <CardContent>
                    <div className="text-2xl font-bold text-destructive">{stats.alertesStock}</div>
                    <p className="text-xs text-muted-foreground">Produits sous seuil</p>
                  </CardContent>
                </Card>
              </Link>
            </div>
          </TabsContent>

          <TabsContent value="retours" className="space-y-6">
            <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
              <Link to="/client/retours">
                <Card className="cursor-pointer hover:shadow-lg transition-shadow">
                  <CardHeader>
                    <CardTitle className="flex items-center gap-2">
                      <Undo2 className="h-4 w-4" /> Mes Retours
                    </CardTitle>
                  </CardHeader>
                  <CardContent>
                    Consultez et suivez vos retours produits.
                  </CardContent>
                </Card>
              </Link>
            </div>
          </TabsContent>

          <TabsContent value="stocks" className="space-y-6">
            <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
              <Link to="/client/produits">
                <Card className="cursor-pointer hover:shadow-lg transition-shadow">
                  <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                    <CardTitle className="text-sm font-medium">Stock Total</CardTitle>
                    <TrendingUp className="h-4 w-4 text-muted-foreground" />
                  </CardHeader>
                  <CardContent>
                    <div className="text-2xl font-bold">{stats.stockTotal}</div>
                    <p className="text-xs text-muted-foreground">Unités en stock</p>
                  </CardContent>
                </Card>
              </Link>
            </div>
          </TabsContent>

          <TabsContent value="attendus" className="space-y-6">
            <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
              <Link to="/client/reception">
                <Card className="cursor-pointer hover:shadow-lg transition-shadow">
                  <CardHeader>
                    <CardTitle className="flex items-center gap-2">
                      <PackageOpen className="h-4 w-4" /> Attendus de Réception
                    </CardTitle>
                  </CardHeader>
                  <CardContent>
                    Annoncez et suivez vos réceptions prévues.
                  </CardContent>
                </Card>
              </Link>
            </div>
          </TabsContent>
        </Tabs>
      </div>
    </DashboardLayout>
  );
}
